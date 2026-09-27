/**
 * ui/evenements.js — réactions aux actions de l'utilisateur
 * ---------------------------------------------------------------------------
 * Branche les écouteurs de l'écran affiché (éléments repérés par les
 * attributs data-action et data-path) et relaie chaque action vers les
 * fonctions d'état de main-msp.js ou vers les exports.
 *
 * Utilisé par : ui-msp.js (après chaque rendu).
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { FACTEURS_MOBILIER_UNITE } from "../data/facteurs-emission-msp.js";
import { afficherBulle } from "./infobulles.js";
import {
  ajouterLigne,
  ajouterLignePraticien,
  ajouterPraticien,
  allerEcran,
  calculerEtEnregistrer,
  getEtat,
  majEtat,
  supprimerLigne,
  supprimerPraticien,
} from "../main-msp.js";
import { chargerCommunes } from "../../../shared/js/data/zonage-insee.js";
import { echapperHtml } from "../../../shared/js/echappement.js";
import { activerListeSuggestions, majListeSuggestions } from "../../../shared/js/accessibilite.js";
import { exporterAffiche } from "../export/affiche.js";
import { exporterArchiveVersFichier, exporterDashboard, importerArchiveDepuisFichier } from "../export/archive.js";
import { exporterExcel } from "../export/excel.js";
import { telechargerPlanActions } from "../export/plan-actions-rtf.js";

/**
 * Branche, après chaque rendu, les écouteurs de chaque élément de l'écran :
 * saisies (data-path), boutons (data-action), recherche de commune,
 * consentement et import d'archive. Comme l'écran est entièrement redessiné
 * à chaque changement, les écouteurs sont reposés à chaque fois.
 * @param {HTMLElement} app  Conteneur de l'application.
 */
