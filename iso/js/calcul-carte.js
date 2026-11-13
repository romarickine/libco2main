// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// ==========================================================================
// Calcul complet d'une carte : sonde de densité, choix du rayon, calcul,
// nouvel essai au rayon maximal si une zone touche le bord.
// Aucun accès à la page : utilisé par l'outil public (ui.js) et par tout
// appelant qui veut la même méthode (mêmes seuils, mêmes rayons).
// ==========================================================================
import { computeIsochronesNetwork, probeJunctionDensity } from "./isochrones.js";
import { setWfsMaxRequestsPerSecond, communeDuPoint } from "./ign-api.js";
import { rayonCommune } from "./rayons-communes.js";
import {
  NETWORK_RADIUS_PROBE_M,
  RADIUS_TIER_VERY_DENSE_MIN_JUNCTIONS,
  RADIUS_TIER_DENSE_MIN_JUNCTIONS,
  RADIUS_TIER_DENSE_M,
  RADIUS_TIER_INTERMEDIATE_MIN_JUNCTIONS,
  RADIUS_TIER_INTERMEDIATE_M,
  RADIUS_TIER_SPARSE_M,
  NETWORK_RADIUS_MAX_M,
  RADIUS_TIER_VERY_DENSE_M,
  RAYONS_RELANCE_M,
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
  if (junctionCount >= RADIUS_TIER_VERY_DENSE_MIN_JUNCTIONS) return RADIUS_TIER_VERY_DENSE_M;
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
 * @param {object|false} [p.ilots]  Réglages des îlots gagnants (voir ILOTS, config.js) ; false = seule la zone reliée au départ.
 * @param {string} [p.direction]  « depart » (j'en pars, défaut), « arrivee » (j'y vais) ou « aller-retour ».
 * @param {(etat:{phase:string, message:string, fraction:number}) => void} [p.onEtat]
 *   phase : « sonde » | « calcul » | « nouvel-essai ».
 * @returns {Promise<{computation:object, probeJunctionCount:number,
 *   probeChosenRadiusMeters:number, usedRadiusMeters:number, radiusRetried:boolean}>}
 */
export async function calculerCarte({ lon, lat, modes, direction, ilots, onEtat = () => {} }) {
  setWfsMaxRequestsPerSecond(WFS_MAX_REQUESTS_PER_SECOND);
  const opts = {
    lon,
    lat,
    modes,
    direction,
    ilots,
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
  // Commune du point (géocodage inverse IGN), en parallèle de la sonde : dans
  // les grandes villes mesurées, le rayon est connu d'avance (rayons-communes.js).
  const [codeCommune, probeJunctionCount] = await Promise.all([
    communeDuPoint(lon, lat),
    probeJunctionDensity(lon, lat, NETWORK_RADIUS_PROBE_M, opts.nodeSnapToleranceMeters, opts.wfsPageSize),
  ]);
  const rayonPrevu = rayonCommune(codeCommune, direction ?? "depart");
  const probeChosenRadiusMeters = rayonPrevu ?? choisirRayonInitial(probeJunctionCount);
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
        (rayonPrevu ? " km (grande ville mesurée) — " : " km — "),
    ),
  });

  // Filet de sécurité : si ce rayon adapté au contexte ne suffit finalement
  // pas (une zone touche le bord), on relance au rayon suivant de
  // RAYONS_RELANCE_M, jusqu'au rayon maximal (voir config.js).
  // Le réseau déjà téléchargé est réutilisé : seul l'anneau entre l'ancien et
  // le nouveau rayon est demandé à l'IGN (etendreIGNRoads dans ign-api.js).
  let radiusRetried = false;
  // (Déjà au rayon maximal : un nouvel essai donnerait le même résultat.)
  while (estTronque(computation) && usedRadiusMeters < NETWORK_RADIUS_MAX_M) {
    // Réseau repris de la mémoire (même point, même rayon) : le réseau brut
    // n'a pas été gardé, on le relit depuis le cache des tuiles.
    const reseauPrecedent = computation.reseau ?? (computation.chargerReseau ? await computation.chargerReseau() : undefined);
    delete computation.reseau;
    delete computation.chargerReseau;
    const ancienRayon = usedRadiusMeters;
    usedRadiusMeters = RAYONS_RELANCE_M.find((r) => r > usedRadiusMeters) ?? NETWORK_RADIUS_MAX_M;
    radiusRetried = true;
    computation = await computeIsochronesNetwork({
      ...opts,
      networkRadiusMeters: usedRadiusMeters,
      reseauPrecedent,
      garderReseau: usedRadiusMeters < NETWORK_RADIUS_MAX_M,
      onProgress: suivi(
        "nouvel-essai",
        "Rayon de " + ancienRayon / 1000 + " km insuffisant, nouvel essai à " + usedRadiusMeters / 1000 + " km — ",
      ),
    });
  }
  delete computation.reseau;
  delete computation.chargerReseau;
  return { computation, codeCommune, rayonCommunePrevu: rayonPrevu, probeJunctionCount, probeChosenRadiusMeters, usedRadiusMeters, radiusRetried };
}

export { estTronque };
