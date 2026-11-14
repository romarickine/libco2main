// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// Rayon du réseau choisi d'emblée selon la commune du point (code INSEE ; à
// Paris, Lyon et Marseille, celui de l'arrondissement), pour éviter les
// relances dans les grandes villes. Valeurs remesurées sur libco2.fr le
// 14/11/2026, après la baisse des vitesses vélo et VAE (moyennes de
// Schleinitz) et la pénalité de cyclabilité en circulation mêlée
// (site/diagnostic-rayon-carte-2026-11-09.md dans le projet) : calcul à 17 km
// depuis le centre (un point par arrondissement à Paris, deux points à Lyon,
// le plus lointain retenu), distance de la zone la plus lointaine au point de
// départ, puis plus petit palier (8 ; 11,5 ; 15 ; 17 km) où cette distance
// reste sous 0,9 × rayon, le seuil de relance. Contrôle : à ce rayon, les
// zones sont identiques au calcul à 17 km (5 cas, au nombre d'hexagones
// près). Les autres communes gardent la sonde de densité, et toutes gardent
// la relance par paliers comme filet de sécurité.
// Ordre : [aller-retour, j'en pars, j'y vais], en mètres.
// Commentaire : distance la plus lointaine mesurée dans chaque sens.
export const RAYONS_COMMUNES = {
  "06088": [8000, 8000, 11500], // Nice : 5.4 / 6.0 / 8.7 km
  "13201": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13202": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13203": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13204": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13205": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13206": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13207": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13208": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13209": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13210": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13211": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13212": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13213": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13214": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13215": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "13216": [8000, 8000, 8000], // Marseille : 6.9 / 7.0 / 5.1 km
  "21231": [11500, 11500, 11500], // Dijon : 7.9 / 7.9 / 7.9 km
  "31555": [8000, 8000, 8000], // Toulouse : 6.7 / 6.7 / 6.9 km
  "33063": [8000, 8000, 8000], // Bordeaux : 6.3 / 5.6 / 6.4 km
  "34172": [8000, 8000, 11500], // Montpellier : 6.9 / 6.6 / 9.6 km
  "35238": [8000, 8000, 8000], // Rennes : 5.5 / 5.9 / 5.5 km
  "37261": [8000, 8000, 8000], // Tours : 4.5 / 5.6 / 5.2 km
  "38185": [8000, 8000, 11500], // Grenoble : 4.9 / 5.0 / 7.4 km
  "42218": [8000, 8000, 11500], // StEtienne : 5.5 / 4.8 / 8.0 km
  "44109": [8000, 8000, 8000], // Nantes : 5.7 / 5.7 / 5.8 km
  "49007": [8000, 8000, 8000], // Angers : 5.2 / 5.7 / 5.5 km
  "51454": [8000, 8000, 8000], // Reims : 5.6 / 5.6 / 5.9 km
  "54395": [8000, 8000, 15000], // Nancy : 5.7 / 5.5 / 10.9 km
  "57463": [8000, 8000, 8000], // Metz : 5.9 / 6.6 / 4.6 km
  "59350": [8000, 8000, 8000], // Lille : 5.2 / 5.4 / 5.4 km
  "63113": [8000, 8000, 15000], // Clermont : 5.3 / 6.6 / 11.0 km
  "64445": [8000, 8000, 8000], // Pau : 6.3 / 5.6 / 6.9 km
  "67482": [11500, 11500, 11500], // Strasbourg : 9.5 / 9.5 / 9.5 km
  "69381": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69382": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69383": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69384": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69385": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69386": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69387": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69388": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "69389": [8000, 8000, 8000], // Lyon : 6.2 / 6.5 / 5.6 km
  "72181": [8000, 8000, 8000], // LeMans : 5.5 / 5.3 / 5.8 km
  "75101": [11500, 11500, 11500], // P01 : 7.3 / 8.5 / 7.9 km
  "75102": [11500, 11500, 11500], // P02 : 7.8 / 8.2 / 7.4 km
  "75103": [8000, 8000, 11500], // P03 : 6.3 / 6.5 / 7.6 km
  "75104": [8000, 11500, 8000], // P04 : 5.2 / 7.2 / 6.4 km
  "75105": [8000, 8000, 8000], // P05 : 5.8 / 6.4 / 5.9 km
  "75106": [8000, 8000, 8000], // P06 : 5.9 / 5.9 / 6.6 km
  "75107": [8000, 8000, 11500], // P07 : 6.4 / 6.3 / 7.4 km
  "75108": [8000, 8000, 8000], // P08 : 6.3 / 5.9 / 6.6 km
  "75109": [8000, 8000, 11500], // P09 : 7.1 / 6.2 / 7.9 km
  "75110": [8000, 8000, 8000], // P10 : 5.8 / 6.4 / 6.1 km
  "75111": [8000, 8000, 8000], // P11 : 6.1 / 6.1 / 6.1 km
  "75112": [8000, 8000, 8000], // P12 : 6.1 / 6.1 / 6.2 km
  "75113": [8000, 8000, 8000], // P13 : 5.6 / 5.8 / 5.9 km
  "75114": [8000, 8000, 8000], // P14 : 6.2 / 6.2 / 6.7 km
  "75115": [8000, 8000, 11500], // P15 : 6.6 / 6.6 / 7.3 km
  "75116": [8000, 8000, 8000], // P16 : 5.6 / 5.7 / 6.6 km
  "75117": [8000, 8000, 8000], // P17 : 6.4 / 6.6 / 6.7 km
  "75118": [8000, 8000, 8000], // P18 : 4.9 / 5.8 / 5.3 km
  "75119": [8000, 8000, 8000], // P19 : 6.0 / 6.6 / 5.0 km
  "75120": [8000, 8000, 8000], // P20 : 6.0 / 6.0 / 6.4 km
  "76540": [8000, 8000, 8000], // Rouen : 5.2 / 5.2 / 6.0 km
  "83137": [8000, 8000, 8000], // Toulon : 5.1 / 4.5 / 7.1 km
};

const SENS = { "aller-retour": 0, depart: 1, arrivee: 2 };

/** Rayon (m) prévu pour cette commune et ce sens, ou null si la commune n'est pas listée. */
export function rayonCommune(codeInsee, direction) {
  const r = codeInsee && RAYONS_COMMUNES[codeInsee];
  if (!r) return null;
  return r[SENS[direction] ?? 1] ?? null;
}
