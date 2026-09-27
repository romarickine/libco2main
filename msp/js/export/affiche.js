/**
 * export/affiche.js — affiche PNG de la structure
 * ---------------------------------------------------------------------------
 * Dessine sur un canvas une affiche résumant le bilan (logo, total,
 * répartition) et la propose au téléchargement.
 *
 * Utilisé par : ui/evenements.js (action « exporter-affiche »).
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { fmt } from "../ui/commun.js";
import { getEtat } from "../main-msp.js";

// ---------------------------------------------------------------------------
// AFFICHE (image PNG) — document de synthèse pour affichage salle d'attente.
// Généré en Canvas natif (comme le certificat du socle individuel), sans
// dépendance externe.
function chargerImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function genererCanvasAffiche(etat) {
  const r = etat.dernierResultat;
  if (!r) return null;
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      /* ignore */
    }
  }

  const nomsPraticiensAffiche = Object.fromEntries(etat.praticiens.map((p, i) => [p.id, `Praticien ${i + 1}`]));
  const hauteurParPraticien = 92;
  const nbLignesPraticiens = etat.praticiens.length + 1; // +1 pour les fonctions support
  const L = 1000,
    H = 900 + nbLignesPraticiens * hauteurParPraticien + 80;

  const canvas = document.createElement("canvas");
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#F7F5F0";
  ctx.fillRect(0, 0, L, H);

  // Bandeau d'en-tête — la position du titre est calculée à partir de la
  // largeur RÉELLE du logo (le bug précédent supposait une largeur fixe de
  // 230px, trop étroite pour le logo réel d'environ 271px, ce qui faisait
  // chevaucher le titre sous le cadre du logo).
  ctx.fillStyle = "#0071C1";
  ctx.fillRect(0, 0, L, 150);
  const logoSrc = document.querySelector(".entete-logo")?.src;
  const logo = await chargerImage(logoSrc);
  let texteX = 60;
  if (logo) {
    const hLogo = 74,
      wLogo = logo.width * (hLogo / logo.height);
    const rx = 40,
      ry = 38,
      rw = wLogo + 28,
      rh = hLogo + 24;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(rx, ry, rw, rh, 10) : ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.drawImage(logo, rx + 14, ry + 12, wLogo, hLogo);
    texteX = rx + rw + 24; // juste après le cadre du logo, quelle que soit sa largeur réelle
  }
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.font = "600 30px Fraunces, Georgia, serif";
  ctx.fillText("Bilan carbone", texteX, 66);
  ctx.font = "400 18px Inter, sans-serif";
  ctx.fillText(etat.structureMSP.nom || "Maison de santé pluriprofessionnelle", texteX, 98);
  ctx.font = "400 14px Inter, sans-serif";
  ctx.fillText(new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" }), texteX, 124);

  // Chiffres clés MSP
  ctx.textAlign = "center";
  ctx.fillStyle = "#1B2B26";
  ctx.font = "700 88px 'JetBrains Mono', monospace";
  ctx.fillText(fmt(r.empreinteTotale / 1000), L / 2, 290);
  ctx.font = "600 22px Inter, sans-serif";
  ctx.fillText("tonnes de CO2e par an — empreinte totale de la MSP", L / 2, 325);
  ctx.font = "600 26px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#0071C1";
  ctx.fillText(`${r.ratioParActe != null ? r.ratioParActe.toFixed(1) : "—"} kgCO2e par acte en moyenne`, L / 2, 365);
  ctx.textAlign = "left";

  // Camembert — répartition par poste (MSP entière)
  const PALETTE_POSTES = {
    local: "#0071C1",
    patientele: "#2E673E",
    deplacements: "#C98A2C",
    alimentation: "#4E8FA3",
    prescriptions: "#8A6FB0",
    support: "#B85C5C",
    immobilisations: "#8FA05F",
  };
  const donneesPostesAffiche = [
    { label: "Local", valeur: r.parPoste.local.total, couleur: PALETTE_POSTES.local },
    { label: "Patientèle", valeur: r.parPoste.patientele.total, couleur: PALETTE_POSTES.patientele },
    {
      label: "Déplacements pro.",
      valeur: r.parPoste.domicileTravail.usageTotal + r.parPoste.domicileTravail.fabricationVehiculeTotal,
      couleur: PALETTE_POSTES.deplacements,
    },
    { label: "Alimentation", valeur: r.parPoste.alimentation.total, couleur: PALETTE_POSTES.alimentation },
    { label: "Prescriptions", valeur: r.parPoste.prescriptions.total, couleur: PALETTE_POSTES.prescriptions },
    { label: "Postes mutualisés", valeur: r.parPoste.support.total, couleur: PALETTE_POSTES.support },
    { label: "Immobilisations", valeur: r.parPoste.immobilisations, couleur: PALETTE_POSTES.immobilisations },
  ].filter((d) => d.valeur > 0);
  const totalPostesAffiche = donneesPostesAffiche.reduce((s, d) => s + d.valeur, 0) || 1;

  ctx.font = "600 24px Fraunces, Georgia, serif";
  ctx.fillStyle = "#1B2B26";
  ctx.fillText("Répartition par poste (MSP entière)", 60, 435);

  const cx = 240,
    cy = 590,
    rad = 150;
  let angleCourant = -Math.PI / 2;
  donneesPostesAffiche.forEach((d) => {
    const angle = (d.valeur / totalPostesAffiche) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, angleCourant, angleCourant + angle);
    ctx.closePath();
    ctx.fillStyle = d.couleur;
    ctx.fill();
    angleCourant += angle;
  });

  let ly = 470;
  donneesPostesAffiche.forEach((d) => {
    ctx.fillStyle = d.couleur;
    ctx.fillRect(510, ly - 15, 18, 18);
    ctx.fillStyle = "#3E4A45";
    ctx.font = "400 16px Inter, sans-serif";
    ctx.fillText(`${d.label} — ${Math.round((d.valeur / totalPostesAffiche) * 100)}%`, 538, ly);
    ly += 30;
  });

  // Empreinte par praticien — total, ratio par acte, ET répartition par
  // poste propre à chaque praticien (mini barre empilée), pour que chacun
  // comprenne d'où vient sa propre empreinte, pas seulement son total.
  let py = 850;
  ctx.font = "600 24px Fraunces, Georgia, serif";
  ctx.fillStyle = "#1B2B26";
  ctx.fillText("Empreinte par praticien", 60, py);
  py += 30;
  ctx.font = "400 14px Inter, sans-serif";
  ctx.fillStyle = "#8A9490";
  ctx.fillText(
    "Chaque barre représente la répartition par poste de ce praticien (mêmes couleurs que ci-dessus).",
    60,
    py,
  );
  py += 40;

  const largeurBarreMax = 880;

  const dessinerLignePraticien = (nom, segments, total, ratioParActe) => {
    ctx.font = "600 17px Inter, sans-serif";
    ctx.fillStyle = "#1B2B26";
    ctx.fillText(nom, 60, py);
    ctx.textAlign = "right";
    ctx.font = "600 15px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#0071C1";
    ctx.fillText(
      `${fmt(total)} kgCO2e/an${ratioParActe != null ? "  ·  " + ratioParActe.toFixed(1) + " kgCO2e/acte" : ""}`,
      60 + largeurBarreMax,
      py,
    );
    ctx.textAlign = "left";

    const totalSeg = segments.reduce((s, seg) => s + seg.valeur, 0) || 1;
    let xCursor = 60;
    const yBarre = py + 14;
    for (const seg of segments) {
      if (seg.valeur <= 0) continue;
      const w = (seg.valeur / totalSeg) * largeurBarreMax;
      ctx.fillStyle = seg.couleur;
      ctx.fillRect(xCursor, yBarre, Math.max(w, 1), 18);
      xCursor += w;
    }
    py += hauteurParPraticien;
  };

  for (const p of etat.praticiens) {
    const e = r.empreintesPraticiens.find((x) => x.id === p.id);
    const segments = [
      { valeur: e.partLocal, couleur: PALETTE_POSTES.local },
      { valeur: e.partPatientele, couleur: PALETTE_POSTES.patientele },
      { valeur: e.partDeplacementsPro, couleur: PALETTE_POSTES.deplacements },
      { valeur: e.partAlimentation, couleur: PALETTE_POSTES.alimentation },
      { valeur: e.partPrescriptions || 0, couleur: PALETTE_POSTES.prescriptions },
      { valeur: e.partImmobilisations, couleur: PALETTE_POSTES.immobilisations },
      { valeur: e.partSupport, couleur: PALETTE_POSTES.support },
    ];
    const ratio = p.nbActesAnnuel > 0 ? e.total / p.nbActesAnnuel : null;
    dessinerLignePraticien(nomsPraticiensAffiche[p.id], segments, e.total, ratio);
  }

  const segmentsAdmin = [
    { valeur: r.empreinteStaffAdmin.partLocal, couleur: PALETTE_POSTES.local },
    { valeur: r.empreinteStaffAdmin.partDeplacements, couleur: PALETTE_POSTES.deplacements },
    { valeur: r.empreinteStaffAdmin.partImmobilisations, couleur: PALETTE_POSTES.immobilisations },
  ];
  dessinerLignePraticien("Fonctions support (MSP)", segmentsAdmin, r.empreinteStaffAdmin.total, null);

  // Pied de page
  ctx.font = "400 13px Inter, sans-serif";
  ctx.fillStyle = "#8A9490";
  ctx.fillText(
    "Estimation d'ordre de grandeur — méthodologie inspirée de kinéCO2 (Lib&CO2, Carbone 4). Généré par Lib&CO2 MSP.",
    60,
    H - 40,
  );

  return canvas;
}

/**
 * Génère l'affiche PNG du bilan et la propose au téléchargement ; signale
 * dans la page s'il faut d'abord calculer le bilan.
 */
export async function exporterAffiche() {
  const zoneStatut = document.getElementById("affiche-statut");
  const etat = getEtat();
  if (!etat.dernierResultat) {
    if (zoneStatut) {
      zoneStatut.textContent = 'Calculez d\'abord le bilan (bouton "Calculer le bilan" en haut de cet écran).';
      zoneStatut.classList.add("aide-alerte");
    }
    return;
  }
  if (zoneStatut) {
    zoneStatut.classList.remove("aide-alerte");
    zoneStatut.textContent = "Génération de l'affiche en cours...";
  }
  const canvas = await genererCanvasAffiche(etat);
  if (!canvas) return;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    const dateDuJour = new Date().toISOString().slice(0, 10);
    lien.href = url;
    lien.download = `libco2-msp-affiche-${dateDuJour}.png`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
    if (zoneStatut) zoneStatut.textContent = "Image téléchargée — prête à imprimer ou à afficher.";
  }, "image/png");
}
