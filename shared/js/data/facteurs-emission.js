/**
 * facteurs-emission.js — SOURCE UNIQUE des facteurs d'émission Lib&CO2
 * ----------------------------------------------------------------------
 * Tous les facteurs d'émission, familles de métiers et le catalogue
 * d'actions de décarbonation, partagés par Lib&CO2 Cab et Lib&CO2 MSP.
 * Une valeur modifiée ici s'applique aux deux outils : c'est voulu, pour
 * que deux saisies identiques donnent toujours le même résultat.
 *
 * Utilisé par : cab/js/*.js, msp/js/*.js (qui y ajoute ses facteurs
 * propres dans msp/js/data/facteurs-emission-msp.js).
 * Après toute modification : `npm test` (les écarts de résultats
 * s'affichent), puis `npm run references` si le changement est voulu.
 *
 * Historique d'harmonisation (septembre 2026) : les copies de Cab et de MSP
 * avaient divergé. Chaque écart a été arbitré en retenant la valeur la plus
 * récente et la mieux sourcée, après vérification contre les références
 * officielles (voir la feuille de route technique, lot 3).
 *
 * Convention de sourcing utilisée dans ce fichier :
 *   "SOURCÉ" = valeur extraite du rapport méthodologique kinéCO2 ou
 *              confirmée par une source externe identifiée.
 *   "ESTIMÉ" = pas de source directe ; le raisonnement est explicité en
 *              commentaire plutôt que de prétendre à une source qui n'existe pas.
 * Voir docs/MAINTENANCE.md pour la marche à suivre si vous devez mettre à
 * jour une valeur ou ajouter un nouveau métier.
 * ----------------------------------------------------------------------
 */

// --- Déplacements : kgCO2e par km (ou par passager.km pour les TC) ---------
export const FE_TRANSPORT = {
  voiture_thermique: {
    label: "Voiture thermique",
    value: 0.218,
    source:
      "SOURCÉ — ADEME Base Empreinte, voiture particulière moyenne du parc français (amont + usage + fabrication amortie). Recherche de recoupement (2026) : plusieurs sources récentes citent 215-218 g/km pour ce même agrégat, cohérent.",
  },
  voiture_electrique: {
    label: "Voiture électrique",
    value: 0.103,
    source:
      "SOURCÉ — ADEME Base Empreinte, véhicule électrique cœur de gamme (mix électrique France + fabrication amortie). Recherche de recoupement (2026) : valeur retrouvée à l'identique (0,103 kgCO2e/km) dans plusieurs sources citant explicitement l'ADEME.",
  },
  voiture_hybride: {
    label: "Voiture hybride",
    value: 0.16,
    source:
      "ESTIMÉ — pas de facteur ADEME dédié pour l'hybride non rechargeable identifié. Valeur choisie à mi-chemin entre voiture thermique (0,218) et voiture électrique (0,103), arrondie à 0,16 ; reflète qu'un hybride classique roule majoritairement en mode thermique mais réduit la consommation en usage urbain. Pas de pondération précise justifiée par une étude — à affiner.",
  },
  deux_roues: {
    label: "Deux-roues motorisé",
    value: 0.087,
    source:
      'SOURCÉ — Base Carbone V23.10, "Moto ≤ 250 cm3, Mixte", Valide générique (id 43779). Retenu face au "Cyclomoteur, Mixte" de la V23.6 (0,085) : version plus récente, écart négligeable.',
  },
  velo_meca: {
    label: "Vélo (mécanique)",
    value: 0.005,
    source:
      "SOURCÉ — extrait directement du rapport méthodologique kinéCO2 (tableau des facteurs d'émission, fabrication amortie).",
  },
  velo_elec: {
    label: "Vélo à assistance électrique",
    value: 0.011,
    source: "SOURCÉ — extrait directement du rapport méthodologique kinéCO2 (fabrication + électricité de recharge).",
  },
  bus: {
    label: "Bus urbain",
    value: 0.122,
    source:
      'SOURCÉ — Base Carbone V23.10, "Autobus, Gazole", kgCO2e/passager.km, Valide générique (id 43739). Valeur la plus élevée parmi les motorisations disponibles (électrique 0,0217 ; hybride 0,0743 ; GNV 0,122), retenue par majoration prudente faute de connaître la motorisation du réseau local.',
  },
  metro_tram: {
    label: "Métro / Tramway",
    value: 0.005,
    source: "SOURCÉ — extrait directement du rapport méthodologique kinéCO2.",
  },
  rer_ter: {
    label: "RER / TER",
    value: 0.0313,
    source:
      'SOURCÉ — Base Carbone V23.10, "TER, 2018", kgCO2e/passager.km, Valide générique (id 28154). Remplace une estimation (0,02).',
  },
  tgv: {
    label: "TGV / grande ligne",
    value: 0.003,
    source: "SOURCÉ — extrait directement du rapport méthodologique kinéCO2.",
  },
  marche: {
    label: "Marche à pied",
    value: 0,
    source: "SOURCÉ — négligeable par construction (pas de consommation d'énergie fossile ni d'électricité).",
  },
  avion_court: {
    label: "Avion court-courrier (< 1 000 km)",
    value: 0.225,
    source:
      "SOURCÉ — ADEME Base Empreinte, via Impact CO2 (impactco2.fr/outils/transport/avion-courtcourrier, consulté en septembre 2026) : 225 gCO2e/passager.km pour un vol de 300 à 1 000 km, traînées de condensation incluses (101 g) et fabrication de l'avion comprise. Remplace l'estimation de Cab (0,245) et la valeur de MSP (0,424), incohérente avec cette référence.",
  },
  avion_moyen: {
    label: "Avion moyen-courrier (1 000 - 3 500 km)",
    value: 0.185,
    source:
      "SOURCÉ — ADEME Base Empreinte, via Impact CO2 (impactco2.fr/outils/transport/avion-moyencourrier, consulté en septembre 2026) : 185 gCO2e/passager.km pour un vol de 1 000 à 2 000 km, traînées incluses (83 g). Limite : la tranche Lib&CO2 va jusqu'à 3 500 km.",
  },
  avion_long: {
    label: "Avion long-courrier (> 3 500 km)",
    value: 0.178,
    source:
      "SOURCÉ — ADEME Base Empreinte, via Impact CO2 (impactco2.fr/outils/transport/avion-longcourrier, consulté en septembre 2026) : 178 gCO2e/passager.km, traînées incluses (80 g). Remplace l'estimation de Cab (0,152) et la valeur de MSP (0,358), incohérente avec cette référence.",
  },
};

