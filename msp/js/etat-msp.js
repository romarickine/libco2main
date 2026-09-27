/**
 * etat-msp.js
 * ---------------------------------------------------------------------------
 * Rôle : tout ce qui concerne la FORME des données de Lib&CO2 MSP, sans
 * jamais toucher à la page (ni DOM, ni localStorage) :
 *   - l'état initial d'un nouveau bilan et d'un nouveau praticien ;
 *   - la migration d'un brouillon enregistré par une version antérieure ;
 *   - la préparation des lignes d'immobilisation puis l'appel du calcul.
 *
 * Pourquoi un module séparé : ces fonctions étaient mêlées au code
 * d'affichage de main-msp.js, qui s'exécute au chargement de la page. Les
 * isoler permet de les tester dans Node (voir tests/msp.test.js) et de
 * garantir que le calcul donne le même résultat, quel que soit l'écran.
 *
 * Utilisé par : main-msp.js (application), tests/msp.test.js (tests).
 * Les données de communes et d'APL doivent être chargées au préalable :
 * await chargerDonneesCalcul().
 * Dépendances : calcul-msp.js, shared/js/data/facteurs-emission.js,
 *               data/facteurs-emission-msp.js.
 */
import { calculBilanMSP } from "./calcul-msp.js";
import {
  FE_GROS_MATERIEL_STANDARD,
  FACTEURS_NUMERIQUE_FABRICATION as FAB,
} from "../../shared/js/data/facteurs-emission.js";
import { FACTEURS_MOBILIER_UNITE } from "./data/facteurs-emission-msp.js";
import { preparerCommunes } from "./data/resolve-commune-msp.js";
import { chargerApl } from "./data/apl-msp.js";

// Rassemble les lignes d'immobilisation (numérique, matériel dédié, mobilier)
// séparément pour chaque praticien et pour le staff admin — nécessaire pour
// attribuer à chaque praticien sa propre empreinte (et non plus un seul total
// fusionné). Chaque ligne porte sa propre durée de détention déclarée.
function collecterLignesImmobilisationParPraticien(praticien) {
  const lignes = [];
  const num = praticien.numerique;
  if (num.nbOrdisFixes)
    lignes.push({
      quantite: num.nbOrdisFixes,
      facteurUnitaireBrut: FAB.ordinateurFixe.valeur,
      dureeDetentionAns: num.dureeDetentionOrdis,
    });
  if (num.nbOrdisPortables)
    lignes.push({
      quantite: num.nbOrdisPortables,
      facteurUnitaireBrut: FAB.ordinateurPortable.valeur,
      dureeDetentionAns: num.dureeDetentionOrdis,
    });
  if (num.nbEcransSuppl)
    lignes.push({
      quantite: num.nbEcransSuppl,
      facteurUnitaireBrut: FAB.ecranSupplementaire.valeur,
      dureeDetentionAns: num.dureeDetentionOrdis,
    });
  for (const m of num.autreMaterielInfo)
    lignes.push({
      quantite: m.valeurAchat,
      facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD,
      dureeDetentionAns: m.dureeDetention,
    });
  for (const m of praticien.materielDedie)
    lignes.push({
      quantite: m.valeurAchat,
      facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD,
      dureeDetentionAns: m.dureeDetention,
    });
  for (const m of praticien.mobilierDedie)
    lignes.push({
      quantite: m.nombre,
      facteurUnitaireBrut: FACTEURS_MOBILIER_UNITE[m.type],
      dureeDetentionAns: m.dureeDetention,
    });
  return lignes;
}

function collecterLignesImmobilisationAdmin(staffAdmin) {
  const lignes = [];
  const num = staffAdmin.numerique;
  if (num.nbOrdisFixes)
    lignes.push({
      quantite: num.nbOrdisFixes,
      facteurUnitaireBrut: FAB.ordinateurFixe.valeur,
      dureeDetentionAns: num.dureeDetentionOrdis,
    });
  if (num.nbOrdisPortables)
    lignes.push({
      quantite: num.nbOrdisPortables,
      facteurUnitaireBrut: FAB.ordinateurPortable.valeur,
      dureeDetentionAns: num.dureeDetentionOrdis,
    });
  if (num.nbEcransSuppl)
    lignes.push({
      quantite: num.nbEcransSuppl,
      facteurUnitaireBrut: FAB.ecranSupplementaire.valeur,
      dureeDetentionAns: num.dureeDetentionOrdis,
    });
  for (const m of num.autreMaterielInfo)
    lignes.push({
      quantite: m.valeurAchat,
      facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD,
      dureeDetentionAns: m.dureeDetention,
    });
  for (const m of staffAdmin.mobilier)
    lignes.push({
      quantite: m.nombre,
      facteurUnitaireBrut: FACTEURS_MOBILIER_UNITE[m.type],
      dureeDetentionAns: m.dureeDetention,
    });
  return lignes;
}

