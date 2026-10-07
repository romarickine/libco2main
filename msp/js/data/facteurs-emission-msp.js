/**
 * facteurs-emission-msp.js — facteurs et règles propres à Lib&CO2 MSP
 * ---------------------------------------------------------------------------
 * Complète la source unique (shared/js/data/facteurs-emission.js) sans rien
 * en redéfinir : médicaments et professions prescriptrices, véhicules
 * (usage / fabrication), bâtiment de santé, mobilier compté à l'unité, clés
 * de réventilation entre praticiens, objectif 2050, libellés d'actions
 * adaptés à une structure collective et actions propres aux MSP.
 * Même convention de sourçage : SOURCÉ (référence précise) ou ESTIMÉ
 * (raisonnement explicité).
 *
 * Utilisé par : calcul-msp.js, etat-msp.js, modules ui/ et export/.
 */
import { FE_MONETAIRE, categorieCout } from "../../../shared/js/data/facteurs-emission.js";

// ---------------------------------------------------------------------------
// 0. PRESCRIPTIONS — professions habilitées à prescrire dans l'outil MSP, et
// facteur médicaments. SOURCÉ : même facteur que Lib&CO2 Cab
// (FE_MONETAIRE.medicaments, source unique) : Base Carbone V23.6, « Produits
// pharmaceutiques de base et préparations pharmaceutiques » 2023, 194
// kgCO2e/k€ HT (id 43435). Remplace 0,5 kgCO2e/€ (The Shift Project, note
// technique « Facteurs d'émissions des médicaments », 18/04/2023, p. 10, qui
// reprenait la Base Empreinte de l'époque) : l'ADEME a depuis publié la
// valeur 2023 (règle R1, version la plus récente de la même source) ; les
// deux outils donnent désormais le même résultat pour la même dépense.
// Limite assumée : facteur moyen tous médicaments confondus, sans
// distinction par classe thérapeutique (une base plus fine, Ecovamed,
// existe si une précision ultérieure est souhaitée).
export const FE_MEDICAMENTS_EUR = FE_MONETAIRE.medicaments;

// Kiné et infirmier prescrivent très marginalement (renouvellements,
// vaccination) : seules médecin généraliste, chirurgien-dentiste et
// sage-femme sont retenus comme prescripteurs dans l'outil (choix éditorial).
export const PROFESSIONS_PRESCRIPTRICES = ["medecin_generaliste", "chirurgien_dentiste", "sage_femme"];

// ---------------------------------------------------------------------------
// 1. VÉHICULES PROFESSIONNELS — décomposition usage / fabrication
// Source : Base Carbone V23.6 (data.ademe.fr, consulté le 06/10/2026), mêmes
// éléments que FE_TRANSPORT (shared/js/data/facteurs-emission.js). SOURCÉ. Nécessaire ici (absent du
// socle individuel) car le socle utilise un facteur combiné usage+fabrication
// par km (FE_TRANSPORT.voiture_*), alors que la MSP a besoin de séparer les
// deux pour éviter un double comptage avec le nouveau poste immobilisation
// véhicule. Les clés correspondent à celles de FE_TRANSPORT
// (voiture_thermique / voiture_hybride / voiture_electrique).
export const FACTEURS_VEHICULES_USAGE_FABRICATION = {
  // « Voiture, motorisation moyenne, 2023 », id 43791 : carburant amont 0,0532
  // + combustion 0,161 = usage 0,2142 ; fabrication 0,041.
  voiture_thermique: { usage: 0.2142, fabrication: 0.041, total: 0.2552 },
  // « Voiture particulière, cœur de gamme, hybride mild essence », id 28011 :
  // carburant 0,0408 + 0,151 = usage 0,1918 ; véhicule 0,04 (variante non
  // rechargeable la plus émissive, règle R3, comme FE_TRANSPORT).
  voiture_hybride: { usage: 0.1918, fabrication: 0.04, total: 0.2318 },
  // « Voiture particulière, cœur de gamme, électrique », id 28007 : électricité
  // 0,0198 ; véhicule 0,0836.
  voiture_electrique: { usage: 0.0198, fabrication: 0.0836, total: 0.1034 },
};

