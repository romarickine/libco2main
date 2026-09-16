// ==========================================================================
// Constantes figées, non réglables depuis l'interface.
// Modifier ces valeurs ici plutôt que d'exposer des champs de réglage.
// ==========================================================================

// Pénalités d'accès : temps supplémentaire pour détacher/rattacher son vélo,
// ou accéder à sa voiture et se garer, par rapport à la marche.
export const DELAY_BIKE_MIN = 3;
export const DELAY_CAR_MIN = 6;

// Rayon du réseau interrogé.
export const NETWORK_RADIUS_M = 15000;

// Résolution de la grille altimétrique, tolérance de fusion des nœuds, et
// paramètres WFS.
export const ELEVATION_GRID_SPACING_M = 150;
export const NODE_SNAP_TOLERANCE_M = 12;
export const WFS_PAGE_SIZE = 1000;
export const WFS_MAX_REQUESTS_PER_SECOND = 29;