/**
 * État d'un nouveau bilan : structure vide, aucun praticien, valeurs par
 * défaut du staff et des postes mutualisés. Unités : m², km, €/an, kg/semaine
 * (déchets).
 * @returns {object}
 */
export function etatInitial() {
  return {
    ecranActuel: 0, // 0 = accueil (première visite uniquement), 1..7 = parcours
    structureMSP: {
      nom: "",
      commune: "",
      surfaceTotale: null,
      local: {
        energieChauffage: "electricite",
        consoReelle: null,
        localDeporte: null,
        batiment: { anneeConstruction: null, renovationLourde: null },
      },
    },
    praticiens: [], // { id, profession, professionAPL, nbActesAnnuel, partLieuFixe, surfaceDediee,
    //   distanceDomicileTravail, modesDomicileTravail: [{mode, part}], joursTravaillesSemaine,
    //   semainesTravailleesAn, tourneesDomicile: {kmAnnuel, modes: [{mode,part}]},
    //   deplacementsProAnnuels: {kmAnnuel, modes: [{mode,part}]}, materielDedie: [], mobilierDedie: [] }
    staffAdmin: {
      etp: null,
      surfaceDediee: null,
      numerique: {
        nbOrdisFixes: 0,
        nbOrdisPortables: 0,
        nbEcransSuppl: 0,
        dureeDetentionOrdis: 5,
        usageNumerique: "moyen",
        autreMaterielInfo: [],
      },
      mobilier: [],
      distanceDomicileTravailMoyenne: null,
      modeDomicileTravailMoyen: "voiture_thermique",
      joursTravaillesSemaine: 5,
      semainesTravailleesAn: 46,
    },
    postesMutualises: {
      materielSecretariat: { montantAnnuelConsommables: 0 },
      services: { comptaBanqueAssurance: 0, sousTraitance: 0 },
      fret: { nbColisAn: 0 },
      materielPartage: [], // équipement lourd utilisé par plusieurs praticiens : { type, valeurAchat, dureeDetention }
      dechets: {
        plastique: 0,
        metal: 0,
        papier: 0,
        carton: 0,
        aluminium: 0,
        verre: 0,
        menagers: 0,
        electronique: 0,
        dasri: 0,
      }, // kg/semaine, structure entière
    },
    emailExport: "",
    actionsChoix: {},
    affichageParActe: false,
    // Le total et le ratio/acte affichés excluent prescriptions et
    // médicaments/parapharmacie vendus en officine par défaut, pour rester
    // comparables entre une MSP avec et sans pharmacie/prescripteurs
    // intégrés — bascule cochable en résultats (voir rendreResultats).
    inclureMedicaments: false,
    dernierResultat: null,
  };
}

