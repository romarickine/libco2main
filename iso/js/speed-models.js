// ==========================================================================
// Modèles de vitesse selon la pente, tirés de la littérature
// ==========================================================================

// Tobler (1993) : W = 6*exp(-3.5*|pente+0.05|) km/h — référence quasi universelle
// pour la vitesse de marche en fonction de la pente (ArcGIS, GRASS GIS r.walk).
export function toblerWalkingSpeed(grade) {
  return 6 * Math.exp(-3.5 * Math.abs(grade + 0.05));
}

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
// calibrée à 106,7 W à plat pour 24,6 km/h (voir EBIKE_FLAT_POWER) et
// montant jusqu'à 300 W (~250 W de moteur, plafond légal, + effort modéré du
// cycliste ; valeur estimée, aucune mesure de vitesse VAE selon la pente
// exploitable trouvée le 09/11/2026, gardée par choix du porteur) — un VAE reste donc nettement moins pénalisé par la pente qu'un
// vélo classique, conformément à l'usage réel.
//
// En descente, faute de donnée réelle de calibration, on garde la régression
// linéaire de Parkin & Rotheram (+0,86 km/h par point de pente, vélo et VAE,
// voir parkinRotheramCyclingSpeed).
function solvePowerSpeed(power, grade) {
  const mass = 90,
    g = 9.81,
    crr = 0.005,
    cda = 0.4,
    rho = 1.2;
  const linearTerm = crr * mass * g + mass * g * grade;
  const f = (v) => linearTerm * v + 0.5 * rho * cda * v ** 3 - power;
  let lo = 0,
    hi = 50;
  while (f(hi) < 0 && hi < 2000) {
    hi *= 2;
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

// Valeurs figées, calibrées sur le trajet réel Place Albert Thomas -> la
// Métare (Saint-Étienne : ~3.5 km, 150 m D+, ~10.5 km/h à effort soutenu sur
// ~4.3% de pente moyenne). Pas de recalibration possible depuis l'application.
// BIKE_MAX_POWER est plafonnée à 250W : puissance maximale soutenable par un
// cycliste moyen (au-delà, un cycliste réel descend de vélo et le pousse à
// pied plutôt que de continuer à pédaler à puissance croissante indéfiniment).
const BIKE_MAX_POWER_CEILING = 250;
const BIKE_FLAT_POWER = 78.3,
  BIKE_MAX_POWER = 129.6,
  BIKE_RAMP_GRADE_REF = 4.3;
// VAE à plat : 24,6 km/h = vitesse vélo de Parkin & Rotheram (21,6 km/h)
// × rapport VAE / vélo classique mesuré par Schleinitz et al. (2017, Safety
// Science 92, 290-297 : 17,4 / 15,3 km/h, seule étude trouvée qui mesure les
// deux dans les mêmes conditions). Choix du porteur, 09/11/2026 (auparavant
// 25 km/h, la vitesse de coupure légale de l'assistance). Puissance déduite
// par le même modèle physique : 106,7 W pour 24,6 km/h à plat.
const EBIKE_FLAT_POWER = 106.74,
  EBIKE_MAX_POWER = 300,
  EBIKE_RAMP_GRADE_REF = 4.3;

// Vitesse "vélo à la main" (descendu de vélo, poussé) : reprend la vitesse de
// marche (Tobler) avec une pénalité modérée pour l'encombrement du vélo poussé.
function walkingBikeSpeed(grade) {
  return toblerWalkingSpeed(grade) * 0.85;
}

/**
 * Vitesse à vélo selon la pente. En montée : modèle physique (roulement,
 * air, gravité) avec une puissance qui croît avec la pente jusqu'à un
 * plafond, et bascule sur la marche à côté du vélo si c'est plus rapide ; en
 * descente : régression de Parkin & Rotheram (2010), plafonnée à 50 km/h.
 * Calibré à 21,6 km/h sur le plat (24,6 km/h en VAE) et 10,5 km/h à 4,3 %.
 * @param {number} grade  Pente (0,05 = 5 %).
 * @param {boolean} isElectric  true pour un vélo à assistance électrique.
 * @returns {number} km/h.
 */
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
  const flatSpeed = isElectric ? 24.6 : 21.6;
  // Descente : +0,86 km/h par point de pente (Parkin & Rotheram 2010,
  // tableau 2 : +0,2379 m/s par 1 % de descente ; le 1,44 utilisé jusqu'au
  // 09/11/2026 était en fait leur coefficient de MONTÉE, −0,4002 m/s par 1 %).
  // Même coefficient pour le VAE : au-delà de 25 km/h l'assistance est
  // coupée (règlement (UE) n° 168/2013, art. 2.2 h), il descend comme un vélo
  // (l'ancien 0,48 n'avait pas de source).
  const downCoeff = 0.86;
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
  "Type autoroutier": 110,
  "Route à 2 chaussées": 90,
  "Route à 1 chaussée": 70,
  "Route empierrée": 30,
  Chemin: 10,
  Bretelle: 50,
  "Rond-point": 30,
};
export const BDTOPO_DEFAULT_SPEED_FALLBACK = 50;
// Natures exclues pour la voiture (chemins, sentiers, pistes cyclables...)
// Natures interdites à la marche et au vélo : les voies de type autoroutier.
// Relevé IGN du 01/10/2026 (WFS BDTOPO_V3:troncon_de_route, secteur de
// Vourles) : ces tronçons sont codés à 95-100 km/h, donc SOUS l'ancien seuil de
// 110 km/h, et leur attribut acces_pieton est vide (il n'est renseigné, à
// « Libre », que sur des routes ordinaires) : ni la vitesse ni cet attribut ne
// permettent de les écarter, seule la nature le fait.
export const BDTOPO_WALK_BIKE_EXCLUDED_NATURES = new Set(["Type autoroutier"]);
export const BDTOPO_CAR_EXCLUDED_NATURES = new Set(["Chemin", "Sentier", "Escalier", "Piste cyclable"]);
