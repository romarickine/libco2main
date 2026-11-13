/**
 * plan-actions.js
 * ---------------------------------------------------------------------------
 * Rôle : gain des actions de décarbonation calculé sur la seule part qu'elles
 * concernent, et total d'un plan d'action sans double comptage. Commun à
 * Lib&CO2 Cab et MSP (décisions du porteur, 12/11/2026).
 *
 * - Part concernée : le gain de certaines actions ne porte que sur les
 *   kilomètres ou l'énergie qu'elles peuvent réduire, avec les facteurs
 *   d'émission de l'outil. Une action sans objet (déjà en voiture électrique,
 *   congrès en train pour le covoiturage, chauffage déjà électrique pour la
 *   pompe à chaleur…) a un gain nul et n'est pas proposée.
 * - Pas de double comptage : les actions cochées qui touchent les mêmes
 *   émissions s'appliquent l'une après l'autre sur ce qui reste.
 *
 * Contexte attendu (ctx), préparé par chaque outil à partir de son résultat :
 *   fe(mode)          facteur d'émission d'un mode (kgCO2e/km)
 *   quotidien         [{ km, mode }] trajets domicile-travail, visites, tournées (km/an)
 *   congres           [{ km, mode }] congrès, formations, réunions (km/an)
 *   chauffageKg       émissions du chauffage du local (kgCO2e/an)
 *   energieChauffage  énergie de chauffage (« gaz », « fioul », « pac »…)
 *
 * Utilisé par : cab/js/calcul.js, msp/js/ui/ecran-actions.js.
 */

const MODES_MOTORISES_INDIVIDUELS = new Set(["voiture_thermique", "voiture_hybride", "voiture_electrique", "deux_roues"]);
const MODES_VOITURE_A_ELECTRIFIER = new Set(["voiture_thermique", "voiture_hybride"]);
const MODES_VOITURE = new Set(["voiture_thermique", "voiture_hybride", "voiture_electrique"]);
// Part adressable des trajets du quotidien reportables sur le vélo (dp1) et
// réduction par la visio (dp4) : mêmes valeurs que les sources de ces actions
// (facteurs-emission.js), appliquées à la part concernée.
const PART_ADRESSABLE_VELO = 0.5;
const REDUCTION_VISIO = 0.94 * 0.4;
const REDUCTION_COVOITURAGE = 0.5;
const REDUCTION_PAC = 0.5;

const somme = (liste, f) => liste.reduce((s, x) => s + f(x), 0);

/**
 * Part concernée par une action et gain pour 1 % de déploiement.
 * @returns {{base: number, gainParPct: number}|null} null : action calculée sur son poste entier.
 */
export function gainPartConcernee(id, ctx) {
  const fe = ctx.fe;
  const quotidien = ctx.quotidien || [];
  const congres = ctx.congres || [];
  switch (id) {
    case "dp1": {
      // Vélo : trajets du quotidien faits en voiture ou en deux-roues motorisé.
      const motorises = quotidien.filter((t) => MODES_MOTORISES_INDIVIDUELS.has(t.mode));
      return {
        base: somme(motorises, (t) => t.km * fe(t.mode)),
        gainParPct: somme(motorises, (t) => t.km * (fe(t.mode) - fe("velo_elec")) * PART_ADRESSABLE_VELO) / 100,
      };
    }
    case "dp2": {
      // Covoiturage : congrès faits en voiture ; à deux, moitié des émissions.
      const base = somme(
        congres.filter((t) => MODES_VOITURE.has(t.mode)),
        (t) => t.km * fe(t.mode),
      );
      return { base, gainParPct: (base * REDUCTION_COVOITURAGE) / 100 };
    }
    case "dp3": {
      // Électrification : km en voiture thermique ou hybride, écart avec la
      // voiture électrique.
      const voitures = [...quotidien, ...congres].filter((t) => MODES_VOITURE_A_ELECTRIFIER.has(t.mode));
      return {
        base: somme(voitures, (t) => t.km * fe(t.mode)),
        gainParPct: somme(voitures, (t) => t.km * (fe(t.mode) - fe("voiture_electrique"))) / 100,
      };
    }
    case "dp4": {
      // Visioconférence : congrès seulement, quel que soit le mode.
      const base = somme(congres, (t) => t.km * fe(t.mode));
      return { base, gainParPct: (base * REDUCTION_VISIO) / 100 };
    }
    case "lo2": {
      // Pompe à chaleur : seulement si le chauffage est au gaz ou au fioul.
      const e = ctx.energieChauffage;
      const base = e === "gaz" || e === "fioul" ? ctx.chauffageKg || 0 : 0;
      return { base, gainParPct: (base * REDUCTION_PAC) / 100 };
    }
    default:
      return null;
  }
}

