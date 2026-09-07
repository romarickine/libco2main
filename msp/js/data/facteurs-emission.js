/**
 * facteurs-emission.js
 * ----------------------------------------------------------------------
 * Tous les facteurs d'émission, familles de métiers et le catalogue
 * d'actions de décarbonation utilisés par le calculateur Lib&CO2.
 *
 * Convention de sourcing utilisée dans ce fichier :
 *   "SOURCÉ" = valeur extraite du rapport méthodologique kinéCO2 ou
 *              confirmée par une source externe identifiée.
 *   "ESTIMÉ" = pas de source directe ; le raisonnement est explicité en
 *              commentaire plutôt que de prétendre à une source qui n'existe pas.
 * Voir le README.md à la racine pour la marche à suivre si vous devez
 * mettre à jour une valeur ou ajouter un nouveau métier.
 * ----------------------------------------------------------------------
 */

// --- Déplacements : kgCO2e par km (ou par passager.km pour les TC) ---------
// Convention de sourcing utilisée dans tout ce fichier :
//  "SOURCÉ" = valeur directement extraite du rapport kinéCO2 ou confirmée par
//             une source externe identifiée lors d'une recherche dédiée.
//  "ESTIMÉ" = pas de source directe trouvée ; le raisonnement/calcul utilisé
//             pour arriver au chiffre est explicité afin d'être vérifiable
//             et contestable, plutôt que de prétendre à une source qui n'existe pas.
export const FE_TRANSPORT = {
  voiture_thermique: { label: "Voiture thermique", value: 0.218, source: "SOURCÉ — ADEME Base Empreinte, voiture particulière moyenne du parc français (amont + usage + fabrication amortie). Recherche de recoupement (2026) : plusieurs sources récentes citent 215-218 g/km pour ce même agrégat, cohérent." },
  voiture_electrique: { label: "Voiture électrique", value: 0.103, source: "SOURCÉ — ADEME Base Empreinte, véhicule électrique cœur de gamme (mix électrique France + fabrication amortie). Recherche de recoupement (2026) : valeur retrouvée à l'identique (0,103 kgCO2e/km) dans plusieurs sources citant explicitement l'ADEME." },
  voiture_hybride: { label: "Voiture hybride", value: 0.16, source: "ESTIMÉ — pas de facteur ADEME dédié pour l'hybride non rechargeable identifié. Valeur choisie à mi-chemin entre voiture thermique (0,218) et voiture électrique (0,103), arrondie à 0,16 ; reflète qu'un hybride classique roule majoritairement en mode thermique mais réduit la consommation en usage urbain. Pas de pondération précise justifiée par une étude — à affiner." },
  deux_roues: { label: "Deux-roues motorisé", value: 0.087, source: "SOURCÉ — Base Carbone V23.10, \"Moto ≤ 250 cm3, Mixte\", Valide générique (id 43779). Quasi identique à l'estimation précédente (0,09), désormais confirmée par une donnée officielle." },
  velo_meca: { label: "Vélo (mécanique)", value: 0.005, source: "SOURCÉ — extrait directement du rapport méthodologique kinéCO2 (tableau des facteurs d'émission, fabrication amortie)." },
  velo_elec: { label: "Vélo à assistance électrique", value: 0.011, source: "SOURCÉ — extrait directement du rapport méthodologique kinéCO2 (fabrication + électricité de recharge)." },
  bus: { label: "Bus urbain", value: 0.122, source: "SOURCÉ — Base Carbone V23.10, \"Autobus, Gazole\", kgCO2e/passager.km, Valide générique (id 43739). Valeur la plus élevée parmi les motorisations disponibles (électrique 0,0217 ; hybride 0,0743 ; GNV 0,122) retenue par choix éditorial de majorer prudemment en l'absence de connaissance de la motorisation réelle du réseau local." },
  metro_tram: { label: "Métro / Tramway", value: 0.005, source: "SOURCÉ — extrait directement du rapport méthodologique kinéCO2." },
  rer_ter: { label: "RER / TER", value: 0.0313, source: "SOURCÉ — Base Carbone V23.10, \"TER, 2018\", kgCO2e/passager.km, Valide générique (id 28154)." },
  tgv: { label: "TGV / grande ligne", value: 0.003, source: "SOURCÉ — extrait directement du rapport méthodologique kinéCO2." },
  marche: { label: "Marche à pied", value: 0, source: "SOURCÉ — négligeable par construction (pas de consommation d'énergie fossile ni d'électricité)." },
  avion_court: { label: "Avion court-courrier (< 1 000 km)", value: 0.424, source: "SOURCÉ — Base Carbone V23.10, \"Avion passagers, Court courrier, 2023\", AVEC traînées, kgCO2e/passager.km, Valide générique (id 48810)." },
  avion_moyen: { label: "Avion moyen-courrier (1 000 - 3 500 km)", value: 0.166, source: "SOURCÉ — Base Carbone V23.10, \"Avion passagers, Moyen courrier, 2023\", AVEC traînées, kgCO2e/passager.km, Valide générique (id 48814)." },
  avion_long: { label: "Avion long-courrier (> 3 500 km)", value: 0.358, source: "SOURCÉ — Base Carbone V23.10, \"Avion passagers, Long courrier, 2023\", AVEC traînées, kgCO2e/passager.km, Valide générique (id 48812)." },
};

