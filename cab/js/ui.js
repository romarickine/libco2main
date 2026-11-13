/**
 * ui.js — point d'entrée de l'affichage de Lib&CO2 Cab
 * ----------------------------------------------------------------------
 * Toutes les fonctions de rendu de l'interface (DOM). Aucun calcul (voir
 * calcul.js) ni accès direct au stockage (voir stockage.js) : l'affichage
 * reçoit des données et des fonctions de rappel (callbacks) depuis main.js,
 * affiche, et relaie les interactions de l'utilisateur.
 *
 * Ce fichier contient les écrans courts (accueil, reprise de brouillon,
 * cadre du questionnaire, historique) et réexporte les autres, pour que
 * main.js n'ait qu'un seul module d'affichage à connaître :
 *   ui/etapes-saisie.js    les huit étapes du questionnaire
 *   ui/ecran-resultats.js  l'écran des résultats et le plan d'action
 *   ui/commun.js           pictogrammes, formatage, champs de formulaire
 * ----------------------------------------------------------------------
 */
import { formatTotal } from "./ui/commun.js";
import { afficherGraphiqueEvolution, construireTableauEvolution } from "./evolution.js";
import {
  renderStepAlimentation,
  renderStepDechets,
  renderStepDeplacements,
  renderStepLocal,
  renderStepMateriel,
  renderStepNumerique,
  renderStepProfil,
  renderStepServices,
} from "./ui/etapes-saisie.js";
export { majBadgesEtTotal } from "./ui/etapes-saisie.js";
export { renderResultats } from "./ui/ecran-resultats.js";

// ============================================================================
// ÉCRAN D'INTRODUCTION
// ============================================================================
export function renderIntro(root, { onStart }) {
  root.innerHTML = `
    <div class="intro">
      <p class="surtitre">Pour les professionnels libéraux</p>
      <h2 class="intro-titre">Mesurez l'empreinte carbone de votre activité.</h2>
      <p class="lead">Estimez, en quelques minutes, l'ordre de grandeur des émissions de gaz à effet de serre de votre activité indépendante — et identifiez les leviers de décarbonation les plus pertinents pour vous.</p>
      <p class="sub">Méthodologie inspirée de kinéCO2 (Lib&CO2, Carbone 4) — facteurs d'émission ADEME (Base Carbone®), report modal de la patientèle/clientèle basé sur l'Enquête Mobilité des Personnes 2019. <a href="methodologie.html">Méthodologie et sources des facteurs</a> — <a href="LibCO2-Cab-Notice-methodologique.docx">notice méthodologique complète (Word)</a>.</p>
      <div class="intro-actions">
        <button class="bouton bouton-primaire" id="btn-demarrer">Démarrer mon estimation</button>
        <a href="pourquoi-compter-le-carbone.html" class="bouton bouton-secondaire">Pourquoi compter le carbone ?</a>
      </div>
      <div class="grille-features">
        <div class="feature-card"><div class="titre">8 minutes</div><div class="desc">Un parcours court, pensé pour ne pas vous perdre.</div></div>
        <div class="feature-card"><div class="titre">8 postes clés</div><div class="desc">Déplacements, local, numérique, matériel, achats…</div></div>
        <div class="feature-card"><div class="titre">Jauge d'engagement</div><div class="desc">Visualisez votre trajectoire vers l'Accord de Paris.</div></div>
        <div class="feature-card"><div class="titre">Plan d'action</div><div class="desc">Des leviers priorisés, avec un ordre de coût.</div></div>
      </div>
      <p class="mentions">Version bêta-test. Les résultats sont des ordres de grandeur destinés à éclairer vos décisions, pas un bilan d'émissions de gaz à effet de serre réglementaire (BEGES).</p>
      <p class="mentions">Vos données restent sur votre appareil (aucun serveur, aucun compte) · Code source ouvert sur <a href="https://github.com/romarickine/libco2cab" target="_blank" rel="noopener" data-style="color:inherit;">GitHub</a> · <a href="../mentions-legales.html" data-style="color:inherit;">Mentions légales</a></p>
    </div>
  `;
  document.getElementById("btn-demarrer").addEventListener("click", onStart);
}

