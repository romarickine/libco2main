/**
 * ui/ecran-actions.js — pistes d'action (étape 7)
 * ---------------------------------------------------------------------------
 * Catalogue d'actions commun (avec les libellés propres à une MSP) et
 * actions spécifiques MSP, estimation du gain de chaque action cochée.
 *
 * Utilisé par : ui-msp.js, export/plan-actions-rtf.js.
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { ACTIONS, CATEGORIES_META } from "../../../shared/js/data/facteurs-emission.js";
import { ACTIONS_MSP_SUPPLEMENTAIRES, LIBELLES_ACTIONS_MSP } from "../data/facteurs-emission-msp.js";
import { fmt } from "./commun.js";
import { rendrePiedNavigation } from "../ui-msp.js";
import { svgJaugeDemiCercle } from "./graphiques-svg.js";

// ---------------------------------------------------------------------------
// ÉCRAN 7 — Solutions (catalogue d'actions de décarbonation, repris du socle
// individuel — ACTIONS/CATEGORIES_META — complété des actions propres à la
// MSP, ex. coordination du parcours de soins). Certains postes n'ont pas
// d'équivalent isolé dans le calcul MSP (numérique à part) : leur potentiel
// reste affiché à titre indicatif, non chiffré.
export const TOUTES_ACTIONS = [
  ...ACTIONS.map((a) => ({ ...a, ...LIBELLES_ACTIONS_MSP[a.id] })),
  ...ACTIONS_MSP_SUPPLEMENTAIRES,
];

function assurerActionsChoix(etat) {
  if (!etat.actionsChoix) etat.actionsChoix = {};
  for (const a of TOUTES_ACTIONS) {
    if (!etat.actionsChoix[a.id]) {
      etat.actionsChoix[a.id] = {
        active: false,
        valeur: a.unit === "degres" ? a.defaultDegres || 1 : (a.defaultPct ?? 50),
      };
    }
  }
}

/**
 * Émissions du poste sur lequel porte une action, dans le résultat MSP.
 * @param {object|null} r  Résultat de calculBilanMSP.
 * @param {string} posteId  Poste de l'action (ex. "deplacements_pro", "local").
 * @returns {number|null} kgCO2e/an ; null si le poste n'est pas isolé dans MSP (numérique).
 */
export function valeurPosteMSP(r, posteId) {
  if (!r) return null;
  switch (posteId) {
    case "deplacements_pro":
      return r.parPoste.domicileTravail.usageTotal + r.parPoste.domicileTravail.fabricationVehiculeTotal;
    case "deplacements_patientele":
      return r.parPoste.patientele.total;
    case "local":
      return r.parPoste.local.total;
    case "services":
      return r.parPoste.support.services;
    case "fret":
      return r.parPoste.support.fret;
    case "materiel":
      return r.parPoste.support.materielSecretariat;
    case "alimentation":
      return r.parPoste.alimentation.total;
    default:
      return null; // numerique : non isolé dans l'outil MSP
  }
}

/**
 * Gain estimé d'une action : part maximale de réduction du poste × taux de
 * déploiement choisi (ou degrés de chauffage abaissés).
 * @param {object} action  Élément du catalogue (maxReduction, maxReductionParDegre, unit).
 * @param {{valeur: number}} choix  Pourcentage de déploiement ou nombre de degrés.
 * @param {number|null} valeurPoste  kgCO2e/an du poste visé.
 * @returns {number|null} kgCO2e/an évités.
 */
export function reductionEstimee(action, choix, valeurPoste) {
  if (valeurPoste == null) return null;
  if (action.unit === "degres") return valeurPoste * action.maxReductionParDegre * (choix.valeur || 0);
  return valeurPoste * action.maxReduction * ((choix.valeur ?? action.defaultPct) / 100);
}

/**
 * Écran des pistes d'action : actions regroupées par poste, avec leur gain
 * estimé et le total du plan choisi.
 * @param {object} etat
 * @returns {string} HTML
 */
