// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// ==========================================================================
// Couleurs des zones (marche/vélo/VAE), lues depuis les variables CSS —
// une seule source de vérité (css/variables.css), utilisée à la fois par le
// rendu Leaflet en direct et par l'export image.
// ==========================================================================
export function getModeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    Walk: style.getPropertyValue("--walk").trim(),
    Bike: style.getPropertyValue("--bike").trim(),
    Ebike: style.getPropertyValue("--ebike").trim(),
  };
}
