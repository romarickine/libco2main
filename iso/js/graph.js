// ==========================================================================
// Graphe : parsing des tronçons BD TOPO® (GeoJSON WFS), construction
// d'adjacence par mode
// ==========================================================================
import {
  toblerWalkingSpeed,
  parkinRotheramCyclingSpeed,
  BDTOPO_DEFAULT_SPEED,
  BDTOPO_DEFAULT_SPEED_FALLBACK,
  BDTOPO_CAR_EXCLUDED_NATURES,
  BDTOPO_WALK_BIKE_EXCLUDED_NATURES,
} from "./speed-models.js";

const EARTH_RADIUS = 6371000;
// Vitesse (km/h) en deçà de laquelle une rue est considérée « calme » : le vélo
// peut y circuler à contresens du sens unique (hypothèse, voir sensUniqueApplique).
const SEUIL_RUE_CALME_KMH = 30;
// Passes de lissage des altitudes BD TOPO® (voir lisserAltitudes) : 1, retenue après
// comparaison sur 4 sites le 06/10/2026 (docs/validation-lissage-altitudes.md). [Estimé]
const PASSES_LISSAGE_ALTITUDE = 1;
// En contexte urbain : au-delà de cette vitesse, voie rapide, sens unique maintenu pour le vélo (seuil de cadrage, non sourcé).
const SEUIL_VOIE_RAPIDE_URBAINE_KMH = 50;
/**
 * Distance à vol d'oiseau entre deux points (formule de haversine, Terre
 * sphérique de rayon 6 371 km).
 * @param {number} lon1 @param {number} lat1 @param {number} lon2 @param {number} lat2  Degrés décimaux.
 * @returns {number} Mètres.
 */
export function haversineMeters(lon1, lat1, lon2, lat2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
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
      const cx = Math.floor(lon / cellW),
        cy = Math.floor(lat / cellH);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = buckets.get(cx + dx + "_" + (cy + dy));
          if (!bucket) {
            continue;
          }
          for (const cand of bucket) {
            if (haversineMeters(lon, lat, cand.lon, cand.lat) <= toleranceMeters) {
              return cand.id;
            }
          }
        }
      }
      const id = nextId++;
      const key = cx + "_" + cy;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push({ id, lon, lat });
      nodeCoords.set(id, [lon, lat]);
      return id;
    },
  };
}

/**
 * Transforme les tronçons BD TOPO® (GeoJSON) en graphe : les extrémités
 * proches de moins de nodeSnapTolerance mètres sont fusionnées en un même
 * carrefour (la BD TOPO® ne fournit pas d'identifiant de nœud).
 * @param {object} featureCollection  Réponse du WFS IGN.
 * @param {number} nodeSnapTolerance  Mètres.
 * @returns {{nodeCoords: Map<number, [number, number]>, edges: object[], nodeElev: Map<number, number>}}
 *   nodeElev : altitude (m) des nœuds dont le sommet porte un Z valide (géométrie 3D BD TOPO®).
 */