// --- Énergie : kgCO2e par kWh -----------------------------------------------
export const FE_ENERGIE = {
  electricite: {
    label: "Électricité (radiateurs/convecteurs)",
    value: 0.052,
    source:
      "SOURCÉ — ADEME Base Empreinte, mix électrique moyen France. Recherche de recoupement (2026) : une publication académique cite explicitement la Base Empreinte à 52,0 gCO2/kWh (millésime 2022). Point de vigilance : ce facteur varie fortement d'une année sur l'autre selon la disponibilité du nucléaire (déjà observé entre ~20 et ~60 gCO2/kWh selon les années) — à recontrôler périodiquement.",
  },
  gaz: {
    label: "Gaz naturel",
    value: 0.243,
    source:
      'SOURCÉ — Base Carbone V23.10, "Gaz naturel", kgCO2e/kWh PCI, Valide générique (id 13515). Valeur identique à la V23.6.',
  },
  fioul: {
    label: "Fioul domestique",
    value: 0.324,
    source:
      'SOURCÉ — Base Carbone V23.10, "Fioul domestique", kgCO2e/kWh PCI, Valide générique (id 14084). Remplace la valeur V23.6 (0,314).',
  },
  bois: {
    label: "Bois / biomasse",
    value: 0.046,
    source:
      'SOURCÉ — Base Carbone V23.10, "Bois bûches, Combustion en poêle à bois", kgCO2e/kWh, Valide spécifique (id 25834). Valeur la plus élevée parmi les combinaisons combustible/appareil disponibles (granulés ou plaquettes en chaudière : 0,013 à 0,032), retenue par majoration prudente.',
  },
  reseau_chaleur: {
    label: "Réseau de chaleur urbain",
    value: 0.113,
    source:
      "SOURCÉ — FEDENE / SNCU, Enquête annuelle des réseaux de chaleur et de froid, édition 2024 (données 2023) : contenu carbone moyen de 113 gCO2/kWh en analyse de cycle de vie (91 g en émissions directes). Moyenne nationale : le contenu réel d'un réseau donné peut s'en écarter nettement (liste par réseau : arrêté DPE du 5 juillet 2024). Remplace la valeur de MSP (0,385), supérieure à celle du gaz brûlé directement alors que les réseaux français sont à 60 % renouvelables ou de récupération.",
  },
  pac: {
    label: "Pompe à chaleur (électrique)",
    value: 0.052,
    source:
      "SOURCÉ — même facteur que l'électricité (mix France), car le COP (coefficient de performance) de la pompe à chaleur est déjà reflété dans le nombre de kWh électriques que l'utilisateur renseigne (moins de kWh consommés pour la même chaleur produite).",
  },
};

// SOURCÉ — ADEME/CEREN, Bâtiment - Chiffres clés 2012 (kWh/m²/an par type
// d'activité tertiaire), extrait du classeur de calcul kinéCO2 (feuille
// "BDD sources"). Remplace un ratio générique unique par des valeurs
// adaptées à chaque famille de métier — le générique précédent (127
// élec / 138 chauffage) correspondait en fait à la catégorie "Bureaux".
export const RATIOS_ENERGIE_PAR_ACTIVITE = {
  sante: { chauffage: 128, elec: 71 }, // catégorie ADEME "Santé"
  juridique: { chauffage: 138, elec: 127 }, // catégorie ADEME "Bureaux"
  conseil: { chauffage: 138, elec: 127 }, // catégorie ADEME "Bureaux"
  archi: { chauffage: 138, elec: 127 }, // catégorie ADEME "Bureaux"
  artisanat_art: { chauffage: 103, elec: 130 }, // catégorie ADEME "Commerces" (proxy le plus proche disponible pour un atelier/point de vente)
  autre: { chauffage: 120, elec: 86 }, // catégorie ADEME "Moyenne toutes branches" (repli générique)
};

