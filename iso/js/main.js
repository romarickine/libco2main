// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// ==========================================================================
// Point d'entrée de « La carte du sans-voiture » : démarre l'interface.
// Tout le reste est organisé depuis ui.js (carte, formulaire) et
// isochrones.js (calcul) ; voir iso/README.md pour la carte des modules.
// ==========================================================================
// En premier : rend possibles les styles calculés sous CSP stricte (voir ce fichier).
import "../../shared/js/styles-dynamiques.js";
import { initUI } from "./ui.js";

// La bibliothèque de carte Leaflet est chargée par index.html depuis le site
// (shared/vendor/leaflet/, avec contrôle d'intégrité ; variable globale L).
// Si ce chargement échoue (fichier manquant, réseau coupé), on l'explique à l'utilisateur plutôt que de laisser une
// page vide et une erreur visible seulement dans la console.
if (typeof window.L === "undefined") {
  const zone = document.getElementById("map");
  if (zone) {
    zone.innerHTML =
      '<p role="alert" data-style="padding:2rem;max-width:40rem;margin:auto;font-size:1.05rem;line-height:1.5">' +
      "La carte n'a pas pu se charger : la bibliothèque cartographique (Leaflet) est inaccessible. " +
      "Vérifiez votre connexion ou désactivez un éventuel bloqueur de contenu pour ce site, puis rechargez la page.</p>";
  }
} else {
  initUI();
  verifierStylesLeaflet();
}

// Feuille de style de Leaflet refusée (empreinte d'intégrité différente du
// fichier en ligne, fichier manquant) : sans elle, les tuiles s'empilent hors
// du cadre de la carte (constaté le 04/11/2026). On le signale clairement.
function verifierStylesLeaflet() {
  const zone = document.getElementById("map");
  if (!zone || getComputedStyle(zone).overflow !== "visible") return;
  console.error("Leaflet : feuille de style leaflet.css non appliquée (empreinte integrity ou fichier manquant).");
  const alerte = document.createElement("p");
  alerte.setAttribute("role", "alert");
  alerte.className = "alerte-carte";
  alerte.textContent =
    "La carte ne peut pas s\u2019afficher correctement : un fichier de mise en forme n\u2019a pas pu être chargé. Rechargez la page ; si le problème persiste, écrivez-nous.";
  (document.getElementById("layout") || zone).before(alerte);
}