export function parseIGNRoadsToGraph(featureCollection, nodeSnapTolerance) {
  const snapper = createNodeSnapper(nodeSnapTolerance);
  const edges = [];
  // Altitude par nœud, lue dans la 3e coordonnée des sommets (la BD TOPO®
  // livre des géométries 3D). Valeurs hors de la plage plausible (la BD TOPO®
  // code un Z inconnu par une valeur négative conventionnelle ; 3,3 % des
  // sommets relevés à Vourles le 06/10/2026) : ignorées, complétées ensuite
  // (voir completerAltitudes et isochrones.js).
  const nodeElev = new Map();
  const noterZ = (id, c) => {
    const z = c[2];
    if (!nodeElev.has(id) && typeof z === "number" && z > -500 && z < 5000) nodeElev.set(id, z);
  };
  // Identifiants négatifs, jamais générés par le snapper (qui compte à partir
  // de 0) : réservés aux points de forme intermédiaires, pour qu'ils ne
  // puissent jamais se fusionner avec un point d'un autre tronçon.
  let privateNodeCounter = -1;
  for (const feature of featureCollection.features || []) {
    const props = feature.properties || {};
    const geom = feature.geometry;
    if (!geom) {
      continue;
    }
    const lineStrings =
      geom.type === "LineString" ? [geom.coordinates] : geom.type === "MultiLineString" ? geom.coordinates : [];
    const nature = props.nature || "";
    const sens = props.sens_de_circulation || props.sens || "Double sens";
    const vitesse = props.vitesse_moyenne_vl || props.vit_moy_vl || null;
    const accesVL = props.acces_vehicule_leger || props.acces_vl || null;
    // Hiérarchie routière officielle BD TOPO® (1 = le plus important). Sert à
    // ne compter une pénalité de carrefour que lorsque deux routes de
    // hiérarchie comparable se croisent — voir edgeRank plus bas.
    const importance = props.importance != null ? parseFloat(props.importance) : null;
    // Couverture incomplète : cet attribut n'est renseigné par l'IGN que
    // lorsqu'un partenaire a fourni l'information — son absence ne garantit
    // donc PAS qu'une voie est publique, seule sa présence à vrai est fiable.
    const prive = props.prive === true || props.prive === "Vrai" || props.privee === true || props.privee === "Vrai";
    for (const coords of lineStrings) {
      const n = coords.length;
      if (n < 2) {
        continue;
      }
      // Seules les DEUX EXTRÉMITÉS d'un tronçon correspondent à de vraies
      // intersections dans la topologie BD TOPO® (deux tronçons qui se
      // croisent partagent un point de départ/arrivée commun, confirmé dans
      // la documentation IGN). Les points de forme intermédiaires (lissage
      // de la géométrie d'une courbe) n'en sont pas — les fusionner avec un
      // point proche d'un AUTRE tronçon crée de faux carrefours, en
      // particulier sur une route à chaussées séparées où les deux sens de
      // circulation ont des points de forme à quelques mètres l'un de
      // l'autre tout du long (confirmé : IGN saisit un tracé par chaussée
      // pour ces routes) : sans cette distinction, une route rapide sans
      // aucune intersection réelle peut accumuler des dizaines de pénalités
      // de carrefour totalement artificielles.
      const nodeIds = new Array(n);
      nodeIds[0] = snapper.snap(coords[0][0], coords[0][1]);
      nodeIds[n - 1] = snapper.snap(coords[n - 1][0], coords[n - 1][1]);
      for (let i = 1; i < n - 1; i++) {
        const id = privateNodeCounter--;
        snapper.nodeCoords.set(id, [coords[i][0], coords[i][1]]);
        nodeIds[i] = id;
      }
      for (let i = 0; i < n; i++) noterZ(nodeIds[i], coords[i]);
      for (let i = 0; i < n - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        const idA = nodeIds[i],
          idB = nodeIds[i + 1];
        const length = haversineMeters(lon1, lat1, lon2, lat2);
        if (length <= 0 || idA === idB) {
          continue;
        }
        edges.push({ from: idA, to: idB, length, nature, sens, vitesse, accesVL, prive, importance });
      }
    }
  }
  return { nodeCoords: snapper.nodeCoords, edges, nodeElev };
}

/**
 * Lisse les altitudes le long du réseau : chaque nœud prend la moyenne de sa
 * propre altitude et de celles de ses voisins, `passes` fois. Raison : la pente
 * est calculée tronçon par tronçon, entre sommets parfois distants de quelques
 * mètres ; un écart de quelques décimètres sur le Z d'un sommet y produit des
 * pentes fictives de plusieurs %, que les modèles de vitesse (non linéaires)
 * transforment en ralentissement net.
 * Validation du 06/10/2026 sur 4 sites (Saint-Étienne, Pélussin, Feurs, Charly),
 * contre l'ancienne méthode (grille RGE ALTI® de 70 m) : 1 passe donne le meilleur
 * recouvrement des zones vélo (indice de Jaccard moyen 0,91, minimum 0,86 ; sans
 * lissage 0,85 / 0,68 ; 3 passes 0,82 / 0,51) et le dénivelé cumulé le plus proche
 * (−4 à −5 % ; sans lissage +6 à +9 % ; 3 passes −10 à −12 %). Détail :
 * docs/validation-lissage-altitudes.md. [Estimé : 4 sites de la Loire et du Rhône]
 * Modifie `elevations` en place.
 * @param {object} graph @param {Map<number, number>} elevations @param {number} [passes]
 */
