// © 2026 Lib&CO2 SASU — tous droits réservés. Reproduction, modification ou redistribution du code interdites sans accord écrit préalable.
// ==========================================================================
// Bornes des champs numériques de Cab et MSP (05/11/2026)
// ==========================================================================
// Demande du porteur : aucune valeur négative, et un maximum pour écarter les
// erreurs de saisie (zéro de trop, kg au lieu de g…), proportionnel à la
// taille de la structure (nombre de personnes, surface). Une saisie hors
// bornes est ramenée à la borne, avec un message sous le champ.
//
// Les maxima ne sont PAS des valeurs typiques : ce sont des plafonds « jamais
// atteints de bonne foi », environ 5 à 10 fois une valeur déjà élevée.
// Sauf mention contraire : [Estimé], choix de cadrage, à resserrer si un cas
// réel les dépasse.
//
// Repères sourcés :
// - déchets : ordures ménagères collectées en France, 391 kg par habitant et
//   par an (ADEME, enquête collecte 2007, soit 7,5 kg par semaine ; Banque des
//   Territoires, « L'Ademe passe au crible le contenu des poubelles », 2009) :
//   50 kg par semaine et par personne et par catégorie, c'est environ 7 fois
//   tous les déchets d'un habitant ;
// - jours (7 par semaine), semaines (52 par an), pourcentages (100) : bornes
//   logiques ;
// - distance aller-retour d'un déplacement lointain : 40 000 km, soit le tour
//   de la Terre (aucun point n'est à plus de 20 000 km d'un autre par la
//   surface) ;
// - consommation d'énergie d'un local : 1 000 kWh par m² et par an, environ
//   6 fois la consommation moyenne des locaux de santé libérale (73 + 99 =
//   172 kWh/m²/an, déclarations OPERAT 2024, déjà utilisées par Cab et MSP).
// ==========================================================================

/** Plafonds unitaires. Le maximum d'un champ = plafond × taille (personnes, m²…). */
export const PLAFONDS = {
  personnes: 500, // praticiens ou salariés (ETP) dans une structure [Estimé]
  actesParPraticien: 20000, // actes par an et par praticien ETP [Estimé]
  kmDomicileTravailParPersonne: 150, // km aller par jour [Estimé]
  kmTourneesParPersonne: 80000, // km par an de visites à domicile [Estimé]
  kmDeplacementsProParPersonne: 100000, // km par an de déplacements professionnels [Estimé]
  congresParPersonne: 50, // déplacements lointains par an [Estimé]
  kmAllerRetourLointain: 40000, // tour de la Terre (voir en-tête)
  surfaceParPersonne: 500, // m² par personne [Estimé]
  surfaceStructure: 20000, // m², quand le nombre de personnes n'est pas encore connu [Estimé]
  kWhParM2: 1000, // voir en-tête
  kWhSansSurface: 1000000, // kWh/an, quand la surface n'est pas connue [Estimé]
  equipementsInfoParPersonne: 10, // ordinateurs ou écrans par personne [Estimé]
  dureeDetentionAns: 50, // durée de détention d'un équipement [Estimé]
  achatsAnnuelsParPersonne: 100000, // € par an et par ligne de consommables [Estimé]
  servicesParPersonne: 500000, // € par an de services ou de sous-traitance [Estimé]
  medicamentsParPraticien: 5000000, // € par an prescrits ou d'actes prescrits [Estimé]
  caMedicamentsParPharmacien: 10000000, // € HT par an [Estimé]
  caParapharmacieParPharmacien: 5000000, // € HT par an [Estimé]
  materielParPersonne: 3000000, // € de valeur d'achat par ligne de gros matériel [Estimé]
  mobilierParPersonne: 200000, // € de valeur d'achat [Estimé]
  meublesParPersonne: 100, // nombre de meubles par ligne [Estimé]
  colisParPersonne: 5000, // colis par an (environ 20 par jour travaillé) [Estimé]
  dechetsKgSemaineParPersonne: 50, // voir en-tête
  dasriKgSemaineParPersonne: 20, // [Estimé]
  coutTravauxParM2: 5000, // € de rénovation lourde par m² [Estimé]
  actesPrescritsParPraticien: 100000, // actes paramédicaux prescrits par an [Estimé]
  materielInfoParPersonne: 100000, // € de valeur d'achat d'autre matériel informatique [Estimé]
};

/** Maximum fondé sur la surface (m²), ou valeur de repli si la surface n'est pas connue. */
export function maxSurface(plafondParM2, surface, repli) {
  const m2 = Number(surface) || 0;
  return m2 > 0 ? Math.round(plafondParM2 * m2) : repli;
}

/** Maximum = plafond × taille, la taille valant au moins 1. Arrondi à l'entier. */
export function maxPour(plafond, taille = 1) {
  return Math.round(plafond * Math.max(1, Number(taille) || 0));
}

/**
 * Valeur d'un champ numérique ramenée dans ses bornes (attributs min et max).
 * @param {HTMLInputElement} input
 * @returns {{valeur: number, corrigee: boolean, borne: "min"|"max"|null}}
 *   valeur : 0 pour un champ vide (comme avant) ; corrigee : la saisie était hors bornes.
 */
export function valeurBornee(input) {
  if (input.value === "") return { valeur: 0, corrigee: false, borne: null };
  const v = Number(input.value);
  const min = input.min === "" ? -Infinity : Number(input.min);
  const max = input.max === "" ? Infinity : Number(input.max);
  if (!Number.isFinite(v)) return { valeur: Number.isFinite(min) ? Math.max(0, min) : 0, corrigee: true, borne: "min" };
  if (v < min) return { valeur: min, corrigee: true, borne: "min" };
  if (v > max) return { valeur: max, corrigee: true, borne: "max" };
  return { valeur: v, corrigee: false, borne: null };
}

/** Texte expliquant une correction. */
export function messageBorne(input, borne) {
  const fr = (n) => Number(n).toLocaleString("fr-FR");
  if (borne === "min") {
    return Number(input.min) <= 0
      ? "Valeur négative impossible : ramenée à " + fr(Math.max(0, Number(input.min) || 0)) + "."
      : "Minimum " + fr(input.min) + " : valeur ramenée à " + fr(input.min) + ".";
  }
  return (
    "Maximum " +
    fr(input.max) +
    (input.dataset.raisonMax ? " " + input.dataset.raisonMax : "") +
    " : valeur ramenée à " +
    fr(input.max) +
    ". Vérifiez l’unité ou un zéro de trop."
  );
}

/** Attributs HTML min, max et raison d'un champ. */
export function attrBornes(min, max, raison) {
  return (
    (min !== undefined ? ` min="${min}"` : "") +
    (max !== undefined ? ` max="${max}"` : "") +
    (raison ? ` data-raison-max="${raison}"` : "")
  );
}

/** Raison affichée avec le maximum (« pour une structure de 3 personnes »…). */
export function raisonPersonnes(n) {
  const k = Math.max(1, Math.round(Number(n) || 0));
  return k > 1 ? `pour ${k} personnes` : "par personne";
}
