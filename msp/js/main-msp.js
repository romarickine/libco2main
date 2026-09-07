import { chargerBrouillon, sauvegarderBrouillon, enregistrerBilan, enregistrerBilanBrut, listerBilans } from './stockage-msp.js';
import { calculBilanMSP } from './calcul-msp.js';
import { rendreEcran } from './ui-msp.js';
import { FE_GROS_MATERIEL_STANDARD } from './data/facteurs-emission.js';
import { FACTEURS_NUMERIQUE_BRUT, FACTEURS_MOBILIER_UNITE } from './data/facteurs-emission-msp.js';

// Rassemble les lignes d'immobilisation (numérique, matériel dédié, mobilier)
// séparément pour chaque praticien et pour le staff admin — nécessaire pour
// attribuer à chaque praticien sa propre empreinte (et non plus un seul total
// fusionné). Chaque ligne porte sa propre durée de détention déclarée.
function collecterLignesImmobilisationParPraticien(praticien) {
  const lignes = [];
  const num = praticien.numerique;
  if (num.nbOrdisFixes) lignes.push({ quantite: num.nbOrdisFixes, facteurUnitaireBrut: FACTEURS_NUMERIQUE_BRUT.ordinateurFixe, dureeDetentionAns: num.dureeDetentionOrdis });
  if (num.nbOrdisPortables) lignes.push({ quantite: num.nbOrdisPortables, facteurUnitaireBrut: FACTEURS_NUMERIQUE_BRUT.ordinateurPortable, dureeDetentionAns: num.dureeDetentionOrdis });
  if (num.nbEcransSuppl) lignes.push({ quantite: num.nbEcransSuppl, facteurUnitaireBrut: FACTEURS_NUMERIQUE_BRUT.ecranSupplementaire, dureeDetentionAns: num.dureeDetentionOrdis });
  for (const m of num.autreMaterielInfo) lignes.push({ quantite: m.valeurAchat, facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD, dureeDetentionAns: m.dureeDetention });
  for (const m of praticien.materielDedie) lignes.push({ quantite: m.valeurAchat, facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD, dureeDetentionAns: m.dureeDetention });
  for (const m of praticien.mobilierDedie) lignes.push({ quantite: m.nombre, facteurUnitaireBrut: FACTEURS_MOBILIER_UNITE[m.type], dureeDetentionAns: m.dureeDetention });
  return lignes;
}

function collecterLignesImmobilisationAdmin(staffAdmin) {
  const lignes = [];
  const num = staffAdmin.numerique;
  if (num.nbOrdisFixes) lignes.push({ quantite: num.nbOrdisFixes, facteurUnitaireBrut: FACTEURS_NUMERIQUE_BRUT.ordinateurFixe, dureeDetentionAns: num.dureeDetentionOrdis });
  if (num.nbOrdisPortables) lignes.push({ quantite: num.nbOrdisPortables, facteurUnitaireBrut: FACTEURS_NUMERIQUE_BRUT.ordinateurPortable, dureeDetentionAns: num.dureeDetentionOrdis });
  if (num.nbEcransSuppl) lignes.push({ quantite: num.nbEcransSuppl, facteurUnitaireBrut: FACTEURS_NUMERIQUE_BRUT.ecranSupplementaire, dureeDetentionAns: num.dureeDetentionOrdis });
  for (const m of num.autreMaterielInfo) lignes.push({ quantite: m.valeurAchat, facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD, dureeDetentionAns: m.dureeDetention });
  for (const m of staffAdmin.mobilier) lignes.push({ quantite: m.nombre, facteurUnitaireBrut: FACTEURS_MOBILIER_UNITE[m.type], dureeDetentionAns: m.dureeDetention });
  return lignes;
}

