// ==========================================================================
// Couleurs des zones (marche/vélo/VAE), lues depuis les variables CSS —
// une seule source de vérité (css/variables.css), utilisée à la fois par le
// rendu Leaflet en direct et par l'export image.
// ==========================================================================
export function getModeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    Walk: style.getPropertyValue('--walk').trim(),
    Bike: style.getPropertyValue('--bike').trim(),
    Ebike: style.getPropertyValue('--ebike').trim(),
  };
}
