/**
 * graphiques.js
 * ----------------------------------------------------------------------
 * Génération de tous les graphiques de l'application en Canvas 2D natif,
 * SANS dépendance externe (pas de Chart.js, pas de CDN). Choix délibéré :
 * la fiabilité de l'outil ne doit pas dépendre d'une ressource réseau tierce
 * pouvant être indisponible (cohérent avec le choix de coder en dur les
 * données plutôt que de les interroger en direct — voir facteurs-emission.js
 * et zonage-insee.js). Ce fichier ne contient aucune logique de calcul : il
 * reçoit des données déjà prêtes à afficher.
 * ----------------------------------------------------------------------
 */

// Prépare un canvas pour un rendu net sur les écrans haute densité (Retina).
// Renvoie le contexte 2D déjà mis à l'échelle, et {w, h} en pixels CSS.
function preparerCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 260);
  const h = Math.max(rect.height, 200);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/* ----------------------------------------------------------------------------
   Graphique de répartition par poste — camembert ou histogramme horizontal.
   Entrée : canvas cible, données [{ label, value, color }] (déjà triées par
   ui.js, du poste le plus important au moins important), type "pie" | "bar"
   (la légende avec les libellés est gérée séparément en HTML par ui.js).
   Le graphique est interactif : survol souris ou appui tactile affiche une
   infobulle avec le libellé, le pourcentage et la valeur exacte du poste.
---------------------------------------------------------------------------- */
export function dessinerGraphiqueRepartition(canvas, donnees, type) {
  const { ctx, w, h } = preparerCanvas(canvas);
  if (donnees.length === 0) return;
  const total = donnees.reduce((s, d) => s + d.value, 0);
  const geometrie = type === "pie" ? dessinerCamembert(ctx, w, h, donnees, total) : dessinerHistogramme(ctx, w, h, donnees, total);
  activerInfobulle(canvas, geometrie);
}

function dessinerCamembert(ctx, w, h, donnees, total) {
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 12;
  let angle = -Math.PI / 2;
  const items = [];

  donnees.forEach((d) => {
    const part = total > 0 ? d.value / total : 0;
    const angleFin = angle + part * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angleFin);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    // Fin liseré entre les parts, pour bien distinguer deux teintes proches.
    ctx.strokeStyle = "#F7F5F0";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pourcentage affiché sur la part elle-même dès que l'angle est assez
    // large pour rester lisible ; les parts trop petites restent
    // consultables via l'infobulle au survol/appui.
    if (part > 0.025) {
      const angleMid = (angle + angleFin) / 2;
      const rLabel = r * 0.66;
      const lx = cx + Math.cos(angleMid) * rLabel;
      const ly = cy + Math.sin(angleMid) * rLabel;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "600 13px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(part * 100)}%`, lx, ly);
    }
    items.push({ ...d, part, startAngle: angle, endAngle: angleFin });
    angle = angleFin;
  });

  return { type: "pie", cx, cy, r, items };
}

function dessinerHistogramme(ctx, w, h, donnees, total) {
  const marge = { haut: 6, bas: 6, gauche: 6, droite: 56 };
  const zoneW = w - marge.gauche - marge.droite;
  const zoneH = h - marge.haut - marge.bas;
  const n = donnees.length;
  const gapRatio = 0.45;
  const barH = zoneH / n / (1 + gapRatio);
  const gap = barH * gapRatio;
  const max = Math.max(...donnees.map((d) => d.value)) || 1;

  ctx.font = "600 12px -apple-system, sans-serif";
  ctx.textBaseline = "middle";

  const items = [];
  donnees.forEach((d, i) => {
    const rowTop = marge.haut + i * (barH + gap);
    const y = rowTop + gap / 2;
    // Largeur minimale garantie (6px) pour que les petites valeurs restent
    // visibles comme un petit rectangle propre, plutôt qu'une forme déformée
    // quand le rayon d'arrondi dépasse la largeur réelle de la barre.
    const barW = Math.max(6, (d.value / max) * zoneW);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    const rad = Math.min(5, barH / 2, barW / 2);
    tracerRectArrondi(ctx, marge.gauche, y, barW, barH, rad);
    ctx.fill();

    ctx.fillStyle = "#3E4A45";
    ctx.textAlign = "left";
    ctx.fillText(Math.round(d.value).toLocaleString("fr-FR"), marge.gauche + barW + 8, y + barH / 2);

    items.push({ ...d, part: total > 0 ? d.value / total : 0, rowTop, rowBottom: rowTop + barH + gap });
  });

  return { type: "bar", w, h, items };
}

