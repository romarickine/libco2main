// ==========================================================================
// Orchestration : réseau + élévations + 4 Dijkstra + comparaison + polygone
// ==========================================================================
import { dijkstra } from "./dijkstra.js";
import {
  parseIGNRoadsToGraph,
  transposeAdjacency,
  isEdgeUsable,
  findNearestNode,
  computeNodeDegrees,
  estimateCarTime,
  haversineMeters,
  classifyUrbanContext,
  buildCarReachabilityIndex,
  computeNodeIncidentEdges,
  noeudCarrossableProche,
  CAR_GAP_FALLBACK_SPEED_MS,
  CAR_GAP_MAX_SEARCH_RING,
} from "./graph.js";
import {
  preparerReseau,
  adjacenceCSR,
  tempsSelonDirectionCSR,
  versMap,
  ValeursParNoeud,
  tempsVoitureEffectifCSR,
  cacheTempsVoiture,
  gagnantsConnexesCSR,
  tousGagnantsCSR,
  connexiteBruteCSR,
  completerAltitudesCSR,
  lisserAltitudesCSR,
  analyserFrontiereCSR,
} from "./moteur-csr.js";
import { filtrerIlots, trousACombler, NATURES_DEGRADEES } from "./ilots.js";
import { HexGrid, ClesParTroncon, traceOuterBoundaries, buildPolygonsWithHoles, smoothPolygonsWithHoles } from "./hexgrid.js";
import { fetchIGNRoads, etendreIGNRoads, fetchElevations } from "./ign-api.js";
import { DELAY_BIKE_MIN, DELAY_CAR_MIN_URBAN, DELAY_CAR_MIN_RURAL, ILOTS } from "./config.js";

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
// Parking en lisière : tenté si l'adresse n'est sur aucun tronçon carrossable,
// ou si le calcul voiture dessert moins de nœuds que ce seuil (enclave). [Estimé]
const PARKING_SEUIL_NOEUDS = 50;