// ============================================================================
// PROPOSITION DE REPRISE D'UN BROUILLON
// ============================================================================
export function renderPropositionBrouillon(root, { date, onReprendre, onIgnorer }) {
  const d = new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  root.innerHTML = `
    <div class="conteneur-etroit">
      <div class="carte" data-style="text-align:center; margin-top: 60px;">
        <div data-style="font-size:15px; font-weight:700; margin-bottom:8px;">Reprendre votre saisie précédente ?</div>
        <div class="texte-discret" data-style="margin-bottom:18px;">Une saisie non terminée a été sauvegardée le ${d}.</div>
        <button class="bouton bouton-primaire" id="btn-reprendre" data-style="margin-right:10px;">Reprendre</button>
        <button class="bouton bouton-secondaire" id="btn-ignorer">Recommencer à zéro</button>
      </div>
    </div>
  `;
  document.getElementById("btn-reprendre").addEventListener("click", onReprendre);
  document.getElementById("btn-ignorer").addEventListener("click", onIgnorer);
}

// ============================================================================
// ASSISTANT (WIZARD)
// ============================================================================
// Noms courts affichés dans la barre d'étapes.
const NOMS_COURTS_ETAPES = {
  profil: "Profil",
  deplacements: "Déplacements",
  local: "Local",
  numerique: "Numérique",
  materiel: "Matériel",
  dechets: "Déchets",
  alimentation: "Alimentation",
  services: "Services",
};

const TITRES_ETAPES = {
  profil: "Votre profil",
  deplacements: "Les déplacements professionnels",
  local: "Votre local professionnel",
  numerique: "Le numérique",
  materiel: "Matériel et consommables métier",
  dechets: "Déchets",
  alimentation: "Alimentation professionnelle",
  services: "Achats de services & livraisons",
};

/**
 * Dessine le cadre du questionnaire (titre, progression, boutons précédent et
 * suivant) puis délègue le contenu de l'étape courante à ui/etapes-saisie.js.
 * @param {HTMLElement} root  Conteneur de l'application.
 * @param {object} ctx  Étapes, index courant, saisie, famille, zone, résultats
 *   provisoires et fonctions de rappel (voir main.js).
 */
export function renderWizard(root, ctx) {
  const { etapes, etapeIndex, data, famille, zone, resultats } = ctx;
  const etapeId = etapes[etapeIndex];
  const estPremiere = etapeIndex === 0;
  const estDerniere = etapeIndex === etapes.length - 1;
  const titre = etapeId === "local" ? `Votre ${famille.lieuLabel} professionnel` : TITRES_ETAPES[etapeId];

  root.innerHTML = `
    <div class="barre-etapes-cadre">
      <div class="barre-etapes">
        <ol class="etapes-cab" aria-label="Étapes du questionnaire">
          ${etapes
            .map(
              (e, i) =>
                `<li class="etape-cab ${i === etapeIndex ? "active" : i < etapeIndex ? "faite" : ""}"${i === etapeIndex ? ' aria-current="step"' : ""}><span class="etape-puce">${i + 1}</span><span class="etape-nom">${NOMS_COURTS_ETAPES[e]}</span></li>`,
            )
            .join("")}
        </ol>
        <div class="bloc-total">
          <span class="total-en-cours">Total en cours <strong class="total-valeur" aria-live="polite">${formatTotal(resultats.totalT)}</strong></span>
          <button type="button" class="bouton-info" id="btn-info-total" aria-expanded="false" aria-controls="explication-total" aria-label="Qu'est-ce que le total en cours ?">i</button>
        </div>
      </div>
    </div>
    <div class="conteneur-etroit">
      <div class="explication-total" id="explication-total" hidden>
        <strong>Total en cours</strong> : l'empreinte annuelle estimée de votre activité, recalculée à chaque saisie. Les étapes que vous n'avez pas encore remplies sont comptées avec les valeurs par défaut de l'outil : le chiffre se précise au fil du questionnaire. Unité : tonnes d'équivalent CO2 par an (tCO2e/an).
      </div>
      <p class="eyebrow">Étape ${etapeIndex + 1} sur ${etapes.length}</p>
      <h2 class="titre-serif" data-style="font-size:30px; margin: 4px 0 28px;">${titre}</h2>
      <div class="carte" data-style="padding:28px;" id="contenu-etape"></div>
      <div class="pas-actions">
        <button class="bouton bouton-secondaire" id="btn-precedent" ${estPremiere ? "disabled" : ""}>‹ Précédent</button>
        <button class="bouton bouton-primaire" id="btn-suivant">${estDerniere ? "Voir mon estimation" : "Suivant"} ›</button>
      </div>
    </div>
  `;

  const boutonInfo = document.getElementById("btn-info-total");
  const explication = document.getElementById("explication-total");
  boutonInfo.addEventListener("click", () => {
    const ouvert = boutonInfo.getAttribute("aria-expanded") === "true";
    boutonInfo.setAttribute("aria-expanded", String(!ouvert));
    explication.hidden = ouvert;
  });

  const conteneurEtape = document.getElementById("contenu-etape");
  const rendus = {
    profil: renderStepProfil,
    deplacements: renderStepDeplacements,
    local: renderStepLocal,
    numerique: renderStepNumerique,
    materiel: renderStepMateriel,
    dechets: renderStepDechets,
    alimentation: renderStepAlimentation,
    services: renderStepServices,
  };
  rendus[etapeId](conteneurEtape, { data, famille, zone, resultats, ctx });

  document.getElementById("btn-precedent").addEventListener("click", ctx.onPrev);
  document.getElementById("btn-suivant").addEventListener("click", ctx.onNext);
}

