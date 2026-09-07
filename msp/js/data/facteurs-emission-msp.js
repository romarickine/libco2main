// Facteurs et fonctions spécifiques à l'extension MSP de Lib&CO2.
// Ne redéfinit RIEN de ce qui existe déjà dans facteurs-emission.js (socle
// individuel, copié tel quel dans ce dossier) : RATIOS_ENERGIE_PAR_ACTIVITE,
// FE_GROS_MATERIEL_STANDARD/MASSIF, FE_MONETAIRE, FE_FRET_COLIS, etc. sont
// importés directement depuis ce fichier par calcul-msp.js.

// ---------------------------------------------------------------------------
// 0. PRESCRIPTIONS — professions habilitées à prescrire dans l'outil MSP, et
// facteur médicaments. SOURCÉ : The Shift Project, "Facteurs d'émission des
// médicaments" (note technique, avril 2023), reprenant le facteur ADEME Base
// Empreinte de 500 kgCO2e/k€ (0,5 kgCO2e/€) — retenu par le Shift Project
// après comparaison de plusieurs sources comme la valeur la plus robuste.
// Limite assumée : facteur moyen tous médicaments confondus, sans
// distinction par classe thérapeutique (une base plus fine, Ecovamed,
// existe si une précision ultérieure est souhaitée).
export const FE_MEDICAMENTS_EUR = 0.5;

// Kiné et infirmier prescrivent très marginalement (renouvellements,
// vaccination) : seules médecin généraliste, chirurgien-dentiste et
// sage-femme sont retenus comme prescripteurs dans l'outil (choix éditorial).
export const PROFESSIONS_PRESCRIPTRICES = ['medecin_generaliste', 'chirurgien_dentiste', 'sage_femme'];

// ---------------------------------------------------------------------------
// 1. VÉHICULES PROFESSIONNELS — décomposition usage / fabrication
// Source : Base Carbone V23.10, familles "Voiture" (2023) et "Voiture
// particulière" (2020, Valide générique). SOURCÉ. Nécessaire ici (absent du
// socle individuel) car le socle utilise un facteur combiné usage+fabrication
// par km (FE_TRANSPORT.voiture_*), alors que la MSP a besoin de séparer les
// deux pour éviter un double comptage avec le nouveau poste immobilisation
// véhicule. Les clés correspondent à celles de FE_TRANSPORT
// (voiture_thermique / voiture_hybride / voiture_electrique).
export const FACTEURS_VEHICULES_USAGE_FABRICATION = {
  voiture_thermique: { usage: 0.208, fabrication: 0.041, total: 0.249 },
  // Moyenne arithmétique simple des 4 variantes Base Carbone (mild essence,
  // mild diesel, full, rechargeable) — non pondérée par les parts de marché
  // réelles (ESTIMÉ sur la pondération, SOURCÉ sur chaque valeur d'origine).
  voiture_hybride: { usage: 0.121, fabrication: 0.046, total: 0.167 },
  voiture_electrique: { usage: 0.020, fabrication: 0.084, total: 0.103 }
};

// ---------------------------------------------------------------------------
// 2. BÂTIMENT — carbone de construction, sous-ligne du poste local/immobilisations
// Facteur SOURCÉ (Base Carbone V23.10, id 20739, "Établissement de santé,
// structure béton", Valide générique, MAJ 2014). Durée d'amortissement de 30
// ans et seuil de rénovation lourde : ESTIMÉ / choix éditorial de Romaric.
export const FACTEUR_BATIMENT_SANTE = {
  kgCO2e_m2: 440,
  dureeAmortissementAns: 30,
  seuilRenovationLourde_eur_m2: 275 // réglementation locaux non résidentiels, SOURCÉ
};

/**
 * Émissions annuelles du bâtiment, sous-ligne du poste local.
 */
