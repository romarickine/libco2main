// ==========================================================================
// Orchestration : réseau + élévations + 4 Dijkstra + comparaison + polygone
// ==========================================================================
import { dijkstra } from './dijkstra.js';
import { parseIGNRoadsToGraph, buildAdjacency, isEdgeUsable, findNearestNode, computeNodeDegrees, checkRawConnectivity, connectedWinningNodes, analyzeFrontier, haversineMeters } from './graph.js';
import { HexGrid, traceOuterBoundaries, buildPolygonsWithHoles, smoothPolygonsWithHoles } from './hexgrid.js';
import { fetchIGNRoads, buildElevationGrid, bilinearElevation, fetchElevations } from './ign-api.js';

export async function computeIsochronesNetwork(opts) {
  const { lon, lat, delayBike, delayCar, networkRadiusMeters, elevationGridSpacingMeters = 200, nodeSnapToleranceMeters = 8, wfsPageSize = 1000, onProgress } = opts;
  const bufferRadiusMeters = 40;

  const modeDefs = [
    { key: 'Walk', mode: 'walk', maxTime: 20 * 60, carPenalty: delayCar * 60 },
    { key: 'Bike', mode: 'bike', maxTime: 40 * 60, carPenalty: (delayCar - delayBike) * 60 },
    { key: 'Ebike', mode: 'ebike', maxTime: 60 * 60, carPenalty: (delayCar - delayBike) * 60 },
  ];

  onProgress('Téléchargement du réseau routier (BD TOPO® IGN)…', 0.05);
  const roadsGeoJson = await fetchIGNRoads(lon, lat, networkRadiusMeters, wfsPageSize, (fraction) => {
    onProgress('Téléchargement du réseau routier (BD TOPO® IGN)…', 0.05 + fraction * 0.15);
  });
  const graph = parseIGNRoadsToGraph(roadsGeoJson, nodeSnapToleranceMeters);
  const nodeDegrees = computeNodeDegrees(graph);

  onProgress('Récupération de l\u2019altimétrie…', 0.22);
  const elevGrid = buildElevationGrid(graph.nodeCoords, elevationGridSpacingMeters);
  const gridElevations = await fetchElevations(elevGrid.points, (fraction) => {
    onProgress('Récupération de l\u2019altimétrie (grille de ' + elevGrid.points.length + ' points, contre ' + graph.nodeCoords.size + ' nœuds)…', 0.22 + fraction * 0.30);
  });
  const elevations = new Map();
  for (const [id, [nlon, nlat]] of graph.nodeCoords) { elevations.set(id, bilinearElevation(elevGrid, gridElevations, nlon, nlat)); }

  const originNode = findNearestNode(graph, lon, lat);
  if (originNode == null) { throw new Error('Aucune rue trouvée près de ce point dans le rayon interrogé — vérifiez l\u2019adresse ou le point choisi.'); }
  const rawConnectivity = checkRawConnectivity(graph, originNode);

  onProgress('Calcul des temps de trajet voiture (référence)…', 0.55);
  const maxCarCutoff = Math.max(...modeDefs.map((m) => m.maxTime + m.carPenalty));
  const carAdjacency = buildAdjacency(graph, elevations, 'car', nodeDegrees);
  const carTimes = dijkstra(carAdjacency, originNode, maxCarCutoff);

  const results = {};
  const hexagonsByMode = {};
  const hexGrid = new HexGrid(lon, lat, bufferRadiusMeters * 1.6, 6);
  const progressPerMode = { Walk: 0.65, Bike: 0.78, Ebike: 0.9 };

  for (const mode of modeDefs) {
    onProgress('Calcul — ' + mode.key + '…', progressPerMode[mode.key]);
    const adjacency = buildAdjacency(graph, elevations, mode.mode, nodeDegrees);
    const modeTimes = dijkstra(adjacency, originNode, mode.maxTime);
    const winningNodes = connectedWinningNodes(adjacency, modeTimes, carTimes, originNode, mode.carPenalty);

    // Détecte si la zone touche le bord du rayon réseau interrogé : signe
    // probable que la vraie frontière (là où la voiture rattraperait le mode)
    // se trouve plus loin, hors de portée des données téléchargées.
    let maxDistanceFromOrigin = 0;
    for (const nodeId of winningNodes) {
      const [nlon, nlat] = graph.nodeCoords.get(nodeId);
      const d = haversineMeters(lon, lat, nlon, nlat);
      if (d > maxDistanceFromOrigin) { maxDistanceFromOrigin = d; }
    }
    const possiblyTruncated = maxDistanceFromOrigin > networkRadiusMeters * 0.9;
    const frontierDiagnosis = analyzeFrontier(graph, mode.mode, winningNodes, modeTimes, carTimes, mode.carPenalty);

    const hexagons = {};
    for (const edge of graph.edges) {
      if (!isEdgeUsable(edge, mode.mode)) { continue; }
      if (!winningNodes.has(edge.from) || !winningNodes.has(edge.to)) { continue; }
      const [lon1, lat1] = graph.nodeCoords.get(edge.from);
      const [lon2, lat2] = graph.nodeCoords.get(edge.to);
      hexGrid.addSegmentToGrid(hexagons, lon1, lat1, lon2, lat2);
    }
    hexagonsByMode[mode.key] = hexagons;
    hexagonsByMode[mode.key + '_truncated'] = possiblyTruncated;
    hexagonsByMode[mode.key + '_frontier'] = frontierDiagnosis;
  }

  // Chaque mode est vectorisé sur son ANNEAU (ce qu'il ajoute au-delà du mode
  // précédent) : les zones ne se chevauchent pas du tout, donc n'importe
  // quelle opacité de rendu reste lisible, sans mélange de couleurs. Le
  // "trou" qu'un anneau contiendrait (la zone du mode plus rapide) est
  // représenté comme un vrai trou de polygone GeoJSON (pas rebouché) dès
  // qu'il est assez grand pour être une vraie zone exclue plutôt qu'un simple
  // artefact de pavage (petit îlot urbain isolé entouré de rues).
  const alreadyShown = {};
  for (const mode of modeDefs) {
    const hexagons = hexagonsByMode[mode.key];
    const ring = {};
    for (const key in hexagons) { if (!alreadyShown[key]) { ring[key] = hexagons[key]; } }
    for (const key in hexagons) { alreadyShown[key] = true; }
    const rawPolygons = buildPolygonsWithHoles(traceOuterBoundaries(ring, 6), 0.0002);
    const polygons = smoothPolygonsWithHoles(rawPolygons, 4);
    results[mode.key] = {
      polygons,
      hexagonCount: Object.keys(hexagons).length,
      possiblyTruncated: hexagonsByMode[mode.key + '_truncated'],
      frontierDiagnosis: hexagonsByMode[mode.key + '_frontier'],
    };
  }

  onProgress('Terminé.', 1);
  return { results, nodeCount: graph.nodeCoords.size, edgeCount: graph.edges.length, rawConnectivity, roadsTruncated: roadsGeoJson.truncated, rawFeatureCount: roadsGeoJson.rawFeatureCount };
}
