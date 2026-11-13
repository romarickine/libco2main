/**
 * ui/ecran-actions.js — pistes d'action (étape 7)
 * ---------------------------------------------------------------------------
 * Catalogue d'actions commun (avec les libellés propres à une MSP) et
 * actions spécifiques MSP, estimation du gain de chaque action cochée.
 *
 * Utilisé par : ui-msp.js, export/plan-actions-rtf.js.
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { ACTIONS, CATEGORIES_META, COST_LABELS, FE_TRANSPORT } from "../../../shared/js/data/facteurs-emission.js";
import { gainPartConcernee, reductionPlan } from "../../../shared/js/plan-actions.js";
import { ACTIONS_MSP_SUPPLEMENTAIRES, LIBELLES_ACTIONS_MSP, FACTEURS_VEHICULES_USAGE_FABRICATION } from "../data/facteurs-emission-msp.js";
import { fmt } from "./commun.js";
import { echapperHtml } from "../../../shared/js/echappement.js";
import { lienContact } from "../../../shared/js/contact.js";
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
      // Usage + fabrication : les gains des actions de déplacement sont
      // calculés avec les facteurs complets (une voiture évitée n'est pas
      // fabriquée), même si la fabrication est présentée en immobilisations.
      return r.parPoste.domicileTravail.usageTotal + r.parPoste.domicileTravail.fabricationVehiculeTotal;
    case "deplacements_patientele":
      return r.parPoste.patientele.total;
    case "local":
      // Énergie seulement : la construction du bâtiment est une immobilisation.
      return r.parPoste.local.emissionsEnergie;
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
 * Contexte du plan d'action (shared/js/plan-actions.js) tiré du résultat MSP :
 * kilomètres par mode, chauffage du local. null pour un résultat calculé avant
 * le 12/11/2026 (sans ce détail) : les actions gardent alors l'ancien calcul.
 */
export function contexteActionsMSP(r) {
  const parts = r && r.parPoste.domicileTravail.parts;
  if (!parts) return null;
  return {
    // Voitures : usage + fabrication, comme dans le bilan MSP.
    fe: (mode) => FACTEURS_VEHICULES_USAGE_FABRICATION[mode]?.total ?? FE_TRANSPORT[mode]?.value ?? 0,
    quotidien: parts.quotidien,
    congres: parts.congres,
    chauffageKg: r.parPoste.local.chauffage || 0,
    energieChauffage: r.parPoste.local.energieChauffage,
  };
}

// Part touchée par une action : sous-partie du local (chauffage, électricité)
// ou poste entier. Le numérique n'est pas isolé dans MSP.
function cleAction(a) {
  return a.unit === "degres" ? "localChauffage" : a.detailKey || a.poste;
}
function valeurPartMSP(r, cle) {
  if (!r) return null;
  if (cle === "localChauffage") return r.parPoste.local.chauffage ?? r.parPoste.local.total;
  if (cle === "localElec") return r.parPoste.local.elec ?? r.parPoste.local.total;
  if (cle === "numUsage") return null;
  return valeurPosteMSP(r, cle);
}

/**
 * Gain estimé d'une action (kgCO2e/an évités), sur la seule part qu'elle
 * concerne (décision du porteur, 12/11/2026) : trajets par mode pour les
 * déplacements, chauffage au gaz ou au fioul pour la pompe à chaleur,
 * chauffage ou électricité pour les autres actions du local ; sinon le poste.
 * @param {object} action  Élément du catalogue.
 * @param {{valeur: number}} choix  Pourcentage de déploiement ou nombre de degrés.
 * @param {object|null} r  Résultat de calculBilanMSP.
 * @param {number} [valeurForcee]  Remplace choix.valeur (gain à plein déploiement).
 * @returns {number|null} null si le poste n'est pas isolé dans MSP.
 */
export function reductionEstimee(action, choix, r, valeurForcee) {
  if (!r) return null;
  const valeur = valeurForcee ?? (action.unit === "degres" ? choix.valeur || 0 : (choix.valeur ?? action.defaultPct));
  const ctx = contexteActionsMSP(r);
  const specifique = ctx ? gainPartConcernee(action.id, ctx) : null;
  if (specifique) return specifique.gainParPct * valeur;
  const base = valeurPartMSP(r, ctx ? cleAction(action) : action.poste);
  if (base == null) return null;
  if (action.unit === "degres") return base * action.maxReductionParDegre * valeur;
  return base * action.maxReduction * (valeur / 100);
}

/**
 * Une action est-elle proposée ? Non si elle n'apporte aucun gain à plein
 * déploiement (décision du porteur, 12/11/2026) ; oui sans bilan calculé ou
 * pour un poste non isolé (potentiel indicatif).
 */
export function actionProposee(action, r) {
  if (!r) return true;
  const max = reductionEstimee(action, {}, r, action.unit === "degres" ? 5 : 100);
  return max == null || max > 0;
}