// Attache les gestionnaires souris/tactile à un graphique de répartition
// (camembert ou histogramme) et affiche une infobulle flottante au survol
// ou à l'appui, avec le libellé, le pourcentage et la valeur du poste
// concerné. Le conteneur direct du canvas doit être en position:relative
// (voir .zone-canvas-repartition en CSS) pour que l'infobulle s'y positionne.
function activerInfobulle(canvas, geometrie) {
  const conteneur = canvas.parentElement;
  let tooltip = conteneur.querySelector(".graphique-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "graphique-tooltip";
    conteneur.appendChild(tooltip);
  }

  function trouverItem(px, py) {
    if (geometrie.type === "pie") {
      const dx = px - geometrie.cx, dy = py - geometrie.cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > geometrie.r) return null;
      let ang = Math.atan2(dy, dx);
      if (ang < -Math.PI / 2) ang += Math.PI * 2;
      return geometrie.items.find((it) => ang >= it.startAngle && ang < it.endAngle) || null;
    }
    // histogramme : toute la bande horizontale de la ligne déclenche l'infobulle
    if (px < 0 || px > geometrie.w) return null;
    return geometrie.items.find((it) => py >= it.rowTop && py < it.rowBottom) || null;
  }

  function afficherPourItem(item, clientX, clientY) {
    if (!item) { tooltip.style.display = "none"; return; }
    const rectConteneur = conteneur.getBoundingClientRect();
    tooltip.innerHTML = `<strong>${item.label}</strong><br>${Math.round(item.part * 100)}% · ${item.value.toLocaleString("fr-FR")} kgCO2e`;
    tooltip.style.display = "block";
    let x = clientX - rectConteneur.left + 14;
    let y = clientY - rectConteneur.top + 14;
    // Évite que l'infobulle ne sorte du cadre du graphique.
    const maxX = rectConteneur.width - tooltip.offsetWidth - 6;
    const maxY = rectConteneur.height - tooltip.offsetHeight - 6;
    if (x > maxX) x = clientX - rectConteneur.left - tooltip.offsetWidth - 14;
    if (y > maxY) y = Math.max(6, maxY);
    tooltip.style.left = `${Math.max(6, x)}px`;
    tooltip.style.top = `${Math.max(6, y)}px`;
  }

  function gererPointeur(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const item = trouverItem(clientX - rect.left, clientY - rect.top);
    afficherPourItem(item, clientX, clientY);
  }

  canvas.addEventListener("mousemove", (e) => gererPointeur(e.clientX, e.clientY));
  canvas.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
  canvas.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.touches[0]; if (t) gererPointeur(t.clientX, t.clientY); }, { passive: false });
  canvas.addEventListener("touchmove", (e) => { e.preventDefault(); const t = e.touches[0]; if (t) gererPointeur(t.clientX, t.clientY); }, { passive: false });
  canvas.addEventListener("touchend", () => { tooltip.style.display = "none"; });
}