export function etatInitial() {
  return {
    ecranActuel: 0, // 0 = accueil (première visite uniquement), 1..7 = parcours
    structureMSP: {
      nom: '',
      commune: '',
      surfaceTotale: null,
      local: {
        energieChauffage: 'electricite',
        consoReelle: null,
        localDeporte: null,
        batiment: { anneeConstruction: null, renovationLourde: null }
      }
    },
    praticiens: [], // { id, profession, professionAPL, nbActesAnnuel, partLieuFixe, surfaceDediee,
                     //   distanceDomicileTravail, modesDomicileTravail: [{mode, part}], joursTravaillesSemaine,
                     //   semainesTravailleesAn, tourneesDomicile: {kmAnnuel, modes: [{mode,part}]},
                     //   deplacementsProAnnuels: {kmAnnuel, modes: [{mode,part}]}, materielDedie: [], mobilierDedie: [] }
    staffAdmin: {
      etp: null, surfaceDediee: null,
      numerique: { nbOrdisFixes: 0, nbOrdisPortables: 0, nbEcransSuppl: 0, dureeDetentionOrdis: 5, usageNumerique: 'moyen', autreMaterielInfo: [] },
      mobilier: [],
      distanceDomicileTravailMoyenne: null, modeDomicileTravailMoyen: 'voiture_thermique',
      joursTravaillesSemaine: 5, semainesTravailleesAn: 46
    },
    postesMutualises: {
      materielSecretariat: { montantAnnuelConsommables: 0 },
      services: { comptaBanqueAssurance: 0, sousTraitance: 0 },
      fret: { nbColisAn: 0 },
      materielPartage: [] // équipement lourd utilisé par plusieurs praticiens : { type, valeurAchat, dureeDetention }
    },
    emailExport: '',
    actionsChoix: {},
    affichageParActe: false,
    dernierResultat: null
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
      : [{ mode: 'voiture_thermique', part: 100 }];
  }
  delete p.modeDomicileTravail;
  if (!p.numerique) p.numerique = { nbOrdisFixes: 0, nbOrdisPortables: 0, nbEcransSuppl: 0, dureeDetentionOrdis: 5, autreMaterielInfo: [] };
  if (!Array.isArray(p.numerique.autreMaterielInfo)) p.numerique.autreMaterielInfo = [];
  if (p.numerique.dureeDetentionOrdis == null) p.numerique.dureeDetentionOrdis = 5;
  if (!p.tourneesDomicile) p.tourneesDomicile = { kmAnnuel: 0, modes: [{ mode: 'voiture_thermique', part: 100 }] };
  if (!Array.isArray(p.tourneesDomicile.modes)) {
    p.tourneesDomicile.modes = p.tourneesDomicile.mode
      ? [{ mode: p.tourneesDomicile.mode, part: 100 }]
      : [{ mode: 'voiture_thermique', part: 100 }];
  }
  delete p.tourneesDomicile.mode;
  if (!p.deplacementsProAnnuels) p.deplacementsProAnnuels = { kmAnnuel: 0, modes: [{ mode: 'voiture_thermique', part: 100 }] };
  if (!Array.isArray(p.deplacementsProAnnuels.modes)) p.deplacementsProAnnuels.modes = [{ mode: 'voiture_thermique', part: 100 }];
  if (!p.alimentation) p.alimentation = { repasParSemaine: 0, pctVegetarien: 0 };
  if (!p.prescriptions) p.prescriptions = { montantAnnuelMedicaments: 0, actesParamedicauxExternes: [] };
  if (!Array.isArray(p.prescriptions.actesParamedicauxExternes)) p.prescriptions.actesParamedicauxExternes = [];
  if (!Array.isArray(p.materielDedie)) p.materielDedie = [];
  if (!Array.isArray(p.mobilierDedie)) p.mobilierDedie = [];
  if (p.surfaceDediee == null) p.surfaceDediee = 0;
  if (p.professionAPL === undefined) p.professionAPL = null;
  return p;
}

