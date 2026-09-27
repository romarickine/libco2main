/**
 * ui/commun.js — constantes d'affichage et formatage
 * ---------------------------------------------------------------------------
 * Listes et libellés affichés (étapes, professions, modes de transport,
 * énergies, mobilier), palette des graphiques, formatage des nombres et
 * échappement XML pour les exports.
 *
 * Utilisé par : tous les modules d'affichage et d'export de MSP.
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */

export const ETAPES = [
  "Profil",
  "Local",
  "Praticiens",
  "Staff admin",
  "Postes mutualisés",
  "Résultats",
  "Pistes d'action",
];

export const PROFESSIONS_APL = [
  { valeur: "medecin_generaliste", label: "Médecin généraliste" },
  { valeur: "infirmier", label: "Infirmier(ère)" },
  { valeur: "sage_femme", label: "Sage-femme" },
  { valeur: "kinesitherapeute", label: "Kinésithérapeute" },
  { valeur: "chirurgien_dentiste", label: "Chirurgien(ne)-dentiste" },
  { valeur: "pharmacien", label: "Pharmacien(ne) titulaire d'officine" },
  { valeur: null, label: "Autre profession de santé (ostéopathe, psychologue, diététicien...)" },
];

export const MODES_DEPLACEMENT = [
  "voiture_thermique",
  "voiture_hybride",
  "voiture_electrique",
  "deux_roues",
  "velo_meca",
  "velo_elec",
  "bus",
  "metro_tram",
  "rer_ter",
  "tgv",
  "marche",
  "avion_court",
  "avion_moyen",
  "avion_long",
];

export const LABELS_MODES = {
  voiture_thermique: "Voiture thermique",
  voiture_hybride: "Voiture hybride",
  voiture_electrique: "Voiture électrique",
  deux_roues: "Deux-roues motorisé",
  velo_meca: "Vélo (mécanique)",
  velo_elec: "Vélo à assistance électrique",
  bus: "Bus urbain",
  metro_tram: "Métro / Tramway",
  rer_ter: "RER / TER",
  tgv: "TGV / grande ligne",
  marche: "Marche à pied",
  avion_court: "Avion court-courrier (< 1 000 km)",
  avion_moyen: "Avion moyen-courrier (1 000 - 3 500 km)",
  avion_long: "Avion long-courrier (> 3 500 km)",
};

export const ENERGIES = ["electricite", "gaz", "fioul", "bois", "reseau_chaleur", "pac"];

export const LABELS_ENERGIES = {
  electricite: "Électricité",
  gaz: "Gaz naturel",
  fioul: "Fioul domestique",
  bois: "Bois / biomasse",
  reseau_chaleur: "Réseau de chaleur urbain",
  pac: "Pompe à chaleur",
};

export const LABELS_MOBILIER = {
  chaiseBois: "Chaise bois",
  chaisePlastique: "Chaise plastique",
  chaiseBoisTextile: "Chaise bois et textile",
  tableBoisMassif: "Table bois massif",
  tableRepresentative: "Table de bureau",
  armoire: "Armoire",
  canapeTextile: "Canapé textile",
  canapeCuir: "Canapé cuir",
};

export const COULEURS_POSTES = ["#0071C1", "#2E673E", "#C98A2C", "#B85C5C", "#8A6FB0", "#4E8FA3"];

/**
 * Formate un nombre entier à la française ; « — » si la valeur manque.
 * @param {number|null} n
 * @returns {string}
 */
export function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

/**
 * Formate un nombre avec une décimale ; « — » si la valeur manque.
 * @param {number|null} n
 * @returns {string}
 */
export function fmtDecimal(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// EXPORT EXCEL — génère un classeur multi-feuilles au format SpreadsheetML
// (XML natif Excel, aucune librairie externe requise, fonctionne hors-ligne).
// Reprend le détail complet des calculs, de la réventilation et de tous les
// facteurs d'émission utilisés, pour que chaque chiffre soit vérifiable.
export function xmlEchappe(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
