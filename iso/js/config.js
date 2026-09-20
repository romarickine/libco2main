// ==========================================================================
// Constantes figées, non réglables depuis l'interface.
// Modifier ces valeurs ici plutôt que d'exposer des champs de réglage.
// ==========================================================================

// Pénalités d'accès : temps supplémentaire pour détacher/rattacher son vélo,
// ou accéder à sa voiture et se garer, par rapport à la marche. Le vélo ne
// varie pas avec le contexte ; la voiture si (chercher une place, se garer
// loin, marcher jusqu'à l'entrée — nettement plus long en ville dense qu'en
// zone rurale où l'on se gare généralement devant sa destination).
// Sources (voiture) : CEREMA, enquête stationnement Lyon 2015 — temps de
// RECHERCHE seule d'une place sur voirie, moyenne 2-3 min, distribution
// étalée dépassant 10 min en secteur tendu (citée dans Combes et al., arXiv
// 2511.13350, 2025). Une étude d'accessibilité urbaine récente (arXiv
// 2604.01019, 2024) ajoute forfaitairement 15 min au trajet voiture brut pour
// couvrir marche jusqu'au véhicule + recherche + marche jusqu'à destination
// (valeur unique, pas de distinction ville/campagne dans cette étude). Nos
// deux valeurs se situent dans cette fourchette. Aucune étude trouvée ne
// chiffre le temps d'accès à un vélo — 3 min reste une estimation raisonnée,
// non sourcée.
export const DELAY_BIKE_MIN = 3;
export const DELAY_CAR_MIN_URBAN = 8;
export const DELAY_CAR_MIN_RURAL = 4;

// Rayon du réseau interrogé, choisi en deux temps.
//
// 1) Une sonde légère (réseau téléchargé sur NETWORK_RADIUS_PROBE_M, un
//    coût négligeable) mesure la densité de carrefours autour du point de
//    départ (même mesure que la classification urbain/rural, voir
//    URBAN_CLASSIFICATION_JUNCTION_THRESHOLD dans graph.js), pour choisir un
//    rayon de départ adapté au contexte plutôt qu'une valeur unique — la
//    zone interrogée (donc le volume de données) croît avec le CARRÉ du
//    rayon, pas avec le rayon lui-même, donc adapter le rayon au contexte
//    réduit fortement le volume téléchargé dans le cas courant.
//
//    Seuils et rayons calibrés sur des mesures réelles (distance maximale
//    à vol d'oiseau de la limite VAE, le mode qui va le plus loin) :
//    - dense (≥150 carrefours/600m, ex. Andrézieux 167→8,5km, Saint-Étienne
//      235→8,52km, Lyon Croix-Rousse 287→11,34km) : 10 km ;
//    - intermédiaire (30-150, ex. Bonneval 74→5,54km) : 7 km ;
//    - clairsemé (<30, ex. Vassieux-en-Vercors 24→4,93km) : 6 km.
//    La relation carrefours→distance n'est pas monotone : les deux extrêmes
//    (hypercentre très dense type Paris République, 217 carrefours, et
//    rural très épars/dendritique type Lozère, 10 carrefours) dépassent
//    tous les deux 14 km alors que les zones intermédiaires en restent très
//    en-deçà — c'est le filet de sécurité ci-dessous qui les couvre, pas le
//    choix du rayon initial.
//
// 2) Si ce premier essai ne suffit pas à couvrir entièrement une zone
//    (marche/vélo/VAE tronquée en bord de rayon, ou téléchargement du
//    réseau lui-même tronqué par la pagination), un second essai est
//    relancé automatiquement à NETWORK_RADIUS_MAX_M — ce filet de sécurité
//    garantit un résultat complet même quand la sonde sous-estime le rayon
//    nécessaire.
export const NETWORK_RADIUS_PROBE_M = 1000;
export const RADIUS_TIER_DENSE_MIN_JUNCTIONS = 150;
export const RADIUS_TIER_DENSE_M = 10000;
export const RADIUS_TIER_INTERMEDIATE_MIN_JUNCTIONS = 30;
export const RADIUS_TIER_INTERMEDIATE_M = 7000;
export const RADIUS_TIER_SPARSE_M = 6000;
export const NETWORK_RADIUS_MAX_M = 15000;

// Résolution de la grille altimétrique, tolérance de fusion des nœuds, et
// paramètres WFS.
export const ELEVATION_GRID_SPACING_M = 70;
export const NODE_SNAP_TOLERANCE_M = 12;
export const WFS_PAGE_SIZE = 1000;
export const WFS_MAX_REQUESTS_PER_SECOND = 29;