export function rendreSolutions(etat) {
  assurerActionsChoix(etat);
  const r = etat.dernierResultat;

  const groupes = {};
  for (const a of TOUTES_ACTIONS) {
    if (!groupes[a.poste]) groupes[a.poste] = [];
    groupes[a.poste].push(a);
  }

  let totalReduction = 0;
  const actionsCochees = [];
  for (const a of TOUTES_ACTIONS) {
    const choix = etat.actionsChoix[a.id];
    if (!choix.active) continue;
    actionsCochees.push(a);
    const red = reductionEstimee(a, choix, valeurPosteMSP(r, a.poste));
    if (red) totalReduction += red;
  }
  const pctEngagement = r && r.empreinteTotale > 0 ? Math.min((totalReduction / r.empreinteTotale) * 100, 30) : 0;
  const paliers =
    pctEngagement < 5 ? "Pas encore engagé" : pctEngagement < 15 ? "Trajectoire 1 an" : "Trajectoire 3 ans et plus";

  return `
  <section class="ecran">
    <h2>7. Pistes d'action</h2>
    ${!r ? '<p class="alerte">Calculez d\'abord le bilan (écran "Résultats") pour voir l\'impact chiffré de chaque action.</p>' : ""}
    <p class="aide">Cochez les actions envisagées par la structure. Le poste numérique n'est pas isolé dans le calcul MSP (fondu dans les immobilisations) — son potentiel reste indicatif.</p>

    ${
      r
        ? `
    <div class="carte">
      <h3 class="carte-titre">Jauge d'engagement — trajectoire Accord de Paris</h3>
      <p class="aide">Situe le plan d'action coché par rapport à une trajectoire de réduction de -5%/an, plafonnée à 30% (au-delà, la structure doit surtout se concentrer sur le déploiement réel plutôt que sur l'ajout de nouvelles actions cochées).</p>
      ${svgJaugeDemiCercle(pctEngagement)}
      <div class="chiffres-cles">
        <div class="chiffre-cle">
          <span class="chiffre-cle-valeur">${fmt(totalReduction)}</span>
          <span class="chiffre-cle-unite">kgCO2e/an évités</span>
          <span class="chiffre-cle-label">Potentiel des actions cochées</span>
        </div>
        <div class="chiffre-cle">
          <span class="chiffre-cle-valeur">${pctEngagement.toFixed(1)}%</span>
          <span class="chiffre-cle-unite">de l'empreinte totale</span>
          <span class="chiffre-cle-label">${paliers}</span>
        </div>
      </div>
    </div>`
        : ""
    }

    <div class="carte">
      <h3 class="carte-titre">Document de suivi éditable</h3>
      <p class="aide">Reprend les actions cochées ci-dessous avec un objectif à 1 an, prêt à imprimer ou à modifier directement dans Word/LibreOffice — pour un point d'avancement en réunion, à remplir au fil du temps (dates, statuts, notes).</p>
      <button data-action="telecharger-plan-actions" class="bouton-principal" ${!r || actionsCochees.length === 0 ? "disabled" : ""}>Télécharger le plan de décarbonation</button>
      ${actionsCochees.length === 0 ? '<p class="aide" style="margin-top:0.6rem">Cochez au moins une action ci-dessous pour activer le téléchargement.</p>' : ""}
    </div>

    ${Object.entries(groupes)
      .map(([posteId, actions]) => rendreGroupeActions(etat, posteId, actions, r))
      .join("")}
    ${rendrePiedNavigation(etat)}
  </section>`;
}

function rendreGroupeActions(etat, posteId, actions, r) {
  const meta = CATEGORIES_META[posteId];
  const valeurPoste = valeurPosteMSP(r, posteId);
  return `
  <div class="carte">
    <h3 class="carte-titre" style="color:color-mix(in srgb, ${meta.color} 70%, #000)">${meta.label}</h3>
    ${valeurPoste == null ? '<p class="aide">Poste non isolé dans le calcul MSP — potentiel de réduction indicatif uniquement.</p>' : ""}
    ${actions.map((a) => rendreActionCard(etat, a, valeurPoste)).join("")}
  </div>`;
}

function rendreActionCard(etat, action, valeurPoste) {
  const choix = etat.actionsChoix[action.id];
  const sourcee = action.source.startsWith("SOURCÉ");
  const reduction = choix.active ? reductionEstimee(action, choix, valeurPoste) : null;
  return `
  <div class="carte-action">
    <label class="action-entete">
      <input type="checkbox" data-path="actionsChoix.${action.id}.active" ${choix.active ? "checked" : ""}>
      <span>${action.titre}</span>
    </label>
    <div class="action-badges">
      <span class="badge ${sourcee ? "badge-source" : "badge-estime"}">${sourcee ? "Sourcé" : "Estimé"}</span>
      <span class="badge badge-cout">${action.cost}</span>
    </div>
    ${
      choix.active
        ? `
      <div class="action-curseur">
        <label>${action.unit === "degres" ? "Nombre de degrés ajustés" : "Part de déploiement (%)"}
          <input type="number" min="0" max="${action.unit === "degres" ? 5 : 100}" data-path="actionsChoix.${action.id}.valeur" value="${choix.valeur}">
        </label>
        ${reduction != null ? `<p class="action-reduction">≈ ${fmt(reduction)} kgCO2e/an évités</p>` : '<p class="aide">Potentiel non chiffrable ici (poste non isolé dans l\'outil MSP).</p>'}
      </div>`
        : ""
    }
    <p class="aide">${action.source}</p>
  </div>`;
}