export function lisserAltitudes(graph, elevations, passes = PASSES_LISSAGE_ALTITUDE) {
  const voisins = new Map();
  for (const e of graph.edges) {
    if (!voisins.has(e.from)) voisins.set(e.from, []);
    if (!voisins.has(e.to)) voisins.set(e.to, []);
    voisins.get(e.from).push(e.to);
    voisins.get(e.to).push(e.from);
  }
  for (let p = 0; p < passes; p++) {
    const lissees = new Map();
    for (const [id, z] of elevations) {
      let somme = z,
        n = 1;
      for (const v of voisins.get(id) || []) {
        const zv = elevations.get(v);
        if (zv !== undefined) {
          somme += zv;
          n++;
        }
      }
      lissees.set(id, somme / n);
    }
    for (const [id, z] of lissees) elevations.set(id, z);
  }
}

/**
 * Complète les altitudes manquantes par la moyenne des voisins connus (le long
 * des tronçons), en quelques passes : un sommet sans Z se trouve presque
 * toujours entre deux sommets qui en ont un. Modifie `elevations` en place.
 * @param {object} graph  { nodeCoords, edges }
 * @param {Map<number, number>} elevations
 * @param {number} [passes]
 * @returns {number} Nombre de nœuds encore sans altitude.
 */
export function completerAltitudes(graph, elevations, passes = 6) {
  const voisins = new Map();
  for (const e of graph.edges) {
    if (!voisins.has(e.from)) voisins.set(e.from, []);
    if (!voisins.has(e.to)) voisins.set(e.to, []);
    voisins.get(e.from).push(e.to);
    voisins.get(e.to).push(e.from);
  }
  let manquants = [...graph.nodeCoords.keys()].filter((id) => !elevations.has(id));
  for (let p = 0; p < passes && manquants.length; p++) {
    const ajouts = [];
    for (const id of manquants) {
      const zs = (voisins.get(id) || []).map((v) => elevations.get(v)).filter((z) => z !== undefined);
      if (zs.length) ajouts.push([id, zs.reduce((a, b) => a + b, 0) / zs.length]);
    }
    if (!ajouts.length) break;
    for (const [id, z] of ajouts) elevations.set(id, z);
    manquants = manquants.filter((id) => !elevations.has(id));
  }
  return manquants.length;
}

/**
 * Indique si un tronçon est praticable pour un mode. Exclus pour tous : voies
 * privées et bacs. Voiture : ni chemins, sentiers, escaliers ou pistes
 * cyclables, ni accès physiquement impossible. Marche et vélo : toute voie
 * jusqu'à 110 km/h (au-delà, voie de type autoroute).
 * @param {object} edge  Tronçon du graphe.
 * @param {string} mode  "walk", "bike", "ebike" ou "car".
 * @returns {boolean}
 */
