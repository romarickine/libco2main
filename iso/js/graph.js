// ==========================================================================
// Graphe : parsing des tronçons BD TOPO® (GeoJSON WFS), construction
// d'adjacence par mode
// ==========================================================================
import { toblerWalkingSpeed, parkinRotheramCyclingSpeed, BDTOPO_DEFAULT_SPEED, BDTOPO_DEFAULT_SPEED_FALLBACK, BDTOPO_CAR_EXCLUDED_NATURES } from './speed-models.js';

const EARTH_RADIUS = 6371000;
export function haversineMeters(lon1, lat1, lon2, lat2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// La BD TOPO® ne fournit pas d'identifiant de nœud de carrefour (contrairement
// à OSM) : on identifie chaque nœud par ses coordonnées arrondies.
// Appariement spatial par voisinage plutôt qu'un simple arrondi de
// coordonnées : un arrondi, même à 1m, s'est révélé insuffisant en pratique
// (9% de connexité brute observée sur un vrai réseau — 91% du réseau
// téléchargé topologiquement inaccessible depuis l'origine). Cette approche
// cherche, pour chaque point, un nœud existant à moins de `toleranceMeters`
// (recherche dans les cellules voisines d'une grille, pas seulement la même
// cellule arrondie), ce qui absorbe des écarts plus importants entre
// tronçons censés se toucher — au prix d'un risque, si la tolérance est trop
// grande, de fusionner à tort deux intersections réellement distinctes très
// proches l'une de l'autre.
function createNodeSnapper(toleranceMeters) {
  const mPerDegLat = 111320;
  const buckets = new Map();
  const nodeCoords = new Map();
  let nextId = 0;

  function cellSize(lat) {
    const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
    return [toleranceMeters / mPerDegLon, toleranceMeters / mPerDegLat];
  }

  return {
    nodeCoords,
    snap(lon, lat) {
      const [cellW, cellH] = cellSize(lat);
      const cx = Math.floor(lon / cellW), cy = Math.floor(lat / cellH);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = buckets.get((cx + dx) + '_' + (cy + dy));
          if (!bucket) { continue; }
          for (const cand of bucket) {
            if (haversineMeters(lon, lat, cand.lon, cand.lat) <= toleranceMeters) { return cand.id; }
          }
        }
      }
      const id = nextId++;
      const key = cx + '_' + cy;
      if (!buckets.has(key)) { buckets.set(key, []); }
      buckets.get(key).push({ id, lon, lat });
      nodeCoords.set(id, [lon, lat]);
      return id;
    },
  };
}

export function parseIGNRoadsToGraph(featureCollection, nodeSnapTolerance) {
  const snapper = createNodeSnapper(nodeSnapTolerance);
  const edges = [];
  for (const feature of featureCollection.features || []) {
    const props = feature.properties || {};
    const geom = feature.geometry;
    if (!geom) { continue; }
    const lineStrings = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : [];
    const nature = props.nature || '';
    const sens = props.sens_de_circulation || props.sens || 'Double sens';
    const vitesse = props.vitesse_moyenne_vl || props.vit_moy_vl || null;
    const accesVL = props.acces_vehicule_leger || props.acces_vl || null;
    // Couverture incomplète : cet attribut n'est renseigné par l'IGN que
    // lorsqu'un partenaire a fourni l'information — son absence ne garantit
    // donc PAS qu'une voie est publique, seule sa présence à vrai est fiable.
    const prive = props.prive === true || props.prive === 'Vrai' || props.privee === true || props.privee === 'Vrai';
    for (const coords of lineStrings) {
      for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        const idA = snapper.snap(lon1, lat1), idB = snapper.snap(lon2, lat2);
        const length = haversineMeters(lon1, lat1, lon2, lat2);
        if (length <= 0 || idA === idB) { continue; }
        edges.push({ from: idA, to: idB, length, nature, sens, vitesse, accesVL, prive });
      }
    }
  }
  return { nodeCoords: snapper.nodeCoords, edges };
}

export function isEdgeUsable(edge, mode) {
  // Exclusion pour tous les modes quand l'IGN a explicitement codé la voie
  // comme privée. Couverture incomplète (voir plus haut) : ça écarte les cas
  // connus, mais ne garantit pas l'absence de chemins privés non signalés.
  if (edge.prive) { return false; }
  if (mode === 'car') {
    if (BDTOPO_CAR_EXCLUDED_NATURES.has(edge.nature)) { return false; }
    if (edge.accesVL === 'Physiquement impossible') { return false; }
    return true;
  }
  // Marche et vélo : autorisés partout, seule limite = vitesse de la voie.
  // Au-delà de 110 km/h, c'est une voie à caractère autoroutier où la
  // circulation à pied/vélo est en pratique interdite ou dangereuse ; en
  // dessous, on suppose un accès possible (bas-côté, trottoir, ou simple
  // tolérance) plutôt que d'exclure par nature, ce qui coupait parfois le
  // réseau cyclable à tort (ex. bretelles ou voies rapides urbaines à vitesse
  // modérée) et bornait artificiellement les zones vélo/VAE au même endroit.
  const speedKmh = edge.vitesse || BDTOPO_DEFAULT_SPEED[edge.nature] || BDTOPO_DEFAULT_SPEED_FALLBACK;
  return speedKmh <= 110;
}

