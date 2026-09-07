/**
 * evolution.js
 * ----------------------------------------------------------------------
 * Construit la vue "évolution du cabinet dans le temps" à partir de
 * l'historique des bilans enregistrés (voir stockage.js). Ne lit/écrit
 * jamais directement le stockage : reçoit la liste des bilans en entrée,
 * renvoie du HTML/des données de graphique en sortie.
 * ----------------------------------------------------------------------
 */
import { CATEGORIES_META } from "./data/facteurs-emission.js";
import { dessinerGraphiqueEvolution } from "./graphiques.js";

// Construit le tableau récapitulatif de l'historique des bilans.
// Entrée : bilans (tableau trié du plus ancien au plus récent, voir stockage.js)
// Sortie : élément DOM prêt à insérer
export function construireTableauEvolution(bilans) {
  const wrapper = document.createElement("div");
  if (bilans.length === 0) {
    wrapper.innerHTML = `<p class="texte-discret">Aucun bilan enregistré pour l'instant.</p>`;
    return wrapper;
  }

  const table = document.createElement("table");
  table.className = "tableau-evolution";
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Date</th><th>Cabinet</th><th>tCO2e/an</th><th>kgCO2e/acte</th><th>Évolution</th><th></th></tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  bilans.forEach((b, i) => {
    const precedent = i > 0 ? bilans[i - 1] : null;
    const tr = document.createElement("tr");
    const date = new Date(b.dateCalcul).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

    let evolutionHtml = "—";
    if (precedent && precedent.resultats.totalT > 0) {
      const pct = ((b.resultats.totalT - precedent.resultats.totalT) / precedent.resultats.totalT) * 100;
      const signe = pct >= 0 ? "+" : "";
      const couleur = pct > 0 ? "evolution-hausse" : pct < 0 ? "evolution-baisse" : "";
      evolutionHtml = `<span class="${couleur}">${signe}${pct.toFixed(0)}%</span>`;
    }

    tr.innerHTML = `
      <td>${date}</td>
      <td>${b.nomCabinet || "—"}</td>
      <td>${b.resultats.totalT.toFixed(2)}</td>
      <td>${b.resultats.parActe.toFixed(1)}</td>
      <td>${evolutionHtml}</td>
      <td><button class="bouton-lien" data-supprimer-bilan="${b.id}">Supprimer</button></td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  return wrapper;
}

// Construit le graphique d'évolution de l'empreinte totale (tCO2e/an) dans
// le temps, poste par poste (aires empilées) si au moins 2 bilans existent.
// Entrée : bilans, élément <canvas> cible
export function afficherGraphiqueEvolution(bilans, canvas) {
  if (bilans.length < 2) return false;
  const labels = bilans.map((b) => new Date(b.dateCalcul).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }));
  const postes = Object.keys(CATEGORIES_META);
  const series = postes.map((poste) => ({
    label: CATEGORIES_META[poste].label,
    color: CATEGORIES_META[poste].color,
    data: bilans.map((b) => Math.round((b.resultats.parPoste[poste] || 0) / 1000 * 100) / 100), // en tCO2e
  }));
  dessinerGraphiqueEvolution(canvas, labels, series);
  return true;
}