export function emissionsBatimentAnnuelles(surfaceM2, anneeConstruction, renovationLourde, anneeActuelle) {
  let anneeReference = anneeConstruction;
  if (renovationLourde) {
    const seuil = surfaceM2 * FACTEUR_BATIMENT_SANTE.seuilRenovationLourde_eur_m2;
    if (renovationLourde.coutTravaux >= seuil && renovationLourde.annee > anneeReference) {
      anneeReference = renovationLourde.annee;
    }
  }
  const age = anneeActuelle - anneeReference;
  if (age > FACTEUR_BATIMENT_SANTE.dureeAmortissementAns) return 0;
  return (surfaceM2 * FACTEUR_BATIMENT_SANTE.kgCO2e_m2) / FACTEUR_BATIMENT_SANTE.dureeAmortissementAns;
}

// ---------------------------------------------------------------------------
// 3. IMMOBILISATIONS À DURÉE DE DÉTENTION DÉCLARÉE (remplace le forfait
// DUREE_AMORTISSEMENT_ANS=5 fixe du socle individuel pour la MSP)

// Numérique : valeurs BRUTES de fabrication (non amorties), "dé-annualisées"
// à partir de FE_NUMERIQUE du socle (qui divise déjà implicitement par 5) :
// ordi_fixe_an=45 -> 225 ; ordi_portable_an=30 -> 156 (SOURCÉ ISLEAN/GreenIT,
// valeur d'origine) ; ecran_an=15 -> 75. Mêmes valeurs, présentation différente.
export const FACTEURS_NUMERIQUE_BRUT = {
  ordinateurFixe: 296,     // SOURCÉ — Base Carbone V23.10, "Ordinateur fixe", kgCO2e/unité, Archivé (id 27004). Valeur la plus élevée entre les deux variantes archivées disponibles (169 et 296) retenue par choix éditorial de majoration prudente.
  ordinateurPortable: 156, // SOURCÉ (ISLEAN/GreenIT)
  ecranSupplementaire: 431 // SOURCÉ — Base Carbone V23.10, "Ecran LCD, 24 pouces", kgCO2e/appareil, Archivé (id 20598). Valeur la plus élevée parmi les tailles/générations disponibles (222 à 431 selon la taille et l'ancienneté de la donnée) retenue par choix éditorial de majoration prudente.
};

// "Autre matériel informatique" (imprimante, lecteur de carte Vitale...) :
// réutilise FE_GROS_MATERIEL_STANDARD (0,19 kgCO2e/€) du socle. Alternative
// non retenue par défaut, si Romaric souhaite un facteur imprimante dédié :
//   Photocopieur (multifonction partagé) : 2935 kgCO2e/appareil, Valide générique (Base Carbone)
//   Imprimante multifonction A3 bureau couleur : 883 kgCO2e/appareil, Archivé (2019)
//   Imprimante multifonction A4 laser couleur : 218 kgCO2e/appareil, Archivé (2019)
//   Imprimante mono-fonction A4 laser N&B : 166 kgCO2e/appareil, Archivé (2019)

// Mobilier : comptage par unité (choix MSP, différent du socle individuel qui
// utilise FE_MOBILIER en €/kgCO2e). SOURCÉ Base Carbone V23.10.
export const FACTEURS_MOBILIER_UNITE = {
  chaiseBois: 18.6,
  chaisePlastique: 34.4,
  chaiseBoisTextile: 24.8,
  tableBoisMassif: 80.2,
  tableRepresentative: 60.1,
  armoire: 907,
  canapeTextile: 179,
  canapeCuir: 182
};

/**
 * Émissions annuelles d'une ligne d'immobilisation à durée de détention
 * déclarée (numérique brut, matériel lourd via FE_GROS_MATERIEL_STANDARD/
 * MASSIF du socle, ou mobilier par unité).
 */
export function emissionsImmobilisationAnnuelles(quantite, facteurUnitaireBrut, dureeDetentionAns) {
  return (quantite * facteurUnitaireBrut) / dureeDetentionAns;
}

// ---------------------------------------------------------------------------
// 4. RÉVENTILATION — clés de répartition (absent du socle individuel, qui ne
// gère qu'une seule structure/un seul praticien)
export function clefReventilationSurface(surfaceDedieeM2, surfaceTotaleM2) {
  return surfaceDedieeM2 / surfaceTotaleM2;
}

export function clefReventilationActes(nbActesPraticien, totalActesStructure) {
  return nbActesPraticien / totalActesStructure;
}

