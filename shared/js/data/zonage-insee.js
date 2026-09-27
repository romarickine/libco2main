/**
 * zonage-insee.js
 * ----------------------------------------------------------------------
 * Données géographiques utilisées pour estimer les déplacements de la
 * patientèle/clientèle : le report modal par zone (ZONES) et la
 * correspondance commune -> zone (COMMUNES, ~35 000 communes).
 *
 * SOURCE — ZONES : rapport méthodologique kinéCO2 (Tableau 15), lui-même
 * construit à partir de l'Enquête Mobilité des Personnes 2019 (SDES)
 * croisée à une structure pôle/couronne/hors attraction. Valeurs en km
 * aller-retour par séance/rendez-vous, déjà réparties par mode de transport.
 *
 * SOURCE — COMMUNES : fichier officiel INSEE "Base des aires urbaines 2010"
 * (AU2010_au_01-01-2020.xlsx, feuilles Composition_communale et AU2010),
 * fourni par l'utilisateur. C'est le même millésime de zonage (2010) que
 * celui utilisé par kinéCO2 pour construire le Tableau 15 (voir note dans
 * le rapport : le zonage 2010 a été délibérément préféré à celui de 2020
 * pour rester cohérent avec l'enquête mobilité 2019). Ce zonage étant figé
 * dans le temps, les données sont intégrées une fois pour toutes ci-dessous
 * plutôt qu'interrogées via une API — aucune dépendance réseau.
 *
 * Méthode de classification commune -> zone : catégorie ZAU 2010 de la
 * commune (pôle/couronne/multipolarisée/isolée) croisée avec la taille
 * réelle de l'aire urbaine (variable TAU2017, jointe via le code d'aire
 * AU2010) pour distinguer "grand pôle" de "très grand pôle" (seuil : TAU2017
 * >= 09, soit les aires urbaines de 500 000 habitants ou plus hors Paris ;
 * classe « 500 000 à 9 999 999 habitants » du dictionnaire INSEE des
 * tranches d'aire urbaine ; Saint-Étienne est classée ainsi dans les
 * données).
 *
 * DÉCISION (27/09/2026, arbitrage du porteur de projet) : le zonage INSEE
 * 2010 fait foi, car c'est lui qui permet l'appariement avec l'Enquête
 * mobilité des personnes 2019 (même justification que le rapport kinéCO2,
 * section « Déplacements de la patientèle »). Écart connu et assumé : la
 * table commune -> zone du classeur kinéCO2 (feuille « BDD sources »)
 * classe autrement 57 % des communes appariées ; sa répartition suit les
 * tranches du zonage en aires d'attraction des villes 2020 (700 000 /
 * 200 000 / 50 000 habitants ; ex. Saint-Étienne « grand pôle »,
 * Bourg-en-Bresse « moyen pôle »). Ne pas « corriger » vers cette table
 * sans nouvel arbitrage.
 * Paris (aire "001") reçoit un traitement spécifique : communes du
 * pôle en département 75 -> Paris intra-muros, autres communes du pôle ->
 * Paris banlieue, couronne de l'aire -> Couronne Île-de-France.
 *
 * LIMITE ASSUMÉE : trois catégories ZAU 2010 n'ont pas d'équivalent direct
 * dans les 12 zones du Tableau 15 kinéCO2 :
 *   - "Commune multipolarisée des grandes aires urbaines" (~3 770 communes)
 *     -> approximée en "couronne d'un grand pôle".
 *   - "Autre commune multipolarisée" (~6 590) et "Commune isolée hors
 *     influence des pôles" (~7 000) -> approximées en "Commune hors
 *     attraction des villes".
 * Ensemble, environ la moitié des communes françaises EN NOMBRE (mais une
 * part nettement plus faible de la population, ce sont des communes rurales
 * de petite taille pour l'essentiel).
 * ----------------------------------------------------------------------
 */

