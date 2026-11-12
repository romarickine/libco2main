// Rayon du réseau choisi d'emblée selon la commune du point (code INSEE ; à
// Paris, Lyon et Marseille, celui de l'arrondissement), pour éviter les
// relances dans les grandes villes. Valeurs mesurées sur libco2.fr les 9 et
// 10/11/2026 (site/diagnostic-rayon-carte-2026-11-09.md dans le projet) :
// calcul à 17 km depuis le centre (ou un point par arrondissement à Paris),
// distance de la zone la plus lointaine au point de départ, puis plus petit
// palier (8 ; 11,5 ; 15 ; 17 km) où cette distance reste sous 0,9 × rayon,
// le seuil de relance. Les autres communes gardent la sonde de densité, et
// toutes gardent la relance par paliers comme filet de sécurité.
// Ordre : [aller-retour, j'en pars, j'y vais], en mètres.
// Commentaire : distance la plus lointaine mesurée dans chaque sens.
// 17 km avec une distance au-delà de 15,3 km : zone qui dépasse même 17 km ;
// remesurée le 10/11/2026 après la correction du parking en lisière (le
// rayon maximal reste 17 km : la carte est alors signalée « tronquée »).
export const RAYONS_COMMUNES = {
  "06088": [15000, 11500, 17000], // Nice : 13.3 / 9.5 / 15.5 km
  "13201": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13202": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13203": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13204": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13205": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13206": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13207": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13208": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13209": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13210": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13211": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13212": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13213": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13214": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13215": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "13216": [17000, 17000, 17000], // Marseille : 16.4 / 13.8 / 17.5 km
  "21231": [17000, 17000, 17000], // Dijon : 14.7 / 14.6 / 14.8 km
  "31555": [17000, 17000, 17000], // Toulouse : 14.8 / 14.5 / 15.1 km
  "33063": [17000, 17000, 17000], // Bordeaux : 19.5 / 19.9 / 18.0 km (remesuré le 10/11/2026)
  "34172": [17000, 15000, 17000], // Montpellier : 17.2 / 13.2 / 18.8 km
  "35238": [17000, 15000, 17000], // Rennes : 13.9 / 12.5 / 14.0 km
  "37261": [15000, 15000, 15000], // Tours : 10.5 / 10.5 / 10.5 km
  "38185": [15000, 11500, 17000], // Grenoble : 10.6 / 10.0 / 17.6 km (remesuré le 10/11/2026)
  "42218": [15000, 11500, 15000], // StEtienne : 11.9 / 11.1 / 13.6 km
  "44109": [17000, 17000, 17000], // Nantes : 16.0 / 16.0 / 16.1 km (remesuré le 10/11/2026)
  "49007": [15000, 15000, 11500], // Angers : 11.1 / 11.6 / 10.1 km (remesuré le 10/11/2026)
  "51454": [15000, 15000, 15000], // Reims : 10.8 / 11.0 / 10.7 km
  "54395": [17000, 17000, 17000], // Nancy : 14.8 / 14.8 / 14.8 km
  "57463": [15000, 15000, 15000], // Metz : 11.2 / 11.2 / 11.3 km
  "59350": [15000, 15000, 17000], // Lille : 11.7 / 11.6 / 13.5 km
  "63113": [15000, 15000, 17000], // Clermont : 11.9 / 13.4 / 14.8 km
  "64445": [15000, 17000, 15000], // Pau : 12.1 / 13.7 / 12.2 km
  "67482": [17000, 17000, 17000], // Strasbourg : 14.4 / 14.4 / 14.4 km
  "69381": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69382": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69383": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69384": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69385": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69386": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69387": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69388": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "69389": [15000, 15000, 15000], // Lyon : 11.8 / 13.1 / 11.2 km
  "72181": [15000, 15000, 15000], // LeMans : 11.3 / 12.4 / 11.4 km
  "75101": [17000, 17000, 17000], // P01 : 15.0 / 16.0 / 15.0 km
  "75102": [17000, 17000, 17000], // P02 : 14.6 / 16.9 / 14.4 km
  "75103": [17000, 15000, 17000], // P03 : 13.8 / 13.0 / 15.9 km
  "75104": [17000, 17000, 17000], // P04 : 14.6 / 15.1 / 14.8 km
  "75105": [17000, 17000, 17000], // P05 : 15.7 / 15.7 / 15.7 km
  "75106": [15000, 15000, 17000], // P06 : 13.0 / 12.9 / 15.6 km
  "75107": [17000, 17000, 17000], // P07 : 17.5 / 17.5 / 15.0 km
  "75108": [15000, 15000, 15000], // P08 : 12.5 / 12.5 / 12.7 km
  "75109": [17000, 15000, 17000], // P09 : 13.9 / 12.7 / 14.6 km
  "75110": [17000, 15000, 17000], // P10 : 13.8 / 13.3 / 14.0 km
  "75111": [17000, 17000, 17000], // P11 : 13.5 / 13.5 / 13.6 km
  "75112": [15000, 15000, 15000], // P12 : 12.1 / 11.2 / 12.6 km
  "75113": [15000, 17000, 17000], // P13 : 12.5 / 15.0 / 13.9 km
  "75114": [15000, 17000, 15000], // P14 : 11.7 / 15.0 / 12.1 km
  "75115": [11500, 11500, 15000], // P15 : 10.3 / 9.4 / 12.4 km
  "75116": [11500, 11500, 11500], // P16 : 9.1 / 9.0 / 9.8 km
  "75117": [15000, 15000, 15000], // P17 : 12.0 / 12.2 / 12.0 km
  "75118": [11500, 11500, 15000], // P18 : 9.2 / 9.2 / 10.6 km
  "75119": [15000, 15000, 15000], // P19 : 10.8 / 10.6 / 10.8 km
  "75120": [11500, 15000, 11500], // P20 : 9.3 / 13.0 / 8.6 km
  "76540": [11500, 11500, 15000], // Rouen : 8.6 / 8.6 / 11.7 km
  "83137": [15000, 11500, 17000], // Toulon : 10.5 / 9.3 / 17.2 km (mesuré le 10/11/2026)
};

const SENS = { "aller-retour": 0, depart: 1, arrivee: 2 };

/** Rayon (m) prévu pour cette commune et ce sens, ou null si la commune n'est pas listée. */
export function rayonCommune(codeInsee, direction) {
  const r = codeInsee && RAYONS_COMMUNES[codeInsee];
  if (!r) return null;
  return r[SENS[direction] ?? 1] ?? null;
}