// --- Numérique -------------------------------------------------------------
// Empreinte de FABRICATION par appareil (kgCO2e/unité). Table commune aux
// deux outils : Cab l'amortit sur DUREE_AMORTISSEMENT_ANS (voir FE_NUMERIQUE
// ci-dessous), MSP sur la durée de détention déclarée pour chaque appareil.
export const FACTEURS_NUMERIQUE_FABRICATION = {
  // SOURCÉ (archivé) — Base Carbone V23.10, "Ordinateur fixe", Archivé
  // (id 27004) : valeur la plus élevée des deux variantes disponibles (169 et
  // 296), par majoration prudente. Fiche archivée mais seule donnée ADEME
  // nominative pour cet équipement ; la V23.6 donnait 305.
  ordinateurFixe: { valeur: 296, source: 'SOURCÉ (archivé) — Base Carbone V23.10, "Ordinateur fixe" (id 27004)' },
  // SOURCÉ (partiel) — bilan d'émissions ISLEAN (2019, réf. GreenIT) : 156
  // kgCO2e. Cohérent avec un recoupement monétaire (portable 600-1 000 € ×
  // 0,216 kgCO2e/€ « Produits informatiques » ≈ 130-216 kgCO2e).
  ordinateurPortable: { valeur: 156, source: "SOURCÉ (partiel) — ISLEAN 2019, réf. GreenIT" },
  // SOURCÉ — Base Carbone V23.6, "Ecran, 21,5 pouces", Valide générique :
  // 222 kgCO2e. Préférée à la fiche V23.10 « Ecran LCD, 24 pouces » (431),
  // archivée : une fiche valide prime sur une fiche archivée.
  ecranSupplementaire: { valeur: 222, source: 'SOURCÉ — Base Carbone V23.6, "Ecran, 21,5 pouces", Valide générique' },
};

// Émissions ANNUELLES utilisées par Cab (kgCO2e/an et par appareil) :
// fabrication ÷ durée d'amortissement, plus un forfait d'usage.
export const FE_NUMERIQUE = {
  get ordi_fixe_an() {
    return FACTEURS_NUMERIQUE_FABRICATION.ordinateurFixe.valeur / DUREE_AMORTISSEMENT_ANS;
  },
  get ordi_portable_an() {
    return FACTEURS_NUMERIQUE_FABRICATION.ordinateurPortable.valeur / DUREE_AMORTISSEMENT_ANS;
  },
  get ecran_an() {
    return FACTEURS_NUMERIQUE_FABRICATION.ecranSupplementaire.valeur / DUREE_AMORTISSEMENT_ANS;
  },
  // ESTIMÉ — ordres de grandeur qualitatifs (guides de sobriété numérique
  // ADEME/Arcep) ; pas de ratio monétaire ADEME transposable à un « niveau
  // d'usage ».
  usage_an: { faible: 15, moyen: 40, fort: 90 },
};

// --- Alimentation --------------------------------------------------------
export const FE_REPAS = { standard: 2.04, vegetarien: 1.4 }; // SOURCÉ — extrait directement du rapport kinéCO2 (source Agribalyse, ADEME)

// --- Ratios monétaires (kgCO2e / €) ---
// SOURCÉ — ADEME Base Carbone V23.6, ratios monétaires 2023 (fichier
// officiel consulté directement, millésime le plus récent disponible).
// Remplace les précédentes valeurs ESTIMÉES (0,12 et 0,35), qui
// surestimaient respectivement de ~65% et ~50% les valeurs réelles.
export const FE_MONETAIRE = {
  // Moyenne de trois catégories proches (kgCO2e/k€ HT, 2023) : "Services
  // juridiques et comptables / conseil de gestion" (67) + "Assurance,
  // réassurance, retraites" (77) + "Services financiers hors assurance" (70)
  // = 71,3 kgCO2e/k€ → 0,072 kgCO2e/€.
  services_administratifs: 0.072,
  // "Autres services spécialisés, scientifiques et techniques", 2023 : 110 kgCO2e/k€.
  prestations_specialisees: 0.11,
  // "Services juridiques et comptables / services des sièges sociaux /
  // conseil de gestion", 2023 : 67 kgCO2e/k€.
  juridique_conseil_gestion: 0.067,
  // "Programmation, conseil IT / Services d'information", 2023 : 75 kgCO2e/k€.
  informatique_conseil: 0.075,
  // "Papier et carton", 2023 : 357 kgCO2e/k€ (Base Carbone V23.10 — version
  // plus récente que la précédente source utilisée ici, "Autres produits
  // manufacturés", Base Carbone V23.6 : 231 kgCO2e/k€). Harmonisé avec
  // Lib&CO2 MSP en septembre 2026, en retenant le facteur le plus récent
  // disponible entre les deux outils. Catégorie plus précise pour une
  // bonne partie des postes concernés (fournitures administratives,
  // impression, fournitures de bureau) ; moins précise pour d'autres
  // (consommables de soin, matières premières d'artisanat d'art) — limite
  // assumée, faute d'un facteur par nature de consommable.
  biens_consommables: 0.357,
  // "Produits pharmaceutiques de base et préparations pharmaceutiques", 2023 :
  // 194 kgCO2e/k€ → 0,194 kgCO2e/€. Utilisé pour le chiffre d'affaires
  // médicaments (pharmaciens) et les dépenses de médicaments prescrits.
  medicaments: 0.194,
  // "Services de santé humaine", 2023 : 82 kgCO2e/k€ → 0,082 kgCO2e/€.
  // Utilisé comme proxy pour les actes médicaux prescrits hors médicament
  // (examens complémentaires, dispositifs médicaux) — catégorie la plus
  // proche disponible, ces actes n'étant pas des achats de biens manufacturés.
  actes_medicaux: 0.082,
};

// SOURCÉ — étude commandée par l'ADEME sur les impacts environnementaux du
// e-commerce : émissions moyennes de l'ordre de 1 kgCO2e par colis (tous
// maillons compris : fabrication de l'emballage, transport amont, dernier
// kilomètre).
export const FE_FRET_COLIS = 1.0;

