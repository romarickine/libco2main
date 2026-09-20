// ==========================================================================
// Modèles de vitesse selon la pente, tirés de la littérature
// ==========================================================================

// Tobler (1993) : W = 6*exp(-3.5*|pente+0.05|) km/h — référence quasi universelle
// pour la vitesse de marche en fonction de la pente (ArcGIS, GRASS GIS r.walk).
export function toblerWalkingSpeed(grade) { return 6 * Math.exp(-3.5 * Math.abs(grade + 0.05)); }

// Modèle hybride, calibré sur une vraie donnée de terrain (montée Place Albert
// Thomas -> la Métare à Saint-Étienne : ~3.5 km, 150 m D+, ~10.5 km/h à effort
// soutenu sur ~4.3% de pente moyenne).
//
// En montée : Parkin & Rotheram (2010), une régression LINÉAIRE (km/h perdu
// par point de %), s'est révélée bien trop optimiste sur une côte soutenue —
// elle prédisait 17.9 km/h à 4.3% de pente, près du double de la réalité même
// à effort maximal. La vraie physique du vélo est non linéaire : en montée,
// la puissance nécessaire pour vaincre la gravité augmente pendant que celle
// nécessaire pour vaincre l'air chute avec le cube de la vitesse — l'équilibre
// se déplace brutalement. On résout donc la vitesse par un modèle physique
// (résistance au roulement + traînée + gravité, résolu par bissection), avec
// une puissance qui augmente progressivement avec la pente jusqu'à un plafond
// (un cycliste réel pousse plus fort en côte, jusqu'à un maximum soutenable) :
// calibrée à 78 W à plat (déduit de la vitesse Parkin-Rotheram de 21.6 km/h)
// jusqu'à 130 W au point de calibration réel (4.3%, 10.5 km/h).
//
// Pour le VAE, la puissance est celle du système complet (cycliste + moteur),
// calibrée à 111 W à plat pour tenir 25 km/h (limite légale d'assistance) et
// montant jusqu'à 300 W (~250 W de moteur, plafond légal, + effort modéré du
// cycliste) — un VAE reste donc nettement moins pénalisé par la pente qu'un
// vélo classique, conformément à l'usage réel.
//
// En descente, faute de donnée réelle de calibration, on garde la régression
// linéaire de Parkin & Rotheram (+1.44 km/h/% pour le vélo classique, +0.48
// pour le VAE) qui n'a pas été mise en cause.
function solvePowerSpeed(power, grade) {
  const mass = 90, g = 9.81, crr = 0.005, cda = 0.4, rho = 1.2;
  const linearTerm = crr * mass * g + mass * g * grade;
  const f = (v) => linearTerm * v + 0.5 * rho * cda * v ** 3 - power;
  let lo = 0, hi = 50;
  while (f(hi) < 0 && hi < 2000) { hi *= 2; }
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) { lo = mid; } else { hi = mid; } }
  return (lo + hi) / 2;
}

// Valeurs figées, calibrées sur le trajet réel Place Albert Thomas -> la
// Métare (Saint-Étienne : ~3.5 km, 150 m D+, ~10.5 km/h à effort soutenu sur
// ~4.3% de pente moyenne). Pas de recalibration possible depuis l'application.
// BIKE_MAX_POWER est plafonnée à 250W : puissance maximale soutenable par un
// cycliste moyen (au-delà, un cycliste réel descend de vélo et le pousse à
// pied plutôt que de continuer à pédaler à puissance croissante indéfiniment).
const BIKE_MAX_POWER_CEILING = 250;
const BIKE_FLAT_POWER = 78.3, BIKE_MAX_POWER = 129.6, BIKE_RAMP_GRADE_REF = 4.3;
const EBIKE_FLAT_POWER = 111.0, EBIKE_MAX_POWER = 300, EBIKE_RAMP_GRADE_REF = 4.3;

// Vitesse "vélo à la main" (descendu de vélo, poussé) : reprend la vitesse de
// marche (Tobler) avec une pénalité modérée pour l'encombrement du vélo poussé.
function walkingBikeSpeed(grade) {
  return toblerWalkingSpeed(grade) * 0.85;
}

export function parkinRotheramCyclingSpeed(grade, isElectric) {
  const gradePercent = grade * 100;
  if (gradePercent >= 0) {
    const flatPower = isElectric ? EBIKE_FLAT_POWER : BIKE_FLAT_POWER;
    const maxPower = isElectric ? EBIKE_MAX_POWER : Math.min(BIKE_MAX_POWER, BIKE_MAX_POWER_CEILING);
    const rampRef = isElectric ? EBIKE_RAMP_GRADE_REF : BIKE_RAMP_GRADE_REF;
    const ramp = (maxPower - flatPower) / rampRef;
    const power = Math.min(maxPower, flatPower + ramp * gradePercent);
    const cyclingSpeed = solvePowerSpeed(power, grade) * 3.6;
    // Un cycliste rationnel choisit la solution la plus rapide : pédaler, ou
    // descendre et pousser le vélo — sans ce choix, le modèle continuerait à
    // ramper artificiellement vers un plancher de sécurité au lieu de refléter
    // un comportement réel. Plancher minimal (0.5 km/h) purement numérique,
    // pour éviter une vitesse nulle/négative sur une pente aberrante — il ne
    // doit jamais dominer le vrai croisement entre les deux vitesses.
    return Math.max(0.5, cyclingSpeed, walkingBikeSpeed(grade));
  }
  const flatSpeed = isElectric ? 25 : 21.6;
  const downCoeff = isElectric ? 0.48 : 1.44;
  // Plafond de 50 km/h : au-delà, la régression linéaire de Parkin & Rotheram
  // (non calibrée sur une vraie descente, cf. commentaire plus haut) devient
  // irréaliste — un cycliste freine bien avant d'atteindre une telle vitesse,
  // pour des raisons de sécurité et de confort, quelle que soit la pente.
  return Math.min(50, Math.max(3, flatSpeed + downCoeff * Math.abs(gradePercent)));
}

// Vitesses voiture par défaut selon la nature du tronçon BD TOPO® (utilisées
// seulement si l'attribut vitesse_moyenne_vl est absent — cet attribut donne
// normalement une vitesse déjà calculée par l'IGN tronçon par tronçon, plus
// fiable qu'une table générique par type de voie).
export const BDTOPO_DEFAULT_SPEED = {
  'Type autoroutier': 110, 'Route à 2 chaussées': 90, 'Route à 1 chaussée': 70,
  'Route empierrée': 30, 'Chemin': 10, 'Bretelle': 50, 'Rond-point': 30,
};
export const BDTOPO_DEFAULT_SPEED_FALLBACK = 50;
// Natures exclues pour la voiture (chemins, sentiers, pistes cyclables...)
export const BDTOPO_CAR_EXCLUDED_NATURES = new Set(['Chemin', 'Sentier', 'Escalier', 'Piste cyclable']);