// --- Énergie : kgCO2e par kWh -----------------------------------------------
export const FE_ENERGIE = {
  electricite: { label: "Électricité (radiateurs/convecteurs)", value: 0.052, source: "SOURCÉ — ADEME Base Empreinte, mix électrique moyen France. Recherche de recoupement (2026) : une publication académique cite explicitement la Base Empreinte à 52,0 gCO2/kWh (millésime 2022). Point de vigilance : ce facteur varie fortement d'une année sur l'autre selon la disponibilité du nucléaire (déjà observé entre ~20 et ~60 gCO2/kWh selon les années) — à recontrôler périodiquement." },
  gaz: { label: "Gaz naturel", value: 0.243, source: "SOURCÉ — Base Carbone V23.10, \"Gaz naturel\", kgCO2e/kWh PCI, Valide générique (id 13515)." },
  fioul: { label: "Fioul domestique", value: 0.324, source: "SOURCÉ — Base Carbone V23.10, \"Fioul domestique\", kgCO2e/kWh PCI, Valide générique (id 14084). Valeur inchangée, désormais confirmée par une donnée officielle." },
  bois: { label: "Bois / biomasse", value: 0.046, source: "SOURCÉ — Base Carbone V23.10, \"Bois bûches, Combustion en poêle à bois\", kgCO2e/kWh, Valide spécifique (id 25834). Valeur la plus élevée parmi les combinaisons combustible/appareil disponibles (granulés/plaquettes en chaudière : 0,013 à 0,032) retenue par choix éditorial de majoration prudente." },
  reseau_chaleur: { label: "Réseau de chaleur urbain", value: 0.385, source: "SOURCÉ — Base Carbone V23.10, \"Réseau de chaleur, Autres réseaux, France continentale\", kgCO2e/kWh, Valide générique (id 47684). Remplace une moyenne nationale forfaitaire ESTIMÉE par la moyenne officielle des réseaux non individuellement caractérisés." },
  pac: { label: "Pompe à chaleur (électrique)", value: 0.052, source: "SOURCÉ — même facteur que l'électricité (mix France), car le COP (coefficient de performance) de la pompe à chaleur est déjà reflété dans le nombre de kWh électriques que l'utilisateur renseigne (moins de kWh consommés pour la même chaleur produite)." },
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

// --- Numérique ---------------------------------------------------------------
export const FE_NUMERIQUE = {
  ordi_fixe_an: 45, // ESTIMÉ — par analogie avec le portable (156 kgCO2e fabrication, majoré ~45% pour poste fixe), amorti 5 ans
  ordi_portable_an: 30, // SOURCÉ (partiel) — bilan d'émissions ISLEAN (2019, réf. GreenIT) : 156 kgCO2e fabrication / 5 ans amortissement
  ecran_an: 15, // ESTIMÉ — fabrication estimée à ~75 kgCO2e, amortie sur 5 ans
  usage_an: { faible: 15, moyen: 40, fort: 90 }, // ESTIMÉ — ordres de grandeur qualitatifs (guides de sobriété numérique ADEME/Arcep)
};

// --- Alimentation --------------------------------------------------------
export const FE_REPAS = { standard: 2.04, vegetarien: 1.40 }; // SOURCÉ — extrait directement du rapport kinéCO2 (source Agribalyse, ADEME)

// --- Ratios monétaires (kgCO2e / €) ---
export const FE_MONETAIRE = {
  // ESTIMÉ — pas de source directe ; valeur basse (~1/3 de biens_consommables)
  // reflétant une activité de services peu matérielle. À noter : la
  // méthodologie Bilan Carbone® déconseille les ratios monétaires génériques
  // pour ce type d'activité (incertitude ~80%). Confirmé : l'ADEME a bien
  // révisé ses ratios monétaires à la baisse en 2025, cf. Base Carbone ci-dessous.
  services_intellectuels: 0.077, // SOURCÉ — Base Carbone V23.10, "Assurance, réassurance, retraites (hors sécurité sociale) - 2023", kgCO2e/keuro HT, Valide générique (id 43475). Valeur la plus élevée parmi les catégories de services intellectuels disponibles (juridique/comptable 2023 : 0,067 ; services financiers hors assurance 2019 : 0,069) retenue par choix éditorial de majoration prudente.
  biens_consommables: 0.357, // SOURCÉ — Base Carbone V23.10, "Papier et carton - 2023", kgCO2e/keuro HT, Valide générique (id 43370). Confirme l'estimation précédente (0,35 ; un bilan d'émissions publié, Memo Bank, citait aussi 367 kgCO2e/k€ pour ses fournitures).
};

// SOURCÉ — étude commandée par l'ADEME sur les impacts environnementaux du
// e-commerce : émissions moyennes de l'ordre de 1 kgCO2e par colis (tous
// maillons compris : fabrication de l'emballage, transport amont, dernier
// kilomètre).
export const FE_FRET_COLIS = 1.0;

// --- Gros matériel & mobilier (immobilisations, amorties sur 5 ans) ---
// SOURCÉ — repris du rapport kinéCO2, Tableau des immobilisations (sources
// ADEME Base Carbone V23.7). Équipements médicaux lourds :
// ~0,19 kgCO2e/€ ; équipements massifs (tables, plateformes) : ~0,72 kgCO2e/€.
// Amortissement par défaut : 5 ans.
// LIMITE : ces facteurs, établis pour du matériel médical, sont réutilisés
// tels quels pour le gros matériel des autres familles (photocopieurs,
// serveurs, machines-outils...), faute d'équivalent trouvé par métier.
export const FE_GROS_MATERIEL_STANDARD = 0.19; // kgCO2e/€ — équipements lourds "standard" (kinéCO2)
export const FE_GROS_MATERIEL_MASSIF = 0.72; // kgCO2e/€ — équipements massifs (kinéCO2/Decathlon)
export const FE_MOBILIER = 0.261; // kgCO2e/€ — SOURCÉ, ADEME Base Carbone V23.7, "Meubles et autres biens manufacturés" (extrait du rapport kinéCO2)
export const DUREE_AMORTISSEMENT_ANS = 5; // SOURCÉ — kinéCO2, Tableau 7 : amortissement des immobilisations par défaut

/* ----------------------------------------------------------------------------
   2) REPORT MODAL DE LA PATIENTÈLE / CLIENTÈLE, PAR ZONE GÉOGRAPHIQUE
   Les 12 profils de report modal (km aller-retour par séance/rendez-vous,
   déjà répartis par mode de transport) sont repris du rapport kinéCO2
   (Tableau 15), construit à partir de l'Enquête Mobilité des Personnes 2019
   (SDES) croisée à une structure pôle/couronne/hors attraction. La commune
   de l'utilisateur est ensuite affectée à l'un de ces 12 profils à partir
   La commune de l'utilisateur est ensuite affectée à l'un de ces 12 profils
   à partir du zonage INSEE en aires urbaines 2010 (ZAU 2010) — le même
   millésime que celui utilisé par kinéCO2 pour construire le Tableau 15 —
   intégré commune par commune directement dans l'outil (voir ZoneFinder plus
   bas), et non une approximation par population.
---------------------------------------------------------------------------- */
const ZONES = [
  { id: "hors_attraction", label: "Commune rurale hors attraction d'une ville", modal: { voiture_thermique: 10.1 } },
  { id: "couronne_grand_pole", label: "Couronne d'un grand pôle urbain", modal: { bus: 0.10, deux_roues: 0.04, velo_elec: 0.07, voiture_electrique: 0.26, voiture_thermique: 8.84 } },
  { id: "couronne_moyen_pole", label: "Couronne d'un pôle urbain moyen", modal: { bus: 1.27, deux_roues: 0.52, velo_elec: 0.59, voiture_electrique: 1.31, voiture_thermique: 7.59 } },
  { id: "couronne_petit_pole", label: "Couronne d'un petit pôle urbain", modal: { deux_roues: 0.31, voiture_electrique: 1.51, voiture_thermique: 5.51 } },
  { id: "couronne_tres_grand_pole", label: "Couronne d'un très grand pôle urbain", modal: { bus: 0.76, deux_roues: 0.46, velo_elec: 0.13, voiture_electrique: 0.47, voiture_thermique: 8.67 } },
  { id: "couronne_idf", label: "Couronne Île-de-France", modal: { deux_roues: 0.11, voiture_electrique: 1.18, voiture_thermique: 2.64 } },
  { id: "tres_grand_pole", label: "Très grand pôle urbain (hors Paris)", modal: { bus: 0.50, deux_roues: 0.07, metro_tram: 0.29, rer_ter: 0.13, velo_elec: 0.16, voiture_electrique: 0.21, voiture_thermique: 6.55 } },
  { id: "grand_pole", label: "Grand pôle urbain", modal: { bus: 0.29, deux_roues: 0.01, tgv: 0.01, velo_elec: 0.01, voiture_electrique: 0.19, voiture_thermique: 8.86 } },
  { id: "moyen_pole", label: "Pôle urbain moyen", modal: { bus: 0.15, deux_roues: 0.56, velo_elec: 0.04, voiture_electrique: 2.16, voiture_thermique: 7.87 } },
  { id: "petit_pole", label: "Petit pôle urbain", modal: { voiture_thermique: 0.44 } },
  { id: "paris_banlieue", label: "Paris et proche banlieue", modal: { bus: 0.52, deux_roues: 0.02, rer_ter: 0.04, velo_elec: 0.04, voiture_electrique: 0.91, voiture_thermique: 8.80 } },
  { id: "paris_intramuros", label: "Paris intra-muros", modal: { bus: 1.15, deux_roues: 0.55, metro_tram: 1.53, rer_ter: 0.43, velo_elec: 0.07, voiture_electrique: 0.12, voiture_thermique: 0.77 } },
];

function kmModalTotal(zone) {
  return Object.values(zone.modal).reduce((a, b) => a + b, 0);
}
function emissionsPatienteleParActe(zone) {
  return Object.entries(zone.modal).reduce((sum, [mode, km]) => sum + km * FE_TRANSPORT[mode].value, 0);
}

/* ----------------------------------------------------------------------------
   3) FAMILLES DE MÉTIERS — vocabulaire et postes spécifiques adaptés
---------------------------------------------------------------------------- */
export const FAMILLES = [
  {
    id: "sante", label: "Santé & paramédical", icon: "sante",
    metiers: ["Kinésithérapeute", "Infirmier(ère) libéral(e)", "Médecin généraliste ou spécialiste", "Chirurgien-dentiste", "Sage-femme", "Orthophoniste", "Orthoptiste", "Ostéopathe / chiropracteur", "Psychologue / psychothérapeute", "Pédicure-podologue", "Diététicien(ne)", "Autre profession de santé"],
    lieuLabel: "cabinet", lieuArticleMon: "mon cabinet", lieuArticleLe: "le cabinet",
    publicLabel: "patientèle", publicSingulier: "patient", acteLabel: "séances",
    consommables: [
      { id: "materiel_soin", label: "Matériel et consommables de soin (gants, champs, produits, petit matériel)", factor: FE_MONETAIRE.biens_consommables },
      { id: "linge_hygiene", label: "Linge, hygiène et désinfection", factor: FE_MONETAIRE.biens_consommables },
      { id: "fournitures_admin", label: "Fournitures administratives (papier, dossiers patients)", factor: FE_MONETAIRE.biens_consommables },
    ],
    grosMateriel: [
      { id: "imagerie", label: "Appareils d'imagerie / diagnostic (échographe, radiographie)", factor: FE_GROS_MATERIEL_STANDARD },
      { id: "electrotherapie", label: "Électrothérapie, ondes de choc, ultrasons, pressothérapie, cryothérapie", factor: FE_GROS_MATERIEL_STANDARD },
      { id: "equipements_massifs", label: "Équipements de rééducation massifs (tables, plateformes, espaliers)", factor: FE_GROS_MATERIEL_MASSIF },
      { id: "sterilisation", label: "Système de stérilisation (autoclave)", factor: FE_GROS_MATERIEL_STANDARD },
    ],
    uniteActe: "séance",
    motifDeplacement: "autres_motifs_personnels", // EMP2019 : santé non isolable, proxy "autres motifs personnels"
  },
  {
    id: "juridique", label: "Juridique", icon: "juridique",
    metiers: ["Avocat(e)", "Notaire", "Huissier / commissaire de justice", "Mandataire judiciaire", "Autre profession juridique"],
    lieuLabel: "cabinet", lieuArticleMon: "mon cabinet", lieuArticleLe: "le cabinet",
    publicLabel: "clientèle", publicSingulier: "client", acteLabel: "rendez-vous",
    consommables: [
      { id: "impression", label: "Impression, reliure et archivage de dossiers", factor: FE_MONETAIRE.biens_consommables },
      { id: "documentation", label: "Abonnements documentaires et bases juridiques", factor: FE_MONETAIRE.services_intellectuels },
    ],
    grosMateriel: [
      { id: "bureautique_lourde", label: "Photocopieurs professionnels, scanners, serveurs d'archivage", factor: FE_GROS_MATERIEL_STANDARD },
    ],
    uniteActe: "rendez-vous",
    motifDeplacement: "autres_motifs_personnels", // EMP2019 : démarches administratives/juridiques, même proxy que la santé faute de mieux
  },
  {
    id: "conseil", label: "Conseil, formation & indépendants du numérique", icon: "conseil",
    metiers: ["Consultant(e)", "Formateur / formatrice", "Coach professionnel", "Développeur / développeuse indépendant(e)", "Traducteur / traductrice", "Autre activité de conseil"],
    lieuLabel: "bureau", lieuArticleMon: "mon bureau", lieuArticleLe: "le bureau",
    publicLabel: "clientèle", publicSingulier: "client", acteLabel: "missions",
    consommables: [
      { id: "licences", label: "Licences logicielles et abonnements SaaS", factor: FE_MONETAIRE.services_intellectuels },
      { id: "fournitures_bureau", label: "Fournitures de bureau", factor: FE_MONETAIRE.biens_consommables },
    ],
    grosMateriel: [
      { id: "informatique_lourde", label: "Serveurs, baies informatiques, gros équipement réseau", factor: FE_GROS_MATERIEL_STANDARD },
    ],
    uniteActe: "mission",
    motifDeplacement: "autres_motifs_professionnels", // EMP2019 : rendez-vous professionnel d'un tiers
  },
  {
    id: "archi", label: "Architecture & ingénierie", icon: "archi",
    metiers: ["Architecte", "Ingénieur bureau d'études", "Géomètre-expert", "Autre activité d'ingénierie"],
    lieuLabel: "agence", lieuArticleMon: "mon agence", lieuArticleLe: "l'agence",
    publicLabel: "clientèle", publicSingulier: "client", acteLabel: "rendez-vous",
    consommables: [
      { id: "impression_plans", label: "Impression de plans et maquettes", factor: FE_MONETAIRE.biens_consommables },
      { id: "logiciels_metier", label: "Logiciels métier (CAO/BIM) et licences", factor: FE_MONETAIRE.services_intellectuels },
    ],
    grosMateriel: [
      { id: "topo_impression", label: "Scanners 3D, traceurs grand format, stations topographiques", factor: FE_GROS_MATERIEL_STANDARD },
    ],
    uniteActe: "rendez-vous",
    motifDeplacement: "autres_motifs_professionnels", // EMP2019 : rendez-vous professionnel (chantier, client)
  },
  {
    id: "artisanat_art", label: "Artisanat d'art & création", icon: "artisanat",
    metiers: ["Artisan d'art", "Designer / créateur(trice)", "Restaurateur(trice) d'œuvres d'art", "Autre activité de création"],
    lieuLabel: "atelier", lieuArticleMon: "mon atelier", lieuArticleLe: "l'atelier",
    publicLabel: "clientèle", publicSingulier: "client", acteLabel: "commandes",
    consommables: [
      { id: "matieres_premieres", label: "Matières premières et fournitures de création", factor: FE_MONETAIRE.biens_consommables },
      { id: "outillage", label: "Outillage et petit équipement", factor: FE_MONETAIRE.biens_consommables },
    ],
    grosMateriel: [
      { id: "machines_outils", label: "Machines-outils, fours, presses (> 60 kg)", factor: FE_GROS_MATERIEL_MASSIF },
    ],
    uniteActe: "commande",
    motifDeplacement: "achats", // EMP2019 : proxy achat/commande d'un bien
  },
  {
    id: "autre", label: "Autre profession libérale", icon: "autre",
    metiers: ["Autre profession libérale"],
    lieuLabel: "lieu d'exercice", lieuArticleMon: "mon lieu d'exercice", lieuArticleLe: "le lieu d'exercice",
    publicLabel: "clientèle", publicSingulier: "client", acteLabel: "rendez-vous",
    consommables: [
      { id: "fournitures_generales", label: "Fournitures et consommables professionnels", factor: FE_MONETAIRE.biens_consommables },
    ],
    grosMateriel: [
      { id: "gros_equipement", label: "Gros équipement professionnel (> 60 kg)", factor: FE_GROS_MATERIEL_STANDARD },
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
  { id: "dp1", poste: "deplacements_pro", titre: "Basculer les trajets courts (< 5 km) vers le vélo ou le vélo à assistance électrique", source: "SOURCÉ — rapport kinéCO2 : le vélo électrique réduit les émissions d'environ -95% par km vs voiture thermique.", hasPct: true, defaultPct: 30, maxReduction: 0.5, cost: "faible", coutKg: "≈ 0,05 à 0,2 €/kgCO2e évité (vélo amorti sur 5 ans)" },
  { id: "dp2", poste: "deplacements_pro", titre: "Covoiturer ou mutualiser les trajets vers congrès, formations et réunions professionnelles", source: "SOURCÉ — rapport kinéCO2 : passer d'un taux de remplissage de 1 à 2 divise par 2 les émissions du trajet.", hasPct: true, defaultPct: 40, maxReduction: 0.25, cost: "gratuit", coutKg: "0 € — organisation" },
  { id: "dp3", poste: "deplacements_pro", titre: "Électrifier le véhicule professionnel lors du prochain renouvellement", source: "SOURCÉ (partiel) — ADEME Base Empreinte : -95% sur les émissions d'usage. ESTIMÉ : gain net de -55% retenu pour tenir compte d'une fabrication de batterie plus émissive.", hasPct: true, defaultPct: 50, maxReduction: 0.55, cost: "investissement", coutKg: "≈ 1 à 2 €/kgCO2e évité (surcoût amorti sur la durée de vie du véhicule)" },
  { id: "dp4", poste: "deplacements_pro", titre: "Remplacer une partie des déplacements pour congrès/formations par de la visioconférence", source: "ESTIMÉ — bonne pratique de sobriété numérique, non chiffrée par une étude.", hasPct: true, defaultPct: 25, maxReduction: 0.4, cost: "gratuit", coutKg: "0 € — organisation" },

  // --- Déplacements de la patientèle / clientèle ---
  { id: "dc1", poste: "deplacements_patientele", titre: "Développer la téléconsultation ou les rendez-vous à distance quand c'est pertinent", source: "ESTIMÉ — principe reconnu de réduction des déplacements induits, non chiffré par une étude.", hasPct: true, defaultPct: 20, maxReduction: 0.3, cost: "gratuit", coutKg: "0 € — organisation" },
  { id: "dc2", poste: "deplacements_patientele", titre: "Inciter la patientèle/clientèle aux mobilités actives (marche, vélo)", source: "SOURCÉ — rapport kinéCO2 : le facteur d'émission des modes actifs est quasi nul comparé à la voiture.", hasPct: true, defaultPct: 20, maxReduction: 0.3, cost: "gratuit", coutKg: "0 € — communication" },
  { id: "dc3", poste: "deplacements_patientele", titre: "Faciliter le covoiturage pour la patientèle/clientèle", source: "SOURCÉ — rapport kinéCO2 : passer d'un taux de remplissage de 1 à 2 divise par 2 les émissions du trajet.", hasPct: true, defaultPct: 25, maxReduction: 0.25, cost: "gratuit", coutKg: "0 € — communication" },

  // --- Local professionnel ---
  { id: "lo1", poste: "local", titre: "Ajuster la température de consigne (chauffage l'hiver, climatisation l'été)", source: "SOURCÉ — rapport kinéCO2, citant l'ADEME : chaque degré de consigne modifié réduit les émissions correspondantes d'environ 7% (calcul exact, multiplié par le nombre de degrés choisi).", unit: "degres", defaultDegres: 1, maxReductionParDegre: 0.07, cost: "gratuit", coutKg: "0 € — réglage" },
  { id: "lo2", poste: "local", titre: "Remplacer une chaudière gaz/fioul par une pompe à chaleur", source: "SOURCÉ — rapport kinéCO2, citant l'ADEME : une pompe à chaleur émet environ -82% vs une chaudière gaz. Appliqué à la seule part chauffage du poste local.", hasPct: false, defaultPct: 100, maxReduction: 0.4, cost: "investissement", coutKg: "≈ 0,3 à 0,6 €/kgCO2e évité selon aides disponibles" },
  { id: "lo3", poste: "local", titre: "Améliorer l'isolation du local (combles, fenêtres)", source: "ESTIMÉ — ordre de grandeur usuel pour une rénovation d'isolation partielle, non re-vérifié cette session.", hasPct: true, defaultPct: 30, maxReduction: 0.25, cost: "investissement", coutKg: "≈ 0,4 à 0,8 €/kgCO2e évité, aides MaPrimeRénov' possibles" },
  { id: "lo4", poste: "local", titre: "Souscrire un contrat d'électricité verte / renouvelable", source: "ESTIMÉ — effet surtout comptable (garanties d'origine) vu le mix français déjà décarboné ; valeur volontairement basse.", hasPct: true, defaultPct: 100, maxReduction: 0.08, cost: "faible", coutKg: "souvent sans surcoût significatif" },

  // --- Numérique ---
  { id: "nu1", poste: "numerique", titre: "Allonger la durée de vie du matériel informatique (viser 5-6 ans plutôt que 3-4 ans)", source: "ESTIMÉ, calcul explicite — passer de 4 à 6 ans d'amortissement réduit l'empreinte annuelle de fabrication de (1 - 4/6) ≈ 33%.", hasPct: true, defaultPct: 50, maxReduction: 0.3, cost: "gratuit", coutKg: "économie directe" },
  { id: "nu2", poste: "numerique", titre: "Acheter du matériel reconditionné plutôt que neuf", source: "SOURCÉ — HRAFNKELSDÓTTIR, 2022 (KTH), citée dans le rapport kinéCO2 : -42% sur les émissions de fabrication.", hasPct: true, defaultPct: 50, maxReduction: 0.42, cost: "faible", coutKg: "≈ 0,1 €/kgCO2e évité, souvent moins cher que le neuf" },
  { id: "nu3", poste: "numerique", titre: "Limiter le stockage cloud superflu et la vidéo HD par défaut", source: "ESTIMÉ — gain plausible de sobriété numérique de base, non chiffré par une étude.", hasPct: true, defaultPct: 40, maxReduction: 0.2, cost: "gratuit", coutKg: "0 € — réglages" },

  // --- Matériel & consommables métier ---
  { id: "ma1", poste: "materiel", titre: "Privilégier du matériel reconditionné ou éco-conçu pour les équipements", source: "SOURCÉ — HRAFNKELSDÓTTIR, 2022 (KTH), citée dans le rapport kinéCO2 : -42% sur les émissions de fabrication.", hasPct: true, defaultPct: 40, maxReduction: 0.42, cost: "faible", coutKg: "≈ 0,1 à 0,3 €/kgCO2e évité" },
  { id: "ma2", poste: "materiel", titre: "Réduire les consommables à usage unique au profit de solutions réutilisables", source: "ESTIMÉ — non chiffré par une étude.", hasPct: true, defaultPct: 30, maxReduction: 0.2, cost: "faible", coutKg: "économie directe à moyen terme" },
  { id: "ma3", poste: "materiel", titre: "Choisir des fournisseurs/matières à faible empreinte (écolabels, circuits courts)", source: "ESTIMÉ — non chiffré par une étude.", hasPct: true, defaultPct: 30, maxReduction: 0.15, cost: "faible", coutKg: "souvent neutre en coût" },

  // --- Alimentation ---
  { id: "al1", poste: "alimentation", titre: "Augmenter la part de repas végétariens lors des repas professionnels", source: "SOURCÉ, calcul exact — (2,04 - 1,40) / 2,04 ≈ 31%, à partir des facteurs FE_REPAS déjà sourcés (kinéCO2/Agribalyse).", hasPct: true, defaultPct: 40, maxReduction: 0.31, cost: "gratuit", coutKg: "souvent une économie directe" },
  { id: "al2", poste: "alimentation", titre: "Limiter le gaspillage alimentaire lors des repas sur site", source: "ESTIMÉ — ordre de grandeur usuel, non re-vérifié cette session.", hasPct: true, defaultPct: 30, maxReduction: 0.1, cost: "gratuit", coutKg: "économie directe" },

  // --- Achats de services ---
  { id: "se1", poste: "services", titre: "Choisir des prestataires (banque, assurance, comptabilité) engagés bas-carbone", source: "ESTIMÉ — dépend des prestataires réellement disponibles, non chiffré.", hasPct: true, defaultPct: 40, maxReduction: 0.15, cost: "gratuit", coutKg: "0 € — critère de choix" },
  { id: "se2", poste: "services", titre: "Dématérialiser les échanges avec les prestataires et réduire le courrier papier", source: "ESTIMÉ — non chiffré par une étude.", hasPct: true, defaultPct: 50, maxReduction: 0.1, cost: "gratuit", coutKg: "0 € — organisation" },
  { id: "se3", poste: "services", titre: "Limiter la sous-traitance aux besoins essentiels et privilégier des prestataires locaux", source: "ESTIMÉ — non chiffré par une étude.", hasPct: true, defaultPct: 20, maxReduction: 0.1, cost: "gratuit", coutKg: "0 € — organisation" },

  // --- Fret / livraisons ---
  { id: "fr1", poste: "fret", titre: "Grouper les commandes et éviter les livraisons express", source: "ESTIMÉ — principe admis (livraison express plus émissive), non chiffré pour ce contexte.", hasPct: true, defaultPct: 50, maxReduction: 0.3, cost: "gratuit", coutKg: "0 € — organisation" },
  { id: "fr2", poste: "fret", titre: "Privilégier les points relais à la livraison à domicile/au cabinet", source: "ESTIMÉ — principe admis (mutualisation des trajets), non chiffré pour ce contexte.", hasPct: true, defaultPct: 40, maxReduction: 0.2, cost: "gratuit", coutKg: "0 € — organisation" },
];

export const CATEGORIES_META = {
  deplacements_pro: { label: "Déplacements professionnels", icon: "deplacements", color: "#2E673E" },
  deplacements_patientele: { label: "Déplacements de la patientèle / clientèle", icon: "patientele", color: "#5C8A7A" },
  local: { label: "Local professionnel", icon: "local", color: "#C98A2C" },
  numerique: { label: "Numérique", icon: "numerique", color: "#7A6FA8" },
  materiel: { label: "Matériel & consommables métier", icon: "materiel", color: "#B85C5C" },
  alimentation: { label: "Alimentation professionnelle", icon: "alimentation", color: "#4E8FA3" },
  services: { label: "Achats de services", icon: "services", color: "#8A9490" },
  fret: { label: "Fret & livraisons", icon: "fret", color: "#0071C1" },
};

export const COST_WEIGHT = { gratuit: 1, faible: 1.3, investissement: 1.8 };