function yieldToBrowser() {
  // Dans un Web Worker (calcul-worker.js), rien à repeindre : on rend
  // seulement la main pour laisser passer les messages.
  if (typeof document === "undefined" || document.hidden) {
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
  // Refus anticipé (voir verifierDepart) sur ce petit réseau, avant de
  // télécharger le réseau complet ; le calcul complet vérifie de nouveau.
  const origine = findNearestNode(graph, lon, lat);
  if (origine != null) verifierDepart(computeNodeIncidentEdges(graph).get(origine), ["walk", "bike", "ebike"]);
  return junctionCount;
}

export const MESSAGE_DEPART_REFUSE =
  "Ce point est sur une voie interdite à pied et à vélo (bretelle, voie rapide…). Choisissez une adresse ou un point sur une rue ordinaire.";

// Point de départ refusé s'il est rattaché à un nœud qu'aucun des modes
// actifs ne peut quitter (bretelle ou voie rapide : zones marche, vélo et VAE
// vides sinon). Choix du porteur, 09/11/2026 : le calcul porte sur des
// adresses de la base IGN, qui ne sont pas sur ces voies.
function verifierDepart(tronconsDepart, modesActifs) {
  const ok = (tronconsDepart || []).some((e) => modesActifs.some((m) => isEdgeUsable(e, m)));
  if (!ok) {
    const err = new Error(MESSAGE_DEPART_REFUSE);
    err.departRefuse = true;
    throw err;
  }
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

// Dernier réseau préparé (voir computeIsochronesNetwork).
let memoReseau = null;
/** Vide le réseau gardé en mémoire (libère la mémoire ; aucun effet sur les résultats). */
export function oublierReseau() {
  memoReseau = null;
}

/**
 * Téléchargement, graphe, altitudes et préparation du moteur : tout ce qui
 * ne dépend que du point, du rayon et des données IGN (pas du mode, du sens
 * ni des îlots).
 */
async function preparerReseauComplet({ lon, lat, networkRadiusMeters, nodeSnapToleranceMeters, wfsPageSize, reseauPrecedent, onProgress }) {
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
  const restants = completerAltitudesCSR(graph, elevations);
  if (restants > 0) {
    const points = [];
    for (const [id, [nlon, nlat]] of graph.nodeCoords) if (!elevations.has(id)) points.push({ id, lon: nlon, lat: nlat });
    const altitudes = await fetchElevations(points, (fraction) => {
      onProgress("Altitudes manquantes (" + points.length + " points, API IGN)…", 0.22 + fraction * 0.3);
    });
    for (const [id, z] of altitudes) elevations.set(id, z);
  }
  lisserAltitudesCSR(graph, elevations);
  await yieldToBrowser();

  const originNode = findNearestNode(graph, lon, lat);
  if (originNode == null) {
    throw new Error(
      "Aucune rue trouvée près de ce point dans le rayon interrogé — vérifiez l\u2019adresse ou le point choisi.",
    );
  }
  // Moteur sur tableaux typés (moteur-csr.js) : mêmes résultats que
  // buildAdjacency + dijkstra, en bien moins de temps sur un grand réseau.
  const prep = preparerReseau(graph, elevations, nodeDegrees, nodeIncidentEdges);
  const rawConnectivity = connexiteBruteCSR(prep.idx, prep.idx.index.get(originNode));
  return {
    graph,
    nodeDegrees,
    nodeIncidentEdges,
    urbanContext,
    originNode,
    prep,
    rawConnectivity,
    brut: roadsGeoJson,
    roadsTruncated: roadsGeoJson.truncated,
    rawFeatureCount: roadsGeoJson.rawFeatureCount,
    etendu: roadsGeoJson.etendu === true,
  };
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
    ilots = undefined,
    onProgress,
  } = opts;
  const bufferRadiusMeters = 40;

  // Réseau déjà préparé pour exactement la même demande (même point, même
  // rayon, même chemin de téléchargement) : par exemple un changement de sens
  // du trajet ou de modes. Mêmes données, donc mêmes résultats ; on évite le
  // téléchargement, le graphe, les altitudes et la préparation (environ 20 s
  // à Paris, mesure du 09/11/2026). Une seule entrée, vidée avant tout
  // nouveau réseau pour ne pas cumuler deux réseaux en mémoire.
  const cleReseau = [lon, lat, networkRadiusMeters, nodeSnapToleranceMeters, wfsPageSize, reseauPrecedent ? "anneau:" + JSON.stringify([reseauPrecedent.emprise, reseauPrecedent.truncated, reseauPrecedent.ordreAxes, reseauPrecedent.rawFeatureCount]) : "direct"].join("|");
  let reseau = memoReseau && memoReseau.cle === cleReseau ? memoReseau : null;
  if (!reseau) {
    memoReseau = null;
    reseau = await preparerReseauComplet({ lon, lat, networkRadiusMeters, nodeSnapToleranceMeters, wfsPageSize, reseauPrecedent, onProgress });
    reseau.cle = cleReseau;
    memoReseau = reseau;
  } else {
    onProgress("Réseau routier déjà préparé pour ce point…", 0.5);
    await yieldToBrowser();
  }
  const { graph, nodeDegrees, nodeIncidentEdges, urbanContext, originNode, prep, rawConnectivity } = reseau;
  // Réseau brut, pour une relance par anneau (calcul-carte.js) : disponible
  // au premier calcul ; sinon relu à la demande depuis le cache des tuiles
  // (mêmes réponses). Jamais gardé au-delà de ce calcul (≈ 120 Mo à Paris).
  const brut = reseau.brut;
  reseau.brut = null;
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
  const { ids, index: indexNoeud } = prep.idx;
  const origineIdx = indexNoeud.get(originNode);
  verifierDepart(
    nodeIncidentEdges.get(originNode),
    modeDefs.map((d) => d.mode),
  );

  onProgress("Calcul des temps de trajet voiture (référence)…", 0.55);
  await yieldToBrowser();
  const maxCarCutoff = Math.max(...modeDefs.map((m) => m.maxTime + m.carPenalty));
  const urbain = urbanContext.isUrban;
  const carCSR = adjacenceCSR(prep, "car", { urbain, details: true });
  const rc = tempsSelonDirectionCSR(carCSR, origineIdx, maxCarCutoff, direction, true);
  let carTimes = versMap(ids, rc.ordre, rc.temps);
  let carDistances = new ValeursParNoeud(ids, indexNoeud, rc.ordre, rc.temps, rc.distance);
  let carJunctionDelays = new ValeursParNoeud(ids, indexNoeud, rc.ordre, rc.temps, rc.delai);
  // Aller-retour : deux trajets, donc deux fois la pénalité d'accès voiture et
  // deux fois le comblement à pied jusqu'au réseau voiture (voir estimateCarTime).
  const facteurTrajets = direction === DIRECTION_ALLER_RETOUR ? 2 : 1;

  // Parking en lisière : si l'adresse est hors du réseau voiture (zone
  // piétonne, sentier, escalier, piste cyclable…), le calcul voiture ne sort
  // pas du point de départ et la voiture « perd partout ». On relance alors le
  // calcul depuis le nœud carrossable le plus proche (là où l'on se gare), si
  // et seulement s'il dessert davantage de nœuds, et l'on ajoute à tous les
  // temps voiture la marche entre l'adresse et ce parking (vol d'oiseau, même
  // vitesse prudente que le repli d'estimateCarTime ; deux fois en aller-retour).
  let parkingLisiere = null;
  const departCarrossable = (nodeIncidentEdges.get(originNode) || []).some((e) => isEdgeUsable(e, "car"));
  if (!departCarrossable || carTimes.size < PARKING_SEUIL_NOEUDS) {
    const distMax = CAR_GAP_MAX_SEARCH_RING * 200; // même portée que le repli voiture
    const parking = noeudCarrossableProche(graph, lon, lat, new Set(carTimes.keys()), distMax);
    if (parking) {
      const r2 = tempsSelonDirectionCSR(carCSR, indexNoeud.get(parking.node), maxCarCutoff, direction, true);
      const t2 = versMap(ids, r2.ordre, r2.temps);
      const d2 = new ValeursParNoeud(ids, indexNoeud, r2.ordre, r2.temps, r2.distance);
      const j2 = new ValeursParNoeud(ids, indexNoeud, r2.ordre, r2.temps, r2.delai);
      if (t2.size > carTimes.size) {
        const marche = (facteurTrajets * parking.distanceMeters) / CAR_GAP_FALLBACK_SPEED_MS;
        carTimes = new Map([...t2].map(([n, t]) => [n, t + marche]));
        carDistances = new Map([...d2].map(([n, d]) => [n, d + facteurTrajets * parking.distanceMeters]));
        carJunctionDelays = j2;
        parkingLisiere = {
          distanceMeters: Math.round(parking.distanceMeters),
          marcheSecondes: Math.round(marche),
          noeudsDesservis: t2.size,
        };
      }
    }
  }
  // Cellules de 200m : assez fines pour bien localiser le nœud voiture le
  // plus proche d'un chemin/sentier isolé, sans exploser le nombre de
  // compartiments sur un réseau de 6 à 15 km de rayon (voir les paliers RADIUS_TIER_* et NETWORK_RADIUS_MAX_M dans config.js).
  // Index pour l'inspection d'un point seulement : construit à la première
  // inspection (0,9 s à Paris, mesure du 09/11/2026), pas à chaque carte.
  let carIndexMemo = null;
  // Temps voiture sur tableaux : calculé (ou non) par nœud, et temps effectif
  // avec repli (estimateCarTime) mis en cache pour les trois modes.
  const { n: nNoeuds, lon: lonN, lat: latN, de: deA, vers: versA } = prep.idx;
  const voitureAtteinte = new Uint8Array(nNoeuds);
  for (const id of carTimes.keys()) voitureAtteinte[indexNoeud.get(id)] = 1;
  const tempsVoitureEffectif = tempsVoitureEffectifCSR(
    prep.idx,
    carTimes,
    200,
    CAR_GAP_MAX_SEARCH_RING,
    CAR_GAP_FALLBACK_SPEED_MS,
    haversineMeters,
  );
  const voitureEffective = cacheTempsVoiture((i) => tempsVoitureEffectif(i, facteurTrajets), nNoeuds);
  const voitureUtilisable = carCSR.utilisable;

  const results = {};
  const hexagonsByMode = {};
  const modeTimesByKey = {}; // conservé pour l'outil de diagnostic (inspection d'un point)
  const hexGrid = new HexGrid(lon, lat, bufferRadiusMeters * 1.6, 6);
  // Hexagones traversés par chaque tronçon : calculés une fois, servent aux trois modes.
  const clesTroncons = new ClesParTroncon(hexGrid, prep.idx);
  const progressPerMode = { Walk: 0.65, Bike: 0.78, Ebike: 0.9 };
  const zonesVides = () => ({ polygons: [], hexagonCount: 0, possiblyTruncated: false, frontierDiagnosis: null, ilots: null });
  // Mode « toutes zones gagnantes » + filtre de pertinence (ilots.js, réglages
  // dans config.js). `ilots: false` revient à la seule zone reliée au départ.
  const reglagesIlots = ilots === false ? null : { ...ILOTS, ...(ilots || {}) };
  const ilotsActifs = reglagesIlots !== null && reglagesIlots.actif !== false;
  const [origLon, origLat] = graph.nodeCoords.get(originNode);
  const cleOrigine = hexGrid.cleDe(origLon, origLat);

  for (const mode of modeDefs) {
    onProgress("Calcul — " + mode.key + "…", progressPerMode[mode.key]);
    await yieldToBrowser();
    const adjacence = adjacenceCSR(prep, mode.mode, { urbain });
    const rm = tempsSelonDirectionCSR(adjacence, origineIdx, mode.maxTime, direction);
    const modeTimes = new ValeursParNoeud(ids, indexNoeud, rm.ordre, rm.temps);
    modeTimesByKey[mode.key] = modeTimes;
    // Parcours de connexité dans le sens de la carte : « j'y vais » remonte le
    // réseau depuis la destination ; départ et aller-retour partent de l'adresse.
    const adjacenceParcours = direction === DIRECTION_ARRIVEE ? rm.inverse : adjacence;
    const penalite = mode.carPenalty * facteurTrajets;
    const gagnants = ilotsActifs
      ? tousGagnantsCSR(ids, rm.ordre, rm.temps, voitureEffective, origineIdx, penalite, nNoeuds)
      : gagnantsConnexesCSR(adjacenceParcours, ids, rm.temps, voitureEffective, origineIdx, penalite);
    const winningNodes = gagnants.ensemble;
    const gagne = gagnants.drapeaux;
    const utilisable = adjacence.utilisable;

    // Hexagones gagnants ; on note à part les « carrossables », traversés par au
    // moins une voie gagnante où la voiture a un vrai temps calculé : ouverte
    // à la voiture, non dégradée (chemin, sentier, route empierrée) et reliée
    // au réseau voiture. Ailleurs (pistes cyclables, voies de berge, chemins),
    // le temps voiture n'est qu'une estimation à pied jusqu'à la route la plus
    // proche, et la « victoire » du mode n'a guère de sens.
    // Zone principale : nœuds reliés au départ par des rues où le mode gagne
    // de proche en proche (l'ancien calcul). Le reste des zones gagnantes forme
    // les îlots, filtrés plus bas, même s'ils touchent cette zone sur la grille.
    const connexes = ilotsActifs
      ? gagnantsConnexesCSR(adjacenceParcours, ids, rm.temps, voitureEffective, origineIdx, penalite).drapeaux
      : null;
    const clesPrincipales = new Set();
    const hexagons = {};
    const hexCarrossables = new Set();
    for (let e = 0; e < deA.length; e++) {
      if (!utilisable[e]) {
        continue;
      }
      const a = deA[e],
        b = versA[e];
      if (!gagne[a] || !gagne[b]) {
        continue;
      }
      clesTroncons.ajouterCellules(hexagons, e);
      if (connexes && connexes[a] && connexes[b]) {
        clesTroncons.ajouterCles(clesPrincipales, e);
      }
      if (
        ilotsActifs &&
        !NATURES_DEGRADEES.has(graph.edges[e].nature) &&
        voitureUtilisable[e] &&
        voitureAtteinte[a] &&
        voitureAtteinte[b]
      ) {
        clesTroncons.ajouterCles(hexCarrossables, e);
      }
    }

    // Voies praticables du mode (gagnantes ou non) dans le cadre d'un ensemble
    // d'hexagones : sert à distinguer, dans un trou, interstice sans route et
    // poche où la voiture gagne.
    const hexRoutesDans = (cles) => {
      let minLo = Infinity,
        maxLo = -Infinity,
        minLa = Infinity,
        maxLa = -Infinity;
      for (const key of cles) {
        for (const [lo, la] of (hexagons[key] || hexGrid.celluleDepuisCle(key)).coordinates) {
          if (lo < minLo) minLo = lo;
          if (lo > maxLo) maxLo = lo;
          if (la < minLa) minLa = la;
          if (la > maxLa) maxLa = la;
        }
      }
      const hexRoutes = new Set();
      const dansCadre = (lo, la) => lo >= minLo && lo <= maxLo && la >= minLa && la <= maxLa;
      for (let e = 0; e < deA.length; e++) {
        if (!utilisable[e]) continue;
        const lon1 = lonN[deA[e]],
          lat1 = latN[deA[e]],
          lon2 = lonN[versA[e]],
          lat2 = latN[versA[e]];
        if (!dansCadre(lon1, lat1) && !dansCadre(lon2, lat2)) continue;
        clesTroncons.ajouterCles(hexRoutes, e);
      }
      return hexRoutes;
    };
    // Accès aux hexagones avant filtrage (essais de calibrage uniquement).
    if (typeof opts.surHexagonesBruts === "function") {
      opts.surHexagonesBruts(mode.key, { cles: Object.keys(hexagons), clesPrincipales, hexCarrossables, cleOrigine, hexGrid, hexRoutesDans });
    }

    let statsIlots = null;
    if (ilotsActifs) {
      const filtre = filtrerIlots(Object.keys(hexagons), {
        clesPrincipales,
        cleOrigine,
        hexCarrossables,
        minHex: reglagesIlots.minHex,
        ancreMin: reglagesIlots.ancreMin,
        distParHex: reglagesIlots.distParHexM / hexGrid.hexSize,
        partDegradeeMax: reglagesIlots.partDegradeeMax,
      });
      for (const key of Object.keys(hexagons)) if (!filtre.gardes.has(key)) delete hexagons[key];
      const hexRoutes = hexRoutesDans(Object.keys(hexagons));
      const ajouts = trousACombler(new Set(Object.keys(hexagons)), hexRoutes, reglagesIlots.pochesVoitureMax);
      for (const key of ajouts) hexagons[key] = hexGrid.celluleDepuisCle(key);
      statsIlots = {
        ilotsGardes: filtre.ilotsGardes,
        ilotsEcartes: filtre.ilotsEcartes,
        ilotsNonCarrossablesEcartes: filtre.ilotsNonCarrossablesEcartes,
        trousCombles: ajouts.length,
      };
    }

    // Détecte si la zone touche le bord du rayon réseau interrogé : signe
    // probable que la vraie frontière (là où la voiture rattraperait le mode)
    // se trouve plus loin, hors de portée des données téléchargées.
    let maxDistanceFromOrigin = 0;
    for (let i = 0; i < nNoeuds; i++) {
      if (!gagne[i]) continue;
      const nlon = lonN[i],
        nlat = latN[i];
      // Îlots écartés par le filtre : ils ne doivent pas faire relancer à un rayon plus grand.
      if (ilotsActifs && !hexagons[hexGrid.cleDe(nlon, nlat)]) {
        continue;
      }
      const d = haversineMeters(lon, lat, nlon, nlat);
      if (d > maxDistanceFromOrigin) {
        maxDistanceFromOrigin = d;
      }
    }
    const possiblyTruncated = maxDistanceFromOrigin > networkRadiusMeters * 0.9;
    // Même résultat que analyzeFrontier (graph.js), sur tableaux.
    const frontierDiagnosis = analyserFrontiereCSR(
      prep.idx,
      graph.edges,
      mode.mode,
      gagne,
      rm.temps,
      voitureEffective,
      mode.carPenalty * facteurTrajets,
    );

    hexagonsByMode[mode.key] = hexagons;
    hexagonsByMode[mode.key + "_ilots"] = statsIlots;
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
      ilots: hexagonsByMode[mode.key + "_ilots"],
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
    roadsTruncated: reseau.roadsTruncated,
    // Réseau brut, seulement sur demande (relance par anneau) : il pèse lourd en mémoire.
    reseau: garderReseau && brut ? brut : undefined,
    chargerReseau:
      garderReseau && !brut
        ? () =>
            reseauPrecedent
              ? etendreIGNRoads(reseauPrecedent, lon, lat, networkRadiusMeters, wfsPageSize, () => {})
              : fetchIGNRoads(lon, lat, networkRadiusMeters, wfsPageSize, () => {})
        : undefined,
    reseauEtendu: reseau.etendu,
    rawFeatureCount: reseau.rawFeatureCount,
    urbanContext,
    delayCarApplied: delayCar,
    parkingLisiere,
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
      get carIndex() {
        carIndexMemo ??= buildCarReachabilityIndex(carTimes, graph.nodeCoords, 200);
        return carIndexMemo;
      },
      originNode,
      modeTimesByKey,
      modeDefs,
      nodeDegrees,
      direction,
    },
  };
}