// Pénalité de franchissement de carrefour : quelques secondes ajoutées à
// chaque nœud où au moins 3 rues se croisent (un vrai carrefour, pas un
// simple sommet de forme le long d'une rue qui tourne). Ça matérialise
// l'écart entre vitesse de croisière (celle des formules Tobler/Parkin-
// Rotheram, mesurées en roulement) et vitesse moyenne de trajet réelle,
// plus faible à cause des arrêts/ralentissements aux intersections.
//
// Plutôt que de classer les zones "urbaine/rurale" à la main, cette pénalité
// reproduit l'effet naturellement : une zone dense a mécaniquement plus de
// carrefours au km, donc une vitesse moyenne de trajet mécaniquement plus
// basse, sans avoir besoin de deviner un indice d'urbanité en plus.
//
// Approximation assumée : faute de données sur le type de régulation de
// chaque carrefour (feu, stop, cédez-le-passage, rond-point — présentes dans
// la couche BD TOPO® "noeud_routier", non récupérée ici), on applique une
// valeur moyenne forfaitaire par mode plutôt qu'une valeur par carrefour réel.
const JUNCTION_DELAY_SECONDS = { car: 6, walk: 2, bike: 4, ebike: 4 };

export function computeNodeDegrees(graph) {
  const degrees = new Map();
  for (const edge of graph.edges) {
    degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
  }
  return degrees;
}

// Pénalité de vitesse selon la nature de la surface — jusqu'ici absente du
// modèle marche/vélo/VAE, qui ne dépendait que de la pente. Un chemin de
// terre ou un sentier ralentit réellement un vélo (roulement moins efficace,
// terrain irrégulier), bien plus qu'un piéton. Valeurs estimées par ordre de
// grandeur (pas de régression publiée spécifique trouvée) : à ajuster si vous
// avez une meilleure source. Absent de cette table = route classique, aucune
// pénalité.
const SURFACE_SPEED_FACTOR = {
  bike: { 'Route empierrée': 0.75, 'Chemin': 0.55, 'Sentier': 0.35 },
  ebike: { 'Route empierrée': 0.8, 'Chemin': 0.6, 'Sentier': 0.4 },
  walk: { 'Route empierrée': 0.95, 'Chemin': 0.9, 'Sentier': 1.0 },
};
function surfaceFactor(nature, mode) {
  const table = SURFACE_SPEED_FACTOR[mode];
  return (table && table[nature]) || 1.0;
}

export function buildAdjacency(graph, elevations, mode, nodeDegrees) {
  const adjacency = new Map();
  const junctionDelay = JUNCTION_DELAY_SECONDS[mode] || 0;
  const addDirected = (from, to, cost) => {
    if (!adjacency.has(from)) { adjacency.set(from, []); }
    const delay = (nodeDegrees.get(to) || 0) >= 3 ? junctionDelay : 0;
    adjacency.get(from).push({ to, cost: cost + delay });
  };
  for (const edge of graph.edges) {
    if (!isEdgeUsable(edge, mode)) { continue; }
    const elevA = elevations.get(edge.from) ?? 0;
    const elevB = elevations.get(edge.to) ?? 0;
    // Plafonnée à ±35% : au-delà, c'est presque toujours une anomalie de
    // données (décalage d'altimétrie, valeur aberrante) plutôt qu'une vraie
    // pente de rue — sans ce garde-fou, une seule valeur d'altitude fausse
    // peut réduire la vitesse calculée à quasi zéro sur les arêtes voisines et
    // effondrer tout le calcul (zones réduites à quelques hexagones).
    const rawGrade = (elevB - elevA) / edge.length;
    const grade = Math.max(-0.35, Math.min(0.35, rawGrade));

    let costForward, costBackward;
    if (mode === 'car') {
      const speedKmh = edge.vitesse || BDTOPO_DEFAULT_SPEED[edge.nature] || BDTOPO_DEFAULT_SPEED_FALLBACK;
      const cost = edge.length / (speedKmh * 1000 / 3600);
      costForward = cost; costBackward = cost;
    } else if (mode === 'walk') {
      const factor = surfaceFactor(edge.nature, 'walk');
      costForward = edge.length / (toblerWalkingSpeed(grade) * factor * 1000 / 3600);
      costBackward = edge.length / (toblerWalkingSpeed(-grade) * factor * 1000 / 3600);
    } else {
      const isElectric = mode === 'ebike';
      const factor = surfaceFactor(edge.nature, mode);
      costForward = edge.length / (parkinRotheramCyclingSpeed(grade, isElectric) * factor * 1000 / 3600);
      costBackward = edge.length / (parkinRotheramCyclingSpeed(-grade, isElectric) * factor * 1000 / 3600);
    }

    // Le sens de circulation (SENS) de la BD TOPO® est défini pour les
    // véhicules légers uniquement — on ne l'applique donc qu'à la voiture ;
    // la marche et le vélo restent supposés bidirectionnels sur chaque tronçon.
    const forwardOnly = mode === 'car' && edge.sens === 'Sens direct';
    const backwardOnly = mode === 'car' && edge.sens === 'Sens inverse';
    if (!backwardOnly) { addDirected(edge.from, edge.to, costForward); }
    if (!forwardOnly) { addDirected(edge.to, edge.from, costBackward); }
  }
  return adjacency;
}