/**
 * Réduction totale d'un plan d'action, sans double comptage.
 * Déplacements professionnels : simulés trajet par trajet (vélo, puis
 * électrification de ce qui reste en voiture ; visio, puis covoiturage et
 * électrification des congrès restants). Ailleurs : actions groupées par part
 * touchée (cle), réduction = base × (1 − Π (1 − r)), r étant la part de la
 * base que chaque action retire seule.
 * @param {Array<{id, poste, potentielKg, pct, cle}>} cochees  actions cochées
 *   (cle : part touchée ; pct : déploiement en %).
 * @param {object} ctx  voir l'en-tête.
 * @param {(cle: string) => number} baseDe  émissions de la part touchée (kgCO2e/an).
 * @returns {number} kgCO2e/an évités.
 */
export function reductionPlan(cochees, ctx, baseDe) {
  let total = 0;
  const groupes = new Map();
  const dp = new Map();
  for (const a of cochees) {
    if (!(a.potentielKg > 0)) continue;
    if (a.poste === "deplacements_pro" && gainPartConcernee(a.id, ctx)) {
      dp.set(a.id, a);
      continue;
    }
    if (!groupes.has(a.cle)) groupes.set(a.cle, { base: baseDe(a.cle) || 0, reste: 1 });
    const g = groupes.get(a.cle);
    if (g.base > 0) g.reste *= Math.max(0, 1 - a.potentielKg / g.base);
  }
  for (const g of groupes.values()) total += g.base * (1 - g.reste);
  if (dp.size) total += reductionDeplacementsPro(ctx, dp);
  return total;
}

function reductionDeplacementsPro(ctx, dp) {
  const fe = ctx.fe;
  const part = (id) => (dp.has(id) ? dp.get(id).pct / 100 : 0);
  let avant = 0,
    apres = 0;
  // Quotidien : une part passe au vélo électrique (dp1), puis ce qui reste en
  // voiture thermique ou hybride est électrifié en partie (dp3).
  for (const t of ctx.quotidien || []) {
    const f = fe(t.mode);
    avant += t.km * f;
    if (!MODES_MOTORISES_INDIVIDUELS.has(t.mode)) {
      apres += t.km * f;
      continue;
    }
    const kmVelo = t.km * PART_ADRESSABLE_VELO * part("dp1");
    const kmRestants = t.km - kmVelo;
    const kmElectrifies = MODES_VOITURE_A_ELECTRIFIER.has(t.mode) ? kmRestants * part("dp3") : 0;
    apres += kmVelo * fe("velo_elec") + kmElectrifies * fe("voiture_electrique") + (kmRestants - kmElectrifies) * f;
  }
  // Congrès : une part remplacée par la visio (dp4), puis, en voiture, le
  // reste covoituré en partie (dp2) et électrifié en partie (dp3).
  for (const t of ctx.congres || []) {
    const kg = t.km * fe(t.mode);
    avant += kg;
    let reste = kg * (1 - REDUCTION_VISIO * part("dp4"));
    if (MODES_VOITURE.has(t.mode)) {
      reste *= 1 - REDUCTION_COVOITURAGE * part("dp2");
      if (MODES_VOITURE_A_ELECTRIFIER.has(t.mode)) {
        reste *= 1 - part("dp3") * (1 - fe("voiture_electrique") / fe(t.mode));
      }
    }
    apres += reste;
  }
  return avant - apres;
}
