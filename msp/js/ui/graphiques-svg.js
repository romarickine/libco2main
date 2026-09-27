/**
 * ui/graphiques-svg.js — graphiques en SVG natif
 * ---------------------------------------------------------------------------
 * Camembert en anneau, barres horizontales, jauge en demi-cercle, barres
 * empilées par praticien. Chaque fonction reçoit des données et renvoie une
 * chaîne SVG ; aucune bibliothèque externe.
 *
 * Utilisé par : ui/ecran-resultats.js.
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { COULEURS_POSTES, fmt, xmlEchappe } from "./commun.js";

/**
 * Camembert en anneau — répartition par poste. Remplace le graphique en
 * barres horizontales pour ce cas d'usage précis (une lecture "part du
 * tout" est plus immédiate en anneau qu'en barres). Les valeurs et le
 * calcul sous-jacent (items) sont strictement identiques à avant ; seule la
 * représentation change.
 */
export function svgCamembertAnneau(items, { taille = 220, epaisseur = 34, unite = "kgCO2e" } = {}) {
  const total = items.reduce((s, i) => s + i.valeur, 0) || 1;
  const rayon = (taille - epaisseur) / 2;
  const cx = taille / 2,
    cy = taille / 2;

  // Vrais segments d'arc indépendants (path), plutôt que des cercles
  // complets superposés avec stroke-dasharray : chaque segment n'occupe
  // que sa portion réelle du cercle, ce qui rend le survol/toucher fiable
  // sur chacun (avec des cercles empilés, la zone "invisible" d'un cercle
  // peut malgré tout intercepter les événements de pointeur au-dessus des
  // segments qu'il recouvre, rendant certains segments impossibles à survoler).
  let angleCourant = -Math.PI / 2;
  const point = (angle) => ({ x: cx + rayon * Math.cos(angle), y: cy + rayon * Math.sin(angle) });

  const segments = items
    .map((item, i) => {
      const couleur = item.couleur || COULEURS_POSTES[i % COULEURS_POSTES.length];
      const part = item.valeur / total;
      const angle = part * Math.PI * 2;
      const p0 = point(angleCourant);
      const p1 = point(angleCourant + angle);
      const grandArc = angle > Math.PI ? 1 : 0;
      const tooltip = `${item.label} : ${fmt(item.valeur)} ${unite} (${Math.round(part * 100)}%)`;
      const chemin = `<path d="M ${p0.x} ${p0.y} A ${rayon} ${rayon} 0 ${grandArc} 1 ${p1.x} ${p1.y}"
      fill="none" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="${items.length > 1 ? "butt" : "round"}"
      class="segment-survolable" data-tooltip="${xmlEchappe(tooltip)}"></path>`;
      angleCourant += angle;
      return chemin;
    })
    .join("");

  const legende = items
    .map((item, i) => {
      const couleur = item.couleur || COULEURS_POSTES[i % COULEURS_POSTES.length];
      return `<span class="legende-item"><span class="legende-puce" style="background:${couleur}"></span>${item.label}<span class="legende-pct">${Math.round((item.valeur / total) * 100)}%</span></span>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${taille} ${taille}" width="${taille}" height="${taille}" class="graphe-anneau" role="img" aria-label="Répartition par poste">
      <circle cx="${cx}" cy="${cy}" r="${rayon}" fill="none" stroke="var(--couleur-bordure-legere)" stroke-width="${epaisseur}"></circle>
      ${segments}
    </svg>
    <div class="legende-graphe">${legende}</div>`;
}

/**
 * Barres empilées : une barre par entité (praticien...), segmentée par poste.
 * Remplace le tableau "Détail par praticien" par une lecture visuelle directe.
 */
/**
 * Jauge en demi-cercle, 0 à 30% (plafond de la jauge d'engagement).
 * Trois zones de couleur (pas engagé / trajectoire 1 an / trajectoire 3 ans+)
 * et une aiguille indiquant la position actuelle.
 */
export function svgJaugeDemiCercle(pct) {
  const cx = 150,
    cy = 130,
    rayon = 110;
  const pctCappe = Math.max(0, Math.min(pct, 30));
  const angleDe = (valeurPct) => Math.PI - (valeurPct / 30) * Math.PI; // 0% -> 180°(gauche), 30% -> 0°(droite)
  const point = (angle, r) => ({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) });

  const arc = (pctDebut, pctFin, couleur) => {
    const a0 = angleDe(pctDebut),
      a1 = angleDe(pctFin);
    const p0 = point(a0, rayon),
      p1 = point(a1, rayon);
    return `<path d="M ${p0.x} ${p0.y} A ${rayon} ${rayon} 0 0 1 ${p1.x} ${p1.y}" stroke="${couleur}" stroke-width="22" fill="none" stroke-linecap="butt"></path>`;
  };

  const angleAiguille = angleDe(pctCappe);
  const pointeAiguille = point(angleAiguille, rayon - 30);

  return `
  <svg viewBox="0 0 300 155" class="jauge-svg" role="img" aria-label="Jauge d'engagement, ${pctCappe.toFixed(1)}%">
    ${arc(0, 5, "#B85C5C")}
    ${arc(5, 15, "#C98A2C")}
    ${arc(15, 30, "#2E673E")}
    <line x1="${cx}" y1="${cy}" x2="${pointeAiguille.x}" y2="${pointeAiguille.y}" stroke="var(--couleur-encre)" stroke-width="3" stroke-linecap="round"></line>
    <circle cx="${cx}" cy="${cy}" r="6" fill="var(--couleur-encre)"></circle>
    <text x="${cx}" y="${cy - 20}" text-anchor="middle" class="jauge-valeur">${pctCappe.toFixed(1)}%</text>
    <text x="30" y="${cy + 18}" class="jauge-repere">0%</text>
    <text x="270" y="${cy + 18}" text-anchor="end" class="jauge-repere">30%</text>
  </svg>`;
}

/**
 * Barres horizontales empilées : une barre par praticien, un segment par poste.
 * @param {object[]} donnees  Une entrée par barre (libellé et valeurs par série).
 * @param {object[]} series  Postes à empiler (clé, libellé, couleur).
 * @param {object} [options]  Dimensions, unité et formatage des valeurs.
 * @returns {string} SVG
 */
export function svgBarresEmpilees(
  donnees,
  series,
  {
    largeur = 560,
    hauteurBarre = 30,
    espaceLabel = 20,
    espaceApresBarre = 26,
    unite = "kgCO2e",
    reserveValeur = 110,
    formatteur = fmt,
  } = {},
) {
  const totaux = donnees.map((d) => series.reduce((s, ser) => s + (d[ser.cle] || 0), 0));
  const max = Math.max(...totaux, 1);
  const largeurZone = largeur - reserveValeur;
  const hauteurBloc = espaceLabel + hauteurBarre + espaceApresBarre;
  const hauteurTotale = donnees.length * hauteurBloc;

  const barres = donnees
    .map((d, i) => {
      const yBloc = i * hauteurBloc;
      let xCursor = 0;
      const segments = series
        .map((ser) => {
          const valeur = d[ser.cle] || 0;
          if (valeur <= 0) return "";
          const largeurSeg = (valeur / max) * largeurZone;
          const rect = `<rect x="${xCursor}" y="${yBloc + espaceLabel}" width="${largeurSeg}" height="${hauteurBarre}" fill="${ser.couleur}" class="segment-survolable" data-tooltip="${xmlEchappe(ser.label + " : " + formatteur(valeur) + " " + unite)}"></rect>`;
          xCursor += largeurSeg;
          return rect;
        })
        .join("");
      return `
      <text x="0" y="${yBloc + 14}" class="svg-label">${d.label}</text>
      ${segments}
      <text x="${xCursor + 8}" y="${yBloc + espaceLabel + hauteurBarre / 2 + 4}" class="svg-valeur">${formatteur(totaux[i])} ${unite}</text>`;
    })
    .join("");

  const legende = series
    .map(
      (ser) =>
        `<span class="legende-item"><span class="legende-puce" style="background:${ser.couleur}"></span>${ser.label}</span>`,
    )
    .join("");

  return `<div class="legende-graphe">${legende}</div>
    <svg viewBox="0 0 ${largeur} ${hauteurTotale}" class="graphe-barres" role="img" aria-label="Graphique en barres empilées">${barres}</svg>`;
}
