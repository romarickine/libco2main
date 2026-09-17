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
  // Bac et liaisons maritimes : exclus pour tous les modes. Ni la marche ni
  // le vélo ne peuvent traverser l'eau, et même en voiture une traversée en
  // bac implique une attente d'horaire non modélisée — la BD TOPO® les code
  // comme un tronçon de route ordinaire (nature = "Bac ou liaison
  // maritime"), ce qui laissait le tracé vélo/VAE longer la côte via ces
  // liaisons comme s'il s'agissait d'une route classique.
  if (edge.nature === 'Bac ou liaison maritime') { return false; }
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

// Classification ville/campagne par densité de carrefours autour du point de
// départ — sans appel réseau supplémentaire (le graphe est déjà téléchargé à
// ce stade), donc sans coût de temps ni d'incertitude. Seuil empirique (pas
// une donnée officielle de zonage) : un centre-ville dense compte typiquement
// plusieurs dizaines de carrefours (nœuds à 3 rues ou plus) dans un rayon de
// 600 m, contre une poignée en zone rurale ou pavillonnaire lâche.
export const URBAN_CLASSIFICATION_RADIUS_M = 600;
const URBAN_CLASSIFICATION_JUNCTION_THRESHOLD = 20;
export function classifyUrbanContext(graph, nodeDegrees, originLon, originLat) {
  let junctionCount = 0;
  for (const [id, [lon, lat]] of graph.nodeCoords) {
    if ((nodeDegrees.get(id) || 0) < 3) { continue; } // pas un carrefour, juste un sommet de forme
    if (haversineMeters(originLon, originLat, lon, lat) <= URBAN_CLASSIFICATION_RADIUS_M) { junctionCount++; }
  }
  return { isUrban: junctionCount >= URBAN_CLASSIFICATION_JUNCTION_THRESHOLD, junctionCount };
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
 * Index spatial (grille de compartiments) sur les nœuds accessibles en
 * voiture, pour retrouver rapidement le plus proche depuis un nœud qui ne
 * l'est pas — sert de base à l'estimation d'un temps voiture "de repli"
 * (voir estimateCarTime) plutôt que de traiter tout nœud hors du graphe
 * voiture comme infiniment loin.
 */
export function buildCarReachabilityIndex(carTimes, nodeCoords, cellSizeMeters) {
  const mPerDegLat = 111320;
  const cellOf = (lon, lat) => {
    const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
    return [Math.floor(lon / (cellSizeMeters / mPerDegLon)), Math.floor(lat / (cellSizeMeters / mPerDegLat))];
  };
  const buckets = new Map();
  for (const [id, time] of carTimes) {
    const [lon, lat] = nodeCoords.get(id);
    const [cx, cy] = cellOf(lon, lat);
    const key = cx + '_' + cy;
    if (!buckets.has(key)) { buckets.set(key, []); }
    buckets.get(key).push({ lon, lat, time });
  }
  return { buckets, cellOf };
}

function findNearestCarTime(index, lon, lat, maxRing) {
  const [cx, cy] = index.cellOf(lon, lat);
  let best = null, bestDist = Infinity;
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) { continue; } // seulement le bord de l'anneau (déjà vu sinon)
        const bucket = index.buckets.get((cx + dx) + '_' + (cy + dy));
        if (!bucket) { continue; }
        for (const cand of bucket) {
          const d = haversineMeters(lon, lat, cand.lon, cand.lat);
          if (d < bestDist) { bestDist = d; best = cand; }
        }
      }
    }
    // Un anneau de sécurité supplémentaire une fois un candidat trouvé : le
    // point réellement le plus proche peut être dans une cellule adjacente à
    // celle où le premier candidat est tombé.
    if (best && ring > 0) { break; }
  }
  return best ? { time: best.time, distanceMeters: bestDist } : null;
}

// Vitesse de repli prudente (plus lente que la marche de Tobler à plat) : ce
// tronçon n'est pas un vrai itinéraire connu, juste une estimation à vol
// d'oiseau pour combler l'écart jusqu'au réseau voiture le plus proche — mieux
// vaut sous-estimer la vitesse que sur-crédibiliser une distance à vol d'oiseau.
const CAR_GAP_FALLBACK_SPEED_MS = (4.5 * 1000) / 3600;
const CAR_GAP_MAX_SEARCH_RING = 25; // ~5 km avec des cellules de 200 m

/**
 * Temps voiture "effectif" pour un nœud donné : le vrai temps Dijkstra s'il
 * existe, sinon celui du nœud accessible en voiture le plus proche + le temps
 * de marche pour combler la distance qui les sépare (plutôt que l'infini).
 * Modélise une voiture qui se gare au bout de la route utilisable la plus
 * proche et termine à pied — le cas typique d'un chemin/sentier qui longe une
 * route bien plus rapide sans que les deux graphes soient topologiquement
 * reliés (nœuds distincts, jamais fusionnés car pas au même endroit exact).
 * Sans ce repli, un mode actif "gagnait" à tort sur ces chemins simplement
 * parce que la voiture ne peut pas y rouler à la lettre près — alors qu'en
 * pratique elle les a déjà largement dépassés via la route adjacente.
 * Au-delà de ~5 km de tout accès voiture connu (zone vraiment isolée), on
 * revient à l'infini : au-delà de cette distance, l'hypothèse "garé tout
 * près" cesse d'être raisonnable.
 */
export function estimateCarTime(carTimes, carIndex, nodeId, nodeCoords) {
  const direct = carTimes.get(nodeId);
  if (direct !== undefined) { return direct; }
  const [lon, lat] = nodeCoords.get(nodeId);
  const nearest = findNearestCarTime(carIndex, lon, lat, CAR_GAP_MAX_SEARCH_RING);
  if (!nearest) { return Infinity; }
  return nearest.time + nearest.distanceMeters / CAR_GAP_FALLBACK_SPEED_MS;
}

/**
 * Parcours en largeur depuis l'origine, restreint aux nœuds où le mode actif
 * bat la voiture (mode_time(n) < car_time(n) + pénalité). Essentiel pour
 * obtenir une zone cohérente avec le point de départ plutôt que d'inclure des
 * îlots isolés qui satisferaient le critère localement sans y être reliés par
 * un chemin continûment gagnant — c'est l'esprit même de "faire grandir la
 * zone depuis le point de départ" de l'algorithme original.
 */
export function connectedWinningNodes(adjacencyMode, modeTimes, carTimes, carIndex, nodeCoords, originNode, carPenalty) {
  const nodeWins = (n) => {
    const mt = modeTimes.get(n);
    if (mt === undefined) { return false; }
    const carTime = estimateCarTime(carTimes, carIndex, n, nodeCoords) + carPenalty;
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
export function analyzeFrontier(graph, mode, winningNodes, modeTimes, carTimes, carIndex, nodeCoords, carPenalty) {
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
    const carTime = estimateCarTime(carTimes, carIndex, outsideNode, nodeCoords) + carPenalty;
    if (mt >= carTime) { counts.carWins++; } else { counts.other++; }
  }
  return counts;
}

