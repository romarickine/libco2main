/**
 * ui-msp.js — chef d'orchestre de l'affichage de Lib&CO2 MSP
 * ---------------------------------------------------------------------------
 * Redessine l'écran courant à chaque changement d'état, en préservant ce que
 * l'utilisateur ne doit pas perdre (menus dépliés, défilement, focus
 * clavier), puis rebranche les écouteurs. Le contenu de chaque écran est
 * construit par les modules de ui/ ; les exports sont dans export/.
 *
 * Organisation de l'affichage :
 *   ui/commun.js           constantes d'affichage, formatage
 *   ui/ecrans-saisie.js    étapes 0 à 5 (accueil → postes mutualisés)
 *   ui/ecran-resultats.js  étape 6 (restitution), avec ui/graphiques-svg.js
 *   ui/ecran-actions.js    étape 7 (pistes d'action)
 *   ui/evenements.js       réactions aux clics et saisies
 *   ui/infobulles.js       bulles d'information
 *   export/*.js            Excel, affiche PNG, plan d'action RTF, JSON
 *
 * Utilisé par : main-msp.js (rendreEcran après chaque modification d'état).
 */
import { ETAPES } from "./ui/commun.js";
import { attacherEcouteurs } from "./ui/evenements.js";
import { relierLibelles } from "../../shared/js/accessibilite.js";
import { attacherTooltipsGraphes } from "./ui/infobulles.js";
import {
  rendreAccueil,
  rendreLocalBatiment,
  rendrePostesMutualises,
  rendrePraticiens,
  rendreProfil,
  rendreStaffAdmin,
} from "./ui/ecrans-saisie.js";
import { rendreRestitution } from "./ui/ecran-resultats.js";
import { rendreSolutions } from "./ui/ecran-actions.js";
export { afficherBulle } from "./ui/infobulles.js";

// ---------------------------------------------------------------------------
// RENDU PRINCIPAL — corrige la cause racine du bug de fermeture des menus :
// tout re-rendu remplace l'intégralité du HTML de l'écran (nécessaire pour
// rester synchronisé avec le state), ce qui réinitialise par défaut l'état
// d'affichage (menus <details> ouverts, position de défilement). On capture
// cet état juste avant de re-rendre et on le restaure juste après, à CHAQUE
// appel de rendreEcran — donc pour toute action future (pas seulement
// l'ajout de praticien), ce type de régression ne peut plus se reproduire.
export function rendreEcran(etat) {
  const app = document.getElementById("app");
  if (!app) return;

  const detailsOuverts = new Set(
    [...app.querySelectorAll("details[data-details-key]")].filter((d) => d.open).map((d) => d.dataset.detailsKey),
  );
  const positionDefilement = window.scrollY;

  // Préserve le focus clavier et la position du curseur à travers le
  // re-rendu complet de l'écran. Sans ça, l'élément focalisé était détruit
  // à chaque frappe/Tab : la navigation au clavier (Tab) s'interrompait en
  // boucle, et une saisie pouvait sembler nécessiter deux actions au lieu
  // d'une (la première mettait à jour le state mais perdait le focus).
  const actif = document.activeElement;
  let cheminActif = null,
    typeChemin = null,
    selectionDebut = null,
    selectionFin = null;
  if (actif && app.contains(actif)) {
    if (actif.dataset.path) {
      cheminActif = actif.dataset.path;
      typeChemin = "data-path";
    } else if (actif.dataset.pathMobilier) {
      cheminActif = actif.dataset.pathMobilier;
      typeChemin = "data-path-mobilier";
    }
    if (cheminActif && typeof actif.selectionStart === "number") {
      selectionDebut = actif.selectionStart;
      selectionFin = actif.selectionEnd;
    }
  }

  app.innerHTML = (etat.ecranActuel === 0 ? "" : rendreNav(etat)) + rendreEcranCourant(etat);

  app.querySelectorAll("details[data-details-key]").forEach((d) => {
    if (detailsOuverts.has(d.dataset.detailsKey)) d.open = true;
  });
  window.scrollTo(0, positionDefilement);

  if (cheminActif) {
    const nouvelElement = app.querySelector(`[${typeChemin}="${CSS.escape(cheminActif)}"]`);
    if (nouvelElement) {
      nouvelElement.focus({ preventScroll: true });
      if (selectionDebut != null && typeof nouvelElement.setSelectionRange === "function") {
        try {
          nouvelElement.setSelectionRange(selectionDebut, selectionFin);
        } catch (e) {
          /* type d'input sans sélection de texte (ex. select) */
        }
      }
    }
  }

  relierLibelles(app);
  attacherEcouteurs(app);
  attacherTooltipsGraphes(app);
}

