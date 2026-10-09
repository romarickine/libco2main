// ==========================================================================
// Îlots gagnants et trous internes (carte du sans-voiture)
// --------------------------------------------------------------------------
// Fonctions pures sur des ensembles d'hexagones (clés axiales « q,r ») :
//  1. filtrerIlots : parmi les zones où un mode bat la voiture, garde la zone
//     principale (reliée au départ par des rues où le mode gagne) et les îlots
//     PERTINENTS (taille × éloignement à une grande zone) ; écarte les îlots
//     faits surtout de voies où la voiture n'a pas de vrai temps de parcours
//     (chemins, sentiers, pistes cyclables, voies de berge…) : là, le temps
//     voiture n'est qu'une estimation et la « victoire » du mode, un artefact.
//  2. comblerTrous : comble les trous fermés à l'intérieur d'une zone — les
//     interstices du maillage sans route, toujours ; les petites poches où la
//     voiture gagne sur une vraie route, sous un seuil de taille.
// Principe repris d'une solution concurrente transmise par le porteur du
// projet (09/10/2026) ; valeurs des seuils calibrées sur nos propres sites
// (voir config.js et docs/calibrage-ilots.md).
// ==========================================================================

const VOISINS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

const lireCle = (k) => {
  const i = k.indexOf(",");
  return [+k.slice(0, i), +k.slice(i + 1)];
};

/** Natures de voies « dégradées » (BD TOPO®) : la voiture y est très lente ou absente. */
export const NATURES_DEGRADEES = new Set(["Route empierrée", "Chemin", "Sentier"]);

/**
 * Composantes connexes (voisinage hexagonal à 6) d'un ensemble de clés.
 * @param {Iterable<string>} cles
 * @returns {string[][]}
 */