export function attacherEcouteurs(app) {
  // Sélectionne tout le contenu au focus pour les champs numériques et
  // texte : sans ça, taper dans un champ affichant déjà "0" par défaut
  // insère le nouveau chiffre à côté de l'ancien ("02" au lieu de "2").
  app.querySelectorAll('input[type="number"], input[type="text"], input[type="email"]').forEach((input) => {
    input.addEventListener("focus", () => input.select());
  });

  app.querySelectorAll("[data-path]").forEach((input) => {
    input.addEventListener("change", () => {
      let valeur =
        input.type === "checkbox"
          ? input.checked
          : input.type === "number"
            ? parseFloat(input.value) || 0
            : input.value;
      // Une année ne comporte que 52 semaines : au-delà, la saisie est
      // presque toujours une erreur de frappe (ou une confusion avec un
      // nombre de jours). On prévient avec une bulle plutôt que de laisser
      // passer silencieusement une valeur impossible, puis on ramène à 52.
      if (input.dataset.path.endsWith(".semainesTravailleesAn") && valeur > 52) {
        afficherBulle(
          "👀 Wow, vous travaillez beaucoup sur une année ! Une année ne comporte que 52 semaines — on ramène la valeur à 52.",
        );
        valeur = 52;
        input.value = 52;
      }
      majEtat(input.dataset.path, valeur);
    });
  });

  app.querySelectorAll("[data-path-mobilier]").forEach((input) => {
    input.addEventListener("change", () => {
      const [ownerId, champ, index, clef] = input.dataset.pathMobilier.split("|");
      const etat = getEtat();
      const cible =
        ownerId === "staffAdmin" ? etat.staffAdmin[champ] : etat.praticiens.find((p) => p.id === ownerId)[champ];
      cible[+index][clef] = input.type === "number" ? parseFloat(input.value) || 0 : input.value;
      forcerRafraichissement(etat);
    });
  });

  const inputImportArchive = app.querySelector("#import-archive-fichier");
  if (inputImportArchive) {
    inputImportArchive.addEventListener("change", () => {
      if (inputImportArchive.files?.[0]) importerArchiveDepuisFichier(inputImportArchive.files[0]);
    });
  }

  const consentementDashboard = app.querySelector("#consentement-dashboard");
  const boutonExporterDashboard = app.querySelector("#bouton-exporter-dashboard");
  if (consentementDashboard && boutonExporterDashboard) {
    consentementDashboard.addEventListener("change", () => {
      boutonExporterDashboard.disabled = !consentementDashboard.checked;
    });
  }

  const rechercheCommune = app.querySelector("#recherche-commune");
  const zoneResultats = app.querySelector("#resultats-commune");
  if (rechercheCommune && zoneResultats) {
    // Chargement de la liste des communes dès l'affichage du champ.
    chargerCommunes();
    // Choix au clavier : même effet qu'un clic sur la suggestion.
    activerListeSuggestions(rechercheCommune, zoneResultats, (option) => option.click());
    rechercheCommune.addEventListener("input", async () => {
      const saisie = rechercheCommune.value;
      const { chercherCommunes } = await chargerCommunes();
      if (rechercheCommune.value !== saisie) return; // une frappe plus récente a pris le relais
      const resultats = chercherCommunes(saisie, 8);
      zoneResultats.innerHTML = resultats
        .map(
          (c) =>
            `<div class="resultat-commune" role="option" data-code="${echapperHtml(c.code)}" data-nom="${echapperHtml(c.nom)}">${echapperHtml(c.nom)} (${echapperHtml(c.dep)})</div>`,
        )
        .join("");
      majListeSuggestions(rechercheCommune, zoneResultats, resultats.length > 0);
    });
  }
  if (zoneResultats) {
    zoneResultats.addEventListener("click", (ev) => {
      const item = ev.target.closest(".resultat-commune");
      if (!item) return;
      const etat = getEtat();
      etat.structureMSP.communeNom = item.dataset.nom;
      majEtat("structureMSP.commune", item.dataset.code);
    });
  }

  // Délégation d'événements plutôt qu'un écouteur par bouton : un écouteur
  // attaché individuellement à chaque bouton [data-action] est perdu s'il
  // est recréé pendant le clic lui-même (ex. taper une valeur puis cliquer
  // "Suivant" sans cliquer ailleurs avant : le "blur" du champ déclenche un
  // re-rendu complet AU MILIEU du clic, qui détruit le bouton visé). En
  // écoutant sur #app (élément stable, jamais recréé — seul son contenu
  // change), le clic est capturé même si sa cible exacte a été remplacée
  // entre le mousedown et le mouseup. Attaché une seule fois (voir plus bas,
  // hors de rendreEcran), jamais à chaque re-rendu.
  if (!app.dataset.ecouteurActionsAttache) {
    app.dataset.ecouteurActionsAttache = "1";
    app.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-action]");
      if (!el) return;
      const { action } = el.dataset;
      if (action === "aller-ecran") {
        allerEcran(+el.dataset.numero);
        window.scrollTo(0, 0);
      }
      if (action === "ajouter-praticien") ajouterPraticien();
      if (action === "supprimer-praticien") supprimerPraticien(el.dataset.id);
      if (action === "calculer") calculerEtEnregistrer();
      if (action === "exporter-excel") exporterExcel(getEtat());
      if (action === "exporter-affiche") exporterAffiche();
      if (action === "telecharger-plan-actions") telechargerPlanActions();
      if (action === "exporter-archive") exporterArchiveVersFichier();
      if (action === "exporter-dashboard") exporterDashboard();
      if (action === "affichage-total") {
        const e = getEtat();
        e.affichageParActe = false;
        forcerRafraichissement(e);
      }
      if (action === "affichage-par-acte") {
        const e = getEtat();
        e.affichageParActe = true;
        forcerRafraichissement(e);
      }
      if (action === "toggle-inclure-medicaments") {
        const e = getEtat();
        e.inclureMedicaments = !e.inclureMedicaments;
        forcerRafraichissement(e);
      }
      if (action === "ajouter-materiel-dedie")
        ajouterLignePraticien(el.dataset.id, "materielDedie", { type: "", valeurAchat: 0, dureeDetention: 5 });
      if (action === "ajouter-mode")
        ajouterLigneChampPraticien(el.dataset.id, el.dataset.champ, { mode: "velo_meca", part: 0 });
      if (action === "ajouter-prescription-externe")
        ajouterLigneChampPraticien(el.dataset.id, el.dataset.champ, {
          profession: "kinesitherapeute",
          nbActesAnnuel: 0,
        });
      if (action === "supprimer-mode") supprimerLigneChampPraticien(el.dataset.id, el.dataset.champ, +el.dataset.index);
      if (action === "ajouter-mode-transport")
        ajouterLignePraticien(el.dataset.id, "modesDomicileTravail", { mode: "velo_meca", part: 0 });
      if (action === "ajouter-materiel-info") ajouterMaterielInfoPraticien(el.dataset.id);
      if (action === "supprimer-ligne-praticien")
        supprimerLigneNestedPraticien(el.dataset.id, el.dataset.champ, +el.dataset.index);
      if (action === "ajouter-materiel-info-admin")
        ajouterLigne("staffAdmin.numerique.autreMaterielInfo", { type: "", valeurAchat: 0, dureeDetention: 5 });
      if (action === "ajouter-materiel-partage")
        ajouterLigne("postesMutualises.materielPartage", { type: "", valeurAchat: 0, dureeDetention: 5 });
      if (action === "supprimer-ligne") supprimerLigne(el.dataset.chemin, +el.dataset.index);
      if (action === "ajouter-mobilier") ajouterMobilier(el.dataset.owner, el.dataset.champ);
      if (action === "supprimer-mobilier") supprimerMobilier(el.dataset.owner, el.dataset.champ, +el.dataset.index);
    });
  }
}

