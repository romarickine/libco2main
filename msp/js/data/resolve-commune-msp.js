// Complète zonage-insee.js (repris tel quel du socle individuel) avec la seule
// fonction qui manquait pour un usage MSP : résoudre une zone directement à
// partir du code commune INSEE (le socle individuel ne fait que de la
// recherche par nom via chercherCommunes, adaptée à une saisie utilisateur).
import { COMMUNES, ZONES } from './zonage-insee.js';

const COMMUNES_PAR_CODE = new Map(COMMUNES.map(c => [c.code, c]));
const ZONES_PAR_ID = new Map(ZONES.map(z => [z.id, z]));

/**
 * @param {string} codeInsee
 * @returns {object} zone (objet ZONES, avec id/label/modal)
 */
export function resolveZoneFromCommune(codeInsee) {
  const commune = COMMUNES_PAR_CODE.get(codeInsee);
  if (!commune) throw new Error(`Commune INSEE inconnue : ${codeInsee}`);
  const zone = ZONES_PAR_ID.get(commune.zoneId);
  if (!zone) throw new Error(`Zone inconnue pour la commune ${codeInsee} (zoneId=${commune.zoneId})`);
  return zone;
}