export function isEdgeUsable(edge, mode) {
  // Exclusion pour tous les modes quand l'IGN a explicitement codé la voie
  // comme privée. Couverture incomplète (voir plus haut) : ça écarte les cas
  // connus, mais ne garantit pas l'absence de chemins privés non signalés.
  if (edge.prive) {
    return false;
  }
  // Bac et liaisons maritimes : exclus pour tous les modes. Ni la marche ni
  // le vélo ne peuvent traverser l'eau, et même en voiture une traversée en
  // bac implique une attente d'horaire non modélisée — la BD TOPO® les code
  // comme un tronçon de route ordinaire (nature = "Bac ou liaison
  // maritime"), ce qui laissait le tracé vélo/VAE longer la côte via ces
  // liaisons comme s'il s'agissait d'une route classique.
  if (edge.nature === "Bac ou liaison maritime") {
    return false;
  }
  if (mode === "car") {
    if (BDTOPO_CAR_EXCLUDED_NATURES.has(edge.nature)) {
      return false;
    }
    if (edge.accesVL === "Physiquement impossible") {
      return false;
    }
    return true;
  }
  // Marche et vélo : voies de type autoroutier exclues par leur NATURE (la
  // circulation des piétons et des cycles y est interdite d'après le code de la
  // route ; BD TOPO® les code à 95-100 km/h, donc la seule vitesse ne suffit
  // pas, voir BDTOPO_WALK_BIKE_EXCLUDED_NATURES). Pour le reste : autorisés
  // partout, seule limite = vitesse de la voie. Au-delà de 110 km/h, voie à
  // caractère autoroutier ; en dessous, on suppose un accès possible (bas-côté,
  // trottoir, ou simple tolérance) plutôt que d'exclure par nature, ce qui
  // coupait parfois le réseau cyclable à tort (ex. voies rapides urbaines à
  // vitesse modérée) et bornait artificiellement les zones vélo/VAE.
  if (BDTOPO_WALK_BIKE_EXCLUDED_NATURES.has(edge.nature)) {
    return false;
  }
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
// La BD TOPO® ne renseigne pas le type de régulation de chaque carrefour
// (feu, stop, cédez-le-passage) — recherché puis confirmé absent des données
// disponibles, y compris via la couche "carrefour" dédiée, qui ne couvre que
// les échangeurs et ronds-points nommés, pas les carrefours ordinaires.
// À la place, on utilise la HIÉRARCHIE des routes qui se croisent : une route
// principale qui croise une voie nettement moins importante n'est pas
// pénalisée (priorité évidente, pas de ralentissement réel) ; seules deux
// routes de hiérarchie comparable comptent comme un vrai carrefour.
const JUNCTION_DELAY_SECONDS = { car: 6, walk: 2, bike: 4, ebike: 4 };

// Hiérarchie de repli par nature de voie (1 = le plus important), utilisée
// quand l'attribut officiel BD TOPO® "importance" est absent.
const NATURE_RANK_FALLBACK = {
  "Type autoroutier": 1,
  "Route à 2 chaussées": 2,
  Bretelle: 2.5,
  "Rond-point": 3,
  "Route à 1 chaussée": 3,
  "Piste cyclable": 4,
  "Route empierrée": 4,
  Chemin: 5,
  Sentier: 5,
  Escalier: 5,
};
// Écart de rang au-delà duquel deux routes sont considérées de hiérarchie
// trop différente pour qu'un vrai ralentissement ait lieu (priorité évidente).
// Valeur volontairement resserrée (0.5, pas plus) : au-delà, une route
// ordinaire (rang 3) qui croise une voie rapide de rang 2 était encore
// comptée à tort comme un carrefour "comparable" — testé et corrigé.
const JUNCTION_RANK_THRESHOLD = 0.5;
function edgeRank(edge) {
  if (Number.isFinite(edge.importance)) {
    return edge.importance;
  }
  return NATURE_RANK_FALLBACK[edge.nature] ?? 3;
}

// Cap (direction) entre deux points, en radians (0 = nord, sens horaire) —
// sert à distinguer une route qui continue tout droit après un carrefour
// (même route, tronçon suivant) d'une route qui croise réellement la
// direction de circulation. Sans cette distinction, le tronçon suivant de la
// MÊME route est toujours de rang identique à celui qu'on vient de parcourir,
// donc toujours compté à tort comme un "vrai carrefour" quel que soit le
// seuil de hiérarchie choisi.
function bearingRad(lon1, lat1, lon2, lat2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1r = (lat1 * Math.PI) / 180,
    lat2r = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2r);
  const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
  return Math.atan2(y, x);
}
function angleDiffRad(a, b) {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}
// En dessous de 45° d'écart avec la direction d'arrivée, une route est
// considérée comme un prolongement tout droit (même itinéraire), pas un
// croisement à négocier — au-dessus, c'est une route qui coupe réellement la
// trajectoire.
const STRAIGHT_THROUGH_TOLERANCE_RAD = (45 * Math.PI) / 180;