export function findNearestNode(graph, lon, lat) {
  let best = null, bestDist = Infinity;
  for (const [id, [nlon, nlat]] of graph.nodeCoords) {
    const d = haversineMeters(lon, lat, nlon, nlat);
    if (d < bestDist) { bestDist = d; best = id; }
  }
  return best;
}

/**
 * Diagnostic : parcourt le graphe BRUT (toutes les arêtes, sans aucun filtre
 * de mode/vitesse/accès) depuis l'origine, pour vérifier si le réseau
 * lui-même est déjà fragmenté à cet endroit — un problème de données/topologie
 * indépendant de toute logique de filtrage par mode.
 */
export function checkRawConnectivity(graph, originNode) {
  const undirected = new Map();
  const addEdge = (a, b) => {
    if (!undirected.has(a)) { undirected.set(a, []); }
    undirected.get(a).push(b);
  };
  for (const edge of graph.edges) { addEdge(edge.from, edge.to); addEdge(edge.to, edge.from); }
  const visited = new Set([originNode]);
  const queue = [originNode];
  while (queue.length > 0) {
    const u = queue.shift();
    for (const to of (undirected.get(u) || [])) {
      if (!visited.has(to)) { visited.add(to); queue.push(to); }
    }
  }
  return { reachable: visited.size, total: graph.nodeCoords.size };
}

/**
 * Parcours en largeur depuis l'origine, restreint aux nœuds où le mode actif
 * bat la voiture (mode_time(n) < car_time(n) + pénalité). Essentiel pour
 * obtenir une zone cohérente avec le point de départ plutôt que d'inclure des
 * îlots isolés qui satisferaient le critère localement sans y être reliés par
 * un chemin continûment gagnant — c'est l'esprit même de "faire grandir la
 * zone depuis le point de départ" de l'algorithme original.
 */
export function connectedWinningNodes(adjacencyMode, modeTimes, carTimes, originNode, carPenalty) {
  const nodeWins = (n) => {
    const mt = modeTimes.get(n);
    if (mt === undefined) { return false; }
    const ct = carTimes.get(n);
    const carTime = ct === undefined ? Infinity : ct + carPenalty;
    return mt < carTime;
  };
  const visited = new Set([originNode]);
  const queue = [originNode];
  while (queue.length > 0) {
    const u = queue.shift();
    const neighbors = adjacencyMode.get(u) || [];
    for (const { to } of neighbors) {
      if (visited.has(to)) { continue; }
      if (!nodeWins(to)) { continue; }
      visited.add(to);
      queue.push(to);
    }
  }
  return visited;
}

/**
 * Diagnostic : pour chaque arête à la frontière de la zone gagnante (un bout
 * dans winningNodes, l'autre non), détermine POURQUOI le mode ne va pas plus
 * loin à cet endroit — arête exclue par le filtre de vitesse, nœud voisin
 * situé hors du budget-temps du mode, ou la voiture qui gagne réellement à
 * partir de là. Permet de distinguer une vraie limite face à la voiture d'une
 * simple coupure du réseau disponible.
 */
export function analyzeFrontier(graph, mode, winningNodes, modeTimes, carTimes, carPenalty) {
  const counts = { excludedByFilter: 0, beyondTimeBudget: 0, carWins: 0, other: 0 };
  const seenPairs = new Set();
  for (const edge of graph.edges) {
    const fromIn = winningNodes.has(edge.from), toIn = winningNodes.has(edge.to);
    if (fromIn === toIn) { continue; } // pas une arête de frontière (les deux dedans ou les deux dehors)
    const insideNode = fromIn ? edge.from : edge.to;
    const outsideNode = fromIn ? edge.to : edge.from;
    const pairKey = insideNode < outsideNode ? insideNode + '|' + outsideNode : outsideNode + '|' + insideNode;
    if (seenPairs.has(pairKey)) { continue; }
    seenPairs.add(pairKey);

    if (!isEdgeUsable(edge, mode)) { counts.excludedByFilter++; continue; }
    const mt = modeTimes.get(outsideNode);
    if (mt === undefined) { counts.beyondTimeBudget++; continue; }
    const ct = carTimes.get(outsideNode);
    const carTime = ct === undefined ? Infinity : ct + carPenalty;
    if (mt >= carTime) { counts.carWins++; } else { counts.other++; }
  }
  return counts;
}
