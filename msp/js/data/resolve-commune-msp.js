/**
 * resolve-commune-msp.js — zone de mobilité d'une commune, par code INSEE
 * ---------------------------------------------------------------------------
 * Complète le zonage du socle (shared/js/data/zonage-insee.js), qui recherche
 * les communes par leur nom pour la saisie : la MSP enregistre le code INSEE
 * de sa commune et a besoin de retrouver directement la zone correspondante.
 *
 * Utilisé par : calcul-msp.js.
 */
import { ZONES, chargerCommunes } from "../../../shared/js/data/zonage-insee.js";

const ZONES_PAR_ID = new Map(ZONES.map((z) => [z.id, z]));
/** Index code INSEE → commune, construit après le chargement de la liste. */
let communesParCode = null;

/**
 * Charge la liste des communes (fichier séparé, à la demande) et construit
 * l'index par code INSEE. À attendre avant le premier calcul : voir
 * chargerDonneesCalcul() dans etat-msp.js.
 * @returns {Promise<void>}
 */
export async function preparerCommunes() {
  if (communesParCode) return;
  const { COMMUNES } = await chargerCommunes();
  communesParCode = new Map(COMMUNES.map((c) => [c.code, c]));
}

/**
 * Zone de mobilité (report modal) de la commune de la structure.
 * @param {string} codeInsee
 * @returns {object} zone (objet ZONES, avec id/label/modal)
 * @throws {Error} Si la liste n'est pas chargée, ou si le code est inconnu.
 */
export function resolveZoneFromCommune(codeInsee) {
  if (!communesParCode)
    throw new Error("Liste des communes non chargée : attendre chargerDonneesCalcul() avant le calcul.");
  const commune = communesParCode.get(codeInsee);
  if (!commune) throw new Error(`Commune INSEE inconnue : ${codeInsee}`);
  const zone = ZONES_PAR_ID.get(commune.zoneId);
  if (!zone) throw new Error(`Zone inconnue pour la commune ${codeInsee} (zoneId=${commune.zoneId})`);
  return zone;
}
