/**
 * main-msp.js — point d'entrée et état de Lib&CO2 MSP
 * ---------------------------------------------------------------------------
 * Détient l'état unique du formulaire (structure, praticiens, staff, postes
 * mutualisés), le sauvegarde en brouillon à chaque modification et
 * redemande l'affichage. Toutes les modifications d'état passent par les
 * fonctions exportées ici (majEtat, ajouterPraticien, allerEcran,
 * calculerEtEnregistrer…) : c'est la seule porte d'entrée de l'état.
 *
 * Forme des données et calcul : etat-msp.js. Stockage : stockage-msp.js.
 * Affichage : ui-msp.js. Utilisé par : index.html (module chargé au démarrage),
 * et par les modules d'affichage et d'export, qui lisent l'état via getEtat().
 */
import {
  chargerBrouillon,
  sauvegarderBrouillon,
  enregistrerBilan,
  enregistrerBilanBrut,
  listerBilans,
} from "./stockage-msp.js";
import { rendreEcran, afficherBulle } from "./ui-msp.js";
import {
  etatInitial,
  nouveauPraticien,
  migrerEtat,
  calculerBilanDepuisEtat,
  chargerDonneesCalcul,
} from "./etat-msp.js";
import { echapperHtml } from "../../shared/js/echappement.js";
// Réexportée pour ui-msp.js, qui l'importe depuis ce module.
export { calculerSurfaceDeclaree } from "./etat-msp.js";

const etat = migrerEtat(chargerBrouillon()?.data ?? etatInitial());

/**
 * Renvoie l'état courant du formulaire (objet unique, voir etatInitial).
 * À lire seulement : toute modification passe par les fonctions ci-dessous.
 * @returns {object}
 */
export function getEtat() {
  return etat;
}

/**
 * Modifie une valeur de l'état, la sauvegarde en brouillon et redemande
 * l'affichage (différé tant qu'un champ texte est en cours de saisie).
 * @param {string} chemin  Chemin pointé, ex. "structureMSP.commune" ou "praticiens.0.nbActesAnnuel".
 * @param {unknown} valeur
 */
export function majEtat(chemin, valeur) {
  // chemin : ex. "structureMSP.commune" ou "praticiens.0.nbActesAnnuel"
  // Auto-crée les objets intermédiaires manquants (null/undefined) rencontrés
  // en chemin — corrige à la racine toute une classe de plantage ("Cannot
  // set properties of null") qui touchait notamment consoReelle et
  // renovationLourde (initialisés à null tant qu'ils ne sont pas saisis).
  const parts = chemin.split(".");
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
    // Seuls les champs texte/nombre risquent la concaténation si le rendu
    // les recrée pendant la frappe (voir le commentaire détaillé plus bas) —
    // une case à cocher ou un menu déroulant n'a rien à "concaténer" et
    // garde en général le focus après l'action (aucun blur naturel ne
    // survient), ce qui bloquait le re-rendu indéfiniment pour ces
    // éléments : la jauge et les gains d'actions ne se mettaient jamais à
    // jour tant qu'on ne cliquait pas ailleurs. On ne fait donc attendre
    // que les types de champs réellement concernés par le risque initial.
    const typeSensible = actif && actif.tagName === "INPUT" && (actif.type === "text" || actif.type === "number");
    const champActif = typeSensible && (actif.dataset?.path || actif.dataset?.pathMobilier);
    if (champActif) {
      renduEnAttente = setTimeout(tenter, 150);
      return;
    }
    rendreEcran(etat);
  };
  renduEnAttente = setTimeout(tenter, 120);
}

// Utilisée par toutes les actions directes (ajouter/supprimer un praticien,
// changer d'écran, calculer...) au lieu d'appeler rendreEcran directement.
// Annule d'abord tout re-rendu différé encore en attente (voir
// demanderRendu ci-dessus) : sans cela, un changement de champ resté en
// attente de re-rendu (ex. focus encore actif ailleurs au moment du clic)
// pouvait se déclencher APRÈS l'action directe et la re-rendre par-dessus,
// avec un risque de perturber ce que l'utilisateur voit ou est en train de
// faire juste après (ex. cliquer "Ajouter un praticien" puis commencer à
// choisir sa profession, interrompu par ce re-rendu fantôme).
function rendreImmediat(etat) {
  if (renduEnAttente) {
    clearTimeout(renduEnAttente);
    renduEnAttente = null;
  }
  rendreEcran(etat);
}

/**
 * Ajoute un praticien vierge (voir nouveauPraticien), sauvegarde et redessine.
 */
export function ajouterPraticien() {
  etat.praticiens.push(nouveauPraticien(crypto.randomUUID()));
  sauvegarderBrouillon(etat);
  rendreImmediat(etat);
}

/**
 * Retire un praticien, sauvegarde et redessine.
 * @param {string} id  Identifiant du praticien.
 */
export function supprimerPraticien(id) {
  etat.praticiens = etat.praticiens.filter((p) => p.id !== id);
  sauvegarderBrouillon(etat);
  rendreImmediat(etat);
}

/**
 * Ajoute un élément à un tableau du state (mobilierDedie, materielDedie,
 * autreMaterielInfo...), ex. chemin = "praticiens.0.mobilierDedie" ou
 * "staffAdmin.mobilier". Le chemin peut aussi cibler un praticien par id via
 * ajouterLignePraticien ci-dessous (plus robuste qu'un index qui peut bouger).
 */
export function ajouterLigne(chemin, item) {
  const parts = chemin.split(".");
  let cible = etat;
  for (const part of parts) cible = cible[part];
  cible.push(item);
  sauvegarderBrouillon(etat);
  rendreImmediat(etat);
}