// ---------------------------------------------------------------------------
// MIGRATION — un brouillon sauvegardé dans le navigateur peut dater d'une
// version antérieure du schéma de données (ex. avant l'ajout des modes de
// transport multiples ou du numérique par praticien). Sans cette étape, les
// champs manquants provoquent un plantage au premier rendu. Appelée une
// seule fois au chargement, elle complète les champs manquants sans jamais
// écraser les données déjà saisies par l'utilisateur.
function migrerPraticien(p) {
  if (!Array.isArray(p.modesDomicileTravail)) {
    p.modesDomicileTravail = p.modeDomicileTravail
      ? [{ mode: p.modeDomicileTravail, part: 100 }]
      : [{ mode: "voiture_thermique", part: 100 }];
  }
  delete p.modeDomicileTravail;
  if (!p.numerique)
    p.numerique = {
      nbOrdisFixes: 0,
      nbOrdisPortables: 0,
      nbEcransSuppl: 0,
      dureeDetentionOrdis: 5,
      autreMaterielInfo: [],
    };
  if (!Array.isArray(p.numerique.autreMaterielInfo)) p.numerique.autreMaterielInfo = [];
  if (p.numerique.dureeDetentionOrdis == null) p.numerique.dureeDetentionOrdis = 5;
  if (!p.tourneesDomicile) p.tourneesDomicile = { kmAnnuel: 0, modes: [{ mode: "voiture_thermique", part: 100 }] };
  if (!Array.isArray(p.tourneesDomicile.modes)) {
    p.tourneesDomicile.modes = p.tourneesDomicile.mode
      ? [{ mode: p.tourneesDomicile.mode, part: 100 }]
      : [{ mode: "voiture_thermique", part: 100 }];
  }
  delete p.tourneesDomicile.mode;
  if (!p.deplacementsProAnnuels)
    p.deplacementsProAnnuels = { kmAnnuel: 0, modes: [{ mode: "voiture_thermique", part: 100 }] };
  if (!Array.isArray(p.deplacementsProAnnuels.modes))
    p.deplacementsProAnnuels.modes = [{ mode: "voiture_thermique", part: 100 }];
  if (!p.alimentation) p.alimentation = { repasParSemaine: 0, pctVegetarien: 0 };
  if (!p.prescriptions) p.prescriptions = { montantAnnuelMedicaments: 0, actesParamedicauxExternes: [] };
  if (!Array.isArray(p.prescriptions.actesParamedicauxExternes)) p.prescriptions.actesParamedicauxExternes = [];
  if (!Array.isArray(p.materielDedie)) p.materielDedie = [];
  if (!Array.isArray(p.mobilierDedie)) p.mobilierDedie = [];
  if (p.surfaceDediee == null) p.surfaceDediee = 0;
  if (p.professionAPL === undefined) p.professionAPL = null;
  if (!p.pharmacien) p.pharmacien = { caMedicaments: 0, caParapharmacie: 0, coeffAchatPrescriptions: 100 };
  if (p.pharmacien.coeffAchatPrescriptions == null) p.pharmacien.coeffAchatPrescriptions = 100;
  return p;
}

/**
 * Complète un brouillon enregistré par une version antérieure avec les champs
 * ajoutés depuis, sans écraser la saisie existante, et invalide le dernier
 * résultat calculé (sa forme peut avoir changé).
 * @param {object|null} donnees  Brouillon relu, ou null.
 * @returns {object} État utilisable par l'application.
 */
export function migrerEtat(donnees) {
  if (!donnees) return etatInitial();
  const base = etatInitial();
  donnees.structureMSP = { ...base.structureMSP, ...donnees.structureMSP };
  donnees.structureMSP.local = { ...base.structureMSP.local, ...donnees.structureMSP.local };
  if (!donnees.structureMSP.local.batiment)
    donnees.structureMSP.local.batiment = { anneeConstruction: null, renovationLourde: null };

  donnees.praticiens = Array.isArray(donnees.praticiens) ? donnees.praticiens.map(migrerPraticien) : [];

  donnees.staffAdmin = { ...base.staffAdmin, ...donnees.staffAdmin };
  donnees.staffAdmin.numerique = { ...base.staffAdmin.numerique, ...donnees.staffAdmin.numerique };
  if (!Array.isArray(donnees.staffAdmin.numerique.autreMaterielInfo))
    donnees.staffAdmin.numerique.autreMaterielInfo = [];
  if (!Array.isArray(donnees.staffAdmin.mobilier)) donnees.staffAdmin.mobilier = [];

  donnees.postesMutualises = { ...base.postesMutualises, ...donnees.postesMutualises };
  if (!Array.isArray(donnees.postesMutualises.materielPartage)) donnees.postesMutualises.materielPartage = [];
  if (donnees.emailExport == null) donnees.emailExport = "";
  if (!donnees.actionsChoix) donnees.actionsChoix = {};
  if (donnees.affichageParActe == null) donnees.affichageParActe = false;
  if (donnees.inclureMedicaments == null) donnees.inclureMedicaments = false;
  // 0 = écran d'accueil (valeur légitime, pas une absence de valeur) : on ne
  // remet à 1 que si le champ est réellement absent (ancien format).
  if (donnees.ecranActuel == null) donnees.ecranActuel = 1;

  // Un résultat calculé lors d'une session précédente peut avoir une forme
  // incompatible avec la version actuelle du calcul (ex. nouveau poste
  // ajouté depuis, comme "prescriptions"). Plutôt que de migrer le résultat
  // poste par poste (fragile et jamais exhaustif), on l'invalide
  // systématiquement au chargement : l'utilisateur relance le calcul d'un
  // clic, et ce type de plantage ne peut plus se reproduire à l'avenir,
  // quelle que soit l'évolution future du moteur de calcul.
  donnees.dernierResultat = null;

  return donnees;
}

