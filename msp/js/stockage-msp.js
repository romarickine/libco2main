/**
 * stockage-msp.js — sauvegarde locale des bilans MSP
 * ---------------------------------------------------------------------------
 * Seul module autorisé à accéder à localStorage (même règle que Cab). Deux
 * clés, suffixées d'une version de format :
 *   libco2msp_brouillon_v1  saisie en cours, reprise au rechargement ;
 *   libco2msp_bilans_v1     historique des bilans calculés.
 * Les données restent dans le navigateur de l'utilisateur (aucun serveur).
 * Chaque accès est protégé : un stockage plein ou désactivé (navigation
 * privée) n'empêche jamais l'outil de fonctionner.
 *
 * Utilisé par : main-msp.js.
 */
const CLE_BILANS = "libco2msp_bilans_v1";
const CLE_BROUILLON = "libco2msp_brouillon_v1";

/**
 * Enregistre la saisie en cours, horodatée.
 * @param {object} data  État complet du formulaire.
 * @returns {boolean} false si le stockage est indisponible ou plein.
 */
export function sauvegarderBrouillon(data) {
  try {
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({ data, sauvegardeLe: new Date().toISOString() }));
    return true;
  } catch (e) {
    console.error("Échec de sauvegarde du brouillon MSP", e);
    return false;
  }
}

/**
 * Relit la saisie en cours.
 * @returns {{data: object, sauvegardeLe: string}|null} null si aucun brouillon ou stockage illisible.
 */
export function chargerBrouillon() {
  try {
    const brut = localStorage.getItem(CLE_BROUILLON);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    console.error("Échec de lecture du brouillon MSP", e);
    return null;
  }
}

/**
 * Supprime la saisie en cours.
 */
export function effacerBrouillon() {
  try {
    localStorage.removeItem(CLE_BROUILLON);
  } catch (e) {
    console.error("Échec de suppression du brouillon MSP", e);
  }
}

/**
 * Ajoute un bilan à l'historique, avec un identifiant et un horodatage.
 * @param {{structureMSP: object, resultat: object}} bilan
 * @returns {boolean} false si le stockage est indisponible ou plein.
 */
export function enregistrerBilan(bilan) {
  const bilans = listerBilans();
  bilans.push({ ...bilan, id: crypto.randomUUID(), horodatage: new Date().toISOString() });
  try {
    localStorage.setItem(CLE_BILANS, JSON.stringify(bilans));
    return true;
  } catch (e) {
    console.error("Échec d'enregistrement du bilan MSP", e);
    return false;
  }
}

// Variante utilisée par l'import d'archive : conserve l'id et l'horodatage
// d'origine du bilan importé (plutôt que d'en générer de nouveaux comme
// enregistrerBilan), pour préserver la vraie date historique du calcul.
export function enregistrerBilanBrut(bilan) {
  const bilans = listerBilans();
  bilans.push(bilan);
  try {
    localStorage.setItem(CLE_BILANS, JSON.stringify(bilans));
    return true;
  } catch (e) {
    console.error("Échec d'enregistrement (import) du bilan MSP", e);
    return false;
  }
}

/**
 * Historique des bilans, dans l'ordre d'enregistrement.
 * @returns {object[]} Tableau vide si aucun bilan ou stockage illisible.
 */
export function listerBilans() {
  try {
    const brut = localStorage.getItem(CLE_BILANS);
    return brut ? JSON.parse(brut) : [];
  } catch (e) {
    console.error("Échec de lecture des bilans MSP", e);
    return [];
  }
}

/**
 * Retire un bilan de l'historique.
 * @param {string} id
 */
export function supprimerBilan(id) {
  const bilans = listerBilans().filter((b) => b.id !== id);
  try {
    localStorage.setItem(CLE_BILANS, JSON.stringify(bilans));
  } catch (e) {
    console.error("Échec de suppression du bilan MSP", e);
  }
}