// ---------------------------------------------------------------------------
// 2. BÂTIMENT — carbone de construction, sous-ligne du poste local/immobilisations
// Facteur SOURCÉ (Base Carbone V23.6, id 20739, « Établissement de santé,
// structure en béton », 440 kgCO2e/m², Valide générique, vérifié le
// 06/10/2026). Durée d'amortissement de 30 ans : ESTIMÉ, choix éditorial —
// plus prudent que la période de référence de 50 ans de la RE2020 (que
// retient aussi la Banque de France pour ses bâtiments tertiaires) : une
// durée plus courte donne des émissions annuelles plus hautes.
export const FACTEUR_BATIMENT_SANTE = {
  kgCO2e_m2: 440,
  dureeAmortissementAns: 30,
  seuilRenovationLourde_eur_m2: 275, // réglementation locaux non résidentiels, SOURCÉ
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

// Numérique : les facteurs de fabrication par appareil sont dans la source
// unique (FACTEURS_NUMERIQUE_FABRICATION, shared/js/data/facteurs-emission.js).
// La MSP les amortit sur la durée de détention déclarée par appareil, au lieu
// des 5 ans fixes utilisés par Cab.

// "Autre matériel informatique" (imprimante, lecteur de carte Vitale...) :
// réutilise FE_GROS_MATERIEL_STANDARD (0,19 kgCO2e/€) du socle. Alternative
// non retenue par défaut, si Romaric souhaite un facteur imprimante dédié :
//   Photocopieur (multifonction partagé) : 2935 kgCO2e/appareil, Valide générique (Base Carbone)
//   Imprimante multifonction A3 bureau couleur : 883 kgCO2e/appareil, Archivé (2019)
//   Imprimante multifonction A4 laser couleur : 218 kgCO2e/appareil, Archivé (2019)
//   Imprimante mono-fonction A4 laser N&B : 166 kgCO2e/appareil, Archivé (2019)

// Mobilier : comptage par unité (choix MSP, différent du socle individuel qui
// utilise FE_MOBILIER en €/kgCO2e). SOURCÉ Base Carbone V23.6, vérifié le
// 06/10/2026 : chaise bois id 26958, plastique 26959, bois textile 26960,
// table bois massif 26961, table représentative 26962, armoire 26963, canapé
// textile 26964, canapé cuir 26965 (kgCO2e/unité).
export const FACTEURS_MOBILIER_UNITE = {
  chaiseBois: 18.6,
  chaisePlastique: 34.4,
  chaiseBoisTextile: 24.8,
  tableBoisMassif: 80.2,
  tableRepresentative: 60.1,
  armoire: 907,
  canapeTextile: 179,
  canapeCuir: 182,
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
  // Garde contre la division par zéro : si la surface totale de la
  // structure n'est pas (encore) renseignée, il est impossible de calculer
  // une clé de répartition proportionnelle. Retourner 0 plutôt que NaN
  // évite de propager une valeur cassée dans toutes les fiches
  // individuelles — un signal visible est affiché ailleurs (voir
  // structureIncomplete dans calculBilanMSP) pour que l'utilisateur sache
  // pourquoi la répartition est à 0 et retourne compléter l'étape Profil.
  if (!surfaceTotaleM2) return 0;
  return surfaceDedieeM2 / surfaceTotaleM2;
}

/**
 * Part d'un praticien dans les postes réventilés au prorata des actes.
 * @param {number} nbActesPraticien
 * @param {number} totalActesStructure
 * @returns {number} Entre 0 et 1 ; 0 si aucun acte n'est encore renseigné.
 */
export function clefReventilationActes(nbActesPraticien, totalActesStructure) {
  // Même garde que ci-dessus : aucun praticien n'a encore d'actes annuels
  // renseignés (état transitoire très courant juste après l'ajout d'un
  // praticien) → 0 plutôt que NaN.
  if (!totalActesStructure) return 0;
  return nbActesPraticien / totalActesStructure;
}

// ---------------------------------------------------------------------------
// 5. ACTIONS SPÉCIFIQUES MSP — s'ajoutent au catalogue partagé (facteurs-
// emission.js) sur l'écran "Pistes d'action". Ce type d'action n'a de sens
// que dans une structure pluriprofessionnelle (coordination entre plusieurs
// praticiens), donc conservé séparément plutôt que d'être ajouté au fichier
// du socle individuel où il ne s'appliquerait pas.
// Libellés d'actions du catalogue commun, réécrits pour une MSP. Deux raisons :
//  - le vocabulaire (« la structure » plutôt que « le cabinet ») ;
//  - l'exactitude : dans Cab, lo3 et lo4 ne s'appliquent qu'à la part
//    chauffage ou électricité du local (champ detailKey), alors que le calcul
//    MSP ne sépare pas ces deux parts et les applique au poste local entier.
// Appliqués par ui-msp.js par-dessus ACTIONS (même identifiant = remplacement).
export const LIBELLES_ACTIONS_MSP = {
  dc4: {
    titre: "Afficher en salle d'attente une carte isochrone comparant marche/vélo et voiture autour de la structure",
    source:
      'ESTIMÉ — outil de visualisation concret pour appuyer l\'action « inciter aux mobilités actives » : <a href="../iso/" target="_blank" rel="noopener">La carte du sans-voiture</a>, un autre outil Lib&CO2, génère gratuitement une carte des zones plus rapidement accessibles à pied, à vélo ou en vélo électrique qu\'en voiture autour de la MSP — calculée sur le vrai réseau de rues et le relief réel, pas à vol d\'oiseau. Particulièrement pertinent pour une structure regroupant plusieurs praticiens, donc davantage de passages. Effet non chiffré par une étude ; estimé par analogie avec les actions de communication déjà présentes.',
  },
  lo3: {
    source:
      "SOURCÉ (partiel) — ADEME, « Clés pour agir – Isoler sa maison » (novembre 2024, p. 4) : dans un bâtiment non isolé, le toit représente 25 à 30 % des pertes de chaleur, les murs 20 à 25 %, les fenêtres 10 à 15 % ; plafond de 25 % pour une isolation partielle, maximum théorique (les économies mesurées sont souvent plus faibles). Appliqué au poste local entier (le calcul MSP ne sépare pas chauffage et électricité) : le gain affiché est donc un majorant.",
  },
  lo4: {
    source:
      "SOURCÉ — gain comptable nul : la méthode réglementaire BEGES version 5 (2022, chapitre 2) ne permet pas de déduire l'électricité couverte par des garanties d'origine ; l'ADEME (avis du 3 décembre 2018) note qu'une offre verte « standard » ne finance pas de nouvelles capacités renouvelables. Action maintenue pour information, sans réduction chiffrée.",
  },
};

export const ACTIONS_MSP_SUPPLEMENTAIRES = [
  {
    id: "msp1",
    poste: "deplacements_patientele",
    titre:
      "Coordonner le parcours de soins pour grouper plusieurs actes lors d'une même visite (ex. consultation médicale + séance de kiné le même jour)",
    source:
      "ESTIMÉ — pas d'étude chiffrant précisément ce gain pour un contexte MSP ; principe fondé sur la réduction du nombre de trajets du patient (deux venues à la structure ramenées à une seule), rendu possible par la coordination entre professionnels d'une même structure.",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.2,
    coutKg: "≈ 0 €/kgCO2e évité (coordination interne)",
    coutNet: { min: 0, max: 0, calcul: "Organisation interne entre professionnels, sans dépense." },
    coutAbattement: "Non publié.",
  },
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

/**
 * Situe le ratio par acte de la structure entre la moyenne nationale de la
 * médecine de ville (0 %) et l'objectif 2050 (100 %), borné à [0, 100].
 * @param {number|null} ratioParActe  kgCO2e/acte.
 * @returns {{ratioActuel: number, ratioNational: number, objectif2050: number, progressionVersObjectif2050: number}|null}
 */
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
    progressionVersObjectif2050: progression,
  };
}

for (const a of ACTIONS_MSP_SUPPLEMENTAIRES) a.cost = categorieCout(a);