function tracerRectArrondi(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ----------------------------------------------------------------------------
   Graphique d'évolution — aires empilées, une par poste d'émission, dans le
   temps. Utilisé par evolution.js.
   Entrée : canvas cible, labels (dates), series [{ label, color, data }]
   (une valeur par date, en tCO2e). L'ordre des séries détermine l'empilement.
---------------------------------------------------------------------------- */
export function dessinerGraphiqueEvolution(canvas, labels, series) {
  const { ctx, w, h } = preparerCanvas(canvas);
  const marge = { haut: 16, bas: 28, gauche: 40, droite: 12 };
  const zoneW = w - marge.gauche - marge.droite;
  const zoneH = h - marge.haut - marge.bas;
  const n = labels.length;
  if (n === 0) return;

  const cumuls = [];
  for (let i = 0; i < n; i++) {
    let acc = 0;
    const niveaux = [0];
    series.forEach((s) => { acc += s.data[i] || 0; niveaux.push(acc); });
    cumuls.push(niveaux);
  }
  const maxTotal = Math.max(...cumuls.map((c) => c[c.length - 1]), 0.1);

  const xAt = (i) => marge.gauche + (n === 1 ? zoneW / 2 : (i / (n - 1)) * zoneW);
  const yAt = (v) => marge.haut + zoneH - (v / maxTotal) * zoneH;

  ctx.strokeStyle = "#E4E0D6"; ctx.lineWidth = 1;
  ctx.font = "10px -apple-system, sans-serif"; ctx.fillStyle = "#8A9490"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let g = 0; g <= 4; g++) {
    const v = (maxTotal / 4) * g;
    const y = yAt(v);
    ctx.beginPath(); ctx.moveTo(marge.gauche, y); ctx.lineTo(w - marge.droite, y); ctx.stroke();
    ctx.fillText(v.toFixed(1), marge.gauche - 6, y);
  }

  series.forEach((s, idxSerie) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(xAt(i), yAt(cumuls[i][idxSerie + 1]));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(xAt(i), yAt(cumuls[i][idxSerie]));
    ctx.closePath();
    ctx.fillStyle = s.color + "AA";
    ctx.fill();
    ctx.strokeStyle = s.color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i), y = yAt(cumuls[i][idxSerie + 1]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  ctx.fillStyle = "#8A9490"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  labels.forEach((lbl, i) => ctx.fillText(lbl, xAt(i), marge.haut + zoneH + 8));
}

/* ----------------------------------------------------------------------------
   Jauge d'engagement — trajectoire Accord de Paris (arc de cercle en SVG,
   pas de dépendance externe).
   Entrée : conteneur DOM, pctReductionPlan (0-30+), totalT, objectif3ansT
---------------------------------------------------------------------------- */
export function dessinerJaugeEngagement(conteneur, pctReductionPlan, totalT, objectif3ansT) {
  const pct = Math.max(0, Math.min(30, pctReductionPlan || 0));
  const fraction = pct / 30;
  const cx = 150, cy = 118, r = 92;

  const pointAt = (frac, radius) => {
    const theta = Math.PI * (1 - frac);
    return [cx + radius * Math.cos(theta), cy - radius * Math.sin(theta)];
  };
  const describeArc = (fracStart, fracEnd, radius) => {
    const [x1, y1] = pointAt(fracStart, radius);
    const [x2, y2] = pointAt(fracEnd, radius);
    const largeArc = fracEnd - fracStart > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const [needleX, needleY] = pointAt(fraction, r);
  const labelR = r + 18;

  let statut, classeCouleur;
  if (pct >= 15) { statut = "Trajectoire 3 ans ou plus"; classeCouleur = "jauge-vert"; }
  else if (pct >= 5) { statut = "Trajectoire à 1 an (-5%/an)"; classeCouleur = "jauge-vertclair"; }
  else if (pct > 0) { statut = "Engagement amorcé"; classeCouleur = "jauge-ambre"; }
  else { statut = "Pas encore d'action engagée"; classeCouleur = "jauge-rouge"; }

  conteneur.innerHTML = `
    <div class="jauge-engagement">
      <svg viewBox="0 0 300 140" class="jauge-svg">
        <path d="${describeArc(0, 5 / 30, r)}" stroke="#B85C5C" stroke-width="15" fill="none" stroke-linecap="round" />
        <path d="${describeArc(5 / 30, 15 / 30, r)}" stroke="#C98A2C" stroke-width="15" fill="none" />
        <path d="${describeArc(15 / 30, 1, r)}" stroke="#2E673E" stroke-width="15" fill="none" stroke-linecap="round" />
        <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="#1B2B26" stroke-width="3" stroke-linecap="round" />
        <circle cx="${cx}" cy="${cy}" r="5" fill="#1B2B26" />
        <text x="${pointAt(0, labelR)[0]}" y="${pointAt(0, labelR)[1]}" font-size="9.5" fill="#8A9490" text-anchor="middle">0%</text>
        <text x="${pointAt(5 / 30, labelR)[0]}" y="${pointAt(5 / 30, labelR)[1]}" font-size="9.5" fill="#8A9490" text-anchor="middle">-5%</text>
        <text x="${pointAt(15 / 30, labelR)[0]}" y="${pointAt(15 / 30, labelR)[1]}" font-size="9.5" fill="#8A9490" text-anchor="middle">-15%</text>
        <text x="${pointAt(1, labelR)[0]}" y="${pointAt(1, labelR)[1]}" font-size="9.5" fill="#8A9490" text-anchor="middle">-30%+</text>
      </svg>
      <div class="jauge-texte">
        <div class="jauge-eyebrow">Jauge d'engagement — Accord de Paris</div>
        <div class="jauge-valeur"><span class="${classeCouleur}">-${pct.toFixed(1)}%</span> <span class="${classeCouleur} jauge-statut">${statut}</span></div>
        <div class="jauge-objectif">Objectif -15%/3 ans ≈ <strong>${objectif3ansT.toFixed(2)} tCO2e/an</strong> (contre ${totalT.toFixed(2)} aujourd'hui)</div>
      </div>
    </div>
  `;
}