/**
 * Pour chaque nœud, la liste des arêtes (objets, pas seulement leur rang) qui
 * s'y rejoignent — sert à déterminer, pour une arête d'arrivée donnée, si
 * une AUTRE arête de hiérarchie comparable existe à ce nœud (vrai carrefour)
 * ou si toutes les autres sont nettement moins importantes (simple croisement
 * sans ralentissement réel).
 */
export function computeNodeIncidentEdges(graph) {
  const incident = new Map();
  const add = (nodeId, edge) => {
    if (!incident.has(nodeId)) {
      incident.set(nodeId, []);
    }
    incident.get(nodeId).push(edge);
  };
  for (const edge of graph.edges) {
    add(edge.from, edge);
    add(edge.to, edge);
  }
  return incident;
}

/**
 * Nombre de tronçons reliés à chaque nœud (3 ou plus : carrefour).
 * @param {{edges: object[]}} graph
 * @returns {Map<number, number>}
 */
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
// ce stade), donc sans coût de temps ni d'incertitude. Seuil recalibré sur
// des mesures réelles (nombre de carrefours à moins de 600 m rapporté par
// l'outil) : Bonneval (Eure-et-Loir, bourg rural, 74) et Vassieux-en-Vercors
// (hameau de montagne, 24) doivent être classés ruraux, alors qu'Andrézieux-
// Bouthéon (périurbain dense, 167), Saint-Étienne (235), Lyon Croix-Rousse
// (287) et Paris République (217) doivent rester urbains — un seuil de 120
// sépare correctement les deux groupes sur cet échantillon. L'ancien seuil
// (20) classait à tort Bonneval et Vassieux comme urbains.
export const URBAN_CLASSIFICATION_RADIUS_M = 600;
const URBAN_CLASSIFICATION_JUNCTION_THRESHOLD = 120;
/**
 * Classe l'origine en milieu urbain ou non, selon le nombre de carrefours
 * dans un rayon de URBAN_CLASSIFICATION_RADIUS_M ; sert à choisir le temps
 * de stationnement ajouté aux trajets en voiture.
 * @param {object} graph @param {Map<number, number>} nodeDegrees
 * @param {number} originLon @param {number} originLat
 * @returns {{isUrban: boolean, junctionCount: number}}
 */
