// ==========================================================================
// Calcul complet d'une carte : sonde de densité, choix du rayon, calcul,
// nouvel essai au rayon maximal si une zone touche le bord.
// Aucun accès à la page : utilisé par l'outil public (ui.js) et par tout
// appelant qui veut la même méthode (mêmes seuils, mêmes rayons).
// ==========================================================================
import { computeIsochronesNetwork, probeJunctionDensity } from "./isochrones.js";
import { setWfsMaxRequestsPerSecond } from "./ign-api.js";
import {
  NETWORK_RADIUS_PROBE_M,
  RADIUS_TIER_DENSE_MIN_JUNCTIONS,
  RADIUS_TIER_DENSE_M,
  RADIUS_TIER_INTERMEDIATE_MIN_JUNCTIONS,
  RADIUS_TIER_INTERMEDIATE_M,
  RADIUS_TIER_SPARSE_M,
  NETWORK_RADIUS_MAX_M,
  ELEVATION_GRID_SPACING_M,
  NODE_SNAP_TOLERANCE_M,
  WFS_PAGE_SIZE,
  WFS_MAX_REQUESTS_PER_SECOND,
} from "./config.js";

/**
 * Rayon de réseau initial d'après la densité de carrefours mesurée par la
 * sonde (seuils et rayons justifiés dans config.js).
 * @param {number} junctionCount
 * @returns {number} rayon en mètres
 */
export function choisirRayonInitial(junctionCount) {
  if (junctionCount >= RADIUS_TIER_DENSE_MIN_JUNCTIONS) return RADIUS_TIER_DENSE_M;
  if (junctionCount >= RADIUS_TIER_INTERMEDIATE_MIN_JUNCTIONS) return RADIUS_TIER_INTERMEDIATE_M;
  return RADIUS_TIER_SPARSE_M;
}

function estTronque(c) {
  return c.roadsTruncated || ["Walk", "Bike", "Ebike"].some((k) => c.results[k].possiblyTruncated);
}

/**
 * @param {object} p
 * @param {number} p.lon
 * @param {number} p.lat
 * @param {string[]} [p.modes]  Modes demandés parmi Walk, Bike, Ebike (tous par défaut).
 * @param {string} [p.direction]  « depart » (j'en pars, défaut), « arrivee » (j'y vais) ou « aller-retour ».
 * @param {(etat:{phase:string, message:string, fraction:number}) => void} [p.onEtat]
 *   phase : « sonde » | « calcul » | « nouvel-essai ».
 * @returns {Promise<{computation:object, probeJunctionCount:number,
 *   probeChosenRadiusMeters:number, usedRadiusMeters:number, radiusRetried:boolean}>}
 */
export async function calculerCarte({ lon, lat, modes, direction, onEtat = () => {} }) {
  setWfsMaxRequestsPerSecond(WFS_MAX_REQUESTS_PER_SECOND);
  const opts = {
    lon,
    lat,
    modes,
    direction,
    elevationGridSpacingMeters: ELEVATION_GRID_SPACING_M,
    nodeSnapToleranceMeters: NODE_SNAP_TOLERANCE_M,
    wfsPageSize: WFS_PAGE_SIZE,
  };
  const suivi = (phase, prefixe) => (message, fraction) => onEtat({ phase, message: prefixe + message, fraction });

  onEtat({
    phase: "sonde",
    message: "Analyse du contexte local (sonde " + NETWORK_RADIUS_PROBE_M / 1000 + " km)…",
    fraction: 0.02,
  });
  const probeJunctionCount = await probeJunctionDensity(
    lon,
    lat,
    NETWORK_RADIUS_PROBE_M,
    opts.nodeSnapToleranceMeters,
    opts.wfsPageSize,
  );
  const probeChosenRadiusMeters = choisirRayonInitial(probeJunctionCount);
  let usedRadiusMeters = probeChosenRadiusMeters;
  let computation = await computeIsochronesNetwork({
    ...opts,
    networkRadiusMeters: usedRadiusMeters,
    garderReseau: true,
    onProgress: suivi(
      "calcul",
      "Contexte : " +
        probeJunctionCount +
        " carrefours détectés en 1 km, rayon choisi " +
        usedRadiusMeters / 1000 +
        " km — ",
    ),
  });

  // Filet de sécurité : si ce rayon adapté au contexte ne suffit finalement
  // pas (voir config.js), on relance au rayon maximal.
  // Le réseau déjà téléchargé est réutilisé : seul l'anneau entre l'ancien et
  // le nouveau rayon est demandé à l'IGN (etendreIGNRoads dans ign-api.js).
  let radiusRetried = false;
  const reseauPrecedent = computation.reseau;
  delete computation.reseau;
  if (estTronque(computation)) {
    radiusRetried = true;
    usedRadiusMeters = NETWORK_RADIUS_MAX_M;
    computation = await computeIsochronesNetwork({
      ...opts,
      networkRadiusMeters: usedRadiusMeters,
      reseauPrecedent,
      onProgress: suivi(
        "nouvel-essai",
        "Rayon de " +
          probeChosenRadiusMeters / 1000 +
          " km insuffisant, nouvel essai à " +
          NETWORK_RADIUS_MAX_M / 1000 +
          " km — ",
      ),
    });
  }
  return { computation, probeJunctionCount, probeChosenRadiusMeters, usedRadiusMeters, radiusRetried };
}

export { estTronque };