function migrerEtat(donnees) {
  if (!donnees) return etatInitial();
  const base = etatInitial();
  donnees.structureMSP = { ...base.structureMSP, ...donnees.structureMSP };
  donnees.structureMSP.local = { ...base.structureMSP.local, ...donnees.structureMSP.local };
  if (!donnees.structureMSP.local.batiment) donnees.structureMSP.local.batiment = { anneeConstruction: null, renovationLourde: null };

  donnees.praticiens = Array.isArray(donnees.praticiens) ? donnees.praticiens.map(migrerPraticien) : [];

  donnees.staffAdmin = { ...base.staffAdmin, ...donnees.staffAdmin };
  donnees.staffAdmin.numerique = { ...base.staffAdmin.numerique, ...donnees.staffAdmin.numerique };
  if (!Array.isArray(donnees.staffAdmin.numerique.autreMaterielInfo)) donnees.staffAdmin.numerique.autreMaterielInfo = [];
  if (!Array.isArray(donnees.staffAdmin.mobilier)) donnees.staffAdmin.mobilier = [];

  donnees.postesMutualises = { ...base.postesMutualises, ...donnees.postesMutualises };
  if (!Array.isArray(donnees.postesMutualises.materielPartage)) donnees.postesMutualises.materielPartage = [];
  if (donnees.emailExport == null) donnees.emailExport = '';
  if (!donnees.actionsChoix) donnees.actionsChoix = {};
  if (donnees.affichageParActe == null) donnees.affichageParActe = false;
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

let etat = migrerEtat(chargerBrouillon()?.data ?? etatInitial());

export function getEtat() { return etat; }

/**
 * Vérifie que la somme des surfaces dédiées déclarées (praticiens + staff
 * admin) ne dépasse pas la surface totale de la structure — le résidu
 * "espaces communs" gère déjà le cas inverse (somme < total), mais rien ne
 * protégeait contre une saisie qui dépasse le total (double comptage de
 * surface entre plusieurs praticiens, ou simple erreur de saisie).
 */
export function calculerSurfaceDeclaree(etatCourant) {
  const declaree = etatCourant.praticiens.reduce((s, p) => s + (p.surfaceDediee || 0), 0) + (etatCourant.staffAdmin.surfaceDediee || 0);
  const totale = etatCourant.structureMSP.surfaceTotale || 0;
  return { declaree, totale, depassement: totale > 0 && declaree > totale };
}

export function majEtat(chemin, valeur) {
  // chemin : ex. "structureMSP.commune" ou "praticiens.0.nbActesAnnuel"
  // Auto-crée les objets intermédiaires manquants (null/undefined) rencontrés
  // en chemin — corrige à la racine toute une classe de plantage ("Cannot
  // set properties of null") qui touchait notamment consoReelle et
  // renovationLourde (initialisés à null tant qu'ils ne sont pas saisis).
  const parts = chemin.split('.');
  let cible = etat;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cible[parts[i]] == null) cible[parts[i]] = {};
    cible = cible[parts[i]];
  }
  cible[parts[parts.length - 1]] = valeur;
  sauvegarderBrouillon(etat);
  demanderRendu(etat);
}

// Re-rendu qui attend que le focus se libère avant de s'exécuter, plutôt
// qu'un simple délai fixe : ce ré-rendu remplace tout le HTML de l'écran,
// ce qui casse le focus/la sélection de tout champ en cours d'édition s'il
// tombe au mauvais moment (constat : un délai fixe, même généreux, peut
// être dépassé si l'utilisateur clique sur le CHAMP SUIVANT avant qu'il
// n'expire — ce nouveau champ est alors recréé juste après avoir reçu le
// focus, perdant la sélection que son propre gestionnaire "focus" venait
// d'appliquer, et la frappe suivante vient se coller devant la valeur par
// défaut au lieu de la remplacer). En vérifiant à chaque tentative si
// l'élément actif est justement un champ du formulaire, et en reportant
// tant que c'est le cas, le re-rendu n'interrompt jamais une édition en
// cours, quelle que soit la vitesse de saisie.
let renduEnAttente = null;
function demanderRendu(etat) {
  if (renduEnAttente) clearTimeout(renduEnAttente);
  const tenter = () => {
    renduEnAttente = null;
    const actif = document.activeElement;
    const champActif = actif && (actif.dataset?.path || actif.dataset?.pathMobilier);
    if (champActif) { renduEnAttente = setTimeout(tenter, 150); return; }
    rendreEcran(etat);
  };
  renduEnAttente = setTimeout(tenter, 120);
}

export function ajouterPraticien() {
  etat.praticiens.push({
    id: crypto.randomUUID(), profession: '', professionAPL: null,
    nbActesAnnuel: 0, partLieuFixe: 100, surfaceDediee: 0,
    distanceDomicileTravail: 0, modesDomicileTravail: [{ mode: 'voiture_thermique', part: 100 }],
    joursTravaillesSemaine: 5, semainesTravailleesAn: 46,
    tourneesDomicile: { kmAnnuel: 0, modes: [{ mode: 'voiture_thermique', part: 100 }] },
    deplacementsProAnnuels: { kmAnnuel: 0, modes: [{ mode: 'voiture_thermique', part: 100 }] },
    alimentation: { repasParSemaine: 0, pctVegetarien: 0 },
    prescriptions: { montantAnnuelMedicaments: 0, actesParamedicauxExternes: [] },
    numerique: { nbOrdisFixes: 0, nbOrdisPortables: 0, nbEcransSuppl: 0, dureeDetentionOrdis: 5, autreMaterielInfo: [] },
    materielDedie: [], mobilierDedie: []
  });
  sauvegarderBrouillon(etat);
  rendreEcran(etat);
}

