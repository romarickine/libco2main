// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// ==========================================================================
// Inspection d'un point cliqué sur la carte : temps voiture et temps de chaque
// mode au nœud du réseau le plus proche, tels que calculés par le modèle.
// Ne renvoie que des données simples (nombres, textes) : la fonction tourne là
// où le calcul a eu lieu (dans le Web Worker, voir calcul-worker.js), et seul
// ce petit résultat revient à la page — le réseau, lui, reste dans le worker.
// ==========================================================================
import { findNearestNode, haversineMeters, estimateCarTime } from "./graph.js";

/**
 * @param {object} diagnostics  computation.diagnostics (isochrones.js).
 * @param {number} lon @param {number} lat  Point cliqué.
 * @returns {object|null} null si le réseau est vide.
 */
export function inspecterPoint(diagnostics, lon, lat) {
  const { graph, carTimes, carDistances, carJunctionDelays, carIndex, modeTimesByKey, modeDefs, nodeDegrees, direction } =
    diagnostics;
  const nearestNode = findNearestNode(graph, lon, lat);
  if (nearestNode == null) return null;
  const [nodeLon, nodeLat] = graph.nodeCoords.get(nearestNode);
  // Aller-retour : deux trajets, donc deux accès (vélo ou stationnement) et
  // deux comblements à pied jusqu'au réseau voiture, comme dans le calcul
  // des zones (facteurTrajets, isochrones.js).
  const facteurTrajets = direction === "aller-retour" ? 2 : 1;
  const carDirect = carTimes.get(nearestNode);
  const carEffective = estimateCarTime(carTimes, carIndex, nearestNode, graph.nodeCoords, facteurTrajets);
  const modes = modeDefs.map((m) => ({
    key: m.key,
    carPenalty: m.carPenalty,
    temps: modeTimesByKey[m.key].get(nearestNode),
  }));
  const troncons = graph.edges
    .filter((e) => e.from === nearestNode || e.to === nearestNode)
    .slice(0, 6)
    .map((e) => ({ nature: e.nature || null, vitesse: e.vitesse ?? null, length: e.length }));
  return {
    nodeLon,
    nodeLat,
    snapDistance: haversineMeters(lon, lat, nodeLon, nodeLat),
    facteurTrajets,
    carDirect,
    carEffective,
    // distance réellement parcourue par la voiture (le long du chemin le plus
    // rapide trouvé), pas à vol d'oiseau
    carNetworkDistance: carDistances.get(nearestNode),
    carJunctionDelay: carJunctionDelays.get(nearestNode) || 0,
    degre: nodeDegrees.get(nearestNode) || 0,
    modes,
    troncons,
  };
}