export function classifyUrbanContext(graph, nodeDegrees, originLon, originLat) {
  let junctionCount = 0;
  for (const [id, [lon, lat]] of graph.nodeCoords) {
    if ((nodeDegrees.get(id) || 0) < 3) {
      continue;
    } // pas un carrefour, juste un sommet de forme
    if (haversineMeters(originLon, originLat, lon, lat) <= URBAN_CLASSIFICATION_RADIUS_M) {
      junctionCount++;
    }
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
  bike: { "Route empierrée": 0.75, Chemin: 0.55, Sentier: 0.35 },
  ebike: { "Route empierrée": 0.8, Chemin: 0.6, Sentier: 0.4 },
  walk: { "Route empierrée": 0.95, Chemin: 0.9, Sentier: 1.0 },
};
function surfaceFactor(nature, mode) {
  const table = SURFACE_SPEED_FACTOR[mode];
  return (table && table[nature]) || 1.0;
}

/**
 * Le sens unique d'un tronçon s'impose-t-il à ce mode ? Voiture : toujours.
 * Marche : jamais. Vélo et VAE : oui sur les ronds-points ; ailleurs, oui
 * seulement au-delà d'un seuil de vitesse : SEUIL_RUE_CALME_KMH (30) hors
 * contexte urbain, SEUIL_VOIE_RAPIDE_URBAINE_KMH (50) en contexte urbain, où le
 * vélo est supposé pouvoir prendre les sens uniques du centre-ville (choix du
 * porteur du projet, 01/10/2026 ; le contexte urbain est celui détecté autour
 * de l'adresse, appliqué à toute la carte). Cette
 * tolérance est une HYPOTHÈSE de cadrage (choix du porteur du projet, 01/10/2026) :
 * la BD TOPO® n'a pas d'attribut « double sens cyclable » dans les données
 * utilisées, et vitesse_moyenne_vl est une vitesse moyenne, pas une limitation.
 * @param {object} edge @param {string} mode
 * @returns {boolean}
 */
export function sensUniqueApplique(edge, mode, urbain = false) {
  if (edge.sens !== "Sens direct" && edge.sens !== "Sens inverse") {
    return false;
  }
  if (mode === "car") {
    return true;
  }
  if (mode !== "bike" && mode !== "ebike") {
    return false;
  }
  if (edge.nature === "Rond-point") {
    return true;
  }
  const vitesse = edge.vitesse || BDTOPO_DEFAULT_SPEED[edge.nature] || BDTOPO_DEFAULT_SPEED_FALLBACK;
  // Contexte urbain : le vélo peut prendre les sens uniques, sauf voies rapides.
  const seuil = urbain ? SEUIL_VOIE_RAPIDE_URBAINE_KMH : SEUIL_RUE_CALME_KMH;
  return vitesse > seuil;
}

/**
 * Construit la liste d'adjacence d'un mode : coût de chaque tronçon en
 * secondes (vitesse selon la pente et le revêtement), sens de circulation,
 * pénalités de carrefour.
 * @param {object} graph @param {Map} elevations  Altitude par nœud (m).
 * @param {string} mode @param {Map} nodeDegrees @param {Map} nodeIncidentEdges
 * @returns {Map<number, Array<{to: number, cost: number, length: number, delay: number}>>}
 */
export function buildAdjacency(graph, elevations, mode, nodeDegrees, nodeIncidentEdges, { urbain = false } = {}) {
  const adjacency = new Map();
  const junctionDelay = JUNCTION_DELAY_SECONDS[mode] || 0;
  const otherEndpoint = (e, nodeId) => (e.from === nodeId ? e.to : e.from);
  const addDirected = (from, to, cost, length, edge) => {
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    // Une pénalité n'est comptée que si une AUTRE route de hiérarchie
    // comparable CROISE réellement la trajectoire à ce nœud (vrai carrefour à
    // négocier) — ni quand toutes les autres sont nettement moins importantes
    // (priorité évidente), ni quand l'unique route de rang comparable est en
    // fait le prolongement tout droit du même itinéraire (le tronçon suivant
    // d'une route continue a toujours le même rang que celui qu'on vient de
    // parcourir, donc toujours "comparable" à tort si on ne regarde pas aussi
    // la direction).
    let delay = 0;
    if ((nodeDegrees.get(to) || 0) >= 3) {
      const arrivingRank = edgeRank(edge);
      const [fromLon, fromLat] = graph.nodeCoords.get(from);
      const [toLon, toLat] = graph.nodeCoords.get(to);
      const arrivalBearing = bearingRad(fromLon, fromLat, toLon, toLat);
      const others = nodeIncidentEdges.get(to) || [];
      const hasComparable = others.some((other) => {
        if (other === edge) {
          return false;
        }
        const [otherLon, otherLat] = graph.nodeCoords.get(otherEndpoint(other, to));
        const otherBearing = bearingRad(toLon, toLat, otherLon, otherLat);
        if (angleDiffRad(arrivalBearing, otherBearing) < STRAIGHT_THROUGH_TOLERANCE_RAD) {
          return false;
        } // prolongement tout droit, pas un croisement
        return edgeRank(other) <= arrivingRank + JUNCTION_RANK_THRESHOLD;
      });
      if (hasComparable) {
        delay = junctionDelay;
      }
    }
    adjacency.get(from).push({ to, cost: cost + delay, length, delay });
  };
  for (const edge of graph.edges) {
    if (!isEdgeUsable(edge, mode)) {
      continue;
    }
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
    if (mode === "car") {
      const speedKmh = edge.vitesse || BDTOPO_DEFAULT_SPEED[edge.nature] || BDTOPO_DEFAULT_SPEED_FALLBACK;
      const cost = edge.length / ((speedKmh * 1000) / 3600);
      costForward = cost;
      costBackward = cost;
    } else if (mode === "walk") {
      const factor = surfaceFactor(edge.nature, "walk");
      costForward = edge.length / ((toblerWalkingSpeed(grade) * factor * 1000) / 3600);
      costBackward = edge.length / ((toblerWalkingSpeed(-grade) * factor * 1000) / 3600);
    } else {
      const isElectric = mode === "ebike";
      const factor = surfaceFactor(edge.nature, mode);
      costForward = edge.length / ((parkinRotheramCyclingSpeed(grade, isElectric) * factor * 1000) / 3600);
      costBackward = edge.length / ((parkinRotheramCyclingSpeed(-grade, isElectric) * factor * 1000) / 3600);
    }

    // Le sens de circulation (SENS) de la BD TOPO® est défini pour les
    // véhicules légers. Il s'applique à la voiture et, depuis le 01/10/2026,
    // au vélo et au VAE (voir sensUniqueApplique) ; la marche reste
    // bidirectionnelle sur chaque tronçon.
    const oneWay = sensUniqueApplique(edge, mode, urbain);
    const forwardOnly = oneWay && edge.sens === "Sens direct";
    const backwardOnly = oneWay && edge.sens === "Sens inverse";
    if (!backwardOnly) {
      addDirected(edge.from, edge.to, costForward, edge.length, edge);
    }
    if (!forwardOnly) {
      addDirected(edge.to, edge.from, costBackward, edge.length, edge);
    }
  }
  return adjacency;
}

/**
 * Graphe inverse : chaque arc u→v devient v→u, avec le même coût. Un Dijkstra
 * lancé depuis la destination sur ce graphe donne, pour chaque nœud, le temps
 * du trajet nœud→destination (pénalités de carrefour et sens uniques inclus).
 * @param {Map} adjacency
 * @returns {Map}
 */
export function transposeAdjacency(adjacency) {
  const inverse = new Map();
  for (const [from, voisins] of adjacency) {
    for (const { to, cost, length, delay } of voisins) {
      if (!inverse.has(to)) {
        inverse.set(to, []);
      }
      inverse.get(to).push({ to: from, cost, length, delay });
    }
  }
  return inverse;
}

/**
 * Nœud du graphe le plus proche d'un point (recherche exhaustive).
 * @param {object} graph @param {number} lon @param {number} lat
 * @returns {number|null} Identifiant du nœud.
 */
export function findNearestNode(graph, lon, lat) {
  let best = null,
    bestDist = Infinity;
  for (const [id, [nlon, nlat]] of graph.nodeCoords) {
    const d = haversineMeters(lon, lat, nlon, nlat);
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
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
    if (!undirected.has(a)) {
      undirected.set(a, []);
    }
    undirected.get(a).push(b);
  };
  for (const edge of graph.edges) {
    addEdge(edge.from, edge.to);
    addEdge(edge.to, edge.from);
  }
  const visited = new Set([originNode]);
  const queue = [originNode];
  while (queue.length > 0) {
    const u = queue.shift();
    for (const to of undirected.get(u) || []) {
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
      }
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
    const key = cx + "_" + cy;
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push({ lon, lat, time });
  }
  return { buckets, cellOf };
}

function findNearestCarTime(index, lon, lat, maxRing) {
  const [cx, cy] = index.cellOf(lon, lat);
  let best = null,
    bestDist = Infinity;
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
          continue;
        } // seulement le bord de l'anneau (déjà vu sinon)
        const bucket = index.buckets.get(cx + dx + "_" + (cy + dy));
        if (!bucket) {
          continue;
        }
        for (const cand of bucket) {
          const d = haversineMeters(lon, lat, cand.lon, cand.lat);
          if (d < bestDist) {
            bestDist = d;
            best = cand;
          }
        }
      }
    }
    // Un anneau de sécurité supplémentaire une fois un candidat trouvé : le
    // point réellement le plus proche peut être dans une cellule adjacente à
    // celle où le premier candidat est tombé.
    if (best && ring > 0) {
      break;
    }
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
export function estimateCarTime(carTimes, carIndex, nodeId, nodeCoords, gapFactor = 1) {
  const direct = carTimes.get(nodeId);
  if (direct !== undefined) {
    return direct;
  }
  const [lon, lat] = nodeCoords.get(nodeId);
  const nearest = findNearestCarTime(carIndex, lon, lat, CAR_GAP_MAX_SEARCH_RING);
  if (!nearest) {
    return Infinity;
  }
  return nearest.time + (gapFactor * nearest.distanceMeters) / CAR_GAP_FALLBACK_SPEED_MS;
}

