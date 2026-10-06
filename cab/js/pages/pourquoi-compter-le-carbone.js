// Script de la page pourquoi-compter-le-carbone.html (sorti de la page pour la CSP stricte : aucun script en ligne).
// Chargé avec defer : le document est déjà analysé quand il s'exécute.
// Calcul en direct du budget carbone restant, à partir des données GIEC
// AR6 (500 GtCO2 restants pour +1,5°C à 50% de probabilité, estimés en
// 2020) et d'un rythme d'émission mondial d'environ 42 GtCO2/an.
// SOURCÉ — GIEC AR6 WG1 (Table SPM.2) ; Global Carbon Project.
(function () {
  const budgetInitial2020 = 500; // GtCO2 restant en 2020
  const rythmeAnnuel = 42; // GtCO2/an
  const anneeDepart = 2020;
  const anneeCourante = new Date().getFullYear();
  const consomme = (anneeCourante - anneeDepart) * rythmeAnnuel;
  const restant = Math.max(0, budgetInitial2020 - consomme);
  const pctConsomme = Math.min(100, (consomme / budgetInitial2020) * 100);
  const anneesRestantes = restant / rythmeAnnuel;

  document.getElementById("budget-remplissage").style.width = pctConsomme.toFixed(0) + "%";
  const resultatEl = document.getElementById("budget-resultat");
  if (restant <= 0) {
    resultatEl.innerHTML = `Ce budget est <span>déjà dépassé</span> au rythme d'émission actuel.`;
  } else {
    resultatEl.innerHTML = `Au rythme actuel, il reste environ <span>${anneesRestantes.toFixed(1)} ans</span> avant d'épuiser ce budget.`;
  }
  document.getElementById("budget-barre").addEventListener("click", () => {
    alert(`Détail du calcul :\n\nBudget restant estimé en 2020 : ${budgetInitial2020} GtCO2\nRythme d'émission mondial : ~${rythmeAnnuel} GtCO2/an\nDéjà consommé depuis 2020 : ~${consomme.toFixed(0)} GtCO2\nRestant aujourd'hui (${anneeCourante}) : ~${restant.toFixed(0)} GtCO2\n\nSource : GIEC AR6 (groupe 1), Global Carbon Project.`);
  });
})();

// Vidéo au clic : l'iframe YouTube n'est créée qu'après le choix du visiteur.
(function () {
  const conteneur = document.querySelector(".pp-video-wrap[data-video]");
  if (!conteneur) return;
  const bouton = conteneur.querySelector(".pp-video-lancer");
  bouton.addEventListener("click", () => {
    const iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(conteneur.dataset.video) + "?autoplay=1";
    iframe.title = conteneur.dataset.titre;
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    conteneur.replaceChildren(iframe);
    iframe.focus();
  });
})();