export function supprimerPraticien(id) {
  etat.praticiens = etat.praticiens.filter(p => p.id !== id);
  sauvegarderBrouillon(etat);
  rendreEcran(etat);
}

/**
 * Ajoute un élément à un tableau du state (mobilierDedie, materielDedie,
 * autreMaterielInfo...), ex. chemin = "praticiens.0.mobilierDedie" ou
 * "staffAdmin.mobilier". Le chemin peut aussi cibler un praticien par id via
 * ajouterLignePraticien ci-dessous (plus robuste qu'un index qui peut bouger).
 */
export function ajouterLigne(chemin, item) {
  const parts = chemin.split('.');
  let cible = etat;
  for (const part of parts) cible = cible[part];
  cible.push(item);
  sauvegarderBrouillon(etat);
  rendreEcran(etat);
}

export function supprimerLigne(chemin, index) {
  const parts = chemin.split('.');
  let cible = etat;
  for (const part of parts) cible = cible[part];
  cible.splice(index, 1);
  sauvegarderBrouillon(etat);
  rendreEcran(etat);
}

export function ajouterLignePraticien(praticienId, champTableau, item) {
  const p = etat.praticiens.find(x => x.id === praticienId);
  if (!p) return;
  p[champTableau].push(item);
  sauvegarderBrouillon(etat);
  rendreEcran(etat);
}

export function supprimerLignePraticien(praticienId, champTableau, index) {
  const p = etat.praticiens.find(x => x.id === praticienId);
  if (!p) return;
  p[champTableau].splice(index, 1);
  sauvegarderBrouillon(etat);
  rendreEcran(etat);
}

export function allerEcran(numero) {
  etat.ecranActuel = numero;
  rendreEcran(etat);
}

export function calculerEtEnregistrer() {
  const immobilisationsParPraticien = {};
  for (const p of etat.praticiens) immobilisationsParPraticien[p.id] = collecterLignesImmobilisationParPraticien(p);
  const immobilisationsAdmin = collecterLignesImmobilisationAdmin(etat.staffAdmin);
  const lignesMaterielPartage = etat.postesMutualises.materielPartage.map(m => ({
    quantite: m.valeurAchat, facteurUnitaireBrut: FE_GROS_MATERIEL_STANDARD, dureeDetentionAns: m.dureeDetention
  }));

  const resultat = calculBilanMSP(etat.structureMSP, etat.praticiens, etat.staffAdmin, etat.postesMutualises, immobilisationsParPraticien, immobilisationsAdmin, lignesMaterielPartage, new Date().getFullYear());
  etat.dernierResultat = resultat;
  enregistrerBilan({ structureMSP: etat.structureMSP, resultat });
  rendreEcran(etat);
  return resultat;
}

// ---------------------------------------------------------------------------
// ARCHIVE — export/import de l'historique complet des bilans calculés
// (localStorage), pour suivre l'évolution de la MSP dans le temps et
// permettre une continuité entre appareils/navigateurs (localStorage ne se
// synchronise jamais tout seul).
export function exporterArchive() {
  return {
    exporteLe: new Date().toISOString(),
    outil: 'Lib&CO2 MSP',
    bilans: listerBilans()
  };
}

export function importerArchive(archive) {
  if (!archive || !Array.isArray(archive.bilans)) throw new Error('Fichier d\'archive invalide (format inattendu).');
  const existants = listerBilans();
  const idsExistants = new Set(existants.map(b => b.id));
  const nouveaux = archive.bilans.filter(b => b.id && !idsExistants.has(b.id));
  for (const bilan of nouveaux) enregistrerBilanBrut(bilan);
  return { importes: nouveaux.length, ignores: archive.bilans.length - nouveaux.length };
}

export function getHistoriqueBilans() {
  return listerBilans().slice().sort((a, b) => new Date(b.horodatage) - new Date(a.horodatage));
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    rendreEcran(etat);
  } catch (erreur) {
    console.error('Erreur au chargement de Lib&CO2 MSP :', erreur);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `<section class="ecran">
        <h2>Un problème est survenu au chargement</h2>
        <p class="aide">Cela peut arriver si des données d'un brouillon précédent ne sont plus compatibles avec la version actuelle de l'outil.</p>
        <p><strong>Détail technique :</strong> ${erreur.message}</p>
        <button data-action="reinitialiser" class="bouton-principal">Réinitialiser et recommencer</button>
      </section>`;
      app.querySelector('[data-action="reinitialiser"]')?.addEventListener('click', () => {
        localStorage.removeItem('libco2msp_brouillon_v1');
        location.reload();
      });
    }
  }
});
