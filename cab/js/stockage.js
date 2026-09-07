/**
 * stockage.js
 * ----------------------------------------------------------------------
 * Sauvegarde et lecture des bilans de l'utilisateur, pour lui permettre de
 * reprendre sa saisie plus tard et de suivre l'évolution de son empreinte
 * dans le temps (voir evolution.js pour le rendu de cette évolution).
 *
 * MÉCANISME CHOISI : localStorage du navigateur.
 * Justification : c'est la solution la plus simple pour une première
 * version qui ne nécessite ni compte utilisateur ni serveur — les données
 * restent sur l'appareil de l'utilisateur, sans transfert réseau. C'est
 * aussi sa LIMITE : les données ne sont disponibles que sur le navigateur/
 * appareil où elles ont été saisies (pas de synchronisation multi-appareil),
 * et un usager qui vide son cache navigateur perd son historique.
 *
 * MIGRATION FUTURE : si le projet évolue vers un compte utilisateur ou un
 * stockage serveur, seul ce fichier a besoin d'être réécrit (remplacer les
 * appels localStorage par des appels à une API REST/GraphQL) — le reste de
 * l'application (calcul.js, ui.js, evolution.js) consomme uniquement les
 * fonctions exportées ci-dessous (get/set/liste/suppression) et n'a pas à
 * changer.
 *
 * FORMAT DE DONNÉES STOCKÉ :
 * Clé localStorage : "libco2_bilans_v1" (le suffixe "_v1" est le
 * versionnement du format : si le questionnaire évolue de façon
 * incompatible, créer une clé "_v2" et écrire une fonction de migration
 * plutôt que de casser silencieusement les données existantes des
 * utilisateurs).
 *
 * Valeur stockée : un tableau JSON de "bilans", chacun de la forme :
 * {
 *   id: string,          // identifiant unique (timestamp + aléatoire)
 *   dateCalcul: string,  // date ISO 8601 du moment où le bilan a été enregistré
 *   nomCabinet: string,  // nom donné par l'utilisateur (facultatif)
 *   data: {...},         // état complet du formulaire (voir main.js: etatInitial)
 *   resultats: {         // résumé des résultats, pour affichage rapide dans
 *     totalT: number,    // l'historique sans avoir à tout recalculer
 *     parActe: number,
 *     parPoste: {...}
 *   }
 * }
 * ----------------------------------------------------------------------
 */

const CLE_STOCKAGE = "libco2_bilans_v1";
const CLE_BROUILLON = "libco2_brouillon_v1"; // sauvegarde automatique de la saisie en cours

function stockageDisponible() {
  try {
    const test = "__libco2_test__";
    window.localStorage.setItem(test, "1");
    window.localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

export const STOCKAGE_OK = typeof window !== "undefined" && stockageDisponible();

function lireTous() {
  if (!STOCKAGE_OK) return [];
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    return brut ? JSON.parse(brut) : [];
  } catch (e) {
    console.error("Lib&CO2 — lecture du stockage impossible :", e);
    return [];
  }
}

function ecrireTous(bilans) {
  if (!STOCKAGE_OK) return false;
  try {
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(bilans));
    return true;
  } catch (e) {
    console.error("Lib&CO2 — écriture du stockage impossible (quota dépassé ?) :", e);
    return false;
  }
}

// Enregistre un nouveau bilan dans l'historique.
// Entrée : { data, resultats, nomCabinet }
// Sortie : le bilan créé (avec son id et sa date), ou null si l'écriture a échoué
export function enregistrerBilan({ data, resultats, nomCabinet }) {
  const bilan = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    dateCalcul: new Date().toISOString(),
    nomCabinet: nomCabinet || "",
    data,
    resultats: {
      totalT: resultats.totalT,
      parActe: resultats.parActe,
      parPoste: resultats.parPoste,
    },
  };
  const bilans = lireTous();
  bilans.push(bilan);
  const ok = ecrireTous(bilans);
  return ok ? bilan : null;
}

// Renvoie la liste des bilans enregistrés, triée du plus ancien au plus récent.
export function listerBilans() {
  return lireTous().sort((a, b) => new Date(a.dateCalcul) - new Date(b.dateCalcul));
}

// Supprime un bilan par son identifiant.
export function supprimerBilan(id) {
  const bilans = lireTous().filter((b) => b.id !== id);
  return ecrireTous(bilans);
}

// Supprime tout l'historique (remise à zéro complète).
export function supprimerTout() {
  if (!STOCKAGE_OK) return false;
  window.localStorage.removeItem(CLE_STOCKAGE);
  return true;
}

// --- Brouillon de saisie en cours (pour reprendre le questionnaire sans
// tout ressaisir, indépendamment de l'historique des bilans enregistrés) ---

export function sauvegarderBrouillon(data) {
  if (!STOCKAGE_OK) return false;
  try {
    window.localStorage.setItem(CLE_BROUILLON, JSON.stringify({ data, sauvegardeLe: new Date().toISOString() }));
    return true;
  } catch (e) {
    return false;
  }
}

export function lireBrouillon() {
  if (!STOCKAGE_OK) return null;
  try {
    const brut = window.localStorage.getItem(CLE_BROUILLON);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    return null;
  }
}

export function supprimerBrouillon() {
  if (!STOCKAGE_OK) return;
  window.localStorage.removeItem(CLE_BROUILLON);
}
