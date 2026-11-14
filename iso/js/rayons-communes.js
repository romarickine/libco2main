// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// Rayon du réseau choisi d'emblée selon la commune du point (code INSEE ; à
// Paris, Lyon et Marseille, celui de l'arrondissement), le moment du trajet
// et le sens, pour éviter les relances dans les grandes villes. Mesures faites
// sur libco2.fr le 14/11/2026 avec la congestion voiture par tronçon
// (COEF_TEMPS_VOITURE_URBAIN, config.js) : calcul à 17 km depuis le centre
// (un point par arrondissement à Paris, deux points à Lyon, le plus lointain
// retenu, un point pour Marseille), distance de la zone la plus lointaine au
// point de départ, puis plus petit palier (8 ; 12 ; 15 ; 17 km) où cette
// distance reste sous 0,9 × rayon, le seuil de relance ; 17 km au-delà (rayon
// maximal). Les autres communes gardent la sonde de densité, et toutes gardent
// la relance par paliers comme filet de sécurité.
// Valeurs : { pointe: [aller-retour, j'en pars, j'y vais], journee: [...] },
// en mètres. Commentaire : distance la plus lointaine mesurée dans chaque cas.
export const RAYONS_COMMUNES = {
  "06088": { pointe: [15000, 17000, 15000], journee: [12000, 12000, 15000] }, // Nice : pointe 12,8 / 14,2 / 12,0 ; journée 8,2 / 10,6 / 11,1 km
  "13201": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13202": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13203": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13204": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13205": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13206": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13207": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13208": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13209": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13210": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13211": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13212": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13213": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13214": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13215": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "13216": { pointe: [15000, 15000, 17000], journee: [15000, 15000, 15000] }, // Marseille : pointe 13,3 / 13,3 / 14,7 ; journée 11,7 / 11,7 / 13,4 km
  "21231": { pointe: [15000, 12000, 15000], journee: [12000, 12000, 15000] }, // Dijon : pointe 11,6 / 10,8 / 13,1 ; journée 10,0 / 9,6 / 12,8 km
  "31555": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 12000] }, // Toulouse : pointe 14,1 / 14,4 / 13,9 ; journée 10,9 / 11,0 / 10,8 km
  "33063": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // Bordeaux : pointe 14,2 / 14,2 / 14,5 ; journée 11,6 / 11,6 / 11,6 km
  "34172": { pointe: [15000, 15000, 17000], journee: [12000, 12000, 17000] }, // Montpellier : pointe 13,1 / 13,1 / 14,8 ; journée 10,7 / 9,4 / 14,3 km
  "35238": { pointe: [12000, 12000, 15000], journee: [12000, 12000, 12000] }, // Rennes : pointe 10,7 / 10,7 / 12,0 ; journée 7,9 / 7,9 / 9,2 km
  "37261": { pointe: [15000, 15000, 12000], journee: [8000, 12000, 8000] }, // Tours : pointe 10,9 / 10,9 / 9,6 ; journée 6,6 / 7,4 / 6,6 km
  "38185": { pointe: [12000, 12000, 15000], journee: [8000, 8000, 12000] }, // Grenoble : pointe 8,6 / 8,3 / 12,1 ; journée 7,2 / 6,9 / 9,3 km
  "42218": { pointe: [12000, 12000, 12000], journee: [12000, 12000, 12000] }, // StEtienne : pointe 9,8 / 10,0 / 10,8 ; journée 7,6 / 7,5 / 8,6 km
  "44109": { pointe: [17000, 15000, 17000], journee: [12000, 12000, 12000] }, // Nantes : pointe 13,6 / 13,5 / 13,7 ; journée 9,4 / 9,5 / 9,6 km
  "49007": { pointe: [12000, 12000, 12000], journee: [12000, 12000, 12000] }, // Angers : pointe 9,3 / 10,1 / 10,1 ; journée 8,1 / 7,8 / 8,1 km
  "51454": { pointe: [12000, 12000, 12000], journee: [12000, 12000, 12000] }, // Reims : pointe 9,8 / 9,9 / 9,8 ; journée 8,5 / 8,5 / 8,3 km
  "54395": { pointe: [15000, 15000, 15000], journee: [15000, 15000, 15000] }, // Nancy : pointe 12,3 / 12,3 / 12,9 ; journée 11,5 / 11,5 / 12,6 km
  "57463": { pointe: [12000, 12000, 12000], journee: [12000, 12000, 12000] }, // Metz : pointe 10,5 / 10,8 / 9,4 ; journée 7,5 / 7,8 / 7,5 km
  "59350": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lille : pointe 13,2 / 13,3 / 13,0 ; journée 8,3 / 8,3 / 8,0 km
  "63113": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 15000] }, // Clermont : pointe 11,4 / 12,4 / 12,1 ; journée 9,4 / 9,3 / 11,2 km
  "64445": { pointe: [12000, 12000, 12000], journee: [12000, 12000, 12000] }, // Pau : pointe 10,3 / 10,4 / 10,7 ; journée 8,3 / 8,3 / 8,7 km
  "67482": { pointe: [17000, 17000, 17000], journee: [12000, 12000, 12000] }, // Strasbourg : pointe 14,1 / 14,1 / 13,9 ; journée 9,9 / 9,9 / 9,8 km
  "69381": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69382": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69383": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69384": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69385": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69386": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69387": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69388": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "69389": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // Lyon : pointe 12,6 / 12,7 / 12,1 ; journée 9,3 / 10,3 / 9,2 km
  "72181": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // LeMans : pointe 11,7 / 11,1 / 12,2 ; journée 8,6 / 8,8 / 8,4 km
  "75101": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P01 : pointe 15,0 / 15,1 / 15,1 ; journée 12,7 / 11,5 / 12,7 km
  "75102": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P02 : pointe 15,5 / 15,5 / 15,7 ; journée 12,1 / 11,7 / 13,4 km
  "75103": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P03 : pointe 14,8 / 14,6 / 15,2 ; journée 12,5 / 11,4 / 13,2 km
  "75104": { pointe: [17000, 17000, 17000], journee: [15000, 12000, 15000] }, // P04 : pointe 14,5 / 14,5 / 14,8 ; journée 11,7 / 10,7 / 12,0 km
  "75105": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P05 : pointe 14,7 / 15,1 / 14,8 ; journée 11,2 / 11,2 / 11,1 km
  "75106": { pointe: [17000, 17000, 17000], journee: [12000, 12000, 15000] }, // P06 : pointe 14,7 / 14,8 / 15,0 ; journée 10,7 / 10,7 / 12,2 km
  "75107": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P07 : pointe 15,1 / 15,1 / 15,2 ; journée 12,2 / 12,2 / 12,3 km
  "75108": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P08 : pointe 14,9 / 15,1 / 15,3 ; journée 11,0 / 11,0 / 11,1 km
  "75109": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 17000] }, // P09 : pointe 15,9 / 15,9 / 16,3 ; journée 12,4 / 12,1 / 14,1 km
  "75110": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P10 : pointe 15,6 / 15,5 / 15,9 ; journée 12,4 / 12,2 / 12,7 km
  "75111": { pointe: [17000, 17000, 17000], journee: [15000, 15000, 15000] }, // P11 : pointe 14,6 / 14,4 / 14,8 ; journée 11,2 / 11,4 / 12,8 km
  "75112": { pointe: [15000, 15000, 17000], journee: [12000, 12000, 12000] }, // P12 : pointe 13,5 / 13,5 / 14,7 ; journée 8,4 / 8,3 / 9,4 km
  "75113": { pointe: [17000, 17000, 17000], journee: [12000, 12000, 12000] }, // P13 : pointe 14,5 / 14,3 / 14,5 ; journée 9,6 / 10,0 / 10,2 km
  "75114": { pointe: [17000, 17000, 17000], journee: [12000, 12000, 12000] }, // P14 : pointe 14,2 / 14,4 / 14,1 ; journée 9,6 / 10,2 / 9,6 km
  "75115": { pointe: [17000, 15000, 17000], journee: [12000, 12000, 12000] }, // P15 : pointe 13,6 / 13,0 / 14,3 ; journée 9,4 / 8,4 / 10,4 km
  "75116": { pointe: [15000, 15000, 15000], journee: [12000, 12000, 12000] }, // P16 : pointe 11,8 / 11,8 / 11,8 ; journée 8,5 / 8,7 / 8,6 km
  "75117": { pointe: [17000, 17000, 17000], journee: [12000, 12000, 12000] }, // P17 : pointe 14,3 / 14,3 / 15,1 ; journée 9,9 / 9,2 / 10,5 km
  "75118": { pointe: [17000, 15000, 17000], journee: [12000, 12000, 12000] }, // P18 : pointe 13,8 / 13,1 / 13,8 ; journée 7,4 / 7,6 / 7,6 km
  "75119": { pointe: [17000, 17000, 17000], journee: [12000, 12000, 12000] }, // P19 : pointe 14,7 / 14,7 / 14,8 ; journée 8,3 / 8,5 / 8,3 km
  "75120": { pointe: [15000, 17000, 15000], journee: [12000, 12000, 12000] }, // P20 : pointe 12,8 / 14,6 / 12,0 ; journée 8,6 / 9,6 / 8,3 km
  "76540": { pointe: [12000, 12000, 12000], journee: [8000, 8000, 12000] }, // Rouen : pointe 8,2 / 7,8 / 9,6 ; journée 6,9 / 6,9 / 7,9 km
  "83137": { pointe: [15000, 15000, 15000], journee: [8000, 8000, 15000] }, // Toulon : pointe 12,0 / 11,5 / 12,6 ; journée 7,1 / 6,5 / 12,4 km
};

const SENS = { "aller-retour": 0, depart: 1, arrivee: 2 };

/** Rayon (m) prévu pour cette commune et ce sens, ou null si la commune n'est pas listée. */
export function rayonCommune(codeInsee, direction, moment = "pointe") {
  const r = codeInsee && RAYONS_COMMUNES[codeInsee];
  if (!r) return null;
  const parSens = r[moment] ?? r.pointe;
  return parSens?.[SENS[direction] ?? 1] ?? null;
}
