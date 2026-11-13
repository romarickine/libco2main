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
 *   "SOURCÉ" = valeur rattachée à une source publiée identifiée (Base
 *              Carbone® avec identifiant de l'élément, rapport, article).
 *   "SOURCÉ (partiel)" / "(proxy)" = source publiée, mais périmètre ou
 *              valeur déduite à préciser (le texte dit en quoi).
 *   "ESTIMÉ" = pas de source directe ; le raisonnement est explicité en
 *              commentaire plutôt que de prétendre à une source qui n'existe pas.
 * Voir docs/MAINTENANCE.md pour la marche à suivre si vous devez mettre à
 * jour une valeur ou ajouter un nouveau métier.
 * ----------------------------------------------------------------------
 */

// --- Références communes des sources ----------------------------------------
// Base Carbone® : jeu de données ouvert publié par l'ADEME sur data.ademe.fr
// (fichier Base_Carbone_V23.6.csv, mis à jour le 03/07/2025), interrogé
// élément par élément le 06/10/2026. Chaque facteur cite l'identifiant de
// l'élément (« id ») pour qu'on puisse le retrouver et le recontrôler.
// Règles de choix appliquées lors de la revue du 06/10/2026 (voir
// docs/revue-facteurs-2026-10.md) :
//   R1. Série annuelle (électricité, trains, ratios monétaires) : millésime le
//       plus récent disponible.
//   R2. L'élément qui correspond à ce que l'outil demande ; quand l'outil ne
//       demande pas la variante (motorisation, filière de traitement…), on
//       prend l'élément « moyen » ou « par défaut » de l'ADEME s'il existe.
//   R3. S'il reste plusieurs candidats (méthodes, sources, variantes sans
//       moyenne publiée) : la valeur la plus haute, par prudence.
export const REF_BASE_CARBONE = "Base Carbone® V23.6, ADEME (jeu ouvert data.ademe.fr du 03/07/2025, consulté le 06/10/2026)";
const BC = REF_BASE_CARBONE;

// --- Déplacements : kgCO2e par km (ou par passager.km pour les TC) ---------
export const FE_TRANSPORT = {
  voiture_thermique: {
    label: "Voiture thermique",
    value: 0.256,
    source: `SOURCÉ — ${BC}, « Voiture, motorisation moyenne, 2023 », kgCO2e/km, Valide générique, id 43791 (amont carburant 0,0532 + combustion 0,161 + fabrication 0,041). Élément « moyen » retenu car l'outil ne demande pas la motorisation (règle R2) ; essence seule : 0,357 (id 43787), gazole : 0,190 (id 43788). Remplace 0,218 (Base Empreinte, valeur antérieure).`,
  },
  voiture_electrique: {
    label: "Voiture électrique",
    value: 0.103,
    source: `SOURCÉ — ${BC}, « Voiture particulière, cœur de gamme, véhicule compact, électrique », kgCO2e/km, Valide générique, id 28007 (fabrication 0,0836 + électricité 0,0198). Valeur inchangée, confirmée.`,
  },
  voiture_hybride: {
    label: "Voiture hybride",
    value: 0.232,
    source: `SOURCÉ — ${BC}, « Voiture particulière, cœur de gamme, véhicule compact, hybride mild essence », kgCO2e/km, Valide générique, id 28011. Pas d'élément « hybride moyen » publié : valeur la plus haute des variantes non rechargeables (règle R3 ; full P2 0,183, id 28008 ; full type Prius 0,147, id 28009 ; mild diesel 0,217, id 28010). Remplace une estimation (0,16).`,
  },
  deux_roues: {
    label: "Deux-roues motorisé",
    value: 0.217,
    source: `SOURCÉ — ${BC}, « Moto > 250 cm3, mixte, 2023 », kgCO2e/km, Valide générique, id 43782. Pas d'élément moyen publié pour les deux-roues : valeur la plus haute (règle R3 ; moto ≤ 250 cm3 0,087, id 43779 ; cyclomoteur 0,0851, id 43775). Remplace 0,087.`,
  },
  velo_meca: {
    label: "Vélo (mécanique)",
    value: 0.006,
    source:
      "SOURCÉ (partiel) — fabrication et entretien du vélo amortis : 0,006 kgCO2e/km d'émissions indirectes, valeur citant « ADEME, étude sur l'usage du vélo en France, 2020 » dans la note du calculateur mobilité de la Wallonie (septembre 2023) ; l'étude ECF « Quantifying CO2 savings of cycling » (2011) donne 0,005. Valeur la plus haute retenue (règle R3). Absent de la Base Carbone ; impactco2.fr (ADEME) affiche 0.",
  },
  velo_elec: {
    label: "Vélo à assistance électrique",
    value: 0.011,
    source: `SOURCÉ — ${BC}, « Vélo à assistance électrique », kgCO2e/km, id 28331 ; même valeur sur impactco2.fr (ADEME : fabrication 8,72 g + usage 2,23 g). Valeur inchangée, confirmée.`,
  },
  bus: {
    label: "Bus urbain",
    value: 0.202,
    source: `SOURCÉ — ${BC}, « Autobus moyen, agglomération de moins de 100 000 habitants », kgCO2e/passager.km, id 27998. Élément « moyen » (toutes motorisations, taux de remplissage réel) retenu (règle R2) ; la taille de l'agglomération n'étant pas demandée, valeur la plus haute des trois tailles (règle R3 ; 100 000 à 250 000 hab. : 0,147, id 27999 ; plus de 250 000 : 0,151, id 28000). Remplace 0,122 (autobus gazole).`,
  },
  metro_tram: {
    label: "Métro / Tramway",
    value: 0.00503,
    source: `SOURCÉ — ${BC}, « Métro, tramway, trolleybus, 2018, agglomération de 100 000 à 250 000 habitants », kgCO2e/passager.km, id 28150. Valeur la plus haute des réseaux hors Île-de-France (règle R3 ; plus de 250 000 hab. : 0,00329, id 28151 ; métro Île-de-France 2022 : 0,00444, id 43253). Remplace 0,005 (rapport kinéCO2).`,
  },
  rer_ter: {
    label: "RER / TER",
    value: 0.0277,
    source: `SOURCÉ — ${BC}, « TER, 2022, traction moyenne », kgCO2e/passager.km, id 43255 : millésime le plus récent (règle R1 ; 2021 : 0,0317, id 37141 ; 2018 : 0,0313, id 28154). RER et Transilien 2022 : 0,00978 (id 43254), plus bas. Remplace 0,0313 (millésime 2018).`,
  },
  tgv: {
    label: "TGV / grande ligne",
    value: 0.0075,
    source: `SOURCÉ — ${BC}, « Intercités, 2022 », kgCO2e/passager.km, id 43272 : la catégorie couvre TGV et trains grandes lignes ; valeur la plus haute des deux pour le millésime le plus récent (règles R1 et R3 ; TGV 2022 : 0,00293, id 43256). Remplace 0,003 (rapport kinéCO2).`,
  },
  marche: {
    label: "Marche à pied",
    value: 0,
    source: "SOURCÉ — négligeable par construction (pas de consommation d'énergie fossile ni d'électricité).",
  },
  avion_court: {
    label: "Avion court-courrier (< 1 000 km)",
    value: 0.289,
    source: `SOURCÉ — ${BC}, « Avion passagers, 101-220 sièges, < 500 km, jet, 2023, AVEC traînées », kgCO2e/passager.km, id 43745. Valeur la plus haute de la tranche pour les avions de ligne de plus de 100 sièges (règle R3 ; 500-1 000 km : 0,225, id 43743 ; les avions régionaux de 20 à 100 sièges, jusqu'à 0,647, ne sont pas retenus : hors lignes courantes). Remplace 0,225.`,
  },
  avion_moyen: {
    label: "Avion moyen-courrier (1 000 - 3 500 km)",
    value: 0.236,
    source: `SOURCÉ — ${BC}, « Avion passagers, > 220 sièges, 1 000-2 000 km, 2023, AVEC traînées », kgCO2e/passager.km, id 43769. Valeur la plus haute de la tranche, avions de plus de 100 sièges (règle R3 ; 101-220 sièges 1 000-2 000 km : 0,185, id 43741 ; 2 000-5 000 km : 0,167 à 0,169). Remplace 0,185.`,
  },
  avion_long: {
    label: "Avion long-courrier (> 3 500 km)",
    value: 0.178,
    source: `SOURCÉ — ${BC}, « Avion passagers, 101-220 sièges, > 5 000 km, 2023, AVEC traînées », kgCO2e/passager.km, id 43749. Valeur la plus haute de la tranche (règle R3 ; > 220 sièges : 0,151, id 43773). Valeur inchangée, désormais rattachée à la Base Carbone.`,
  },
};

// --- Énergie : kgCO2e par kWh -----------------------------------------------
// `value` : facteur appliqué à la consommation. `valueChauffage` (électricité
// seulement) : facteur appliqué quand l'électricité sert au chauffage
// (radiateurs, pompe à chaleur) ; voir FE_CHAUFFAGE plus bas.
export const FE_ENERGIE = {
  electricite: {
    label: "Électricité (radiateurs/convecteurs)",
    value: 0.0519,
    valueChauffage: 0.115,
    source: `SOURCÉ — ${BC}. Électricité spécifique (éclairage, appareils) : « Électricité, 2024, mix moyen, consommation », 0,0519 kgCO2e/kWh, id 43642 (millésime le plus récent, règle R1 ; 2023 : 0,058). Chauffage électrique : « Électricité, 2023, usage chauffage, consommation, méthode saisonnalisée », 0,115 kgCO2e/kWh, id 43276 (dernier millésime publié pour cet usage) — le chauffage se concentre en hiver, quand le mix est le plus carboné ; valeur la plus haute des deux méthodes publiées (règle R3 ; méthode moyenne : 0,0645, id 43277). Remplace 0,052 pour tous usages.`,
  },
  gaz: {
    label: "Gaz naturel",
    value: 0.243,
    source: `SOURCÉ — ${BC}, « Gaz naturel », kgCO2e/kWh PCI, Valide générique, id 13515 (même valeur pour la combustion en chaudière, id 25826). Valeur la plus haute (règle R3 ; « Gaz naturel 2022, mix moyen, consommation » : 0,239, id 37132). Valeur inchangée, confirmée.`,
  },
  fioul: {
    label: "Fioul domestique",
    value: 0.325,
    source: `SOURCÉ — ${BC}, « Fioul domestique », kgCO2e/kWh PCI, Valide générique, id 14085. Valeur la plus haute des deux éléments valides (règle R3 ; id 14084 : 0,324). Remplace 0,324.`,
  },
  bois: {
    label: "Bois / biomasse",
    value: 0.046,
    source: `SOURCÉ — ${BC}, « Bois bûches, combustion en poêle à bois », kgCO2e/kWh, Valide spécifique, id 25834. Valeur la plus haute des combinaisons combustible/appareil (règle R3 ; bûches en chaudière : 0,032, id 25830). Valeur inchangée, confirmée.`,
  },
  reseau_chaleur: {
    label: "Réseau de chaleur urbain",
    value: 0.108,
    source:
      "SOURCÉ — FEDENE / SNCU, Enquête nationale des réseaux de chaleur et de froid, restitution des données 2025 (communiqué FEDENE du 22/10/2026) : contenu moyen de 108 gCO2e/kWh en analyse de cycle de vie, millésime le plus récent (règle R1). Série : 113 g en 2023 (édition 2024, p. 35 ; 91 g en émissions directes), 109 g en 2024 (synthèse de l'édition 2025, p. 3 et 7). Moyenne nationale : le contenu d'un réseau donné peut s'en écarter nettement (liste par réseau : arrêté DPE du 5 juillet 2024 ; la Base Carbone donne aussi une valeur par réseau). Remplace 0,113.",
  },
  pac: {
    label: "Pompe à chaleur (électrique)",
    value: 0.115,
    source: `SOURCÉ — même facteur que le chauffage électrique : ${BC}, « Électricité, 2023, usage chauffage, méthode saisonnalisée », id 43276. Le coefficient de performance de la pompe à chaleur n'est pas déduit : sans facture, les kWh de chauffage viennent d'un ratio par m² qui ne dit pas quelle part est de la chaleur produite ; ce choix surestime volontairement (prudence) les locaux chauffés par pompe à chaleur. Remplace 0,052.`,
  },
};

/** Facteur appliqué aux kWh de chauffage d'une énergie (kgCO2e/kWh). */
export function feChauffage(energie) {
  const f = FE_ENERGIE[energie];
  return f.valueChauffage ?? f.value;
}

// SOURCÉ — consommation totale par m² : ADEME, Observatoire de la
// performance énergétique, de la réduction des émissions de gaz à effet de
// serre et de la qualité de l'air dans le tertiaire (déclarations OPERAT du
// dispositif Éco Énergie Tertiaire), jeu « Consommation tertiaire par
// activité », data.ademe.fr, Licence Ouverte, mis à jour le 31/10/2026 :
// année 2024 (la plus récente complète, règle R1), tous vecteurs, consommation
// ajustée du climat, kWh/m²/an. « Santé libérale » 172 (1 015 déclarations),
// « Bureaux » 121, « Commerce et service de détail » 120, tout le tertiaire
// 130. Partage chauffage / autres usages : SDES-CEREN, « Données sur les
// consommations d'énergie du tertiaire en 2020 », consommations 2019 par
// branche (NAF) : part du chauffage 42,6 % (86, santé humaine), 46,7 % (69-71,
// activités juridiques, comptables, de conseil, d'architecture), 36,7 % (47,
// commerce de détail), 42,1 % (ensemble du tertiaire). Remplace les ratios
// ADEME/CEREN « Bâtiment - Chiffres clés 2012 » repris du classeur kinéCO2.
// Limites : OPERAT ne couvre que les bâtiments de 1 000 m² et plus ; les
// « autres usages » comprennent l'eau chaude et la cuisson, comptées ici au
// facteur de l'électricité.
export const RATIOS_ENERGIE_PAR_ACTIVITE = {
  sante: { chauffage: 73, elec: 99 }, // OPERAT « Santé libérale » 172 × 42,6 % (NAF 86)
  juridique: { chauffage: 57, elec: 64 }, // OPERAT « Bureaux » 121 × 46,7 % (NAF 69-71)
  conseil: { chauffage: 57, elec: 64 }, // idem
  archi: { chauffage: 57, elec: 64 }, // idem
  artisanat_art: { chauffage: 44, elec: 76 }, // OPERAT « Commerce et service de détail » 120 × 36,7 % (NAF 47) — atelier/point de vente
  autre: { chauffage: 55, elec: 75 }, // OPERAT tout le tertiaire 130 × 42,1 % (repli générique)
};
export const RATIOS_ENERGIE_SOURCE =
  "SOURCÉ — consommation totale : ADEME, Observatoire du tertiaire (déclarations OPERAT, dispositif Éco Énergie Tertiaire), jeu « Consommation tertiaire par activité » (data.ademe.fr, mis à jour le 31/10/2026), année 2024, tous vecteurs, consommation ajustée du climat : santé libérale 172 kWh/m²/an (1 015 déclarations), bureaux 121, commerce et service de détail 120, ensemble du tertiaire 130. Part du chauffage : SDES-CEREN, « Données sur les consommations d'énergie du tertiaire en 2020 » (données 2019 par branche) : santé humaine 42,6 %, activités juridiques, de conseil et d'architecture 46,7 %, commerce de détail 36,7 %, ensemble 42,1 %. Limites : OPERAT ne couvre que les bâtiments de 1 000 m² et plus ; les autres usages comprennent l'eau chaude et la cuisson, comptées au facteur de l'électricité. Remplace les ratios ADEME/CEREN « Bâtiment - Chiffres clés 2012 » (128+71, 138+127, 103+130, 120+86).";

// --- Numérique -------------------------------------------------------------
// Empreinte de FABRICATION par appareil (kgCO2e/unité). Table commune aux
// deux outils : Cab l'amortit sur DUREE_AMORTISSEMENT_ANS (voir FE_NUMERIQUE
// ci-dessous), MSP sur la durée de détention déclarée pour chaque appareil.
export const FACTEURS_NUMERIQUE_FABRICATION = {
  ordinateurFixe: {
    valeur: 296,
    source: `SOURCÉ — ${BC}, « Ordinateur fixe, haute performance », kgCO2e/unité, id 27004 (élément valide dans cette version). Valeur la plus haute des deux variantes (règle R3 ; bureautique : 169, id 27003).`,
  },
  ordinateurPortable: {
    valeur: 156,
    source: `SOURCÉ — ${BC}, « Ordinateur portable », kgCO2e/unité, id 27002. Valeur inchangée, désormais rattachée à la Base Carbone (citait ISLEAN 2019).`,
  },
  ecranSupplementaire: {
    valeur: 248,
    source: `SOURCÉ — ${BC}, « Écran 23,8 pouces », kgCO2e/unité, id 27006. Taille non demandée : valeur la plus haute des écrans de bureau (règle R3 ; 21,5 pouces : 222, id 27005). Remplace 222.`,
  },
};

// Facteurs unitaires d'usage numérique, gCO2e, phases réseaux et centres de
// données (ADEME : Impact CO2, src/data/categories/usagenumerique.ts, version
// du 22/10/2026 ; modèle publicodes-acv-numerique, version du 19/08/2026).
// - courriel : transmission 0,036 + construction 0,935 + usage 0,118 des
//   centres de données = 1,09 g ;
// - recherche web : 0,020 + 0,340 + 0,226 + construction des réseaux 0,030
//   = 0,62 g ;
// - Go transféré : réseau fixe France 9,27 g/Go (NegaOctet, box comprise)
//   + centres de données 1,95 Wh/Go (données Netflix 2019 reprises par
//   l'ADEME) × électricité 2024 ;
// - visio HD : 3 Go/h par participant, 2 participants, + construction des
//   centres de données 0,24 g/h.
export const JOURS_OUVRES_AN = 220; // ESTIMÉ (convention)
export const USAGE_NUMERIQUE_UNITAIRE = {
  mail: 1.09,
  recherche: 0.62,
  get go() {
    return 9.27 + 1.95 * FE_ENERGIE.electricite.value;
  },
  get visioHeureHD() {
    return 2 * 3 * this.go + 0.24;
  },
};
// ESTIMÉ — volumes quotidiens de chaque palier (aucune source ne publie de
// paliers). « fort » reprend les 117,7 courriels envoyés et reçus par jour et
// par personne (Radicati, valeur par défaut du modèle ADEME).
export const USAGE_NUMERIQUE_PALIERS = {
  faible: { mails: 20, recherches: 10, visioHeures: 0, go: 0.1 },
  moyen: { mails: 50, recherches: 30, visioHeures: 0.4, go: 0.5 },
  fort: { mails: 118, recherches: 60, visioHeures: 1, go: 3 },
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
  // Usage hors terminaux (réseaux et centres de données), kgCO2e/an pour le
  // cabinet. La fabrication des appareils est comptée ci-dessus et leur
  // électricité dans le poste local : seules les phases « transmission » et
  // « centres de données » sont prises ici. Facteurs unitaires SOURCÉS (ADEME,
  // modèle publicodes-acv-numerique et données d'Impact CO2, sources NegaOctet) ;
  // volumes de chaque palier ESTIMÉS (scénarios explicités dans
  // USAGE_NUMERIQUE_PALIERS), 220 jours ouvrés par an (convention).
  get usage_an() {
    const u = USAGE_NUMERIQUE_UNITAIRE;
    const parJour = (p) => p.mails * u.mail + p.recherches * u.recherche + p.visioHeures * u.visioHeureHD + p.go * u.go;
    const an = (p) => Math.round((parJour(p) * JOURS_OUVRES_AN) / 1000);
    return {
      faible: an(USAGE_NUMERIQUE_PALIERS.faible),
      moyen: an(USAGE_NUMERIQUE_PALIERS.moyen),
      fort: an(USAGE_NUMERIQUE_PALIERS.fort),
    };
  },
  usageSource:
    "Facteurs unitaires SOURCÉS — ADEME, Impact CO2 et modèle publicodes-acv-numerique (sources NegaOctet), phases réseaux et centres de données seulement (la fabrication des appareils est comptée à part et leur électricité dans le local) : courriel 1,09 gCO2e ; recherche web 0,62 g ; transfert de données sur réseau fixe en France 9,27 g/Go (box comprise) + centres de données 1,95 Wh/Go ; visioconférence HD à deux 3 Go/h par participant, soit 56 g/h. Volumes ESTIMÉS (aucune source ne publie de paliers) : faible = 20 courriels, 10 recherches, 0,1 Go par jour ; moyen = 50 courriels, 30 recherches, 2 h de visio HD par semaine, 0,5 Go par jour ; fort = 118 courriels (moyenne Radicati reprise par l'ADEME), 60 recherches, 1 h de visio HD et 3 Go par jour ; 220 jours ouvrés par an (convention). Écart signalé : l'approche globale ADEME-Arcep (2025) donne 434 kgCO2e par habitant et par an, terminaux compris ; la part réseaux et centres de données de l'usage reste de l'ordre de quelques dizaines de kilos. Remplace 15 / 40 / 90 (estimés).",
};

// --- Alimentation --------------------------------------------------------
// SOURCÉ — Base Carbone V23.6 : « Repas moyen » 2,04 kgCO2e/repas (id 20682) ;
// « Repas végétarien » 0,51 kgCO2e/repas (id 20683), mêmes valeurs sur
// impactco2.fr (ADEME). Le 1,40 utilisé jusqu'ici pour le repas végétarien
// (repris du rapport kinéCO2) n'a été retrouvé dans aucune source publiée.
export const FE_REPAS = { standard: 2.04, vegetarien: 0.51 };
export const FE_REPAS_SOURCE = `SOURCÉ — ${BC} : « Repas moyen » 2,04 kgCO2e/repas (id 20682) ; « Repas végétarien » 0,51 kgCO2e/repas (id 20683), valeurs reprises par impactco2.fr. Le repas végétarien remplace 1,40 (rapport kinéCO2, origine non retrouvée).`;

// --- Ratios monétaires (kgCO2e / €) ---
// SOURCÉ — Base Carbone V23.6, ratios monétaires, millésime 2023 (le plus
// récent publié, règle R1), en kgCO2e par k€ HT. Identifiants vérifiés le
// 06/10/2026. Valeurs inchangées.
export const FE_MONETAIRE = {
  // Moyenne de trois catégories proches : « Services juridiques et comptables /
  // services des sièges sociaux / conseil de gestion » 2023 (67, id 43545) +
  // « Assurance, réassurance, retraites » 2023 (77, id 43475) + « Services
  // financiers, hors assurances » 2023 (70, id 43530) = 71,3 kgCO2e/k€ → 0,072.
  services_administratifs: 0.072,
  // « Autres services spécialisés, scientifiques et techniques » 2023 : 110 (id 43315).
  prestations_specialisees: 0.11,
  // « Services juridiques et comptables / services des sièges sociaux /
  // conseil de gestion » 2023 : 67 (id 43545).
  juridique_conseil_gestion: 0.067,
  // « Programmation, conseil IT / Services d'information » 2023 : 75 (id 43445).
  informatique_conseil: 0.075,
  // « Papier et carton » 2023 : 357 (id 43370). Catégorie précise pour les
  // fournitures administratives et l'impression ; moins précise pour les
  // consommables de soin ou les matières d'artisanat d'art — limite assumée,
  // faute d'un facteur par nature de consommable.
  biens_consommables: 0.357,
  // « Produits pharmaceutiques de base et préparations pharmaceutiques » 2023 :
  // 194 (id 43435). Même facteur pour les médicaments vendus (pharmaciens) et
  // prescrits, dans Cab comme dans MSP. The Shift Project (note technique du
  // 18/04/2023, p. 10) retenait 500 kgCO2e/k€, valeur de la Base Empreinte
  // de l'époque ; l'ADEME a depuis publié 194 pour le millésime 2023 : la
  // version la plus récente de la même source l'emporte (règle R1).
  medicaments: 0.194,
  // « Services de santé humaine » 2023 : 82 (id 43505). Proxy pour les actes
  // médicaux prescrits hors médicament (examens, dispositifs médicaux).
  actes_medicaux: 0.082,
};

// SOURCÉ (facteur) — ADEME, Impact CO2, comparateur « Livraison de colis »,
// tiré de l'étude ADEME / ministère de la Transition écologique « Commerce en
// ligne : impacts environnementaux de la logistique, des transports et des
// déplacements » (2023) : colis de 1 kg livré à domicile (ou au cabinet)
// 0,72 kgCO2e (commande et préparation, stockage et transit, dernier
// kilomètre). ESTIMÉ (poids) : aucun poids moyen publié ; 1 kg est le premier
// cas type de l'étude (2 kg : 1,08 ; 15 kg : 7,16). Remplace 1,0 (ratio déduit).
export const FE_FRET_COLIS = 0.72;
export const FE_FRET_COLIS_SOURCE =
  "SOURCÉ (facteur) — ADEME, Impact CO2, « Livraison de colis » (étude ADEME / ministère de la Transition écologique « Commerce en ligne : impacts environnementaux de la logistique, des transports et des déplacements », 2023) : colis de 1 kg livré à domicile ou au cabinet, 0,72 kgCO2e. Retrait en point relais en voiture : 1,65 ; à pied : 0,66. ESTIMÉ (poids) : aucun poids moyen publié ; 1 kg est le premier cas type de l'étude (2 kg : 1,08 kgCO2e ; 15 kg : 7,16). Remplace 1,0 (ratio déduit).";

// Facteurs de TRAITEMENT EN FIN DE VIE des déchets courants (kgCO2e/kg),
// à ne pas confondre avec la fabrication des produits (déjà captée par le
// poste "Matériel et consommables") — même niveau de détail que l'étude
// déchets du projet kinéCO2 : plastique, métal, papier, carton, aluminium,
// verre, déchets ménagers, déchets électroniques. Le DASRI (déchets
// d'activité de soins à risques infectieux) est distinct, réservé à la
// famille Santé & paramédical.
// Revue du 06/10/2026 : élément « Fin de vie moyenne filière – Impacts » de
// la Base Carbone pour chaque flux (la filière réelle moyenne en France : tri,
// recyclage, refus incinérés…), règle R2. Les « émissions évitées » publiées
// à côté ne sont pas déduites (convention des bilans GES). Les valeurs
// précédentes (0,02 à 0,11 kg/kg pour les flux triés) ne couvraient pas les
// procédés de recyclage ni la combustion des plastiques fossiles.
export const FE_DECHETS = {
  plastique: {
    label: "Plastique",
    value: 1.907,
    source: `SOURCÉ — ${BC}, « Emballages, plastique souple PE pétrosourcé, fin de vie moyenne filière – impacts », kgCO2e/tonne (1 907), id 34544. Valeur la plus haute des fins de vie moyennes des plastiques pétrosourcés (règle R3 ; plastique rigide pétrosourcé : 1 906 et 1 210 ; autres plastiques et complexes : 1 844, id 34590). La combustion du plastique fossile domine. Remplace 0,041.`,
  },
  metal: {
    label: "Métal (hors aluminium)",
    value: 0.135,
    source: `SOURCÉ — ${BC}, « Emballages, acier, incinération – impacts », kgCO2e/tonne (135), id 34462. Pas de fin de vie moyenne publiée pour l'acier : valeur la plus haute des filières publiées (règle R3 ; stockage : 41, id 34466). Remplace une estimation (0,11).`,
  },
  papier: {
    label: "Papier",
    value: 0.737,
    source: `SOURCÉ (proxy) — ${BC}, « Emballages, carton, fin de vie moyenne filière – impacts », kgCO2e/tonne (737), id 34486. Aucun élément valide pour le papier seul (anciennes valeurs archivées) : le carton, même filière de recyclage des fibres, sert de proxy. Remplace une estimation (0,028).`,
  },
  carton: {
    label: "Carton",
    value: 0.737,
    source: `SOURCÉ — ${BC}, « Emballages, carton, fin de vie moyenne filière – impacts », kgCO2e/tonne (737), id 34486 (recyclage seul : 992, id 34480 ; incinération : 120). Remplace une estimation (0,028).`,
  },
  aluminium: {
    label: "Aluminium",
    value: 0.311,
    source: `SOURCÉ — ${BC}, « Emballages, aluminium, fin de vie moyenne filière – impacts », kgCO2e/tonne (311), id 34470 (recyclage seul : 873, id 34460 ; incinération : 110, id 34464). Remplace 0,11 (incinération seule).`,
  },
  verre: {
    label: "Verre",
    value: 0.496,
    source: `SOURCÉ — ${BC}, « Emballages, verre, fin de vie moyenne filière – impacts », kgCO2e/tonne (496), id 34478 (recyclage seul : 639, id 34472). Remplace une estimation (0,02).`,
  },
  menagers: {
    label: "Déchets ménagers non triés (résiduels)",
    value: 0.386,
    source: `SOURCÉ — ${BC}, « Ordures ménagères résiduelles, fin de vie moyenne – impacts », kgCO2e/tonne (386), France continentale, id 34654 (incinération : 374, id 34650 ; stockage : 412, id 34652). Remplace 0,374 (incinération seule).`,
  },
  electronique: {
    label: "Déchets électroniques (DEEE)",
    value: 1.995,
    source: `SOURCÉ — ${BC}, « DEEE moyen (par défaut), fin de vie moyenne filière – impacts », kgCO2e/tonne (1 995), id 34620 : élément « par défaut » quand le type d'appareil n'est pas connu (règle R2 ; petits appareils en mélange : 802, id 34612). Remplace 0,802.`,
  },
};

// DASRI — réservé à la famille Santé & paramédical (matériel piquant/
// coupant, produits biologiques). Incinération à haute température
// obligatoire (code de la santé publique), aucune autre filière autorisée.
export const FE_DASRI = {
  label: "DASRI (déchets d'activité de soins à risques infectieux)",
  value: 0.943,
  source: `SOURCÉ — ${BC}, « DAS (déchets d'activités de soins), incinération – impacts », kgCO2e/tonne (943), id 34713. Recoupé : 934 kgCO2e/t selon le Manuel développement durable de l'Association française d'urologie (« Réduction des DASRI », p. 5, citant The Shift Project 2021) ; valeur la plus haute retenue (règle R3). Remplace 0,934.`,
};

// --- Gros matériel & mobilier (immobilisations, amorties sur 5 ans) ---
// Matériel médical « standard » (appareils, tables) : SOURCÉ — Base Carbone
// V23.6, ratio monétaire « Autres produits manufacturés » 2023 : 231 kgCO2e/k€
// HT (id 43365) ; cette catégorie de la nomenclature d'activités comprend la
// fabrication d'instruments et de fournitures à usage médical et dentaire.
// Valeur la plus haute face au 0,19 du rapport kinéCO2 (non publié) et aux
// « Produits informatiques, électroniques et optiques » 2023 (216, id 43420),
// qui couvrent l'électromédical (règle R3). Remplace 0,19.
export const FE_GROS_MATERIEL_STANDARD = 0.231;
// Équipements massifs (plateformes, appareils de rééducation en acier) :
// SOURCÉ (indirect) — intensité carbone d'un fabricant-distributeur
// d'articles de sport (Decathlon, Déclaration de performance extra-financière
// 2023, p. 30) : 0,67 kgCO2e par € de chiffre d'affaires HT, tous scopes
// (2022 : 0,75 ; fabrication seule : 0,50). Millésime le plus récent publié
// (règle R1). Plus haut que les ratios monétaires ADEME applicables
// (« Produits métalliques » 317, id 43425 ; « Machines et équipements » 273,
// id 43355). Remplace 0,72 (rapport kinéCO2, non publié).
export const FE_GROS_MATERIEL_MASSIF = 0.67;
// SOURCÉ — Base Carbone V23.6, ratio monétaire « Machines et équipements »
// 2023 : 273 kgCO2e/k€ HT (id 43355). Familles hors santé. Valeur inchangée.
export const FE_GROS_MATERIEL_BUREAU_INDUSTRIEL = 0.273;
// SOURCÉ — Base Carbone V23.6, ratio monétaire « Meubles » 2023 : 231
// kgCO2e/k€ HT (id 43360), millésime le plus récent (règle R1). Remplace 0,261
// (« Meubles et autres biens manufacturés », millésime antérieur, via kinéCO2).
export const FE_MOBILIER = 0.231;
// ESTIMÉ (convention) — 5 ans, durée d'amortissement par défaut du rapport
// kinéCO2 (tableau 7). Aucune convention publiée par l'ADEME ou l'Association
// pour la transition Bas Carbone n'a été trouvée pour ce type de matériel ;
// la méthode réglementaire BEGES v5 ne fixe pas de durée.
export const DUREE_AMORTISSEMENT_ANS = 5;

/**
 * Facteurs sans libellé ni source dans leur propre structure, décrits ici pour
 * la page publique de méthodologie (cab/methodologie.html). Les valeurs
 * viennent des constantes ci-dessus : rien n'est recopié.
 */
export const AUTRES_FACTEURS = [
  { groupe: "Numérique", label: "Usage (réseaux, centres de données, électricité), par niveau faible / moyen / fort", valeur: `${FE_NUMERIQUE.usage_an.faible} / ${FE_NUMERIQUE.usage_an.moyen} / ${FE_NUMERIQUE.usage_an.fort}`, unite: "kgCO2e/an", source: FE_NUMERIQUE.usageSource },
  { groupe: "Alimentation", label: "Repas moyen", valeur: FE_REPAS.standard, unite: "kgCO2e/repas", source: FE_REPAS_SOURCE },
  { groupe: "Alimentation", label: "Repas végétarien", valeur: FE_REPAS.vegetarien, unite: "kgCO2e/repas", source: FE_REPAS_SOURCE },
  { groupe: "Achats (ratios monétaires)", label: "Services administratifs (comptabilité, banque, assurance)", valeur: FE_MONETAIRE.services_administratifs, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, moyenne de trois ratios 2023 : services juridiques et comptables / conseil de gestion (67 kgCO2e/k€, id 43545), assurance, réassurance, retraites (77, id 43475), services financiers hors assurances (70, id 43530).` },
  { groupe: "Achats (ratios monétaires)", label: "Prestations spécialisées (sous-traitance)", valeur: FE_MONETAIRE.prestations_specialisees, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Autres services spécialisés, scientifiques et techniques » 2023 : 110 kgCO2e/k€, id 43315.` },
  { groupe: "Achats (ratios monétaires)", label: "Juridique, conseil de gestion", valeur: FE_MONETAIRE.juridique_conseil_gestion, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Services juridiques et comptables / services des sièges sociaux / conseil de gestion » 2023 : 67 kgCO2e/k€, id 43545.` },
  { groupe: "Achats (ratios monétaires)", label: "Informatique, conseil IT", valeur: FE_MONETAIRE.informatique_conseil, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Programmation, conseil IT / services d'information » 2023 : 75 kgCO2e/k€, id 43445.` },
  { groupe: "Achats (ratios monétaires)", label: "Consommables (fournitures, linge, petit matériel)", valeur: FE_MONETAIRE.biens_consommables, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Papier et carton » 2023 : 357 kgCO2e/k€, id 43370. Catégorie précise pour les fournitures administratives, moins pour les consommables de soin (limite assumée).` },
  { groupe: "Achats (ratios monétaires)", label: "Médicaments (vendus ou prescrits)", valeur: FE_MONETAIRE.medicaments, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Produits pharmaceutiques de base et préparations pharmaceutiques » 2023 : 194 kgCO2e/k€, id 43435. Seul facteur construit sur des données françaises (comptes SDES/INSEE de la branche, euros 2023 hors taxes, incertitude annoncée de 80 %) ; série du même élément en baisse (219 à 194 selon le millésime). The Shift Project (note technique du 18/04/2023) retenait 500 kgCO2e/k€ (id 25019, élément archivé de la même base) : la version la plus récente est retenue (règle R1). Les valeurs étrangères publiées (NHS Angleterre ≈ 0,72 kgCO2e/€ ; Pays-Bas ≈ 1,2, lues de seconde main) reposent sur d'autres prix et d'autres mix. Base de prix à vérifier : le facteur s'applique à des € hors taxes au prix de la branche ; un chiffre d'affaires d'officine au prix public peut le surestimer.` },
  { groupe: "Achats (ratios monétaires)", label: "Actes médicaux prescrits (hors médicaments)", valeur: FE_MONETAIRE.actes_medicaux, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Services de santé humaine » 2023 : 82 kgCO2e/k€, id 43505 (proxy).` },
  { groupe: "Fret", label: "Colis livré", valeur: FE_FRET_COLIS, unite: "kgCO2e/colis", source: FE_FRET_COLIS_SOURCE },
  { groupe: "Immobilisations", label: "Matériel médical standard", valeur: FE_GROS_MATERIEL_STANDARD, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Autres produits manufacturés » 2023 : 231 kgCO2e/k€, id 43365 (comprend les instruments et fournitures à usage médical) ; valeur la plus haute face au rapport kinéCO2 (0,19) et aux produits électroniques et optiques 2023 (216, id 43420).` },
  { groupe: "Immobilisations", label: "Équipements massifs (plateformes, appareils en acier)", valeur: FE_GROS_MATERIEL_MASSIF, unite: "kgCO2e/€ HT", source: "SOURCÉ (indirect) — Decathlon, Déclaration de performance extra-financière 2023, p. 30 : 0,67 kgCO2e par € de chiffre d'affaires HT, tous scopes (2022 : 0,75 ; fabrication seule : 0,50), millésime le plus récent publié (règle R1). Intensité d'un fabricant-distributeur d'articles de sport, appliquée faute de facteur propre aux appareils de rééducation ; plus haute que les ratios ADEME « Produits métalliques » (0,317, id 43425) et « Machines et équipements » (0,273, id 43355). Remplace 0,72 (rapport kinéCO2, non publié)." },
  { groupe: "Immobilisations", label: "Machines et équipements (familles hors santé)", valeur: FE_GROS_MATERIEL_BUREAU_INDUSTRIEL, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Machines et équipements » 2023 : 273 kgCO2e/k€, id 43355.` },
  { groupe: "Immobilisations", label: "Mobilier", valeur: FE_MOBILIER, unite: "kgCO2e/€ HT", source: `SOURCÉ — ${BC}, « Meubles » 2023 : 231 kgCO2e/k€, id 43360 (millésime le plus récent, règle R1).` },
  { groupe: "Immobilisations", label: "Durée d'amortissement par défaut", valeur: DUREE_AMORTISSEMENT_ANS, unite: "ans", source: "ESTIMÉ (convention) — durée par défaut du rapport kinéCO2 (tableau 7) ; aucune convention publiée par l'ADEME ou l'Association pour la transition Bas Carbone trouvée ; la méthode BEGES v5 ne fixe pas de durée." },
  { groupe: "Local", label: "Consommation par défaut (sans facture), par m² : santé / bureaux / commerces / moyenne", valeur: `${RATIOS_ENERGIE_PAR_ACTIVITE.sante.chauffage}+${RATIOS_ENERGIE_PAR_ACTIVITE.sante.elec} / ${RATIOS_ENERGIE_PAR_ACTIVITE.juridique.chauffage}+${RATIOS_ENERGIE_PAR_ACTIVITE.juridique.elec} / ${RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art.chauffage}+${RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art.elec} / ${RATIOS_ENERGIE_PAR_ACTIVITE.autre.chauffage}+${RATIOS_ENERGIE_PAR_ACTIVITE.autre.elec}`, unite: "kWh/m²/an (chauffage + autres usages)", source: RATIOS_ENERGIE_SOURCE },
];

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
    // Gain calculé sur la seule part concernée (Cab et MSP, shared/js/plan-actions.js).
    partConcernee: "50 % des km en voiture ou deux-roues motorisé, au facteur du vélo à assistance électrique",
    poste: "deplacements_pro",
    titre: "Basculer les trajets courts (< 5 km) vers le vélo ou le vélo à assistance électrique",
    source:
      "SOURCÉ (gain unitaire) — vélo à assistance électrique 0,011 kgCO2e/km contre voiture thermique 0,256 (Base Carbone V23.6, ids 28331 et 43791) : −96 % par km basculé. ESTIMÉ (part adressable) : au plus 50 % des kilomètres du quotidien (domicile-travail, visites) faits en voiture ou en deux-roues motorisé, signalé ; le gain est calculé sur ces seuls kilomètres (aucun si l'on circule déjà à vélo, à pied ou en transports en commun). Repères consultés : un tiers des actifs travaillent à 5 km ou moins, et 60 % d'entre eux y vont en voiture (Insee Première n° 1835, janvier 2021) ; les déplacements de moins de 10 km font 71 % des déplacements mais moins de 13 % des kilomètres (SDES, enquête mobilité des personnes 2019, publication du 29/08/2024). Aucune part des kilomètres sous 5 km n'est publiée : 50 % est élevé, sauf pour une activité très locale (visites à domicile).",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.5,
    coutKg: "≈ −0,14 à +0,12 €/kgCO2e évité si la voiture est conservée (selon l'entretien, estimé) ; nettement négatif si elle est vendue",
    coutNet: { min: -0.14, max: 0.12, calcul: "Calcul : coût du vélo à assistance électrique 0,079 à 0,086 €/km = prix moyen 1 999 € (Union Sport & Cycle, Observatoire du cycle 2025, avril 2026, p. 14) + une batterie de remplacement 300 à 500 € (ADEME, Étude d'évaluation sur les services vélos, 2016, p. 36), sur 30 000 km (12 ans × 2 500 km et un renouvellement de batterie : ADEME, Base Carbone id 28331) + électricité ≈ 0,002 €/km (une charge tous les 40 km, ADEME id 28331 ; batterie de 0,5 kWh, ESTIMÉ ; 0,195 €/kWh TTC (EDF, grille Tarif Bleu non résidentiel en vigueur au 1er août 2026, option Base 6 kVA : 13,18 c€/kWh HT + accise 3,062 c€/kWh, TVA 20 % non récupérable pour une activité de soins exonérée)). ESTIMÉ : entretien 0 à 100 €/an, soit 0 à 0,04 €/km (aucune source primaire trouvée). Moins le carburant économisé : 0,097 €/km en diesel (5,93 L/100 km, MTE/SDES/CCTN 2024, tableau repris par le CCFA, L'industrie automobile française 2025, p. 53 ; gazole 1,64 €/L, moyenne 2025, Insee série 010533883) à 0,114 €/km en essence (6,72 L/100 km ; SP95-E10 1,70 €/L, Insee série 010596133). Divisé par 0,245 kgCO2e évité par km (0,256 − 0,011). Si la voiture est vendue, l'économie atteint le coût complet d'une voiture (barème kilométrique 2026 : 0,34 à 0,64 €/km) et le coût devient nettement négatif." },
    coutAbattement: "Non chiffré : France Stratégie (2021) juge l'indicateur inadapté aux modes actifs, « fortement négatif » si les bénéfices de santé sont comptés.",
  },
  {
    id: "dp2",
    // Gain calculé sur la seule part concernée (Cab et MSP, shared/js/plan-actions.js).
    partConcernee: "moitié des émissions des congrès faits en voiture",
    poste: "deplacements_pro",
    titre: "Covoiturer ou mutualiser les trajets vers congrès, formations et réunions professionnelles",
    source:
      "SOURCÉ (calcul exact) — à deux par voiture, les émissions par personne d'un trajet sont divisées par deux (−50 %). Calculé sur les seuls congrès et formations faits en voiture (aucun gain s'ils se font en train ou en avion) ; le curseur donne la part de ces trajets covoiturés. Repère consulté : 67 % des déplacements professionnels en voiture de longue distance se font seul au volant (SDES-CGDD, Datalab Essentiel « Se déplacer en voiture : seul, à plusieurs ou en covoiturage ? », juillet 2022) ; c'est un potentiel, pas un taux atteignable mesuré.",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.25,
    coutKg: "≈ −0,45 à −0,38 €/kgCO2e évité (rentable : carburant partagé)",
    coutNet: { min: -0.45, max: -0.38, calcul: "Calcul : à deux, chaque personne économise la moitié du carburant (0,049 à 0,058 €/km, voir dp1) pour 0,128 kgCO2e évité par km (moitié de 0,256)." },
    coutAbattement: "Non chiffré par France Stratégie (2021) pour le covoiturage.",
  },
  {
    id: "dp3",
    // Gain calculé sur la seule part concernée (Cab et MSP, shared/js/plan-actions.js).
    partConcernee: "km en voiture thermique ou hybride, au facteur de la voiture électrique",
    poste: "deplacements_pro",
    titre: "Électrifier le véhicule professionnel lors du prochain renouvellement",
    source:
      "SOURCÉ — avis de l'ADEME sur la voiture électrique (octobre 2022) : en France, une voiture électrique à batterie de moins de 60 kWh a sur son cycle de vie un impact carbone 2 à 3 fois inférieur à un modèle thermique similaire, soit −50 à −67 %. Gain calculé avec les facteurs de l'outil sur les seuls kilomètres faits en voiture thermique (0,256 → 0,103 kgCO2e/km : −60 %) ou hybride (0,232 → 0,103 : −56 %) ; aucun gain si l'on roule déjà en électrique. Recoupé : ICCT 2021, −66 à −69 % en Europe. Remplace −55 % (estimé).",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.5,
    coutKg: "≈ −0,16 à +0,09 €/kgCO2e évité (rentable pour un usage professionnel régulier, avant aides)",
    coutNet: { min: -0.16, max: 0.09, calcul: "Calcul : écart de prix catalogue électrique / thermique de 2 900 € (segment C) à 5 200 € (segment B) TTC, hors remises, aides et malus (véhicules vendus en 2025 ; Institut mobilités en transition et C-Ways, Baromètre de l'évolution des prix des véhicules neufs en France 2025, mai 2026, p. 18), amorti sur 8 ans, moins l'économie d'énergie : carburant 9,7 à 11,4 €/100 km (voir dp1) contre recharge ≈ 3 €/100 km (DGEC, « Vrai-faux voitures électriques », octobre 2025), pour 0,153 kgCO2e évité par km. Cas défavorable (écart de 5 200 €, diesel) : −0,16 €/kg à 15 000 km/an, +0,09 €/kg à 8 000 km/an ; segment C à 15 000 km/an : −0,39 €/kg. Entretien (≈ −30 %, non sourcé) et aides non comptés : prudence." },
    coutAbattement: "DG Trésor / DGEC, « Les coûts d'abattement : euros dépensés par tonne de CO2eq éliminée », septembre 2024, tableau 2 p. 8 (coûts privés, euros 2024, actualisation 7 %) : citadine légère −0,19 à −0,11 €/kg ; citadine standard +0,12 (gros rouleur) à +0,35 €/kg (moyen rouleur). France Stratégie, « Les coûts d'abattement – Partie 2 : Transports », commission Criqui, juin 2021 (coûts socio-économiques, euros 2019) : 0,19 à 0,53 €/kg selon le segment (2020-2030).",
  },
  {
    id: "dp4",
    // Gain calculé sur la seule part concernée (Cab et MSP, shared/js/plan-actions.js).
    partConcernee: "37 % des émissions des congrès",
    poste: "deplacements_pro",
    titre: "Remplacer une partie des déplacements pour congrès/formations par de la visioconférence",
    source:
      "SOURCÉ (gain unitaire) — Tao Y. et al., « Trend towards virtual and hybrid conferences may be an effective climate change mitigation strategy », Nature Communications 12, 2021 (doi:10.1038/s41467-021-27251-2) : un congrès virtuel réduit l'empreinte carbone de 94 %. ESTIMÉ (part adressable) : au plus 40 % des déplacements de congrès/formation remplaçables, soit 0,94 × 0,4 ≈ 37 % des émissions des congrès et formations (le reste du poste n'est pas concerné), signalé. La même étude donne environ −2/3 pour un congrès hybride avec la moitié des participants à distance (lu de seconde main) : ordre de grandeur cohérent, pas une mesure de la part remplaçable.",
    hasPct: true,
    defaultPct: 25,
    maxReduction: 0.37,
    coutKg: "négatif (frais de déplacement et d'hébergement évités)",
    coutNet: { min: null, max: null, calcul: "Pas de montant moyen publié pour un déplacement de congrès ; une visioconférence ne demande pas d'investissement pour un cabinet déjà équipé." },
    coutSansChiffre: "rentable",
    coutAbattement: "Non publié.",
  },

  // --- Déplacements de la patientèle / clientèle ---
  {
    id: "dc1",
    poste: "deplacements_patientele",
    titre: "Développer la téléconsultation ou les rendez-vous à distance quand c'est pertinent",
    source:
      "SOURCÉ (gain unitaire) — Holmner Å. et al., « Carbon footprint of telemedicine solutions », PLoS One 9(9), 2014 (doi:10.1371/journal.pone.0105040) : une téléconsultation émet 40 à 70 fois moins qu'une visite physique, soit environ −97,5 % du déplacement évité. Part adressable : 29 % (0,975 × 0,3) est un plafond de potentiel, signalé. Pratique réelle : 2,2 % des consultations des généralistes libéraux en téléconsultation en 2023 (3,7 % en 2021 ; DREES, Études et Résultats n° 1366, février 2026). Potentiel : 51 % des consultations vidéo jugées aussi adaptées ou mieux que le présentiel par les généralistes norvégiens (Johnsen T. M. et al., J Med Internet Res, 2021), sur des consultations déjà orientées vers la vidéo.",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.29,
    coutKg: "≈ 0 €/kgCO2e évité",
    coutNet: { min: 0, max: 0, calcul: "Assurance maladie (ameli.fr, télésoin des masseurs-kinésithérapeutes) : même tarif qu'en présentiel ; aides à l'équipement de 350 € (vidéotransmission) et 175 € (appareils connectés)." },
    coutAbattement: "Non publié.",
  },
  {
    id: "dc2",
    poste: "deplacements_patientele",
    titre: "Inciter la patientèle/clientèle aux mobilités actives (marche, vélo)",
    source:
      "SOURCÉ — méta-analyse de 141 études : les mesures douces (plans de mobilité, conseil, campagnes) font passer la part des déplacements sans voiture de 39 % à 46 %, soit −11,5 % des trajets en voiture (Möser G., Bamberg S., Journal of Environmental Psychology 28(1), 2008, p. 10-26, lu via son résumé). Meilleurs cas : −18 % de trajets en voiture chez les employeurs britanniques les plus avancés (Cairns S. et al., Transportation Research Part A 44(7), 2010). Revue récente : effet moyen faible et très variable (Okraszewska R. et al., Transportation Research Part D 131, 2024). Borne basse retenue (règle R3) : 11,5 % du poste, chaque trajet reporté vers la marche ou le vélo évitant 98 à 100 % de ses émissions. Ces études portent sur des salariés, pas sur une patientèle. Remplace 30 % (estimé).",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.115,
    coutKg: "≈ 0 €/kgCO2e évité (communication)",
    coutNet: { min: 0, max: 0, calcul: "Affichage et conseil, sans dépense notable." },
    coutAbattement: "Non publié.",
  },
  {
    id: "dc3",
    poste: "deplacements_patientele",
    titre: "Faciliter le covoiturage pour la patientèle/clientèle",
    source:
      "SOURCÉ (calcul exact) — à deux par voiture, les émissions par personne sont divisées par deux (−50 %). ESTIMÉ (part adressable) : plafond de 25 % du poste, signalé et probablement optimiste. Repères consultés : 50 % des déplacements en voiture pour se soigner ou faire une démarche se font seul, et le covoiturage déclaré ne représente que 4 % des déplacements des passagers en mobilité locale (SDES-CGDD, juillet 2022) ; le plan national vise un triplement (Cerema, « Covoiturage : tous à bord », 2023). Aucun taux atteignable mesuré.",
    hasPct: true,
    defaultPct: 25,
    maxReduction: 0.25,
    coutKg: "≈ 0 €/kgCO2e évité (communication)",
    coutNet: { min: 0, max: 0, calcul: "Mise en relation des patients, sans dépense notable." },
    coutAbattement: "Non publié.",
  },
  {
    id: "dc4",
    poste: "deplacements_patientele",
    titre: "Afficher en salle d'attente une carte isochrone comparant marche/vélo et voiture autour du cabinet",
    source:
      "ESTIMÉ — outil de visualisation concret pour appuyer l'action « inciter aux mobilités actives » : <a href=\"../iso/\" target=\"_blank\" rel=\"noopener\">La carte du sans-voiture</a>, un autre outil Lib&CO2, génère gratuitement une carte des zones plus rapidement accessibles à pied, à vélo ou en vélo électrique qu'en voiture autour de votre cabinet — calculée sur le vrai réseau de rues et le relief réel, pas à vol d'oiseau. Aucune étude ne chiffre l'effet d'un affichage seul. Plafond de 11,5 %, signalé : c'est l'effet moyen de l'ensemble des mesures douces (Möser et Bamberg, 2008), plus intensives qu'une affiche ; borne haute probablement optimiste (effet faible selon Okraszewska et al., 2024). Remplace 12 %.",
    hasPct: true,
    defaultPct: 15,
    maxReduction: 0.115,
    coutKg: "≈ 0 €/kgCO2e évité (carte gratuite, impression)",
    coutNet: { min: 0, max: 0, calcul: "La carte du sans-voiture est gratuite ; seul reste le coût d'impression." },
    coutAbattement: "Non publié.",
  },

  // --- Local professionnel ---
  {
    id: "lo1",
    poste: "local",
    titre: "Ajuster la température de consigne (chauffage l'hiver, climatisation l'été)",
    source:
      "SOURCÉ — ADEME, guide « 50 trucs et astuces – Eau et énergie : comment réduire la facture ? » (février 2022 ; repris dans l'édition de novembre 2024) : « Baisser le chauffage de 1 °C : −7 % de consommation d'énergie ». Appliqué par degré à la part chauffage du poste local.",
    unit: "degres",
    defaultDegres: 1,
    maxReductionParDegre: 0.07,
    coutKg: "≈ −1,7 à −0,6 €/kgCO2e évité (rentable : énergie économisée)",
    coutNet: { min: -1.69, max: -0.6, calcul: "Calcul : aucun investissement ; chaque kWh de chauffage évité économise 0,146 €/kWh de gaz (prix repère CRE d'octobre 2026, 0,14557 €/kWh TTC) pour 0,243 kgCO2e, soit −0,60 €/kg ; ou 0,195 €/kWh TTC (EDF, grille Tarif Bleu non résidentiel en vigueur au 1er août 2026, option Base 6 kVA : 13,18 c€/kWh HT + accise 3,062 c€/kWh, TVA 20 % non récupérable pour une activité de soins exonérée) pour 0,115 kgCO2e, soit −1,69 €/kg." },
    coutAbattement: "Non chiffré : France Stratégie (2022, logement) estime le potentiel de la sobriété à 20-30 % sans le chiffrer en coût.",
  },
  {
    id: "lo2",
    // Gain calculé sur la seule part concernée (Cab et MSP, shared/js/plan-actions.js).
    partConcernee: "50 % du chauffage au gaz ou au fioul",
    poste: "local",
    detailKey: "localChauffage",
    titre: "Remplacer une chaudière gaz/fioul par une pompe à chaleur",
    source:
      "SOURCÉ — ADEME, avis d'experts « Décarboner le chauffage : quelle place pour les pompes à chaleur ? » (2024, p. 1) : la pompe à chaleur divise par 10 les émissions de CO2 du chauffage face au gaz (−90 %) et par 15 face au fioul, avec un rendement de 2,5. Dans l'outil, le facteur de la pompe à chaleur (0,115 kgCO2e/kWh, coefficient de performance non déduit par prudence) donne −53 % face au gaz (0,243) : 50 % retenu pour que le gain affiché ne dépasse pas ce que l'outil calcule réellement. Proposée seulement si le chauffage est au gaz ou au fioul. Remplace 40 % (estimé).",
    hasPct: false,
    defaultPct: 100,
    maxReduction: 0.5,
    coutKg: "≈ −0,30 à +0,60 €/kgCO2e évité (−0,30 si la chaudière était à remplacer, avec aides ; +0,60 si elle fonctionnait encore, sans aides)",
    coutNet: { min: -0.30, max: 0.60, calcul: "Calcul pour un local de 60 m² (ratio santé 73 kWh/m² de chauffage, OPERAT 2024 et SDES-CEREN, soit 4 380 kWh de gaz par an) : pompe à chaleur air-eau 15 287 € TTC en moyenne, 9 961 € de reste à charge après aides ; chaudière gaz neuve 8 736 € ; rendement de chauffage d'une chaudière gaz 82 % ; maintenance 200 €/an (PAC) contre 150 €/an (gaz) ; COP saisonnier mesuré 2,9 (ADEME et Enertech, Mesure des performances de 100 PAC air/eau et eau/eau installées en maisons individuelles, octobre 2025 : p. 7, p. 73-74 et tableau 18 p. 155). Amortie sur 17 ans (fiche CEE BAR-TH-171). Gaz à 0,146 €/kWh (CRE), 0,195 €/kWh TTC (EDF, grille Tarif Bleu non résidentiel en vigueur au 1er août 2026, option Base 6 kVA : 13,18 c€/kWh HT + accise 3,062 c€/kWh, TVA 20 % non récupérable pour une activité de soins exonérée). Émissions : gaz 0,243, électricité de chauffage 0,115 kgCO2e/kWh ; 922 kgCO2e évités et 396 € d'énergie économisés par an. Chaudière qui fonctionne encore : +0,26 €/kg avec aides, +0,60 sans. Chaudière à remplacer de toute façon (seul l'écart avec une chaudière neuve compte) : −0,30 €/kg avec aides, +0,04 sans. Avec l'ancien ratio (128 kWh/m², 2012), la fourchette était de −0,35 à +0,16." },
    coutAbattement: "DG Trésor / DGEC, « Les coûts d'abattement : euros dépensés par tonne de CO2eq éliminée », septembre 2024, tableau 2 p. 8 (coûts privés, euros 2024, actualisation 7 %) : passage d'une chaudière gaz à une PAC +0,06 €/kg (logement classé F) à +0,15 €/kg (classé D) ; depuis le fioul −0,13 à −0,07 €/kg.",
  },
  {
    id: "lo3",
    poste: "local",
    detailKey: "localChauffage",
    titre: "Améliorer l'isolation du local (combles, fenêtres)",
    source:
      "SOURCÉ (partiel) — ADEME, « Clés pour agir – Isoler sa maison » (novembre 2024, p. 4) : dans un bâtiment non isolé, le toit représente 25 à 30 % des pertes de chaleur, les murs 20 à 25 %, les fenêtres 10 à 15 %. Le plafond de 25 % correspond à une isolation partielle (toiture) ; c'est un maximum théorique : les économies mesurées après travaux sont souvent plus faibles (Glachant, Kahn et Lévêque, Mines ParisTech, 2020). Appliqué à la seule part chauffage du poste local.",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.25,
    coutKg: "≈ +0,43 à +0,72 €/kgCO2e évité (coût d'abattement privé publié)",
    coutNet: { min: 0.43, max: 0.72, calcul: "Pas de coût au m² issu d'une source publique : la valeur publiée ci-dessous est reprise comme coût net." },
    coutAbattement: "DG Trésor / DGEC, « Les coûts d'abattement : euros dépensés par tonne de CO2eq éliminée », septembre 2024, tableau 2 p. 8 (coûts privés, euros 2024, actualisation 7 %) : geste d'isolation seul 0,72 €/kg (durée de vie 20 ans) à 0,43 €/kg (30 ans) ; rénovation globale 0,14 à 0,22 €/kg.",
  },
  {
    id: "lo4",
    poste: "local",
    detailKey: "localElec",
    titre: "Souscrire un contrat d'électricité verte / renouvelable",
    source:
      "SOURCÉ — gain comptable nul. La méthode réglementaire des bilans d'émissions (BEGES version 5, ministère de la Transition écologique / ADEME, 2022, chapitre 2) ne permet pas de déduire l'électricité couverte par des garanties d'origine : elle ne peut figurer qu'en information à part. L'ADEME (avis du 3 décembre 2018) note qu'une offre verte « standard » ne contribue pas au développement de nouvelles capacités renouvelables ; seules les offres dites « premium » (achat direct à des producteurs) y aident. Action maintenue pour information, sans réduction chiffrée. Remplace 8 % (estimé).",
    hasPct: true,
    defaultPct: 100,
    maxReduction: 0,
    coutKg: "sans objet (aucune réduction comptable)",
    coutNet: { min: null, max: null, calcul: "Le gain comptable est nul (méthode BEGES) : un coût par kgCO2e évité n'a pas de sens. Surcoût des offres vertes non recherché." },
    coutSansChiffre: "modere",
    coutAbattement: "Non publié.",
  },

  // --- Numérique ---
  {
    id: "nu1",
    poste: "numerique",
    titre: "Allonger la durée de vie du matériel informatique (viser 5-6 ans plutôt que 3-4 ans)",
    source:
      "SOURCÉ (partiel) — ADEME, « Choisir et faire durer son ordinateur » (agirpourlatransition.ademe.fr) : passer de 2 à 4 ans d'usage améliore de 50 % le bilan d'un ordinateur. Pour 4 → 6 ans, calcul exact sur l'amortissement de la fabrication : 1 − 4/6 ≈ 33 % ; plafond de 30 % du poste.",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.3,
    coutKg: "négatif (achat de matériel repoussé)",
    coutNet: { min: null, max: null, calcul: "Garder un ordinateur 6 ans au lieu de 4 réduit d'un tiers le coût annuel d'achat." },
    coutSansChiffre: "rentable",
    coutAbattement: "Non publié.",
  },
  {
    id: "nu2",
    poste: "numerique",
    titre: "Acheter du matériel reconditionné plutôt que neuf",
    source:
      "SOURCÉ — André H., Ljunggren Söderman M., Nordelöf A., « Resource and environmental impacts of using second-hand laptop computers », Waste Management 88, 2019 (doi:10.1016/j.wasman.2019.03.050) : impacts d'un portable de seconde main 39 à 50 % plus faibles par année d'usage ; ADEME, « Évaluation de l'impact environnemental d'un ensemble de produits reconditionnés » (2022) : 43 à 97 % pour les ordinateurs portables. Borne basse retenue par prudence. Remplace −42 % (Hrafnkelsdóttir 2022, source primaire introuvable).",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.39,
    coutKg: "négatif (matériel reconditionné moins cher)",
    coutNet: { min: null, max: null, calcul: "ADEME (agirpourlatransition.ademe.fr, mars 2026) : un smartphone reconditionné coûte 20 à 70 % de moins que neuf ; pas d'écart publié pour les ordinateurs portables." },
    coutSansChiffre: "rentable",
    coutAbattement: "Non publié.",
  },
  {
    id: "nu3",
    poste: "numerique",
    titre: "Limiter le stockage cloud superflu et la vidéo HD par défaut",
    source:
      "SOURCÉ (calcul) — appliqué à l'usage numérique seul (réseaux et centres de données). Passer la visio de la HD (3 Go/h) à la définition standard (0,7 Go/h) divise ses données par 4,3 (ADEME, modèle publicodes-acv-numerique), soit −77 % ; la visio pèse environ 23 % de l'usage dans les paliers moyen et fort de l'outil : 0,77 × 0,23 ≈ 17 %. Le stockage en ligne pèse moins de 1 % dans les facteurs ADEME. Recoupé : −95 % de l'empreinte de la vidéo en passant de la HD à la définition standard (Obringer R. et al., Resources, Conservation & Recycling 167, 2021). Volumes des paliers estimés (voir FE_NUMERIQUE). Remplace 20 % (estimé).",
    detailKey: "numUsage",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.17,
    coutKg: "≈ 0 €/kgCO2e évité (réglages)",
    coutNet: { min: 0, max: 0, calcul: "Réglages, sans dépense." },
    coutAbattement: "Non publié.",
  },

  // --- Matériel & consommables métier ---
  {
    id: "ma1",
    poste: "materiel",
    titre: "Privilégier du matériel reconditionné ou éco-conçu pour les équipements",
    source:
      "SOURCÉ — même source que l'achat d'informatique reconditionnée : André et al., Waste Management, 2019 (−39 à −50 %) et ADEME 2022 (produits reconditionnés). Borne basse retenue par prudence ; transposée du matériel informatique au matériel métier, faute d'étude propre. Remplace −42 %.",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.39,
    coutKg: "ESTIMÉ : nul à négatif (reconditionné souvent moins cher)",
    coutNet: { min: null, max: null, calcul: "Transposé du matériel informatique (voir nu2) ; pas de donnée publiée pour le matériel métier." },
    coutSansChiffre: "modere",
    coutAbattement: "Non publié.",
  },
  {
    id: "ma2",
    poste: "materiel",
    titre: "Réduire les consommables à usage unique au profit de solutions réutilisables",
    source:
      "SOURCÉ (partiel) — Booth A. et al., « The carbon footprints of single-use and reusable medical devices: a systematic review », BMJ Open 15(12), 2025 : dans 39 études sur 47, le dispositif réutilisable a une empreinte plus faible (ex. blouses chirurgicales −66 %, tenues de bloc −31 %). ESTIMÉ (part adressable) : plafond de 20 % du poste, signalé, les articles remplaçables n'en représentant qu'une partie (aucune source qualifiée sur cette part, revue du 03/11/2026).",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.2,
    coutKg: "ESTIMÉ : investissement de départ, économie à moyen terme",
    coutNet: { min: null, max: null, calcul: "Aucune donnée de coût publiée pour les cabinets libéraux." },
    coutSansChiffre: "modere",
    coutAbattement: "Non publié.",
  },
  {
    id: "ma3",
    poste: "materiel",
    titre: "Choisir des fournisseurs/matières à faible empreinte (écolabels, circuits courts)",
    source:
      "ESTIMÉ — aucun chiffre publié transposable n'a été trouvé (revues du 06/10/2026 et du 03/11/2026).",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.15,
    coutKg: "ESTIMÉ : souvent neutre",
    coutNet: { min: null, max: null, calcul: "Aucune donnée de coût publiée." },
    coutSansChiffre: "modere",
    coutAbattement: "Non publié.",
  },

  // --- Alimentation ---
  {
    id: "al1",
    poste: "alimentation",
    titre: "Augmenter la part de repas végétariens lors des repas professionnels",
    source:
      "SOURCÉ, calcul exact — (2,04 − 0,51) / 2,04 ≈ 75 %, à partir des facteurs FE_REPAS (Base Carbone V23.6 : repas moyen id 20682, repas végétarien id 20683). Remplace 31 % (calculé avec l'ancien facteur végétarien de 1,40).",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.75,
    coutKg: "négatif (repas végétarien moins cher)",
    coutNet: { min: null, max: null, calcul: "Coût moyen des denrées par repas : 1,96 € dans les cantines servant un menu végétarien chaque jour, 2,06 € une fois par semaine, 2,30 € sans menu végétarien, soit −15 % (Observatoire de la restauration collective bio et durable, Un Plus Bio, résultats de l'enquête 2020, p. 7). Moyenne sur l'ensemble des repas de la cantine, et non coût d'un repas végétarien seul ; le « 25 % » utilisé jusqu'au 21/10/2026 venait d'une source secondaire et n'a pas été retrouvé." },
    coutSansChiffre: "rentable",
    coutAbattement: "Non publié.",
  },
  {
    id: "al2",
    poste: "alimentation",
    titre: "Limiter le gaspillage alimentaire lors des repas sur site",
    source:
      "SOURCÉ — ADEME, « Coût complet des pertes et du gaspillage en restauration collective » (2016) : 17 % des aliments achetés sont jetés ; ADEME, guide « Réduire le gaspillage alimentaire en restauration collective » (3e édition, 2017) : une réduction de moitié est atteignable. 17 % × 50 % ≈ 8,5 % du poste. Remplace 10 % (estimé).",
    hasPct: true,
    defaultPct: 30,
    maxReduction: 0.085,
    coutKg: "≈ −0,8 €/kgCO2e évité (rentable : achats évités)",
    coutNet: { min: -0.78, max: -0.78, calcul: "Calcul : 0,27 € de denrées gaspillées par repas (coût direct ; coût complet avec énergie, main-d'œuvre et déchets : 0,68 €), d'après l'étude ADEME « Coût complet des pertes et gaspillages alimentaires en restauration collective », juillet 2016, reprise par ADEME, Réduire le gaspillage alimentaire en restauration collective, 2017, p. 7 ; pour 0,35 kgCO2e (17 % de 2,04 kgCO2e, même source) : −0,78 €/kg si le gaspillage est supprimé." },
    coutAbattement: "Non publié.",
  },

  // --- Achats de services ---
  {
    id: "se1",
    poste: "services",
    titre: "Choisir des prestataires (banque, assurance, comptabilité) engagés bas-carbone",
    source:
      "ESTIMÉ — les chiffres publiés sur l'empreinte des banques (Oxfam France / Les Amis de la Terre, 2019) portent sur les émissions financées par l'épargne, pas sur l'achat d'un service ; aucun chiffre transposable trouvé (revues du 06/10/2026 et du 03/11/2026).",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.15,
    coutKg: "≈ 0 €/kgCO2e évité (critère de choix)",
    coutNet: { min: 0, max: 0, calcul: "Changer de prestataire à prix comparable." },
    coutAbattement: "Non publié.",
  },
  {
    id: "se2",
    poste: "services",
    titre: "Dématérialiser les échanges avec les prestataires et réduire le courrier papier",
    source:
      "ESTIMÉ — non chiffré par une étude pour le courrier professionnel (revues du 06/10/2026 et du 03/11/2026).",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.1,
    coutKg: "≈ 0 €/kgCO2e évité (organisation)",
    coutNet: { min: 0, max: 0, calcul: "Dématérialisation, sans dépense notable ; affranchissement économisé." },
    coutAbattement: "Non publié.",
  },
  {
    id: "se3",
    poste: "services",
    titre: "Limiter la sous-traitance aux besoins essentiels et privilégier des prestataires locaux",
    source:
      "ESTIMÉ — non chiffré par une étude (revues du 06/10/2026 et du 03/11/2026).",
    hasPct: true,
    defaultPct: 20,
    maxReduction: 0.1,
    coutKg: "≈ 0 €/kgCO2e évité (organisation)",
    coutNet: { min: 0, max: 0, calcul: "Organisation, sans dépense notable." },
    coutAbattement: "Non publié.",
  },

  // --- Fret / livraisons ---
  {
    id: "fr1",
    poste: "fret",
    titre: "Grouper les commandes auprès des fournisseurs",
    source:
      "ESTIMÉ — grouper n commandes en un colis réduit à peu près d'autant le nombre de colis (0,72 kgCO2e chacun, voir FE_FRET_COLIS) ; plafond de 30 % du poste, signalé, aucune étude ne mesurant la part de commandes regroupables. La synthèse de l'étude ADEME / ministère de la Transition écologique sur le commerce en ligne (2023) ne démontre pas d'avantage systématique de la livraison standard sur la livraison express : ce volet a été retiré de l'action.",
    hasPct: true,
    defaultPct: 50,
    maxReduction: 0.3,
    coutKg: "négatif (frais d'envoi évités)",
    coutNet: { min: null, max: null, calcul: "Un colis de 1 kg coûte 9,59 € TTC à domicile (La Poste, tarifs Colissimo 2026) ; grouper les commandes évite des frais d'envoi quand ils sont facturés." },
    coutSansChiffre: "rentable",
    coutAbattement: "Non publié.",
  },
  {
    id: "fr2",
    poste: "fret",
    titre: "Retirer les colis en point relais à pied ou à vélo plutôt que les faire livrer au cabinet",
    source:
      "SOURCÉ — ADEME, Impact CO2, « Livraison de colis » (étude ADEME / ministère de la Transition écologique sur le commerce en ligne, 2023), colis de 1 kg : retrait en point relais à pied ou à vélo 0,66 kgCO2e contre 0,72 livré au cabinet, soit −9 % ; retrait en voiture (7 km aller-retour) 1,65, soit plus du double. Le gain n'existe donc que si le colis est retiré à pied, à vélo ou sur un trajet déjà fait. Une étude commanditée par un réseau de points relais (EcoCO2 pour Mondial Relay, 2024) annonce −64 %, non généralisable. Remplace 10 % (estimé).",
    hasPct: true,
    defaultPct: 40,
    maxReduction: 0.09,
    coutKg: "négatif (point relais moins cher)",
    coutNet: { min: null, max: null, calcul: "Colissimo 2026, 1 kg : 8,89 € en point retrait contre 9,59 € à domicile (La Poste)." },
    coutSansChiffre: "rentable",
    coutAbattement: "Non publié.",
  },
];

// --- Coût des actions : catégorie dérivée du coût net pour le praticien ----
// Seuil : valeur de l'action pour le climat (valeur tutélaire du carbone),
// trajectoire révisée par France Stratégie (« La valeur de l'action pour le
// climat : une référence pour évaluer et agir », commission Quinet, mars 2025 ;
// avis du conseil scientifique du 21 mai 2025) : 256 €2023/tCO2e en 2025,
// croissance de 3,2 %/an → ≈ 264 €/t en 2026 (calcul), soit 0,264 €/kgCO2e.
// Une action dont le coût net par kg évité reste sous ce seuil coûte moins
// que ce que la collectivité est prête à payer pour éviter ce kg.
export const VALEUR_ACTION_CLIMAT_EUR_KG = 0.264;
export const COST_LABELS = {
  gratuit: "Rentable ou sans coût",
  faible: "Coût modéré",
  investissement: "Coût élevé",
};
/**
 * Catégorie de coût d'une action, d'après le milieu de sa fourchette de coût
 * net (€/kgCO2e évité) : ≤ 0 → « gratuit » (rentable ou sans coût) ; jusqu'à
 * la valeur de l'action pour le climat → « faible » ; au-delà →
 * « investissement ». Sans chiffre : indication qualitative `coutSansChiffre`.
 * @param {object} action
 * @returns {"gratuit"|"faible"|"investissement"}
 */
export function categorieCout(action) {
  const c = action.coutNet || {};
  if (c.min == null || c.max == null) return action.coutSansChiffre === "modere" ? "faible" : "gratuit";
  const milieu = (c.min + c.max) / 2;
  if (milieu <= 0) return "gratuit";
  return milieu <= VALEUR_ACTION_CLIMAT_EUR_KG ? "faible" : "investissement";
}
for (const a of ACTIONS) a.cost = categorieCout(a);

// --- Immobilisations : fabrication des véhicules et construction du bâtiment ---
// Communs à Lib&CO2 Cab et MSP depuis le 12/11/2026 (auparavant dans
// msp/js/data/facteurs-emission-msp.js).
//
// Voitures : FE_TRANSPORT donne un facteur combiné usage + fabrication par km.
// Les déplacements professionnels de la structure le séparent : l'usage reste
// dans les déplacements, la fabrication passe en immobilisations (décision du
// porteur, 12/11/2026 : « reclasser la part au km », totaux inchangés). Les
// déplacements de la patientèle gardent le facteur combiné (véhicules des
// patients, pas des immobilisations de la structure). Deux-roues : la Base
// Carbone ne détaille pas la part de fabrication, tout reste en usage.
// Les clés correspondent à celles de FE_TRANSPORT.
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

// Bâtiment : carbone de construction par m², amorti sur 30 ans à partir de la
// construction ou de la dernière rénovation lourde ; rien au-delà de 30 ans.
// Durée de 30 ans : ESTIMÉ, choix éditorial (plus prudent que les 50 ans de la
// RE2020 : une durée plus courte donne des émissions annuelles plus hautes).
// Facteur par activité (Base Carbone V23.6, consultée le 12/11/2026 ; règle R2,
// l'outil ne demande pas la structure du bâtiment) :
// - santé : « Établissement de santé, structure en béton », 440 kgCO2e/m²,
//   id 20739, Valide générique (déjà utilisé par MSP) ;
// - juridique, conseil, architecture : « Bâtiments de bureaux », 650 kgCO2e/m²
//   SHON, id 24302, Valide générique (expérimentation HQE Performance, 2017 ;
//   l'élément « Immeubles de bureaux, structure béton », 469, id 20736, est
//   archivé) ; la surface saisie est une surface utile, plus petite que la
//   SHON : légère sous-estimation possible ;
// - artisanat d'art : « Commerce, structure en béton », 550 kgCO2e/m², id 20734 ;
// - autre profession libérale : valeur la plus haute des trois (règle R3), 650.
export const FACTEURS_BATIMENT_PAR_ACTIVITE = {
  sante: { kgCO2e_m2: 440, source: "Base Carbone V23.6, « Établissement de santé, structure en béton », id 20739" },
  juridique: { kgCO2e_m2: 650, source: "Base Carbone V23.6, « Bâtiments de bureaux », id 24302 (par m² SHON)" },
  conseil: { kgCO2e_m2: 650, source: "Base Carbone V23.6, « Bâtiments de bureaux », id 24302 (par m² SHON)" },
  archi: { kgCO2e_m2: 650, source: "Base Carbone V23.6, « Bâtiments de bureaux », id 24302 (par m² SHON)" },
  artisanat_art: { kgCO2e_m2: 550, source: "Base Carbone V23.6, « Commerce, structure en béton », id 20734" },
  autre: { kgCO2e_m2: 650, source: "valeur la plus haute des trois éléments ci-dessus (règle R3)" },
};
export const DUREE_AMORTISSEMENT_BATIMENT_ANS = 30;
// Rénovation lourde : coût des travaux ≥ 275 €/m² (réglementation des locaux
// non résidentiels, SOURCÉ, repris de MSP) ; elle remet le compteur à zéro.
export const SEUIL_RENOVATION_LOURDE_EUR_M2 = 275;
// Compatibilité MSP (même valeurs que la santé).
export const FACTEUR_BATIMENT_SANTE = {
  kgCO2e_m2: FACTEURS_BATIMENT_PAR_ACTIVITE.sante.kgCO2e_m2,
  dureeAmortissementAns: DUREE_AMORTISSEMENT_BATIMENT_ANS,
  seuilRenovationLourde_eur_m2: SEUIL_RENOVATION_LOURDE_EUR_M2,
};

/**
 * Émissions annuelles de construction du bâtiment (kgCO2e/an).
 * @param {number} surfaceM2
 * @param {number|null} anneeConstruction  null : inconnue, rien n'est compté.
 * @param {{annee: number, coutTravaux: number}|null} renovationLourde
 * @param {number} anneeActuelle
 * @param {number} [kgParM2]  440 (santé) par défaut.
 */
export function emissionsBatimentAnnuelles(surfaceM2, anneeConstruction, renovationLourde, anneeActuelle, kgParM2 = FACTEUR_BATIMENT_SANTE.kgCO2e_m2) {
  let anneeReference = anneeConstruction;
  if (renovationLourde) {
    const seuil = surfaceM2 * SEUIL_RENOVATION_LOURDE_EUR_M2;
    if (renovationLourde.coutTravaux >= seuil && renovationLourde.annee > (anneeReference ?? -Infinity)) {
      anneeReference = renovationLourde.annee;
    }
  }
  if (anneeReference == null || !(anneeReference > 0)) return 0;
  const age = anneeActuelle - anneeReference;
  if (age > DUREE_AMORTISSEMENT_BATIMENT_ANS || age < 0) return 0;
  return (surfaceM2 * kgParM2) / DUREE_AMORTISSEMENT_BATIMENT_ANS;
}

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
  immobilisations: { label: "Immobilisations (bâtiment, véhicules)", icon: "local", color: "#8C4F7A" },
};

// Pondération du tri des actions par catégorie de coût (voir categorieCout).
export const COST_WEIGHT = { gratuit: 1, faible: 1.3, investissement: 1.8 };