// ---------------------------------------------------------------------------
// 5. ACTIONS SPÉCIFIQUES MSP — s'ajoutent au catalogue partagé (facteurs-
// emission.js) sur l'écran "Pistes d'action". Ce type d'action n'a de sens
// que dans une structure pluriprofessionnelle (coordination entre plusieurs
// praticiens), donc conservé séparément plutôt que d'être ajouté au fichier
// du socle individuel où il ne s'appliquerait pas.
export const ACTIONS_MSP_SUPPLEMENTAIRES = [
  {
    id: "msp1",
    poste: "deplacements_patientele",
    titre: "Coordonner le parcours de soins pour grouper plusieurs actes lors d'une même visite (ex. consultation médicale + séance de kiné le même jour)",
    source: "ESTIMÉ — pas d'étude chiffrant précisément ce gain pour un contexte MSP ; principe fondé sur la réduction du nombre de trajets du patient (deux venues à la structure ramenées à une seule), rendu possible par la coordination entre professionnels d'une même structure.",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.2,
    cost: "gratuit",
    coutKg: "0 € — coordination interne entre professionnels"
  }
];

// ---------------------------------------------------------------------------
// 6. TAUX DE DÉPENDANCE AUX ÉNERGIES FOSSILES — exprime le ratio kgCO2e/acte
// de la MSP en pourcentage de l'objectif national 2050 "sur les actes, sans
// levier prévention" (100% = la MSP est déjà à l'objectif ; 300% = elle émet
// 3 fois l'objectif). Entièrement sourcé, méthode détaillée dans l'infobulle
// de l'écran Résultats :
// - Moyenne nationale médecine de ville 2023 : 4,99 kgCO2e/acte
//   = 23% des 49 MtCO2e du secteur santé (The Shift Project, "Décarboner la
//   santé", 2023) ÷ 2,256 milliards d'actes (médecins + auxiliaires médicaux
//   + sages-femmes + dentistes, CNAM/Ameli 2023 ; + biologie médicale
//   Biol'AM 2023, prescripteurs ville, déflatée d'une hypothèse de 3 actes
//   NABM par passage en laboratoire).
// - Objectif national 2050 "sur les actes, sans prévention" : -61,2%
//   (The Shift Project, 2021 — scénario 19 MtCO2e/49 MtCO2e, mesures de
//   décarbonation des postes d'émission + baisse de 60% de l'intensité
//   carbone des médicaments/dispositifs médicaux, SANS réduction du volume
//   de soins par la prévention — l'objectif -80% du rapport n'est atteint
//   qu'en ajoutant ce dernier levier, hors périmètre de cet indicateur).
export const RATIO_NATIONAL_MEDECINE_VILLE_KG = 4.99;
export const REDUCTION_OBJECTIF_2050_SANS_PREVENTION = 0.612;
export const OBJECTIF_2050_KG = RATIO_NATIONAL_MEDECINE_VILLE_KG * (1 - REDUCTION_OBJECTIF_2050_SANS_PREVENTION);

export function calculerTauxDependanceFossile(ratioParActe) {
  if (ratioParActe == null || ratioParActe <= 0) return null;
  // Progression sur le chemin entre la moyenne nationale actuelle (0%) et
  // l'objectif 2050 (100%) — pas un simple "ratio / objectif" qui pourrait
  // dépasser 100% indéfiniment. Plafonnée à [0, 100] : en dessous de la
  // moyenne nationale = 0% (pas de progression négative affichée) ; à
  // l'objectif 2050 ou mieux = 100%.
  const plage = RATIO_NATIONAL_MEDECINE_VILLE_KG - OBJECTIF_2050_KG; // toujours positif
  const progressionBrute = ((RATIO_NATIONAL_MEDECINE_VILLE_KG - ratioParActe) / plage) * 100;
  const progression = Math.max(0, Math.min(100, progressionBrute));
  return {
    ratioActuel: ratioParActe,
    ratioNational: RATIO_NATIONAL_MEDECINE_VILLE_KG,
    objectif2050: OBJECTIF_2050_KG,
    progressionVersObjectif2050: progression
  };
}