// Report modal par zone : km aller-retour par séance/rendez-vous, par mode.
// SOURCÉ — rapport kinéCO2, Tableau 15.
export const ZONES = [
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

/**
 * Distance aller-retour totale par acte d'une zone, tous modes confondus.
 * @param {{modal: Object<string, number>}} zone  Objet de ZONES.
 * @returns {number} km par acte.
 */
export function kmModalTotal(zone) {
  return Object.values(zone.modal).reduce((a, b) => a + b, 0);
}

/* ----------------------------------------------------------------------------
   AJUSTEMENT PAR MOTIF DE DÉPLACEMENT (EMP 2019, SDES)

   SOURCÉ — fichier officiel SDES "2_1_3_emp2019_mobilite_locale_en_semaine_
   selon_motifs_de_deplacements.xlsx" (feuille 2 : répartition du mode
   principal par motif de déplacement, France entière, données 2019),
   fourni par l'utilisateur.

   Contexte et limite assumée : trois fichiers officiels EMP 2019 ont été
   examinés lors du développement. Aucun ne croise motif de déplacement,
   zone géographique fine et mode de transport dans un même tableau — cette
   donnée ne semble pas publiée à ce niveau de détail (elle existerait
   uniquement dans les microdonnées individuelles de l'enquête, non
   traitées ici). Le motif "santé" n'est par ailleurs jamais isolé par le
   SDES à ce niveau de publication : les soins médicaux sont agrégés avec
   les démarches administratives et autres motifs privés dans la catégorie
   "Autres motifs personnels", qui sert donc de meilleur proxy disponible
   pour les familles de métier de santé ET juridique (faute de mieux).

   Méthode : plutôt que de remplacer la matrice géographique fine (ZONES,
   issue de kinéCO2/zonage INSEE 2010) par cette donnée nationale plus
   grossière, elle est utilisée pour AJUSTER la répartition entre modes de
   transport au sein de chaque zone, tout en conservant la distance totale
   propre à la zone (voir modalAjusteParMotif). Un mode absent de la zone
   d'origine (ex. aucun métro dans une commune rurale) ne peut jamais
   apparaître après ajustement — seul le poids relatif des modes déjà
   présents dans la zone est modifié.
---------------------------------------------------------------------------- */
export const MOTIFS_MODE_SHARE = {
  // Santé, démarches administratives et autres motifs personnels non classés
  // ailleurs (santé non isolable séparément dans la donnée SDES publiée).
  autres_motifs_personnels: { marche: 19.62924, velo: 1.90396, tc: 9.04434, voiture: 67.42638, deux_roues: 1.81428 },
  // Rendez-vous professionnels d'un tiers (conseil, architecture...).
  autres_motifs_professionnels: { marche: 7.52217, velo: 1.81257, tc: 11.26434, voiture: 72.95927, deux_roues: 2.21865 },
  // Achat/commande d'un bien (proxy retenu pour l'artisanat d'art).
  achats: { marche: 27.08215, velo: 2.03916, tc: 4.90773, voiture: 65.40934, deux_roues: 0.47401 },
  // Moyenne nationale tous motifs confondus (famille "Autre").
  ensemble: { marche: 23.69502, velo: 2.69035, tc: 9.24885, voiture: 62.81065, deux_roues: 1.10428 },
};

// Regroupement des modes fins du report modal géographique (ZONES) sous les
// catégories larges utilisées par la donnée EMP 2019 par motif.
const SOUS_MODES_PAR_GROUPE = {
  voiture: ["voiture_thermique", "voiture_electrique"],
  tc: ["bus", "metro_tram", "rer_ter", "tgv"],
  velo: ["velo_elec"],
  deux_roues: ["deux_roues"],
};

// Calcule la répartition par mode d'une zone, ajustée selon le motif de
// déplacement, en conservant la distance totale de la zone d'origine.
// Entrée : zone (objet ZONES), motifId (clé de MOTIFS_MODE_SHARE)
// Sortie : objet { mode: km } — même structure que zone.modal
export function modalAjusteParMotif(zone, motifId) {
  const motif = MOTIFS_MODE_SHARE[motifId] || MOTIFS_MODE_SHARE.ensemble;
  const ensemble = MOTIFS_MODE_SHARE.ensemble;
  const totalZone = kmModalTotal(zone);
  const resultat = {};
  let sommeAjustee = 0;

  Object.entries(SOUS_MODES_PAR_GROUPE).forEach(([groupe, sousModes]) => {
    const kmGroupeOriginal = sousModes.reduce((s, m) => s + (zone.modal[m] || 0), 0);
    // Ratio du motif par rapport à la moyenne nationale, pour ce groupe de
    // modes : > 1 si ce motif utilise davantage ce mode que la moyenne, < 1 sinon.
    const ratio = ensemble[groupe] > 0 ? motif[groupe] / ensemble[groupe] : 1;
    const kmGroupeAjuste = kmGroupeOriginal * ratio;
    sousModes.forEach((m) => {
      if (zone.modal[m] !== undefined) {
        // Répartition interne au groupe (ex. thermique vs électrique)
        // inchangée : on n'a pas de donnée EMP 2019 à ce niveau de détail,
        // on conserve donc la proportion déjà présente dans la zone.
        const part = kmGroupeOriginal > 0 ? zone.modal[m] / kmGroupeOriginal : 0;
        resultat[m] = kmGroupeAjuste * part;
      }
    });
    sommeAjustee += kmGroupeAjuste;
  });

  // Renormalisation : la distance totale par zone reste celle du report
  // modal géographique (kinéCO2) ; seule sa répartition entre modes change.
  const facteurRenorm = sommeAjustee > 0 ? totalZone / sommeAjustee : 1;
  Object.keys(resultat).forEach((m) => { resultat[m] *= facteurRenorm; });
  return resultat;
}

// FE_TRANSPORT est importé dynamiquement pour éviter une dépendance
// circulaire : ce module de données géographiques ne connaît pas les
// facteurs d'émission, c'est calcul.js qui les combine.
export function emissionsPatienteleParActe(zone, motifId, feTransport) {
  const modalAjuste = modalAjusteParMotif(zone, motifId);
  return Object.entries(modalAjuste).reduce((sum, [mode, km]) => sum + km * feTransport[mode].value, 0);
}

// Normalise un nom pour la comparaison : sans accents, en minuscules, et
// avec les séparateurs (tiret, apostrophe droite ou typographique, espaces
// multiples) ramenés à une seule espace. Ainsi « saint etienne »,
// « Saint-Étienne » et « SAINT ETIENNE » se comparent à l'identique.
export function normalizeStr(s) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-'\u2019\s]+/g, " ")
    .trim();
}

// --- Liste des communes, chargée à la demande ---------------------------------
// La table des ~35 000 communes (communes-insee.js, ~830 Ko) ne sert qu'à la
// recherche de commune et au calcul MSP : elle n'est plus téléchargée avant
// le premier affichage, mais au premier besoin (import dynamique), une seule
// fois. Les écrans lancent ce chargement dès qu'ils affichent le champ de
// recherche, pour que les suggestions soient immédiates.
let promesseCommunes = null;

/**
 * Charge la liste des communes (une seule fois, résultat mis en cache).
 * @returns {Promise<{COMMUNES: Array<{code: string, nom: string, dep: string, zoneId: string}>,
 *   chercherCommunes: (requete: string, limite?: number) => object[]}>}
 */
export function chargerCommunes() {
  promesseCommunes ??= import("./communes-insee.js");
  return promesseCommunes;
}