// Facteurs de TRAITEMENT EN FIN DE VIE des déchets courants (kgCO2e/kg),
// à ne pas confondre avec la fabrication des produits (déjà captée par le
// poste "Matériel et consommables") — même niveau de détail que l'étude
// déchets du projet kinéCO2 : plastique, métal, papier, carton, aluminium,
// verre, déchets ménagers, déchets électroniques. Le DASRI (déchets
// d'activité de soins à risques infectieux) est distinct, réservé à la
// famille Santé & paramédical, et bien plus émissif car son incinération à
// haute température est une obligation réglementaire (pas de mise en
// décharge ni de recyclage possible).
export const FE_DECHETS = {
  plastique: {
    label: "Plastique",
    value: 0.041,
    source:
      'SOURCÉ — Base Carbone V23.9 (ADEME), "Emballages plastique, traitement en mélange", kgCO2e/kg. Traitement fin de vie uniquement (la fabrication du plastique est déjà comptée dans le poste Matériel et consommables).',
  },
  metal: {
    label: "Métal (hors aluminium)",
    value: 0.11,
    source:
      'ESTIMÉ — pas de facteur "métal ménager en mélange" isolé dans la Base Carbone ; valeur alignée sur l\'aluminium (même ordre de grandeur pour un traitement par incinération/tri des métaux).',
  },
  papier: {
    label: "Papier",
    value: 0.028,
    source:
      "ESTIMÉ — ordre de grandeur usuel pour le papier en France (taux de recyclage élevé, ~60-70%), non re-vérifié précisément dans la Base Carbone cette session.",
  },
  carton: {
    label: "Carton",
    value: 0.028,
    source:
      "ESTIMÉ — même traitement que le papier (filières de recyclage proches), non re-vérifié précisément dans la Base Carbone cette session.",
  },
  aluminium: {
    label: "Aluminium",
    value: 0.11,
    source: 'SOURCÉ — Base Carbone V23.9 (ADEME), "Emballages aluminium, incinération", kgCO2e/kg.',
  },
  verre: {
    label: "Verre",
    value: 0.02,
    source:
      "ESTIMÉ — le verre bénéficie d'un recyclage à boucle fermée très efficace en France ; valeur volontairement basse, non re-vérifiée précisément dans la Base Carbone cette session.",
  },
  menagers: {
    label: "Déchets ménagers non triés (résiduels)",
    value: 0.374,
    source:
      'SOURCÉ — Base Carbone V23.9 (ADEME), "Ordures Ménagères Résiduelles, incinération, France continentale", kgCO2e/kg.',
  },
  electronique: {
    label: "Déchets électroniques (DEEE)",
    value: 0.802,
    source:
      'SOURCÉ — Base Carbone V23.9 (ADEME), "DEEE, petits appareils en mélange, fin de vie moyenne filière", kgCO2e/kg.',
  },
};

// DASRI — réservé à la famille Santé & paramédical (matériel piquant/
// coupant, produits biologiques). Incinération à haute température
// obligatoire (code de la santé publique), aucune autre filière autorisée.
export const FE_DASRI = {
  label: "DASRI (déchets d'activité de soins à risques infectieux)",
  value: 0.934,
  source:
    "SOURCÉ — Base Empreinte ADEME 2025, incinération à haute température (convergent avec la Commission développement durable de l'AFU : 934 kgCO2e/tonne pour les DASRI, contre 362 kgCO2e/tonne pour les déchets assimilés aux ordures ménagères en établissement de santé).",
};

// --- Gros matériel & mobilier (immobilisations, amorties sur 5 ans) ---
// SOURCÉ — repris du rapport kinéCO2, Tableau des immobilisations (sources
// Decathlon/ADEME Base Carbone V23.7) pour le matériel médical :
// équipements médicaux lourds ~0,19 kgCO2e/€ ; équipements massifs (tables,
// plateformes) ~0,72 kgCO2e/€. Amortissement par défaut : 5 ans.
export const FE_GROS_MATERIEL_STANDARD = 0.19; // kgCO2e/€ — équipements médicaux lourds "standard" (kinéCO2) — réservé à la famille santé
export const FE_GROS_MATERIEL_MASSIF = 0.72; // kgCO2e/€ — équipements médicaux massifs (kinéCO2/Decathlon) — réservé à la famille santé
// SOURCÉ — ADEME Base Carbone V23.6, ratio monétaire "Machines et
// équipements", 2023 : 273 kgCO2e/k€ HT → 0,273 kgCO2e/€. Remplace, pour les
// familles hors santé, l'ancienne réutilisation du facteur médical
// FE_GROS_MATERIEL_STANDARD (0,19) : une vraie donnée sectorielle générique
// existait, il n'y avait pas besoin d'emprunter le facteur santé.
export const FE_GROS_MATERIEL_BUREAU_INDUSTRIEL = 0.273;
export const FE_MOBILIER = 0.261; // kgCO2e/€ — SOURCÉ, ADEME Base Carbone V23.7, "Meubles et autres biens manufacturés" (extrait du rapport kinéCO2)
export const DUREE_AMORTISSEMENT_ANS = 5; // SOURCÉ — kinéCO2, Tableau 7 : amortissement des immobilisations par défaut