export function composantes(cles) {
  const reste = new Set(cles);
  const comps = [];
  for (const depart of cles) {
    if (!reste.has(depart)) continue;
    reste.delete(depart);
    const comp = [depart];
    for (let i = 0; i < comp.length; i++) {
      const [q, r] = lireCle(comp[i]);
      for (const [dq, dr] of VOISINS) {
        const k = q + dq + "," + (r + dr);
        if (reste.has(k)) {
          reste.delete(k);
          comp.push(k);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

/**
 * Filtre de pertinence des îlots.
 * @param {Iterable<string>} cles  Hexagones gagnants d'un mode.
 * @param {object} p
 * @param {Iterable<string>|null} p.clesPrincipales  Zone principale : hexagones reliés au départ par
 *   le réseau du mode (rues où il gagne de proche en proche). Toujours gardée ; tout le reste forme
 *   les îlots, même s'il touche cette zone sur la grille.
 * @param {string|null} p.cleOrigine   Hexagone de l'adresse : repli quand clesPrincipales est absent
 *   (la composante qui le contient tient lieu de zone principale).
 * @param {Set<string>|null} p.hexCarrossables  Hexagones où la voiture a un vrai temps de parcours
 *   (voie gagnante ouverte à la voiture, non dégradée, reliée au réseau voiture).
 * @param {number} p.minHex     Taille minimale d'un îlot détaché.
 * @param {number} p.ancreMin   Taille à partir de laquelle un îlot carrossable est gardé d'office (« ancre »).
 * @param {number} p.distParHex Distance (en hexagones) autorisée à une ancre, par hexagone au-delà de minHex ; 0 = pas de condition de distance.
 * @param {number} p.partDegradeeMax  Part (0-1) d'hexagones non carrossables au-delà de laquelle un îlot est écarté ; 0 = désactivé.
 * @returns {{gardes: Set<string>, ilotsGardes: number, ilotsEcartes: number, ilotsNonCarrossablesEcartes: number}}
 */
export function filtrerIlots(
  cles,
  { clesPrincipales = null, cleOrigine = null, hexCarrossables = null, minHex, ancreMin, distParHex, partDegradeeMax },
) {
  let comps;
  if (clesPrincipales) {
    const principales = new Set(clesPrincipales);
    if (cleOrigine != null) principales.add(cleOrigine);
    const zone = [],
      reste = [];
    for (const k of cles) (principales.has(k) ? zone : reste).push(k);
    comps = composantes(reste).map((c) => ({ cles: c, taille: c.length, origine: false }));
    if (zone.length) comps.push({ cles: zone, taille: zone.length, origine: true });
  } else {
    comps = composantes(cles).map((c) => ({
      cles: c,
      taille: c.length,
      origine: cleOrigine != null && c.includes(cleOrigine),
    }));
  }
  for (const c of comps) {
    let degrades = 0;
    if (hexCarrossables) for (const k of c.cles) if (!hexCarrossables.has(k)) degrades++;
    c.degrade = partDegradeeMax > 0 && !c.origine && degrades / c.taille >= partDegradeeMax;
    c.ancre = c.origine || (c.taille >= ancreMin && !c.degrade);
  }
  // Index des hexagones d'ancre par compartiments de 8×8, pour la distance.
  const TAILLE_COMP = 8;
  const compartiments = new Map();
  for (const c of comps) {
    if (!c.ancre) continue;
    for (const k of c.cles) {
      const [q, r] = lireCle(k);
      const b = Math.floor(q / TAILLE_COMP) + "," + Math.floor(r / TAILLE_COMP);
      if (!compartiments.has(b)) compartiments.set(b, []);
      compartiments.get(b).push([q, r]);
    }
  }
  const distHex = (q1, r1, q2, r2) => (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
  const procheAncre = (c, portee) => {
    const n = Math.ceil(portee / TAILLE_COMP) + 1;
    for (const k of c.cles) {
      const [q, r] = lireCle(k);
      const bq = Math.floor(q / TAILLE_COMP),
        br = Math.floor(r / TAILLE_COMP);
      for (let i = -n; i <= n; i++)
        for (let j = -n; j <= n; j++)
          for (const [aq, ar] of compartiments.get(bq + i + "," + (br + j)) || []) {
            if (distHex(q, r, aq, ar) <= portee) return true;
          }
    }
    return false;
  };
  const gardes = new Set();
  let ilotsGardes = 0,
    ilotsEcartes = 0,
    ilotsNonCarrossablesEcartes = 0;
  for (const c of comps) {
    let garder;
    if (c.degrade) garder = false;
    else if (c.ancre) garder = true;
    else if (c.taille < minHex) garder = false;
    else if (distParHex <= 0) garder = true;
    else garder = procheAncre(c, (c.taille - minHex) * distParHex);
    if (garder) {
      for (const k of c.cles) gardes.add(k);
      if (!c.origine) ilotsGardes++;
    } else {
      ilotsEcartes++;
      if (c.degrade) ilotsNonCarrossablesEcartes++;
    }
  }
  return { gardes, ilotsGardes, ilotsEcartes, ilotsNonCarrossablesEcartes };
}

/**
 * Trous fermés d'une zone : cellules hors zone qui n'atteignent pas
 * l'extérieur (remplissage depuis le pourtour d'un cadre élargi d'une cellule).
 * Chaque composante de trou est comblée si elle n'a aucune route du mode, ou
 * si elle compte moins de `pochesVoitureMax` cellules (petite poche où la
 * voiture gagne). Les grandes poches voiture restent vides.
 * @param {Set<string>} zone  Clés de la zone (non modifié).
 * @param {Set<string>|null} hexRoutes  Clés traversées par une voie praticable du mode (gagnante ou non).
 * @param {number} pochesVoitureMax
 * @returns {string[]} clés à ajouter à la zone
 */
export function trousACombler(zone, hexRoutes, pochesVoitureMax) {
  if (zone.size === 0) return [];
  let minQ = Infinity,
    maxQ = -Infinity,
    minR = Infinity,
    maxR = -Infinity;
  for (const k of zone) {
    const [q, r] = lireCle(k);
    if (q < minQ) minQ = q;
    if (q > maxQ) maxQ = q;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }
  minQ--;
  maxQ++;
  minR--;
  maxR++;
  const H = maxR - minR + 1;
  const idx = (q, r) => (q - minQ) * H + (r - minR);
  const etat = new Uint8Array((maxQ - minQ + 1) * H); // 0 inconnu, 1 zone, 2 extérieur, 3 trou
  for (const k of zone) {
    const [q, r] = lireCle(k);
    etat[idx(q, r)] = 1;
  }
  const dedans = (q, r) => q >= minQ && q <= maxQ && r >= minR && r <= maxR;
  const pile = [];
  const sortir = (q, r) => {
    const i = idx(q, r);
    if (etat[i] === 0) {
      etat[i] = 2;
      pile.push(q, r);
    }
  };
  for (let q = minQ; q <= maxQ; q++) {
    sortir(q, minR);
    sortir(q, maxR);
  }
  for (let r = minR; r <= maxR; r++) {
    sortir(minQ, r);
    sortir(maxQ, r);
  }
  while (pile.length) {
    const r = pile.pop(),
      q = pile.pop();
    for (const [dq, dr] of VOISINS) if (dedans(q + dq, r + dr)) sortir(q + dq, r + dr);
  }
  const ajouts = [];
  for (let q0 = minQ; q0 <= maxQ; q0++)
    for (let r0 = minR; r0 <= maxR; r0++) {
      if (etat[idx(q0, r0)] !== 0) continue;
      const comp = [q0, r0];
      etat[idx(q0, r0)] = 3;
      for (let i = 0; i < comp.length; i += 2) {
        const q = comp[i],
          r = comp[i + 1];
        for (const [dq, dr] of VOISINS) {
          const nq = q + dq,
            nr = r + dr;
          if (dedans(nq, nr) && etat[idx(nq, nr)] === 0) {
            etat[idx(nq, nr)] = 3;
            comp.push(nq, nr);
          }
        }
      }
      const petite = pochesVoitureMax > 0 && comp.length / 2 < pochesVoitureMax;
      for (let i = 0; i < comp.length; i += 2) {
        const k = comp[i] + "," + comp[i + 1];
        if (petite || !(hexRoutes && hexRoutes.has(k))) ajouts.push(k);
      }
    }
  return ajouts;
}
