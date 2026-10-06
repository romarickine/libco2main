// ==========================================================================
// Orchestration : réseau + élévations + 4 Dijkstra + comparaison + polygone
// ==========================================================================
import { dijkstra } from "./dijkstra.js";
import {
  parseIGNRoadsToGraph,
  buildAdjacency,
  transposeAdjacency,
  isEdgeUsable,
  findNearestNode,
  computeNodeDegrees,
  checkRawConnectivity,
  connectedWinningNodes,
  analyzeFrontier,
  haversineMeters,
  classifyUrbanContext,
  buildCarReachabilityIndex,
  computeNodeIncidentEdges,
  completerAltitudes,
  lisserAltitudes,
} from "./graph.js";
import { HexGrid, traceOuterBoundaries, buildPolygonsWithHoles, smoothPolygonsWithHoles } from "./hexgrid.js";
import { fetchIGNRoads, etendreIGNRoads, fetchElevations } from "./ign-api.js";
import { DELAY_BIKE_MIN, DELAY_CAR_MIN_URBAN, DELAY_CAR_MIN_RURAL } from "./config.js";

// Rend la main au navigateur le temps d'une image, pour qu'il ait l'occasion
// de repeindre l'écran (barre de progression, pourcentage) avant de reprendre
// un bloc de calcul synchrone. Sans ça, plusieurs mises à jour de style
// enchaînées sans la moindre pause ne sont JAMAIS affichées à l'écran : le
// navigateur ne peint qu'entre deux tâches JS, pas au milieu d'un script en
// cours d'exécution — seule la dernière valeur posée juste avant une vraie
// pause asynchrone est visible.
//
// Onglet masqué : les navigateurs suspendent requestAnimationFrame et
// ralentissent fortement les minuteries (setTimeout) des onglets en arrière-
// plan. Le calcul restait alors figé tant que l'utilisateur ne revenait pas
// sur l'onglet (constaté le 28/09/2026). Dans ce cas, on rend la main par un
// MessageChannel, qui n'est pas ralenti : rien à repeindre de toute façon.
function yieldToBrowser() {
  if (document.hidden) {
    return new Promise((resolve) => {
      const canal = new MessageChannel();
      canal.port1.onmessage = () => {
        canal.port1.close(); // libère le canal (sinon il reste ouvert indéfiniment)
        resolve();
      };
      canal.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

// Sonde légère : télécharge un tout petit réseau (probeRadiusMeters, voir
// NETWORK_RADIUS_PROBE_M dans config.js) autour du point de départ et en
// mesure la densité de carrefours, pour choisir un rayon de réseau principal
// adapté au contexte (voir config.js) avant de lancer le téléchargement
// coûteux. Le calcul du délai voiture urbain/rural, lui, reste fait à part
// sur le réseau principal une fois téléchargé (classification tout aussi
// fiable — la sonde ne mesure que dans les 600 m, largement à l'intérieur
// de n'importe quel rayon principal — mais sans réutiliser ce résultat pour
// éviter de dépendre de l'ordre d'exécution entre les deux fonctions).
export async function probeJunctionDensity(lon, lat, probeRadiusMeters, nodeSnapToleranceMeters, wfsPageSize) {
  const roadsGeoJson = await fetchIGNRoads(lon, lat, probeRadiusMeters, wfsPageSize, () => {});
  const graph = parseIGNRoadsToGraph(roadsGeoJson, nodeSnapToleranceMeters);
  const nodeDegrees = computeNodeDegrees(graph);
  const { junctionCount } = classifyUrbanContext(graph, nodeDegrees, lon, lat);
  return junctionCount;
}

export const DIRECTION_DEPART = "depart"; // « j'en pars » : trajets adresse → lieu
export const DIRECTION_ARRIVEE = "arrivee"; // « j'y vais » : trajets lieu → adresse
export const DIRECTION_ALLER_RETOUR = "aller-retour"; // somme des deux trajets

/**
 * Temps de trajet par nœud selon la direction : départ (Dijkstra depuis
 * l'adresse), arrivée (Dijkstra depuis l'adresse sur le graphe inverse) ou
 * aller-retour (somme des deux, pour les nœuds atteints dans les deux sens).
 * Sens uniques, pentes et carrefours sont ceux de chaque trajet.
 * @param {Map} adjacency @param {*} origine @param {number} plafond  Secondes, par trajet.
 * @param {string} direction
 * @param {Map} [distancesOut] @param {Map} [delaysOut]  Diagnostic (cumulés sur l'aller-retour).
 * @returns {Map}
 */
export function tempsSelonDirection(adjacency, origine, plafond, direction, distancesOut, delaysOut) {
  if (direction === DIRECTION_DEPART) {
    return dijkstra(adjacency, origine, plafond, distancesOut, delaysOut);
  }
  const inverse = transposeAdjacency(adjacency);
  if (direction === DIRECTION_ARRIVEE) {
    return dijkstra(inverse, origine, plafond, distancesOut, delaysOut);
  }
  const dA = distancesOut ? new Map() : undefined;
  const eA = delaysOut ? new Map() : undefined;
  const dR = distancesOut ? new Map() : undefined;
  const eR = delaysOut ? new Map() : undefined;
  const aller = dijkstra(adjacency, origine, plafond, dA, eA);
  const retour = dijkstra(inverse, origine, plafond, dR, eR);
  const somme = new Map();
  for (const [n, t] of aller) {
    const r = retour.get(n);
    if (r === undefined) {
      continue;
    }
    somme.set(n, t + r);
    if (distancesOut) {
      distancesOut.set(n, (dA.get(n) ?? 0) + (dR.get(n) ?? 0));
    }
    if (delaysOut) {
      delaysOut.set(n, (eA.get(n) ?? 0) + (eR.get(n) ?? 0));
    }
  }
  return somme;
}

/**
 * Calcul complet des zones « plus rapide que la voiture » autour d'un point :
 * réseau routier et relief IGN, plus courts chemins (Dijkstra) pour la
 * voiture et chaque mode actif, comparaison nœud par nœud, puis polygones
 * lissés. Étapes et progression signalées par onProgress.
 * @param {object} opts  { lon, lat, networkRadiusMeters, (elevationGridSpacingMeters : ignoré depuis le 06/10/2026),
 *   nodeSnapToleranceMeters?, wfsPageSize?, onProgress(message, fraction) }
 * @returns {Promise<object>} results (zones par mode), taille du réseau, connexité,
 *   troncature éventuelle du téléchargement, contexte urbain, pénalité voiture
 *   appliquée, et données de diagnostic.
 */
export async function computeIsochronesNetwork(opts) {
  if (![DIRECTION_DEPART, DIRECTION_ARRIVEE, DIRECTION_ALLER_RETOUR].includes(opts.direction ?? DIRECTION_DEPART)) {
    throw new Error("Direction inconnue : " + opts.direction);
  }
  const {
    lon,
    lat,
    networkRadiusMeters,
    nodeSnapToleranceMeters = 8,
    wfsPageSize = 4800,
    modes = ["Walk", "Bike", "Ebike"],
    direction = DIRECTION_DEPART,
    reseauPrecedent = null,
    garderReseau = false,
    onProgress,
  } = opts;
  const bufferRadiusMeters = 40;

  // Réseau précédent fourni (relance à un rayon plus grand, voir
  // calcul-carte.js) : seul l'anneau manquant est téléchargé.
  const libelleReseau = reseauPrecedent
    ? "Téléchargement de l\u2019anneau manquant du réseau routier (BD TOPO® IGN)…"
    : "Téléchargement du réseau routier (BD TOPO® IGN)…";
  onProgress(libelleReseau, 0.05);
  const suiviReseau = (fraction) => onProgress(libelleReseau, 0.05 + fraction * 0.15);
  const roadsGeoJson = reseauPrecedent
    ? await etendreIGNRoads(reseauPrecedent, lon, lat, networkRadiusMeters, wfsPageSize, suiviReseau)
    : await fetchIGNRoads(lon, lat, networkRadiusMeters, wfsPageSize, suiviReseau);
  const graph = parseIGNRoadsToGraph(roadsGeoJson, nodeSnapToleranceMeters);
  const nodeDegrees = computeNodeDegrees(graph);
  const nodeIncidentEdges = computeNodeIncidentEdges(graph);

  // Le délai d'accès voiture dépend du contexte (ville/campagne) : chercher
  // une place et marcher jusqu'à destination prend nettement plus longtemps
  // en centre dense qu'en zone rurale où l'on se gare devant sa destination.
  // Le délai vélo, lui, ne varie pas avec le contexte.
  const urbanContext = classifyUrbanContext(graph, nodeDegrees, lon, lat);
  const delayBike = DELAY_BIKE_MIN;
  const delayCar = urbanContext.isUrban ? DELAY_CAR_MIN_URBAN : DELAY_CAR_MIN_RURAL;

  // Plafond de recherche par mode (20/40/60 min) : choix technique pour limiter
  // la taille du calcul, PAS une définition des zones (une zone = là où le mode
  // bat la voiture). Hypothèse posée par le porteur du projet (29/09/2026), non
  // vérifiée sur données réelles : chaque mode perd contre la voiture avant son
  // plafond, donc le plafond ne coupe aucune zone. Documenté dans la
  // méthodologie de la page (index.html) et dans README.md.
  const toutesDefs = [
    { key: "Walk", mode: "walk", maxTime: 20 * 60, carPenalty: delayCar * 60 },
    { key: "Bike", mode: "bike", maxTime: 40 * 60, carPenalty: (delayCar - delayBike) * 60 },
    { key: "Ebike", mode: "ebike", maxTime: 60 * 60, carPenalty: (delayCar - delayBike) * 60 },
  ];
  // Chaque mode est tracé comme l'anneau qu'il ajoute au précédent : on calcule
  // donc tous les modes jusqu'au plus lointain demandé (marche, puis vélo, puis
  // VAE), jamais un mode isolé ; les modes au-delà de celui-là sont évités.
  const dernier = Math.max(0, ...modes.map((m) => toutesDefs.findIndex((d) => d.key === m)));
  const modeDefs = toutesDefs.slice(0, dernier + 1);

  // Altitudes : lues dans la géométrie 3D des tronçons BD TOPO® (déjà
  // téléchargée), au lieu d'interroger l'API d'altimétrie sur une grille de
  // 70 m (jusqu'à 205 650 points et 52 requêtes à 15 km, source de refus 429
  // en série : essai réel du 06/10/2026). Relevé du même jour sur 400 sommets
  // à Vourles : écart avec le RGE ALTI® médian 0,65 m, 90 % sous 1,5 m, 99 %
  // sous 2,7 m [mesure ponctuelle, un seul secteur]. Avantage en plus : sur un
  // pont ou un viaduc, le Z est celui de la chaussée, pas celui du fond de
  // vallée. Sommets sans Z : complétés par leurs voisins, puis, s'il en reste,
  // par l'API d'altimétrie (quelques points seulement). Enfin, lissage le long
  // du réseau (1 passe, voir lisserAltitudes dans graph.js).
  onProgress("Altitudes des rues (BD TOPO®)…", 0.22);
  const elevations = new Map(graph.nodeElev || []);
  const restants = completerAltitudes(graph, elevations);
  if (restants > 0) {
    const points = [];
    for (const [id, [nlon, nlat]] of graph.nodeCoords) if (!elevations.has(id)) points.push({ id, lon: nlon, lat: nlat });
    const altitudes = await fetchElevations(points, (fraction) => {
      onProgress("Altitudes manquantes (" + points.length + " points, API IGN)…", 0.22 + fraction * 0.3);
    });
    for (const [id, z] of altitudes) elevations.set(id, z);
  }
  lisserAltitudes(graph, elevations);
  await yieldToBrowser();

  const originNode = findNearestNode(graph, lon, lat);
  if (originNode == null) {
    throw new Error(
      "Aucune rue trouvée près de ce point dans le rayon interrogé — vérifiez l\u2019adresse ou le point choisi.",
    );
  }
  const rawConnectivity = checkRawConnectivity(graph, originNode);

  onProgress("Calcul des temps de trajet voiture (référence)…", 0.55);
  await yieldToBrowser();
  const maxCarCutoff = Math.max(...modeDefs.map((m) => m.maxTime + m.carPenalty));
  const carAdjacency = buildAdjacency(graph, elevations, "car", nodeDegrees, nodeIncidentEdges, { urbain: urbanContext.isUrban });
  const carDistances = new Map();
  const carJunctionDelays = new Map();
  const carTimes = tempsSelonDirection(carAdjacency, originNode, maxCarCutoff, direction, carDistances, carJunctionDelays);
  // Aller-retour : deux trajets, donc deux fois la pénalité d'accès voiture et
  // deux fois le comblement à pied jusqu'au réseau voiture (voir estimateCarTime).
  const facteurTrajets = direction === DIRECTION_ALLER_RETOUR ? 2 : 1;
  // Cellules de 200m : assez fines pour bien localiser le nœud voiture le
  // plus proche d'un chemin/sentier isolé, sans exploser le nombre de
  // compartiments sur un réseau de 6 à 15 km de rayon (voir les paliers RADIUS_TIER_* et NETWORK_RADIUS_MAX_M dans config.js).
  const carIndex = buildCarReachabilityIndex(carTimes, graph.nodeCoords, 200);

  const results = {};
  const hexagonsByMode = {};
  const modeTimesByKey = {}; // conservé pour l'outil de diagnostic (inspection d'un point)
  const hexGrid = new HexGrid(lon, lat, bufferRadiusMeters * 1.6, 6);
  const progressPerMode = { Walk: 0.65, Bike: 0.78, Ebike: 0.9 };
  const zonesVides = () => ({ polygons: [], hexagonCount: 0, possiblyTruncated: false, frontierDiagnosis: null });

  for (const mode of modeDefs) {
    onProgress("Calcul — " + mode.key + "…", progressPerMode[mode.key]);
    await yieldToBrowser();
    const adjacency = buildAdjacency(graph, elevations, mode.mode, nodeDegrees, nodeIncidentEdges, { urbain: urbanContext.isUrban });
    const modeTimes = tempsSelonDirection(adjacency, originNode, mode.maxTime, direction);
    modeTimesByKey[mode.key] = modeTimes;
    // Parcours de connexité dans le sens de la carte : « j'y vais » remonte le
    // réseau depuis la destination ; départ et aller-retour partent de l'adresse.
    const adjacenceParcours = direction === DIRECTION_ARRIVEE ? transposeAdjacency(adjacency) : adjacency;
    const winningNodes = connectedWinningNodes(
      adjacenceParcours,
      modeTimes,
      carTimes,
      carIndex,
      graph.nodeCoords,
      originNode,
      mode.carPenalty * facteurTrajets,
      facteurTrajets,
    );

    // Détecte si la zone touche le bord du rayon réseau interrogé : signe
    // probable que la vraie frontière (là où la voiture rattraperait le mode)
    // se trouve plus loin, hors de portée des données téléchargées.
    let maxDistanceFromOrigin = 0;
    for (const nodeId of winningNodes) {
      const [nlon, nlat] = graph.nodeCoords.get(nodeId);
      const d = haversineMeters(lon, lat, nlon, nlat);
      if (d > maxDistanceFromOrigin) {
        maxDistanceFromOrigin = d;
      }
    }
    const possiblyTruncated = maxDistanceFromOrigin > networkRadiusMeters * 0.9;
    const frontierDiagnosis = analyzeFrontier(
      graph,
      mode.mode,
      winningNodes,
      modeTimes,
      carTimes,
      carIndex,
      graph.nodeCoords,
      mode.carPenalty * facteurTrajets,
      facteurTrajets,
    );

    const hexagons = {};
    for (const edge of graph.edges) {
      if (!isEdgeUsable(edge, mode.mode)) {
        continue;
      }
      if (!winningNodes.has(edge.from) || !winningNodes.has(edge.to)) {
        continue;
      }
      const [lon1, lat1] = graph.nodeCoords.get(edge.from);
      const [lon2, lat2] = graph.nodeCoords.get(edge.to);
      hexGrid.addSegmentToGrid(hexagons, lon1, lat1, lon2, lat2);
    }
    hexagonsByMode[mode.key] = hexagons;
    hexagonsByMode[mode.key + "_truncated"] = possiblyTruncated;
    hexagonsByMode[mode.key + "_frontier"] = frontierDiagnosis;
  }

  // Chaque mode est vectorisé sur son ANNEAU (ce qu'il ajoute au-delà du mode
  // précédent) : les zones ne se chevauchent pas du tout, donc n'importe
  // quelle opacité de rendu reste lisible, sans mélange de couleurs. Le
  // "trou" qu'un anneau contiendrait (la zone du mode plus rapide) est
  // représenté comme un vrai trou de polygone GeoJSON (pas rebouché) dès
  // qu'il est assez grand pour être une vraie zone exclue plutôt qu'un simple
  // artefact de pavage (petit îlot urbain isolé entouré de rues).
  const alreadyShown = {};
  const vectorizeProgress = { Walk: 0.93, Bike: 0.96, Ebike: 0.99 };
  for (const mode of modeDefs) {
    onProgress("Vectorisation et lissage — " + mode.key + "…", vectorizeProgress[mode.key]);
    await yieldToBrowser();
    const hexagons = hexagonsByMode[mode.key];
    const ring = {};
    for (const key in hexagons) {
      if (!alreadyShown[key]) {
        ring[key] = hexagons[key];
      }
    }
    for (const key in hexagons) {
      alreadyShown[key] = true;
    }
    const rawPolygons = buildPolygonsWithHoles(traceOuterBoundaries(ring, 6), 0.0002);
    const polygons = smoothPolygonsWithHoles(rawPolygons, 4);
    results[mode.key] = {
      polygons,
      hexagonCount: Object.keys(hexagons).length,
      possiblyTruncated: hexagonsByMode[mode.key + "_truncated"],
      frontierDiagnosis: hexagonsByMode[mode.key + "_frontier"],
    };
  }

  // Modes non calculés : présents mais vides, pour que l'appelant lise toujours les trois clés.
  for (const def of toutesDefs) {
    results[def.key] ??= zonesVides();
  }

  onProgress("Terminé.", 1);
  await yieldToBrowser();
  return {
    results,
    nodeCount: graph.nodeCoords.size,
    edgeCount: graph.edges.length,
    rawConnectivity,
    roadsTruncated: roadsGeoJson.truncated,
    // Réseau brut, seulement sur demande (relance par anneau) : il pèse lourd en mémoire.
    reseau: garderReseau ? roadsGeoJson : undefined,
    reseauEtendu: roadsGeoJson.etendu === true,
    rawFeatureCount: roadsGeoJson.rawFeatureCount,
    urbanContext,
    delayCarApplied: delayCar,
    direction,
    // Conservé pour l'outil de diagnostic (inspection d'un point) : permet de
    // comparer directement, pour n'importe quel point cliqué, le temps
    // voiture et le temps de chaque mode tels que calculés par le modèle —
    // sans ça, impossible de savoir si un écart avec la réalité (type Google
    // Maps) vient d'une vitesse voiture sous-estimée, d'un détour
    // topologique, ou d'autre chose, sans republier une nouvelle version pour
    // ajouter des logs.
    diagnostics: {
      graph,
      carTimes,
      carDistances,
      carJunctionDelays,
      carIndex,
      originNode,
      modeTimesByKey,
      modeDefs,
      nodeDegrees,
      direction,
    },
  };
}
