/**
 * export/plan-actions-rtf.js — plan de décarbonation (document RTF)
 * ---------------------------------------------------------------------------
 * Document RTF (ouvrable dans Word ou LibreOffice) listant les actions
 * cochées et leur gain estimé.
 *
 * Utilisé par : ui/evenements.js (action « telecharger-plan-actions »).
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { CATEGORIES_META } from "../../../shared/js/data/facteurs-emission.js";
import { TOUTES_ACTIONS, reductionEstimee, valeurPosteMSP } from "../ui/ecran-actions.js";
import { fmt } from "../ui/commun.js";
import { getEtat } from "../main-msp.js";

// ---------------------------------------------------------------------------
// PLAN DE DÉCARBONATION (document éditable, format RTF) — reprend les
// actions cochées avec un objectif à 1 an, pensé comme support de réunion
// d'avancement réutilisable (dates, statuts et notes à remplir directement
// dans Word/LibreOffice, sans repasser par l'outil). RTF plutôt que .docx
// natif : format Word éditable généré en texte brut, sans bibliothèque
// externe requise (le .docx est une archive ZIP, trop complexe à produire
// de façon fiable sans dépendance) — ouverture et édition identiques pour
// l'utilisateur final.
function rtfEchappe(texte) {
  return String(texte ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
}

// Convertit tout caractère non-ASCII (accents, tirets typographiques...) en
// échappement Unicode RTF (\uNNNN?), appliqué en toute fin sur le document
// ENTIER (texte fixe du modèle + valeurs dynamiques confondus) — les mots de
// contrôle RTF (\rtf1, \cellx1600...) sont toujours en ASCII pur, donc cette
// passe globale ne peut jamais les corrompre, et garantit qu'aucun texte
// accentué tapé directement dans le modèle n'est oublié (contrairement à un
// échappement au cas par cas, propice à l'oubli sur les textes fixes).
function rtfVersUnicode(texteRTFComplet) {
  return texteRTFComplet
    .split("")
    .map((c) => {
      const code = c.codePointAt(0);
      return code > 127 ? `\\u${code}?` : c;
    })
    .join("");
}

function genererDocumentPlanActions(etat, actionsCochees, totalReduction) {
  const r = etat.dernierResultat;
  const nomStructure = etat.structureMSP.nom || "la structure";
  const dateDuJour = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  const empreinteActuelle = r.empreinteTotale;
  const objectifMoins5pct = empreinteActuelle * 0.95;
  const objectifPotentielActions = Math.max(empreinteActuelle - totalReduction, 0);
  const largeurCol = [1600, 4200, 2200, 2200, 1800, 4200]; // twips cumulés par colonne

  let cellx = 0;
  const bordCols = largeurCol.map((l) => {
    cellx += l;
    return cellx;
  });
  const ligneEntete = `{\\trowd\\trgaph108\\trleft0 ${bordCols.map((b) => `\\cellx${b}`).join("")}
${["#", "Action", "Poste", "Réduction visée (kgCO2e/an)", "Date de début", "Statut / notes"].map((t) => `\\intbl\\b ${rtfEchappe(t)}\\b0\\cell`).join(" ")} \\row}`;

  const lignesActions = actionsCochees
    .map((a, i) => {
      const choix = etat.actionsChoix[a.id];
      const red = reductionEstimee(a, choix, valeurPosteMSP(r, a.poste));
      return `{\\trowd\\trgaph108\\trleft0 ${bordCols.map((b) => `\\cellx${b}`).join("")}
\\intbl ${i + 1}\\cell \\intbl ${rtfEchappe(a.titre)}\\cell \\intbl ${rtfEchappe(CATEGORIES_META[a.poste]?.label || a.poste)}\\cell \\intbl ${red != null ? Math.round(red) : "\u2014"}\\cell \\intbl \\cell \\intbl \\cell \\row}`;
    })
    .join("\n");

  return rtfVersUnicode(`{\\rtf1\\ansi\\ansicpg1252\\deff0
{\\fonttbl{\\f0 Calibri;}}
\\f0\\fs22
{\\fs36\\b Plan de décarbonation — ${rtfEchappe(nomStructure)}\\b0\\fs22\\par}
{\\fs18\\i Généré le ${rtfEchappe(dateDuJour)} avec Lib&CO2 MSP — à relire et compléter en réunion.\\i0\\fs22\\par}
\\par
{\\fs28\\b Situation actuelle\\b0\\fs22\\par}
Empreinte totale : \\b ${fmt(empreinteActuelle / 1000)} tCO2e/an\\b0  (soit ${r.ratioParActe != null ? r.ratioParActe.toFixed(1) : "\u2014"} kgCO2e/acte en moyenne).\\par
\\par
{\\fs28\\b Objectif à 1 an\\b0\\fs22\\par}
Deux repères pour fixer un objectif chiffré à la structure :\\par
{\\pntext\\bullet\\tab}Trajectoire de référence (-5%/an, feuille de route nationale de décarbonation du système de santé) : \\b ${fmt(objectifMoins5pct / 1000)} tCO2e/an\\b0\\par
{\\pntext\\bullet\\tab}Potentiel cumulé des actions cochées ci-dessous, si toutes déployées à l'échéance retenue : \\b ${fmt(objectifPotentielActions / 1000)} tCO2e/an\\b0  (\u2212${fmt(totalReduction)} kgCO2e/an au total).\\par
\\par
{\\fs28\\b Actions retenues (${actionsCochees.length})\\b0\\fs22\\par}
${ligneEntete}
${lignesActions}
\\par
{\\fs28\\b Notes de réunion / prochaines étapes\\b0\\fs22\\par}
Date de la réunion : \\underline\\tab\\tab\\tab\\tab\\tab\\underline0\\par
\\par
\\underline                                                                                              \\underline0\\par
\\par
\\underline                                                                                              \\underline0\\par
\\par
\\underline                                                                                              \\underline0\\par
\\par
{\\fs16\\i Document généré à partir d'un bilan d'ordre de grandeur — ne constitue pas un audit carbone réglementaire.\\i0\\par}
}`);
}

/**
 * Télécharge le plan de décarbonation (document RTF) des actions cochées,
 * avec le gain estimé de chacune et le total. Ne fait rien sans bilan
 * calculé ni action cochée.
 */
export function telechargerPlanActions() {
  const etat = getEtat();
  const r = etat.dernierResultat;
  if (!r) return;
  const actionsCochees = TOUTES_ACTIONS.filter((a) => etat.actionsChoix?.[a.id]?.active);
  if (actionsCochees.length === 0) return;

  let totalReduction = 0;
  for (const a of actionsCochees) {
    const red = reductionEstimee(a, etat.actionsChoix[a.id], valeurPosteMSP(r, a.poste));
    if (red) totalReduction += red;
  }

  const rtf = genererDocumentPlanActions(etat, actionsCochees, totalReduction);
  const blob = new Blob([rtf], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  const dateDuJour = new Date().toISOString().slice(0, 10);
  const nomStructure = (etat.structureMSP.nom || "msp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  lien.href = url;
  lien.download = `plan-decarbonation-${nomStructure || "export"}-${dateDuJour}.rtf`;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}