/**
 * Crée un praticien vierge, avec les valeurs par défaut du formulaire.
 * @param {string} id  Identifiant unique (ex. crypto.randomUUID()).
 * @returns {object}   Praticien prêt à être ajouté à `etat.praticiens`.
 */
export function nouveauPraticien(id) {
  return {
    id,
    profession: "",
    professionAPL: null,
    nbActesAnnuel: 0,
    partLieuFixe: 100,
    surfaceDediee: 0,
    distanceDomicileTravail: 0,
    modesDomicileTravail: [{ mode: "voiture_thermique", part: 100 }],
    joursTravaillesSemaine: 5,
    semainesTravailleesAn: 46,
    tourneesDomicile: { kmAnnuel: 0, modes: [{ mode: "voiture_thermique", part: 100 }] },
    deplacementsProAnnuels: { kmAnnuel: 0, modes: [{ mode: "voiture_thermique", part: 100 }] },
    alimentation: { repasParSemaine: 0, pctVegetarien: 0 },
    prescriptions: { montantAnnuelMedicaments: 0, actesParamedicauxExternes: [] },
    pharmacien: { caMedicaments: 0, caParapharmacie: 0, coeffAchatPrescriptions: 100 },
    numerique: {
      nbOrdisFixes: 0,
      nbOrdisPortables: 0,
      nbEcransSuppl: 0,
      dureeDetentionOrdis: 5,
      autreMaterielInfo: [],
    },
    materielDedie: [],
    mobilierDedie: [],
  };
}

/**
 * Vérifie que la somme des surfaces dédiées déclarées (praticiens + staff
 * admin) ne dépasse pas la surface totale de la structure — le résidu
 * "espaces communs" gère déjà le cas inverse (somme < total), mais rien ne
 * protégeait contre une saisie qui dépasse le total (double comptage de
 * surface entre plusieurs praticiens, ou simple erreur de saisie).
 */
export function calculerSurfaceDeclaree(etatCourant) {
  const declaree =
    etatCourant.praticiens.reduce((s, p) => s + (p.surfaceDediee || 0), 0) +
    (etatCourant.staffAdmin.surfaceDediee || 0);
  const totale = etatCourant.structureMSP.surfaceTotale || 0;
  return { declaree, totale, depassement: totale > 0 && declaree > totale };
}

/**
 * Charge les données volumineuses nécessaires au calcul (liste des communes,
 * APL par commune), téléchargées à la demande plutôt qu'au démarrage.
 * Sans effet si elles sont déjà chargées. À attendre avant
 * calculerBilanDepuisEtat.
 * @returns {Promise<void>}
 */
export async function chargerDonneesCalcul() {
  await Promise.all([preparerCommunes(), chargerApl()]);
}

/**
 * Calcule le bilan complet d'une MSP à partir de l'état du formulaire.
 * Rassemble d'abord les lignes d'immobilisation (par praticien, staff
 * admin, matériel partagé), puis délègue à calculBilanMSP.
 *
 * @param {object} etatCourant    État complet (voir etatInitial).
 * @param {number} anneeActuelle  Année de référence (âge du bâtiment).
 * @returns {object} Résultat de calculBilanMSP (kgCO2e/an par poste, par praticien…).
 */
export function calculerBilanDepuisEtat(etatCourant, anneeActuelle) {
  const immobilisationsParPraticien = {};
  for (const p of etatCourant.praticiens)
    immobilisationsParPraticien[p.id] = collecterLignesImmobilisationParPraticien(p);
  const immobilisationsAdmin = collecterLignesImmobilisationAdmin(etatCourant.staffAdmin);
  const lignesMaterielPartage = etatCourant.postesMutualises.materielPartage.map((m) => ({
    quantite: m.valeurAchat,
    facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD,
    dureeDetentionAns: m.dureeDetention,
  }));

  return calculBilanMSP(
    etatCourant.structureMSP,
    etatCourant.praticiens,
    etatCourant.staffAdmin,
    etatCourant.postesMutualises,
    immobilisationsParPraticien,
    immobilisationsAdmin,
    lignesMaterielPartage,
    anneeActuelle,
  );
}