/* ----------------------------------------------------------------------------
   2) REPORT MODAL DE LA PATIENTÈLE / CLIENTÈLE, PAR ZONE GÉOGRAPHIQUE
   Les 12 profils de zone et leur calcul sont dans shared/js/data/zonage-insee.js.
---------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   3) FAMILLES DE MÉTIERS — vocabulaire et postes spécifiques adaptés
---------------------------------------------------------------------------- */
export const FAMILLES = [
  {
    id: "sante",
    label: "Santé & paramédical",
    icon: "sante",
    metiers: [
      "Kinésithérapeute",
      "Infirmier(ère) libéral(e)",
      "Médecin généraliste ou spécialiste",
      "Chirurgien-dentiste",
      "Sage-femme",
      "Orthophoniste",
      "Orthoptiste",
      "Ostéopathe / chiropracteur",
      "Psychologue / psychothérapeute",
      "Pédicure-podologue",
      "Diététicien(ne)",
      "Pharmacien(ne) titulaire d'officine",
      "Audioprothésiste",
      "Biologiste médical",
      "Ergothérapeute",
      "Vétérinaire",
      "Hypnothérapeute",
      "Psychanalyste",
      "Psychopraticien(ne)",
      "Sophrologue",
      "Autre profession de santé",
    ],
    lieuLabel: "cabinet",
    lieuArticleMon: "mon cabinet",
    lieuArticleLe: "le cabinet",
    publicLabel: "patientèle",
    publicSingulier: "patient",
    acteLabel: "séances",
    consommables: [
      {
        id: "materiel_soin",
        label: "Matériel et consommables de soin (gants, champs, produits, petit matériel)",
        factor: FE_MONETAIRE.biens_consommables,
      },
      { id: "linge_hygiene", label: "Linge, hygiène et désinfection", factor: FE_MONETAIRE.biens_consommables },
      {
        id: "fournitures_admin",
        label: "Fournitures administratives (papier, dossiers patients)",
        factor: FE_MONETAIRE.biens_consommables,
      },
    ],
    grosMateriel: [
      {
        id: "imagerie",
        label: "Appareils d'imagerie / diagnostic (échographe, radiographie)",
        factor: FE_GROS_MATERIEL_STANDARD,
      },
      {
        id: "electrotherapie",
        label: "Électrothérapie, ondes de choc, ultrasons, pressothérapie, cryothérapie",
        factor: FE_GROS_MATERIEL_STANDARD,
      },
      {
        id: "equipements_massifs",
        label: "Équipements de rééducation massifs (tables, plateformes, espaliers)",
        factor: FE_GROS_MATERIEL_MASSIF,
      },
      { id: "sterilisation", label: "Système de stérilisation (autoclave)", factor: FE_GROS_MATERIEL_STANDARD },
    ],
    uniteActe: "séance",
    motifDeplacement: "autres_motifs_personnels", // EMP2019 : santé non isolable, proxy "autres motifs personnels"
  },
  {
    id: "juridique",
    label: "Juridique",
    icon: "juridique",
    metiers: [
      "Avocat(e)",
      "Notaire",
      "Huissier / commissaire de justice",
      "Administrateur judiciaire",
      "Commissaire-priseur judiciaire",
      "Conseil en propriété industrielle",
      "Greffier des tribunaux de commerce",
      "Mandataire judiciaire à la protection des majeurs",
      "Autre profession juridique",
    ],
    lieuLabel: "cabinet",
    lieuArticleMon: "mon cabinet",
    lieuArticleLe: "le cabinet",
    publicLabel: "clientèle",
    publicSingulier: "client",
    acteLabel: "rendez-vous",
    consommables: [
      {
        id: "impression",
        label: "Impression, reliure et archivage de dossiers",
        factor: FE_MONETAIRE.biens_consommables,
      },
      {
        id: "documentation",
        label: "Abonnements documentaires et bases juridiques",
        factor: FE_MONETAIRE.juridique_conseil_gestion,
      },
    ],
    grosMateriel: [
      {
        id: "bureautique_lourde",
        label: "Photocopieurs professionnels, scanners, serveurs d'archivage",
        factor: FE_GROS_MATERIEL_BUREAU_INDUSTRIEL,
      },
    ],
    uniteActe: "rendez-vous",
    motifDeplacement: "autres_motifs_personnels", // EMP2019 : démarches administratives/juridiques, même proxy que la santé faute de mieux
  },
  {
    id: "conseil",
    label: "Conseil, gestion, expertise & numérique",
    icon: "conseil",
    metiers: [
      "Consultant(e)",
      "Formateur / formatrice",
      "Enseignant(e) indépendant(e)",
      "Coach professionnel",
      "Développeur / développeuse indépendant(e)",
      "Traducteur / traductrice",
      "Expert-comptable",
      "Conseil-expert financier",
      "Agent général d'assurance",
      "Expert immobilier",
      "Expert en automobile",
      "Autre activité de conseil",
    ],
    lieuLabel: "bureau",
    lieuArticleMon: "mon bureau",
    lieuArticleLe: "le bureau",
    publicLabel: "clientèle",
    publicSingulier: "client",
    acteLabel: "missions",
    consommables: [
      { id: "licences", label: "Licences logicielles et abonnements SaaS", factor: FE_MONETAIRE.informatique_conseil },
      { id: "fournitures_bureau", label: "Fournitures de bureau", factor: FE_MONETAIRE.biens_consommables },
    ],
    grosMateriel: [
      {
        id: "informatique_lourde",
        label: "Serveurs, baies informatiques, gros équipement réseau",
        factor: FE_GROS_MATERIEL_BUREAU_INDUSTRIEL,
      },
    ],
    uniteActe: "mission",
    motifDeplacement: "autres_motifs_professionnels", // EMP2019 : rendez-vous professionnel d'un tiers
  },
  {
    id: "archi",
    label: "Architecture & ingénierie",
    icon: "archi",
    metiers: [
      "Architecte",
      "Architecte d'intérieur",
      "Ingénieur bureau d'études",
      "Géomètre-expert",
      "Économiste de la construction",
      "Autre activité d'ingénierie",
    ],
    lieuLabel: "agence",
    lieuArticleMon: "mon agence",
    lieuArticleLe: "l'agence",
    publicLabel: "clientèle",
    publicSingulier: "client",
    acteLabel: "rendez-vous",
    consommables: [
      { id: "impression_plans", label: "Impression de plans et maquettes", factor: FE_MONETAIRE.biens_consommables },
      {
        id: "logiciels_metier",
        label: "Logiciels métier (CAO/BIM) et licences",
        factor: FE_MONETAIRE.informatique_conseil,
      },
    ],
    grosMateriel: [
      {
        id: "topo_impression",
        label: "Scanners 3D, traceurs grand format, stations topographiques",
        factor: FE_GROS_MATERIEL_BUREAU_INDUSTRIEL,
      },
    ],
    uniteActe: "rendez-vous",
    motifDeplacement: "autres_motifs_professionnels", // EMP2019 : rendez-vous professionnel (chantier, client)
  },
  {
    id: "artisanat_art",
    label: "Artisanat d'art & création",
    icon: "artisanat",
    metiers: [
      "Artisan d'art",
      "Designer / créateur(trice)",
      "Conservateur-restaurateur d'œuvres d'art",
      "Autre activité de création",
    ],
    lieuLabel: "atelier",
    lieuArticleMon: "mon atelier",
    lieuArticleLe: "l'atelier",
    publicLabel: "clientèle",
    publicSingulier: "client",
    acteLabel: "commandes",
    consommables: [
      {
        id: "matieres_premieres",
        label: "Matières premières et fournitures de création",
        factor: FE_MONETAIRE.biens_consommables,
      },
      { id: "outillage", label: "Outillage et petit équipement", factor: FE_MONETAIRE.biens_consommables },
    ],
    grosMateriel: [
      {
        id: "machines_outils",
        label: "Machines-outils, fours, presses (> 60 kg)",
        factor: FE_GROS_MATERIEL_BUREAU_INDUSTRIEL,
      },
    ],
    uniteActe: "commande",
    motifDeplacement: "achats", // EMP2019 : proxy achat/commande d'un bien
  },
  {
    id: "autre",
    label: "Autre profession libérale",
    icon: "autre",
    metiers: [
      "Agent commercial",
      "Détective",
      "Graphologue",
      "Guide-conférencier",
      "Guide de haute montagne",
      "Moniteur de ski",
      "Sténotypiste",
      "Autre profession libérale",
    ],
    lieuLabel: "lieu d'exercice",
    lieuArticleMon: "mon lieu d'exercice",
    lieuArticleLe: "le lieu d'exercice",
    publicLabel: "clientèle",
    publicSingulier: "client",
    acteLabel: "rendez-vous",
    consommables: [
      {
        id: "fournitures_generales",
        label: "Fournitures et consommables professionnels",
        factor: FE_MONETAIRE.biens_consommables,
      },
    ],
    grosMateriel: [
      {
        id: "gros_equipement",
        label: "Gros équipement professionnel (> 60 kg)",
        factor: FE_GROS_MATERIEL_BUREAU_INDUSTRIEL,
      },
    ],
    uniteActe: "rendez-vous",
    motifDeplacement: "ensemble", // EMP2019 : moyenne nationale tous motifs (famille générique)
  },
];