/**
 * Total du plan sans double comptage : les actions cochées qui touchent les
 * mêmes émissions s'appliquent l'une après l'autre sur ce qui reste.
 * @param {object[]} actionsCochees @param {object} actionsChoix @param {object|null} r
 * @returns {number} kgCO2e/an
 */
export function totalReductionPlanMSP(actionsCochees, actionsChoix, r) {
  if (!r) return 0;
  const ctx = contexteActionsMSP(r);
  const liste = actionsCochees
    .map((a) => {
      const choix = actionsChoix[a.id];
      const red = reductionEstimee(a, choix, r);
      return red == null ? null : { ...a, potentielKg: red, pct: choix.valeur ?? a.defaultPct, cle: ctx ? cleAction(a) : a.poste };
    })
    .filter(Boolean);
  if (!ctx) return liste.reduce((s, a) => s + a.potentielKg, 0);
  return reductionPlan(liste, ctx, (cle) => valeurPartMSP(r, cle) || 0);
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
    // Actions sans gain (déjà en voiture électrique, chauffage déjà
    // électrique…) : non proposées.
    if (!actionProposee(a, r)) continue;
    if (!groupes[a.poste]) groupes[a.poste] = [];
    groupes[a.poste].push(a);
  }

  const actionsCochees = TOUTES_ACTIONS.filter((a) => etat.actionsChoix[a.id].active && actionProposee(a, r));
  const totalReduction = totalReductionPlanMSP(actionsCochees, etat.actionsChoix, r);
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
      ${actionsCochees.length === 0 ? '<p class="aide" data-style="margin-top:0.6rem">Cochez au moins une action ci-dessous pour activer le téléchargement.</p>' : ""}
    </div>

    ${Object.entries(groupes)
      .map(([posteId, actions]) => rendreGroupeActions(etat, posteId, actions, r))
      .join("")}
    <div class="carte carte-accompagnement">
      <h3 class="carte-titre">Mettre en œuvre le plan, accompagnés</h3>
      <p class="aide">Pour fiabiliser ce bilan avec les données réelles de la structure, animer le plan d'action avec l'équipe ou organiser un atelier, Lib&CO2 peut vous accompagner. Un premier échange est sans engagement.</p>
      <a class="bouton-principal" href="${echapperHtml(
        lienContact(
          "diagnostic",
          r ? [`Résultat de notre estimation Lib&CO2 MSP : ${fmt(r.empreinteTotale)} kgCO2e/an${actionsCochees.length ? `, ${actionsCochees.length} action(s) envisagée(s)` : ""}.`] : [],
        ),
      )}">Écrire à Lib&CO2</a>
      <p class="aide" data-style="margin-top:0.6rem">Votre messagerie s'ouvre avec une trame pré-remplie : vous relisez et envoyez, ou non.</p>
    </div>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

function rendreGroupeActions(etat, posteId, actions, r) {
  const meta = CATEGORIES_META[posteId];
  const valeurPoste = valeurPosteMSP(r, posteId);
  return `
  <div class="carte">
    <h3 class="carte-titre" data-style="color:color-mix(in srgb, ${meta.color} 70%, #000)">${meta.label}</h3>
    ${valeurPoste == null ? '<p class="aide">Poste non isolé dans le calcul MSP — potentiel de réduction indicatif uniquement.</p>' : ""}
    ${actions.map((a) => rendreActionCard(etat, a, r)).join("")}
  </div>`;
}

function rendreActionCard(etat, action, r) {
  const choix = etat.actionsChoix[action.id];
  const sourcee = action.source.startsWith("SOURCÉ");
  const reduction = choix.active ? reductionEstimee(action, choix, r) : null;
  return `
  <div class="carte-action">
    <label class="action-entete">
      <input type="checkbox" data-path="actionsChoix.${action.id}.active" ${choix.active ? "checked" : ""}>
      <span>${action.titre}</span>
    </label>
    <div class="action-badges">
      <span class="badge ${sourcee ? "badge-source" : "badge-estime"}">${sourcee ? "Sourcé" : "Estimé"}</span>
      <span class="badge badge-cout">${COST_LABELS[action.cost]}</span>
    </div>
    ${
      choix.active
        ? `
      <div class="action-curseur">
        <label>${action.unit === "degres" ? "Nombre de degrés ajustés" : "Part de déploiement (% de la part concernée)"}
          <input type="number" min="0" max="${action.unit === "degres" ? 5 : 100}" data-path="actionsChoix.${action.id}.valeur" value="${choix.valeur}">
        </label>
        ${reduction != null ? `<p class="action-reduction">≈ ${fmt(reduction)} kgCO2e/an évités</p>` : '<p class="aide">Potentiel non chiffrable ici (poste non isolé dans l\'outil MSP).</p>'}
      </div>`
        : ""
    }
    <p class="aide">${action.source}</p>
  </div>`;
}