/**
 * Parcours en largeur depuis l'origine, restreint aux nœuds où le mode actif
 * bat la voiture (mode_time(n) < car_time(n) + pénalité). Essentiel pour
 * obtenir une zone cohérente avec le point de départ plutôt que d'inclure des
 * îlots isolés qui satisferaient le critère localement sans y être reliés par
 * un chemin continûment gagnant — c'est l'esprit même de "faire grandir la
 * zone depuis le point de départ" de l'algorithme original.
 */
export function connectedWinningNodes(
  adjacencyMode,
  modeTimes,
  carTimes,
  carIndex,
  nodeCoords,
  originNode,
  carPenalty,
  gapFactor = 1,
) {
  const nodeWins = (n) => {
    const mt = modeTimes.get(n);
    if (mt === undefined) {
      return false;
    }
    const carTime = estimateCarTime(carTimes, carIndex, n, nodeCoords, gapFactor) + carPenalty;
    return mt < carTime;
  };
  const visited = new Set([originNode]);
  const queue = [originNode];
  while (queue.length > 0) {
    const u = queue.shift();
    const neighbors = adjacencyMode.get(u) || [];
    for (const { to } of neighbors) {
      if (visited.has(to)) {
        continue;
      }
      if (!nodeWins(to)) {
        continue;
      }
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
export function analyzeFrontier(
  graph,
  mode,
  winningNodes,
  modeTimes,
  carTimes,
  carIndex,
  nodeCoords,
  carPenalty,
  gapFactor = 1,
) {
  const counts = { excludedByFilter: 0, beyondTimeBudget: 0, carWins: 0, other: 0 };
  const seenPairs = new Set();
  for (const edge of graph.edges) {
    const fromIn = winningNodes.has(edge.from),
      toIn = winningNodes.has(edge.to);
    if (fromIn === toIn) {
      continue;
    } // pas une arête de frontière (les deux dedans ou les deux dehors)
    const insideNode = fromIn ? edge.from : edge.to;
    const outsideNode = fromIn ? edge.to : edge.from;
    const pairKey = insideNode < outsideNode ? insideNode + "|" + outsideNode : outsideNode + "|" + insideNode;
    if (seenPairs.has(pairKey)) {
      continue;
    }
    seenPairs.add(pairKey);

    if (!isEdgeUsable(edge, mode)) {
      counts.excludedByFilter++;
      continue;
    }
    const mt = modeTimes.get(outsideNode);
    if (mt === undefined) {
      counts.beyondTimeBudget++;
      continue;
    }
    const carTime = estimateCarTime(carTimes, carIndex, outsideNode, nodeCoords, gapFactor) + carPenalty;
    if (mt >= carTime) {
      counts.carWins++;
    } else {
      counts.other++;
    }
  }
  return counts;
}
