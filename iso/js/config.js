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

// Rayon du réseau interrogé. Ramené de 20 à 15 km une première fois : le
// passage à 20 km visait à corriger une vitesse voiture sous-estimée près du
// bord du réseau (un itinéraire rapide légèrement hors rayon n'existait alors
// pas dans les données téléchargées) — mais la refonte des pénalités de
// carrefour (hiérarchie routière + cap géographique, voir graph.js) supprime
// la cause réelle du problème à la source : les faux carrefours qui
// ralentissaient artificiellement la voiture. Un rayon plus large n'est donc
// plus nécessaire pour corriger ce cas.
// Ramené ensuite de 15 à 13,5 km : optimum retenu après tests en zones
// urbaines plates (relief négligeable, réseau dense) — réduit encore le
// volume de données téléchargées et le temps de calcul sans perte de
// précision observée sur ce type de terrain. À revoir si des tests en zone
// rurale ou vallonnée montrent un besoin de rayon plus large (cf. historique
// ci-dessus pour le cas qui avait justifié un rayon élargi).
export const NETWORK_RADIUS_M = 13500;

// Résolution de la grille altimétrique, tolérance de fusion des nœuds, et
// paramètres WFS.
export const ELEVATION_GRID_SPACING_M = 70;
export const NODE_SNAP_TOLERANCE_M = 12;
export const WFS_PAGE_SIZE = 1000;
export const WFS_MAX_REQUESTS_PER_SECOND = 29;