/**
 * Retire l'élément d'indice donné d'un tableau de l'état.
 * @param {string} chemin  Chemin pointé du tableau, ex. "staffAdmin.mobilier".
 * @param {number} index
 */
export function supprimerLigne(chemin, index) {
  const parts = chemin.split(".");
  let cible = etat;
  for (const part of parts) cible = cible[part];
  cible.splice(index, 1);
  sauvegarderBrouillon(etat);
  rendreImmediat(etat);
}

/**
 * Ajoute un élément à un tableau d'un praticien désigné par son identifiant
 * (plus sûr qu'un indice, qui change quand on supprime un praticien).
 * @param {string} praticienId
 * @param {string} champTableau  Ex. "materielDedie", "mobilierDedie".
 * @param {object} item
 */
export function ajouterLignePraticien(praticienId, champTableau, item) {
  const p = etat.praticiens.find((x) => x.id === praticienId);
  if (!p) return;
  p[champTableau].push(item);
  sauvegarderBrouillon(etat);
  rendreImmediat(etat);
}

/**
 * Retire l'élément d'indice donné d'un tableau d'un praticien.
 * @param {string} praticienId
 * @param {string} champTableau
 * @param {number} index
 */
export function supprimerLignePraticien(praticienId, champTableau, index) {
  const p = etat.praticiens.find((x) => x.id === praticienId);
  if (!p) return;
  p[champTableau].splice(index, 1);
  sauvegarderBrouillon(etat);
  rendreImmediat(etat);
}

/**
 * Affiche l'écran demandé du parcours.
 * @param {number} numero  0 = accueil, 1 à 7 = étapes (voir ETAPES dans ui/commun.js).
 */
export function allerEcran(numero) {
  etat.ecranActuel = numero;
  rendreImmediat(etat);
}

/**
 * Calcule le bilan à partir de l'état, l'ajoute à l'historique et redessine.
 * Avertit si le chiffre d'affaires médicaments déclaré est inférieur à la part
 * estimée des prescriptions honorées dans l'officine (valeur ramenée à 0).
 * Charge d'abord, si besoin, les données du calcul (communes, APL).
 * @returns {Promise<object|null>} Résultat de calculBilanMSP, ou null si les
 *   données n'ont pas pu être chargées (message affiché).
 */
export async function calculerEtEnregistrer() {
  try {
    await chargerDonneesCalcul();
  } catch (erreur) {
    console.error("Chargement des données de calcul impossible", erreur);
    afficherBulle(
      "Les données nécessaires au calcul (communes, accès aux soins) n'ont pas pu être chargées. Vérifiez la connexion puis relancez le calcul.",
    );
    return null;
  }
  const resultat = calculerBilanDepuisEtat(etat, new Date().getFullYear());
  etat.dernierResultat = resultat;
  if (resultat.alerteMedicamentsNegatif) {
    afficherBulle(
      "💊 Le chiffre d'affaires médicaments déclaré par le pharmacien est inférieur à la part des prescriptions de la structure estimée honorée dans son officine — ramené à 0 plutôt qu'à une valeur négative. Vérifiez le coefficient d'achat renseigné sur sa fiche, ou le montant du CA.",
    );
  }
  enregistrerBilan({ structureMSP: etat.structureMSP, resultat });
  rendreImmediat(etat);
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
    outil: "Lib&CO2 MSP",
    bilans: listerBilans(),
  };
}

/**
 * Ajoute à l'historique les bilans d'une archive JSON, en ignorant ceux déjà
 * présents (même identifiant).
 * @param {{bilans: object[]}} archive  Contenu d'un fichier produit par exporterArchive.
 * @returns {{importes: number, ignores: number}}
 * @throws {Error} Si le fichier n'a pas le format attendu.
 */
export function importerArchive(archive) {
  if (!archive || !Array.isArray(archive.bilans)) throw new Error("Fichier d'archive invalide (format inattendu).");
  const existants = listerBilans();
  const idsExistants = new Set(existants.map((b) => b.id));
  const nouveaux = archive.bilans.filter((b) => b.id && !idsExistants.has(b.id));
  for (const bilan of nouveaux) enregistrerBilanBrut(bilan);
  return { importes: nouveaux.length, ignores: archive.bilans.length - nouveaux.length };
}

/**
 * Historique des bilans enregistrés, du plus récent au plus ancien.
 * @returns {object[]}
 */
export function getHistoriqueBilans() {
  return listerBilans()
    .slice()
    .sort((a, b) => new Date(b.horodatage) - new Date(a.horodatage));
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    rendreImmediat(etat);
    // Premier écran affiché : on précharge en arrière-plan les données du
    // calcul (~2 Mo), pour que le bouton « Calculer » réponde sans attente.
    setTimeout(() => chargerDonneesCalcul().catch(() => {}), 0);
  } catch (erreur) {
    console.error("Erreur au chargement de Lib&CO2 MSP :", erreur);
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `<section class="ecran">
        <h2>Un problème est survenu au chargement</h2>
        <p class="aide">Cela peut arriver si des données d'un brouillon précédent ne sont plus compatibles avec la version actuelle de l'outil.</p>
        <p><strong>Détail technique :</strong> ${echapperHtml(erreur.message)}</p>
        <button data-action="reinitialiser" class="bouton-principal">Réinitialiser et recommencer</button>
      </section>`;
      app.querySelector('[data-action="reinitialiser"]')?.addEventListener("click", () => {
        localStorage.removeItem("libco2msp_brouillon_v1");
        location.reload();
      });
    }
  }
});