function forcerRafraichissement(etat) {
  majEtat("structureMSP.nom", etat.structureMSP.nom);
}

// Accès générique à un champ imbriqué d'un praticien via un chemin en
// notation pointée (ex. "tourneesDomicile.modes"), pour les listes qui ne
// sont pas directement à la racine du praticien.
function champPraticien(praticien, cheminPointe) {
  return cheminPointe.split(".").reduce((o, k) => o[k], praticien);
}

function ajouterLigneChampPraticien(praticienId, cheminPointe, item) {
  const etat = getEtat();
  const p = etat.praticiens.find((x) => x.id === praticienId);
  champPraticien(p, cheminPointe).push(item);
  forcerRafraichissement(etat);
}

function supprimerLigneChampPraticien(praticienId, cheminPointe, index) {
  const etat = getEtat();
  const p = etat.praticiens.find((x) => x.id === praticienId);
  champPraticien(p, cheminPointe).splice(index, 1);
  forcerRafraichissement(etat);
}

function ajouterMaterielInfoPraticien(praticienId) {
  const etat = getEtat();
  const p = etat.praticiens.find((x) => x.id === praticienId);
  p.numerique.autreMaterielInfo.push({ type: "", valeurAchat: 0, dureeDetention: 5 });
  forcerRafraichissement(etat);
}

function supprimerLigneNestedPraticien(praticienId, champ, index) {
  const etat = getEtat();
  const p = etat.praticiens.find((x) => x.id === praticienId);
  if (champ === "numerique.autreMaterielInfo") p.numerique.autreMaterielInfo.splice(index, 1);
  else p[champ].splice(index, 1);
  forcerRafraichissement(etat);
}

function ajouterMobilier(ownerId, champ) {
  const etat = getEtat();
  const cible =
    ownerId === "staffAdmin" ? etat.staffAdmin[champ] : etat.praticiens.find((p) => p.id === ownerId)[champ];
  cible.push({ type: Object.keys(FACTEURS_MOBILIER_UNITE)[0], nombre: 1, dureeDetention: 10 });
  forcerRafraichissement(etat);
}

function supprimerMobilier(ownerId, champ, index) {
  const etat = getEtat();
  const cible =
    ownerId === "staffAdmin" ? etat.staffAdmin[champ] : etat.praticiens.find((p) => p.id === ownerId)[champ];
  cible.splice(index, 1);
  forcerRafraichissement(etat);
}