/* ----------------------------------------------------------------------------
   4) CATALOGUE D'ACTIONS DE DÉCARBONATION
   maxReduction = fraction du poste concerné évitée si l'action est déployée
   à 100%. hasPct = l'action se déploie sur une part choisie du poste
   (curseur affiché uniquement une fois l'action cochée).

   IMPORTANT SUR LE SOURCING : "SOURCÉ" = repris du rapport kinéCO2 ou d'une
   source externe identifiée. "ESTIMÉ" = pas de source directe, ordre de
   grandeur. Pour les actions sourcées, seul le fait physique cité l'est ;
   la part du poste concerné (maxReduction) reste toujours une hypothèse
   ajustable via le curseur de déploiement.
---------------------------------------------------------------------------- */
export const ACTIONS = [
  // --- Déplacements professionnels ---
  {
    id: "dp1",
    poste: "deplacements_pro",
    titre: "Basculer les trajets courts (< 5 km) vers le vélo ou le vélo à assistance électrique",
    source:
      "SOURCÉ — rapport kinéCO2 : le vélo électrique réduit les émissions d'environ -95% par km vs voiture thermique.",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.5,
    cost: "faible",
    coutKg: "≈ 0,05 à 0,2 €/kgCO2e évité (vélo amorti sur 5 ans)",
  },
  {
    id: "dp2",
    poste: "deplacements_pro",
    titre: "Covoiturer ou mutualiser les trajets vers congrès, formations et réunions professionnelles",
    source: "SOURCÉ — rapport kinéCO2 : passer d'un taux de remplissage de 1 à 2 divise par 2 les émissions du trajet.",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.25,
    cost: "gratuit",
    coutKg: "0 € — organisation",
  },
  {
    id: "dp3",
    poste: "deplacements_pro",
    titre: "Électrifier le véhicule professionnel lors du prochain renouvellement",
    source:
      "SOURCÉ (partiel) — ADEME Base Empreinte : -95% sur les émissions d'usage. ESTIMÉ : gain net de -55% retenu pour tenir compte d'une fabrication de batterie plus émissive.",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.55,
    cost: "investissement",
    coutKg: "≈ 1 à 2 €/kgCO2e évité (surcoût amorti sur la durée de vie du véhicule)",
  },
  {
    id: "dp4",
    poste: "deplacements_pro",
    titre: "Remplacer une partie des déplacements pour congrès/formations par de la visioconférence",
    source: "ESTIMÉ — bonne pratique de sobriété numérique, non chiffrée par une étude.",
    hasPct: true,
    defaultPct: 25,
    maxReduction: 0.4,
    cost: "gratuit",
    coutKg: "0 € — organisation",
  },

  // --- Déplacements de la patientèle / clientèle ---
  {
    id: "dc1",
    poste: "deplacements_patientele",
    titre: "Développer la téléconsultation ou les rendez-vous à distance quand c'est pertinent",
    source: "ESTIMÉ — principe reconnu de réduction des déplacements induits, non chiffré par une étude.",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.3,
    cost: "gratuit",
    coutKg: "0 € — organisation",
  },
  {
    id: "dc2",
    poste: "deplacements_patientele",
    titre: "Inciter la patientèle/clientèle aux mobilités actives (marche, vélo)",
    source: "SOURCÉ — rapport kinéCO2 : le facteur d'émission des modes actifs est quasi nul comparé à la voiture.",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.3,
    cost: "gratuit",
    coutKg: "0 € — communication",
  },
  {
    id: "dc3",
    poste: "deplacements_patientele",
    titre: "Faciliter le covoiturage pour la patientèle/clientèle",
    source: "SOURCÉ — rapport kinéCO2 : passer d'un taux de remplissage de 1 à 2 divise par 2 les émissions du trajet.",
    hasPct: true,
    defaultPct: 25,
    maxReduction: 0.25,
    cost: "gratuit",
    coutKg: "0 € — communication",
  },
  {
    id: "dc4",
    poste: "deplacements_patientele",
    titre: "Afficher en salle d'attente une carte isochrone comparant marche/vélo et voiture autour du cabinet",
    source:
      'ESTIMÉ — outil de visualisation concret pour appuyer l\'action « inciter aux mobilités actives » : <a href="../iso/" target="_blank" rel="noopener">La carte du sans-voiture</a>, un autre outil Lib&CO2, génère gratuitement une carte des zones plus rapidement accessibles à pied, à vélo ou en vélo électrique qu\'en voiture autour de votre cabinet — calculée sur le vrai réseau de rues et le relief réel, pas à vol d\'oiseau. Effet non chiffré par une étude ; estimé par analogie avec les actions de communication déjà présentes.',
    hasPct: true,
    defaultPct: 15,
    maxReduction: 0.12,
    cost: "gratuit",
    coutKg: "0 € — carte téléchargeable gratuitement, à imprimer",
  },

  // --- Local professionnel ---
  {
    id: "lo1",
    poste: "local",
    titre: "Ajuster la température de consigne (chauffage l'hiver, climatisation l'été)",
    source:
      "SOURCÉ — rapport kinéCO2, citant l'ADEME : chaque degré de consigne modifié réduit les émissions correspondantes d'environ 7% (calcul exact, multiplié par le nombre de degrés choisi).",
    unit: "degres",
    defaultDegres: 1,
    maxReductionParDegre: 0.07,
    cost: "gratuit",
    coutKg: "0 € — réglage",
  },
  {
    id: "lo2",
    poste: "local",
    detailKey: "localChauffage",
    titre: "Remplacer une chaudière gaz/fioul par une pompe à chaleur",
    source:
      "SOURCÉ — rapport kinéCO2, citant l'ADEME : une pompe à chaleur émet environ -82% vs une chaudière gaz. Appliqué à la seule part chauffage du poste local.",
    hasPct: false,
    defaultPct: 100,
    maxReduction: 0.4,
    cost: "investissement",
    coutKg: "≈ 0,3 à 0,6 €/kgCO2e évité selon aides disponibles",
  },
  {
    id: "lo3",
    poste: "local",
    detailKey: "localChauffage",
    titre: "Améliorer l'isolation du local (combles, fenêtres)",
    source:
      "ESTIMÉ — ordre de grandeur usuel pour une rénovation d'isolation partielle, non re-vérifié cette session. Appliqué à la seule part chauffage du poste local (l'isolation réduit les pertes thermiques, pas la consommation électrique).",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.25,
    cost: "investissement",
    coutKg: "≈ 0,4 à 0,8 €/kgCO2e évité, aides MaPrimeRénov' possibles",
  },
  {
    id: "lo4",
    poste: "local",
    detailKey: "localElec",
    titre: "Souscrire un contrat d'électricité verte / renouvelable",
    source:
      "ESTIMÉ — effet surtout comptable (garanties d'origine) vu le mix français déjà décarboné ; valeur volontairement basse. Appliqué à la seule part électrique du poste local (un contrat d'électricité verte n'affecte pas un chauffage au gaz ou au fioul).",
    hasPct: true,
    defaultPct: 100,
    maxReduction: 0.08,
    cost: "faible",
    coutKg: "souvent sans surcoût significatif",
  },

  // --- Numérique ---
  {
    id: "nu1",
    poste: "numerique",
    titre: "Allonger la durée de vie du matériel informatique (viser 5-6 ans plutôt que 3-4 ans)",
    source:
      "ESTIMÉ, calcul explicite — passer de 4 à 6 ans d'amortissement réduit l'empreinte annuelle de fabrication de (1 - 4/6) ≈ 33%.",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.3,
    cost: "gratuit",
    coutKg: "économie directe",
  },
  {
    id: "nu2",
    poste: "numerique",
    titre: "Acheter du matériel reconditionné plutôt que neuf",
    source:
      "SOURCÉ — HRAFNKELSDÓTTIR, 2022 (KTH), citée dans le rapport kinéCO2 : -42% sur les émissions de fabrication.",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.42,
    cost: "faible",
    coutKg: "≈ 0,1 €/kgCO2e évité, souvent moins cher que le neuf",
  },
  {
    id: "nu3",
    poste: "numerique",
    titre: "Limiter le stockage cloud superflu et la vidéo HD par défaut",
    source: "ESTIMÉ — gain plausible de sobriété numérique de base, non chiffré par une étude.",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.2,
    cost: "gratuit",
    coutKg: "0 € — réglages",
  },

  // --- Matériel & consommables métier ---
  {
    id: "ma1",
    poste: "materiel",
    titre: "Privilégier du matériel reconditionné ou éco-conçu pour les équipements",
    source:
      "SOURCÉ — HRAFNKELSDÓTTIR, 2022 (KTH), citée dans le rapport kinéCO2 : -42% sur les émissions de fabrication.",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.42,
    cost: "faible",
    coutKg: "≈ 0,1 à 0,3 €/kgCO2e évité",
  },
  {
    id: "ma2",
    poste: "materiel",
    titre: "Réduire les consommables à usage unique au profit de solutions réutilisables",
    source: "ESTIMÉ — non chiffré par une étude.",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.2,
    cost: "faible",
    coutKg: "économie directe à moyen terme",
  },
  {
    id: "ma3",
    poste: "materiel",
    titre: "Choisir des fournisseurs/matières à faible empreinte (écolabels, circuits courts)",
    source: "ESTIMÉ — non chiffré par une étude.",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.15,
    cost: "faible",
    coutKg: "souvent neutre en coût",
  },

  // --- Alimentation ---
  {
    id: "al1",
    poste: "alimentation",
    titre: "Augmenter la part de repas végétariens lors des repas professionnels",
    source:
      "SOURCÉ, calcul exact — (2,04 - 1,40) / 2,04 ≈ 31%, à partir des facteurs FE_REPAS déjà sourcés (kinéCO2/Agribalyse).",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.31,
    cost: "gratuit",
    coutKg: "souvent une économie directe",
  },
  {
    id: "al2",
    poste: "alimentation",
    titre: "Limiter le gaspillage alimentaire lors des repas sur site",
    source: "ESTIMÉ — ordre de grandeur usuel, non re-vérifié cette session.",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.1,
    cost: "gratuit",
    coutKg: "économie directe",
  },

  // --- Achats de services ---
  {
    id: "se1",
    poste: "services",
    titre: "Choisir des prestataires (banque, assurance, comptabilité) engagés bas-carbone",
    source: "ESTIMÉ — dépend des prestataires réellement disponibles, non chiffré.",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.15,
    cost: "gratuit",
    coutKg: "0 € — critère de choix",
  },
  {
    id: "se2",
    poste: "services",
    titre: "Dématérialiser les échanges avec les prestataires et réduire le courrier papier",
    source: "ESTIMÉ — non chiffré par une étude.",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.1,
    cost: "gratuit",
    coutKg: "0 € — organisation",
  },
  {
    id: "se3",
    poste: "services",
    titre: "Limiter la sous-traitance aux besoins essentiels et privilégier des prestataires locaux",
    source: "ESTIMÉ — non chiffré par une étude.",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.1,
    cost: "gratuit",
    coutKg: "0 € — organisation",
  },

  // --- Fret / livraisons ---
  {
    id: "fr1",
    poste: "fret",
    titre: "Grouper les commandes et éviter les livraisons express",
    source: "ESTIMÉ — principe admis (livraison express plus émissive), non chiffré pour ce contexte.",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.3,
    cost: "gratuit",
    coutKg: "0 € — organisation",
  },
  {
    id: "fr2",
    poste: "fret",
    titre: "Privilégier les points relais à la livraison à domicile/au cabinet",
    source: "ESTIMÉ — principe admis (mutualisation des trajets), non chiffré pour ce contexte.",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.2,
    cost: "gratuit",
    coutKg: "0 € — organisation",
  },
];

export const CATEGORIES_META = {
  deplacements_pro: { label: "Déplacements professionnels", icon: "deplacements", color: "#2E673E" },
  deplacements_patientele: { label: "Déplacements de la patientèle / clientèle", icon: "patientele", color: "#5C8A7A" },
  local: { label: "Local professionnel", icon: "local", color: "#C98A2C" },
  numerique: { label: "Numérique", icon: "numerique", color: "#7A6FA8" },
  materiel: { label: "Matériel & consommables métier", icon: "materiel", color: "#B85C5C" },
  dechets: { label: "Déchets (traitement fin de vie)", icon: "materiel", color: "#6B7F5C" },
  alimentation: { label: "Alimentation professionnelle", icon: "alimentation", color: "#4E8FA3" },
  services: { label: "Achats de services", icon: "services", color: "#8A9490" },
  fret: { label: "Fret & livraisons", icon: "fret", color: "#0071C1" },
  medicaments: { label: "Médicaments & parapharmacie vendus", icon: "materiel", color: "#3E7A63" },
  prescriptions: { label: "Prescriptions (médicaments & actes)", icon: "materiel", color: "#946620" },
};

export const COST_WEIGHT = { gratuit: 1, faible: 1.3, investissement: 1.8 };
