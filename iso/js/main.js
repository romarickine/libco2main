// ==========================================================================
// Point d'entrée de « La carte du sans-voiture » : démarre l'interface.
// Tout le reste est organisé depuis ui.js (carte, formulaire) et
// isochrones.js (calcul) ; voir iso/README.md pour la carte des modules.
// ==========================================================================
import { initUI } from "./ui.js";

// La bibliothèque de carte Leaflet est chargée depuis cdnjs par index.html
// (variable globale L). Si ce chargement échoue (réseau coupé, bloqueur,
// CDN indisponible), on l'explique à l'utilisateur plutôt que de laisser une
// page vide et une erreur visible seulement dans la console.
if (typeof window.L === "undefined") {
  const zone = document.getElementById("map");
  if (zone) {
    zone.innerHTML =
      '<p role="alert" style="padding:2rem;max-width:40rem;margin:auto;font-size:1.05rem;line-height:1.5">' +
      "La carte n'a pas pu se charger : la bibliothèque cartographique (Leaflet) est inaccessible. " +
      "Vérifiez votre connexion ou désactivez un éventuel bloqueur de contenu pour ce site, puis rechargez la page.</p>";
  }
} else {
  initUI();
}