// ---------------------------------------------------------------------------
// AVANCEMENT — un coup d'œil pour savoir où on en est et ce qu'il reste à faire
export function calculerAvancement(etat) {
  const s = etat.structureMSP;
  const complet = {
    1: !!(s.commune && s.surfaceTotale),
    2: !!(s.local.energieChauffage && s.local.batiment.anneeConstruction),
    3: etat.praticiens.length > 0 && etat.praticiens.every((p) => p.professionAPL !== undefined && p.nbActesAnnuel > 0),
    4: etat.staffAdmin.etp != null,
    5: etat.ecranActuel > 5, // tous les champs peuvent légitimement rester à 0 : on ne peut pas se fier à leur contenu, donc on ne coche cette étape qu'une fois qu'elle a été réellement dépassée (pas dès le chargement)
    6: !!etat.dernierResultat,
    7: (etat.actionsSelectionnees || []).length > 0,
  };
  return complet;
}

function rendreNav(etat) {
  const complet = calculerAvancement(etat);
  const nbEtapesCompletes = Object.values(complet).filter(Boolean).length;
  const pourcentage = Math.round((nbEtapesCompletes / ETAPES.length) * 100);

  return `
  <div class="barre-avancement" role="progressbar" aria-valuenow="${pourcentage}" aria-valuemin="0" aria-valuemax="100">
    <div class="barre-avancement-remplissage" data-style="width:${pourcentage}%"></div>
  </div>
  <nav class="nav-etapes">${ETAPES.map((label, i) => {
    const n = i + 1;
    const classes = ["etape"];
    if (n === etat.ecranActuel) classes.push("active");
    if (complet[n]) classes.push("complete");
    const puce = complet[n] ? "✓" : n;
    return `<button class="${classes.join(" ")}" data-action="aller-ecran" data-numero="${n}">
      <span class="etape-puce">${puce}</span><span class="etape-label">${label}</span>
    </button>`;
  }).join("")}</nav>`;
}

function rendreEcranCourant(etat) {
  switch (etat.ecranActuel) {
    case 0:
      return rendreAccueil();
    case 1:
      return rendreProfil(etat);
    case 2:
      return rendreLocalBatiment(etat);
    case 3:
      return rendrePraticiens(etat);
    case 4:
      return rendreStaffAdmin(etat);
    case 5:
      return rendrePostesMutualises(etat);
    case 6:
      return rendreRestitution(etat);
    case 7:
      return rendreSolutions(etat);
    default:
      return "";
  }
}

/**
 * Boutons « Précédent » et « Suivant » en bas de chaque étape.
 * @param {object} etat
 * @returns {string} HTML
 */
export function rendrePiedNavigation(etat) {
  const precedent =
    etat.ecranActuel > 1
      ? `<button data-action="aller-ecran" data-numero="${etat.ecranActuel - 1}" class="bouton-secondaire">← Précédent</button>`
      : "<span></span>";
  const suivant =
    etat.ecranActuel < ETAPES.length
      ? `<button data-action="aller-ecran" data-numero="${etat.ecranActuel + 1}" class="bouton-principal">Suivant →</button>`
      : "<span></span>";
  return `<div class="pied-navigation">${precedent}${suivant}</div>`;
}