// ============================================================================
// ÉCRAN HISTORIQUE / ÉVOLUTION
// ============================================================================
export function renderHistorique(root, { bilans, onSupprimer, onBack, onNouveauBilan }) {
  root.innerHTML = `
    <div class="conteneur">
      <div class="entete-app">
        <button class="lien-retour" id="btn-retour-hist">‹ Retour aux résultats</button>
      </div>
      <h2 class="titre-serif" data-style="font-size:28px; margin: 4px 0 20px;">Évolution de mon cabinet dans le temps</h2>
      ${
        bilans.length === 0
          ? `<div class="carte"><p class="texte-discret">Aucun bilan enregistré pour l'instant. Depuis l'écran de résultats, cliquez sur "Enregistrer ce bilan" pour commencer un suivi dans le temps.</p></div>`
          : `
        <div class="carte">
          <div data-style="font-weight:700; font-size:14.5px; margin-bottom:10px;">Empreinte totale (tCO2e/an), poste par poste</div>
          ${bilans.length >= 2 ? `<div class="zone-canvas-evolution"><canvas id="canvas-evolution"></canvas></div>` : `<p class="texte-discret">Enregistrez au moins 2 bilans pour voir apparaître un graphique d'évolution.</p>`}
        </div>
        <div class="carte" id="zone-tableau-evolution"></div>
      `
      }
      <div data-style="text-align:center; margin-top:16px;"><button class="bouton bouton-primaire" id="btn-nouveau-bilan">Faire un nouveau bilan</button></div>
    </div>
  `;
  document.getElementById("btn-retour-hist").addEventListener("click", onBack);
  document.getElementById("btn-nouveau-bilan").addEventListener("click", onNouveauBilan);

  if (bilans.length > 0) {
    document.getElementById("zone-tableau-evolution").appendChild(construireTableauEvolution(bilans));
    root.querySelectorAll("[data-supprimer-bilan]").forEach((b) => {
      b.addEventListener("click", () => onSupprimer(b.dataset.supprimerBilan));
    });
    if (bilans.length >= 2) {
      try {
        afficherGraphiqueEvolution(bilans, document.getElementById("canvas-evolution"));
      } catch (e) {
        console.error("Lib&CO2 — graphique d'évolution indisponible :", e);
        document.querySelector(".zone-canvas-evolution").innerHTML =
          `<p class="texte-discret">Graphique indisponible.</p>`;
      }
    }
  }
}
