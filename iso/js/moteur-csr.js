// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// ==========================================================================
// Moteur de calcul sur tableaux typés (nœuds numérotés, adjacence « CSR »)
// ==========================================================================
// Même méthode, mêmes résultats que buildAdjacency / transposeAdjacency /
// dijkstra (graph.js, dijkstra.js), au bit près, mais sans Map ni objet par
// arc : sur un réseau parisien de 15 km (≈ 900 000 nœuds, ≈ 1 000 000 de
// tronçons), la préparation des données par mode passait de 4 à 16 s
// (mesure du 04/11/2026, docs/diagnostic-carte-paris-2026-11.md).
//
// Ce qui garantit des résultats identiques :
//   - coûts calculés par les mêmes fonctions (penteArete, coutsArete,
//     croisementComparable dans graph.js), stockés en Float64 (nombres JS) ;
//   - voisins de chaque nœud rangés dans le même ordre que la liste
//     d'adjacence (tronçons dans l'ordre du graphe, sens direct puis inverse),
//     y compris pour le graphe inverse (même parcours que transposeAdjacency) ;
//   - tas binaire avec exactement les mêmes comparaisons que MinHeap, donc les
//     mêmes ex aequo départagés de la même façon ;
//   - temps rendus dans des Map remplies dans le même ordre qu'avant (ordre de
//     première atteinte), car certains traitements en aval en dépendent
//     (index voiture, ex aequo de distance).
// Vérifié le 04/11/2026 : ancien et nouveau moteur comparés sur des réseaux
// synthétiques variés (pentes, Z manquants, sens uniques, carrefours, chemins,
// voies privées ; trois sens de trajet ; avec et sans îlots) : empreinte
// identique des zones, des temps et des diagnostics, ordre compris
// (docs/diagnostic-carte-paris-2026-11.md).
// ==========================================================================
import {
  isEdgeUsable,
  penteArete,
  coutsArete,
  croisementComparable,
  delaiCarrefour,
  PASSES_LISSAGE_ALTITUDE,
} from "./graph.js";

/**
 * Numérote les nœuds du graphe (ordre de graph.nodeCoords) et les extrémités
 * de chaque tronçon. Résultat gardé sur le graphe (calculé une seule fois).
 * @param {object} graph
 * @returns {{n:number, m:number, ids:Array, index:Map, lon:Float64Array, lat:Float64Array,
 *   de:Int32Array, vers:Int32Array}}
 */
export function indexerGraphe(graph) {
  if (graph._index) return graph._index;
  const n = graph.nodeCoords.size;
  const ids = new Array(n);
  const index = new Map();
  const lon = new Float64Array(n);
  const lat = new Float64Array(n);
  let i = 0;
  for (const [id, c] of graph.nodeCoords) {
    ids[i] = id;
    index.set(id, i);
    lon[i] = c[0];
    lat[i] = c[1];
    i++;
  }
  const m = graph.edges.length;
  const de = new Int32Array(m);
  const vers = new Int32Array(m);
  for (let e = 0; e < m; e++) {
    de[e] = index.get(graph.edges[e].from);
    vers[e] = index.get(graph.edges[e].to);
  }
  const idx = { n, m, ids, index, lon, lat, de, vers };
  Object.defineProperty(graph, "_index", { value: idx, enumerable: false, configurable: true });
  return idx;
}

/**
 * Données communes à tous les modes : pente de chaque tronçon, et présence
 * d'un vrai croisement à l'arrivée (calculée à la demande, une fois par
 * tronçon et par sens, au lieu d'une fois par mode et par sens).
 */
export function preparerReseau(graph, elevations, nodeDegrees, nodeIncidentEdges) {
  const idx = indexerGraphe(graph);
  const pente = new Float64Array(idx.m);
  for (let e = 0; e < idx.m; e++) pente[e] = penteArete(graph.edges[e], elevations);
  const carrefour = new Uint8Array(idx.n);
  for (let i = 0; i < idx.n; i++) carrefour[i] = (nodeDegrees.get(idx.ids[i]) || 0) >= 3 ? 1 : 0;
  // 0 : pas encore calculé ; 1 : non ; 2 : oui. Indice 2e (sens direct), 2e+1 (inverse).
  const croise = new Uint8Array(2 * idx.m);
  const croisement = (e, sens) => {
    const k = 2 * e + sens;
    if (croise[k] === 0) {
      const edge = graph.edges[e];
      const from = sens === 0 ? edge.from : edge.to;
      const to = sens === 0 ? edge.to : edge.from;
      croise[k] = croisementComparable(graph, edge, from, to, nodeIncidentEdges) ? 2 : 1;
    }
    return croise[k] === 2;
  };
  return { graph, idx, pente, carrefour, croisement };
}

/**
 * Adjacence d'un mode, au format CSR : les arcs partant du nœud i sont
 * vers[debut[i] .. debut[i+1]-1]. Mêmes arcs, mêmes coûts, même ordre que
 * buildAdjacency.
 * @param {object} prep  Résultat de preparerReseau.
 * @param {string} mode  « car », « walk », « bike » ou « ebike ».
 * @param {{urbain?: boolean, details?: boolean}} [o]  details : garder longueur
 *   et pénalité de chaque arc (diagnostic voiture).
 */
export function adjacenceCSR(prep, mode, { urbain = false, details = false } = {}) {
  const { graph, idx, pente, carrefour, croisement } = prep;
  const { n, m, de, vers } = idx;
  const delai = delaiCarrefour(mode);
  const coutAvant = new Float64Array(m);
  const coutArriere = new Float64Array(m);
  const sensArc = new Uint8Array(m); // bit 1 : arc direct ; bit 2 : arc inverse
  const degre = new Int32Array(n + 1);
  const c = {};
  let nArcs = 0;
  for (let e = 0; e < m; e++) {
    const edge = graph.edges[e];
    if (!isEdgeUsable(edge, mode)) continue;
    coutsArete(edge, pente[e], mode, urbain, c);
    let s = 0;
    if (!c.backwardOnly) {
      s |= 1;
      degre[de[e]]++;
      nArcs++;
    }
    if (!c.forwardOnly) {
      s |= 2;
      degre[vers[e]]++;
      nArcs++;
    }
    sensArc[e] = s;
    coutAvant[e] = c.costForward;
    coutArriere[e] = c.costBackward;
  }
  const debut = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) debut[i + 1] = debut[i] + degre[i];
  const pos = debut.slice(0, n);
  const cible = new Int32Array(nArcs);
  const cout = new Float64Array(nArcs);
  const longueur = details ? new Float64Array(nArcs) : null;
  const penalite = details ? new Float64Array(nArcs) : null;
  // Ordre d'apparition des nœuds de départ : celui des clés de la Map
  // d'adjacence d'origine, que transposeAdjacency parcourt.
  const ordreSources = [];
  const ajouter = (from, to, base, e, sens) => {
    let d = 0;
    if (carrefour[to] === 1 && croisement(e, sens)) d = delai;
    const k = pos[from]++;
    if (k === debut[from]) ordreSources.push(from);
    cible[k] = to;
    cout[k] = base + d;
    if (details) {
      longueur[k] = graph.edges[e].length;
      penalite[k] = d;
    }
  };
  for (let e = 0; e < m; e++) {
    const s = sensArc[e];
    if (s & 1) ajouter(de[e], vers[e], coutAvant[e], e, 0);
    if (s & 2) ajouter(vers[e], de[e], coutArriere[e], e, 1);
  }
  // utilisable[e] : tronçon praticable par ce mode (au moins un arc).
  return { n, debut, cible, cout, longueur, penalite, ordreSources: Int32Array.from(ordreSources), utilisable: sensArc };
}

/**
 * Graphe inverse (chaque arc u→v devient v→u, même coût), voisins dans le
 * même ordre que transposeAdjacency. O(nombre d'arcs).
 */
export function transposerCSR(a) {
  const { n, debut, cible, cout, longueur, penalite, ordreSources } = a;
  const nArcs = cible.length;
  const deb = new Int32Array(n + 1);
  for (let k = 0; k < nArcs; k++) deb[cible[k] + 1]++;
  for (let i = 0; i < n; i++) deb[i + 1] += deb[i];
  const pos = deb.slice(0, n);
  const cib = new Int32Array(nArcs);
  const co = new Float64Array(nArcs);
  const lo = longueur ? new Float64Array(nArcs) : null;
  const pe = penalite ? new Float64Array(nArcs) : null;
  for (let s = 0; s < ordreSources.length; s++) {
    const u = ordreSources[s];
    for (let k = debut[u]; k < debut[u + 1]; k++) {
      const j = pos[cible[k]]++;
      cib[j] = u;
      co[j] = cout[k];
      if (lo) {
        lo[j] = longueur[k];
        pe[j] = penalite[k];
      }
    }
  }
  return { n, debut: deb, cible: cib, cout: co, longueur: lo, penalite: pe, ordreSources: null };
}

/**
 * Plus courts chemins à origine unique avec coupure (même algorithme que
 * dijkstra() de dijkstra.js, mêmes ex aequo).
 * @returns {{temps: Float64Array, ordre: Int32Array, distance: Float64Array|null, delai: Float64Array|null}}
 *   temps : Infinity si non atteint ; ordre : nœuds atteints, dans l'ordre de première atteinte.
 */
export function dijkstraCSR(a, origine, plafond, avecDetails = false) {
  const { n, debut, cible, cout, longueur, penalite } = a;
  const temps = new Float64Array(n).fill(Infinity);
  const distance = avecDetails ? new Float64Array(n) : null;
  const delai = avecDetails ? new Float64Array(n) : null;
  const ordre = new Int32Array(n);
  let nOrdre = 0;
  // Tas binaire : priorités et valeurs dans deux tableaux parallèles.
  let cap = 1024;
  let pr = new Float64Array(cap);
  let va = new Int32Array(cap);
  let taille = 0;
  const empiler = (p, v) => {
    if (taille === cap) {
      cap *= 2;
      const pr2 = new Float64Array(cap);
      pr2.set(pr);
      pr = pr2;
      const va2 = new Int32Array(cap);
      va2.set(va);
      va = va2;
    }
    let i = taille++;
    pr[i] = p;
    va[i] = v;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      const tp = pr[parent];
      pr[parent] = pr[i];
      pr[i] = tp;
      const tv = va[parent];
      va[parent] = va[i];
      va[i] = tv;
      i = parent;
    }
  };
  temps[origine] = 0;
  ordre[nOrdre++] = origine;
  empiler(0, origine);
  while (taille > 0) {
    const d = pr[0];
    const u = va[0];
    // Dépiler (même déroulé que MinHeap.pop).
    taille--;
    if (taille > 0) {
      pr[0] = pr[taille];
      va[0] = va[taille];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1,
          r = 2 * i + 2;
        let plusPetit = i;
        if (l < taille && pr[l] < pr[plusPetit]) plusPetit = l;
        if (r < taille && pr[r] < pr[plusPetit]) plusPetit = r;
        if (plusPetit === i) break;
        const tp = pr[i];
        pr[i] = pr[plusPetit];
        pr[plusPetit] = tp;
        const tv = va[i];
        va[i] = va[plusPetit];
        va[plusPetit] = tv;
        i = plusPetit;
      }
    }
    if (d > temps[u]) continue;
    if (d > plafond) continue;
    for (let k = debut[u]; k < debut[u + 1]; k++) {
      const nd = d + cout[k];
      if (nd > plafond) continue;
      const v = cible[k];
      if (nd < temps[v]) {
        if (temps[v] === Infinity) ordre[nOrdre++] = v;
        temps[v] = nd;
        if (avecDetails) {
          distance[v] = distance[u] + longueur[k];
          delai[v] = delai[u] + penalite[k];
        }
        empiler(nd, v);
      }
    }
  }
  return { temps, ordre: ordre.subarray(0, nOrdre), distance, delai };
}

/**
 * Temps de trajet par nœud selon la direction (équivalent de
 * tempsSelonDirection, isochrones.js), sur tableaux.
 * @returns {{temps: Float64Array, ordre: Int32Array, distance: Float64Array|null, delai: Float64Array|null, inverse: object|null}}
 *   inverse : graphe inverse construit au passage (réutilisable), sinon null.
 */
export function tempsSelonDirectionCSR(a, origine, plafond, direction, avecDetails = false) {
  if (direction === "depart") {
    return { ...dijkstraCSR(a, origine, plafond, avecDetails), inverse: null };
  }
  const inverse = transposerCSR(a);
  if (direction === "arrivee") {
    return { ...dijkstraCSR(inverse, origine, plafond, avecDetails), inverse };
  }
  const aller = dijkstraCSR(a, origine, plafond, avecDetails);
  const retour = dijkstraCSR(inverse, origine, plafond, avecDetails);
  const n = a.n;
  const temps = new Float64Array(n).fill(Infinity);
  const distance = avecDetails ? new Float64Array(n) : null;
  const delai = avecDetails ? new Float64Array(n) : null;
  const ordre = new Int32Array(aller.ordre.length);
  let nOrdre = 0;
  for (let j = 0; j < aller.ordre.length; j++) {
    const v = aller.ordre[j];
    const r = retour.temps[v];
    if (r === Infinity) continue;
    temps[v] = aller.temps[v] + r;
    ordre[nOrdre++] = v;
    if (avecDetails) {
      distance[v] = aller.distance[v] + retour.distance[v];
      delai[v] = aller.delai[v] + retour.delai[v];
    }
  }
  return { temps, ordre: ordre.subarray(0, nOrdre), distance, delai, inverse };
}

/** Map identifiant → valeur, dans l'ordre de `ordre` (celui de l'ancien moteur). */
export function versMap(ids, ordre, valeurs) {
  const m = new Map();
  for (let j = 0; j < ordre.length; j++) m.set(ids[ordre[j]], valeurs[ordre[j]]);
  return m;
}

/**
 * Temps voiture « effectif » par nœud (estimateCarTime, graph.js), calculé à
 * la demande et gardé en cache : il ne dépend pas du mode, donc sert aux
 * trois. Mêmes nombres que l'appel direct.
 * @param {(i:number) => number} estimer  Temps voiture effectif du nœud i.
 */
export function cacheTempsVoiture(estimer, n) {
  const cache = new Float64Array(n).fill(NaN);
  return (i) => {
    let t = cache[i];
    if (t !== t) {
      t = estimer(i);
      cache[i] = t;
    }
    return t;
  };
}

/**
 * Parcours en largeur depuis l'origine, restreint aux nœuds gagnants (même
 * ordre de visite que connectedWinningNodes).
 * @returns {{ensemble: Set, drapeaux: Uint8Array}} ensemble : identifiants, dans l'ordre de visite.
 */
export function gagnantsConnexesCSR(a, ids, tempsMode, voiture, origine, penalite) {
  const drapeaux = new Uint8Array(a.n);
  const ensemble = new Set([ids[origine]]);
  drapeaux[origine] = 1;
  const file = new Int32Array(a.n);
  let tete = 0,
    queue = 0;
  file[queue++] = origine;
  const { debut, cible } = a;
  while (tete < queue) {
    const u = file[tete++];
    for (let k = debut[u]; k < debut[u + 1]; k++) {
      const v = cible[k];
      if (drapeaux[v]) continue;
      const mt = tempsMode[v];
      if (mt === Infinity) continue;
      if (!(mt < voiture(v) + penalite)) continue;
      drapeaux[v] = 1;
      ensemble.add(ids[v]);
      file[queue++] = v;
    }
  }
  return { ensemble, drapeaux };
}

/** Tous les nœuds gagnants, reliés ou non (même ordre que allWinningNodes). */
export function tousGagnantsCSR(ids, ordreMode, tempsMode, voiture, origine, penalite, n) {
  const drapeaux = new Uint8Array(n);
  const ensemble = new Set([ids[origine]]);
  drapeaux[origine] = 1;
  for (let j = 0; j < ordreMode.length; j++) {
    const v = ordreMode[j];
    if (tempsMode[v] < voiture(v) + penalite) {
      drapeaux[v] = 1;
      ensemble.add(ids[v]);
    }
  }
  return { ensemble, drapeaux };
}

/**
 * Connexité brute du réseau (tous tronçons, sans filtre) depuis l'origine :
 * même résultat que checkRawConnectivity (graph.js).
 */
export function connexiteBruteCSR(idx, origine) {
  const { n, m, de, vers } = idx;
  const deg = new Int32Array(n + 1);
  for (let e = 0; e < m; e++) {
    deg[de[e] + 1]++;
    deg[vers[e] + 1]++;
  }
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const pos = deg.slice(0, n);
  const voisin = new Int32Array(2 * m);
  for (let e = 0; e < m; e++) {
    voisin[pos[de[e]]++] = vers[e];
    voisin[pos[vers[e]]++] = de[e];
  }
  const vu = new Uint8Array(n);
  const file = new Int32Array(n);
  let tete = 0,
    queue = 0,
    atteints = 1;
  vu[origine] = 1;
  file[queue++] = origine;
  while (tete < queue) {
    const u = file[tete++];
    for (let k = deg[u]; k < deg[u + 1]; k++) {
      const v = voisin[k];
      if (!vu[v]) {
        vu[v] = 1;
        atteints++;
        file[queue++] = v;
      }
    }
  }
  return { reachable: atteints, total: n };
}

/**
 * Voisins de chaque nœud le long des tronçons, sans tenir compte du sens, dans
 * le même ordre que les listes construites par completerAltitudes et
 * lisserAltitudes (graph.js). Gardé sur l'index (calculé une fois).
 */
function voisinsNonOrientes(idx) {
  if (idx.voisins) return idx.voisins;
  const { n, m, de, vers } = idx;
  const debut = new Int32Array(n + 1);
  for (let e = 0; e < m; e++) {
    debut[de[e] + 1]++;
    debut[vers[e] + 1]++;
  }
  for (let i = 0; i < n; i++) debut[i + 1] += debut[i];
  const pos = debut.slice(0, n);
  const voisin = new Int32Array(2 * m);
  for (let e = 0; e < m; e++) {
    voisin[pos[de[e]]++] = vers[e];
    voisin[pos[vers[e]]++] = de[e];
  }
  idx.voisins = { debut, voisin };
  return idx.voisins;
}

/**
 * Même calcul que completerAltitudes (graph.js), sur tableaux : altitudes
 * manquantes complétées par la moyenne des voisins connus, en quelques passes.
 * Modifie `elevations` en place (mêmes valeurs, ajoutées dans le même ordre).
 * @returns {number} Nombre de nœuds encore sans altitude.
 */
export function completerAltitudesCSR(graph, elevations, passes = 6) {
  const idx = indexerGraphe(graph);
  const { debut, voisin } = voisinsNonOrientes(idx);
  const z = new Float64Array(idx.n);
  const connu = new Uint8Array(idx.n);
  for (let i = 0; i < idx.n; i++) {
    const v = elevations.get(idx.ids[i]);
    if (v !== undefined) {
      z[i] = v;
      connu[i] = 1;
    }
  }
  let manquants = [];
  for (let i = 0; i < idx.n; i++) if (!connu[i]) manquants.push(i);
  for (let p = 0; p < passes && manquants.length; p++) {
    const ajoutsI = [];
    const ajoutsZ = [];
    for (const i of manquants) {
      let somme = 0,
        nb = 0;
      for (let k = debut[i]; k < debut[i + 1]; k++) {
        const v = voisin[k];
        if (connu[v]) {
          somme += z[v];
          nb++;
        }
      }
      if (nb) {
        ajoutsI.push(i);
        ajoutsZ.push(somme / nb);
      }
    }
    if (!ajoutsI.length) break;
    for (let a = 0; a < ajoutsI.length; a++) {
      const i = ajoutsI[a];
      z[i] = ajoutsZ[a];
      connu[i] = 1;
      elevations.set(idx.ids[i], ajoutsZ[a]);
    }
    manquants = manquants.filter((i) => !connu[i]);
  }
  return manquants.length;
}

/**
 * Même calcul que lisserAltitudes (graph.js), sur tableaux : chaque nœud
 * prend la moyenne de sa propre altitude et de celles de ses voisins.
 * Modifie `elevations` en place (mêmes valeurs).
 */
export function lisserAltitudesCSR(graph, elevations, passes = PASSES_LISSAGE_ALTITUDE) {
  const idx = indexerGraphe(graph);
  const { debut, voisin } = voisinsNonOrientes(idx);
  const z = new Float64Array(idx.n);
  const connu = new Uint8Array(idx.n);
  for (let i = 0; i < idx.n; i++) {
    const v = elevations.get(idx.ids[i]);
    if (v !== undefined) {
      z[i] = v;
      connu[i] = 1;
    }
  }
  const lisse = new Float64Array(idx.n);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < idx.n; i++) {
      if (!connu[i]) continue;
      let somme = z[i],
        nb = 1;
      for (let k = debut[i]; k < debut[i + 1]; k++) {
        const v = voisin[k];
        if (connu[v]) {
          somme += z[v];
          nb++;
        }
      }
      lisse[i] = somme / nb;
    }
    for (let i = 0; i < idx.n; i++) if (connu[i]) z[i] = lisse[i];
  }
  for (let i = 0; i < idx.n; i++) if (connu[i]) elevations.set(idx.ids[i], z[i]);
}

/**
 * Lecture façon Map (get, has, size, parcours dans l'ordre de première
 * atteinte) d'un résultat sur tableaux, sans recopier ~1 million d'entrées
 * dans une vraie Map : sert aux temps des modes et aux diagnostics voiture,
 * qui ne sont que consultés.
 */
export class ValeursParNoeud {
  /**
   * @param {Array} ids @param {Map} index  identifiant ↔ numéro (indexerGraphe)
   * @param {Int32Array} ordre  nœuds présents, dans l'ordre de première atteinte
   * @param {Float64Array} temps  Infinity pour un nœud absent
   * @param {Float64Array} [valeurs]  valeur rendue (par défaut : temps)
   */
  constructor(ids, index, ordre, temps, valeurs = temps) {
    this.ids = ids;
    this.index = index;
    this.ordre = ordre;
    this.temps = temps;
    this.valeurs = valeurs;
  }
  get size() {
    return this.ordre.length;
  }
  has(id) {
    const i = this.index.get(id);
    return i !== undefined && this.temps[i] !== Infinity;
  }
  get(id) {
    const i = this.index.get(id);
    return i !== undefined && this.temps[i] !== Infinity ? this.valeurs[i] : undefined;
  }
  *keys() {
    for (let j = 0; j < this.ordre.length; j++) yield this.ids[this.ordre[j]];
  }
  *entries() {
    for (let j = 0; j < this.ordre.length; j++) {
      const i = this.ordre[j];
      yield [this.ids[i], this.valeurs[i]];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
}

/**
 * Temps voiture « effectif » de chaque nœud (même calcul, même résultat que
 * estimateCarTime + buildCarReachabilityIndex + findNearestCarTime de
 * graph.js), sur tableaux : compartiments de 200 m numérotés au lieu de clés
 * texte, candidats rangés dans des tableaux, même ordre de parcours des
 * anneaux et des candidats (donc même candidat retenu à égalité), même
 * formule de distance. Mesure du 09/11/2026 à Paris : ce repli coûtait 9,5 s
 * (vélo) et 14,5 s (VAE) par carte.
 * @param {object} idx  indexerGraphe
 * @param {Map} carTimes  temps voiture (identifiant → s), dans l'ordre de l'ancien moteur
 * @param {number} tailleCellule  m (200 dans isochrones.js)
 * @param {number} anneauMax  CAR_GAP_MAX_SEARCH_RING
 * @param {number} vitesseRepli  CAR_GAP_FALLBACK_SPEED_MS
 * @param {(a:number,b:number,c:number,d:number)=>number} distance  haversineMeters
 * @returns {(i:number, facteur:number) => number}
 */
// Rayon terrestre des distances (6 371 000 m, celui de haversineMeters) en
// mètres par degré, réduit de 0,1 % pour le minorant de distance.
const RAYON_MINORANT = ((6371000 * Math.PI) / 180) * 0.999;

export function tempsVoitureEffectifCSR(idx, carTimes, tailleCellule, anneauMax, vitesseRepli, distance) {
  const { n, index, lon, lat } = idx;
  const mParDegLat = 111320;
  const celluleX = (lo, la) => {
    const mParDegLon = 111320 * Math.cos((la * Math.PI) / 180);
    return Math.floor(lo / (tailleCellule / mParDegLon));
  };
  const celluleY = (la) => Math.floor(la / (tailleCellule / mParDegLat));
  const direct = new Float64Array(n).fill(NaN);
  const m = carTimes.size;
  const cx = new Int32Array(m),
    cy = new Int32Array(m),
    nd = new Int32Array(m);
  const tv = new Float64Array(m);
  let k = 0,
    minCx = Infinity,
    maxCx = -Infinity,
    minCy = Infinity,
    maxCy = -Infinity;
  for (const [id, t] of carTimes) {
    const i = index.get(id);
    direct[i] = t;
    nd[k] = i;
    tv[k] = t;
    cx[k] = celluleX(lon[i], lat[i]);
    cy[k] = celluleY(lat[i]);
    if (cx[k] < minCx) minCx = cx[k];
    if (cx[k] > maxCx) maxCx = cx[k];
    if (cy[k] < minCy) minCy = cy[k];
    if (cy[k] > maxCy) maxCy = cy[k];
    k++;
  }
  if (m === 0) {
    return (i) => (Number.isNaN(direct[i]) ? Infinity : direct[i]);
  }
  // Compartiments numérotés dans l'emprise ; candidats dans l'ordre de carTimes.
  const largeur = maxCy - minCy + 1;
  const nCases = (maxCx - minCx + 1) * largeur;
  const debut = new Int32Array(nCases + 1);
  for (let j = 0; j < m; j++) debut[(cx[j] - minCx) * largeur + (cy[j] - minCy) + 1]++;
  for (let c = 0; c < nCases; c++) debut[c + 1] += debut[c];
  const pos = debut.slice(0, nCases);
  const cLon = new Float64Array(m),
    cLat = new Float64Array(m),
    cT = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    const c = (cx[j] - minCx) * largeur + (cy[j] - minCy);
    const p = pos[c]++;
    cLon[p] = lon[nd[j]];
    cLat[p] = lat[nd[j]];
    cT[p] = tv[j];
  }
  return (i, facteur) => {
    const d0 = direct[i];
    if (!Number.isNaN(d0)) return d0;
    const lo = lon[i],
      la = lat[i];
    const x = celluleX(lo, la),
      y = celluleY(la);
    const premierAnneau = Math.max(minCx - x, x - maxCx, minCy - y, y - maxCy, 0);
    if (premierAnneau > anneauMax) return Infinity;
    let meilleur = -1,
      meilleureDist = Infinity;
    // Minorant rapide de la distance (projection équirectangulaire avec le
    // plus petit cosinus de latitude de la zone de recherche, puis −0,1 %) :
    // un candidat dont le minorant atteint déjà la meilleure distance ne peut
    // pas la battre (comparaison stricte), on évite alors le calcul exact.
    // Le minorant est toujours inférieur à la distance de haversineMeters
    // (écart entre les deux formules < 10⁻⁵ en relatif sous 10 km), donc le
    // candidat retenu et la distance rendue sont exactement les mêmes.
    const cosBas = Math.cos(((Math.abs(la) + 0.1) * Math.PI) / 180);
    const kLon = RAYON_MINORANT * cosBas,
      kLat = RAYON_MINORANT;
    const examiner = (dx, dy) => {
      const c = (x + dx - minCx) * largeur + (y + dy - minCy);
      for (let p = debut[c]; p < debut[c + 1]; p++) {
        if (meilleur >= 0) {
          const ex = (cLon[p] - lo) * kLon,
            ey = (cLat[p] - la) * kLat;
          if (ex * ex + ey * ey >= meilleureDist * meilleureDist) continue;
        }
        const d = distance(lo, la, cLon[p], cLat[p]);
        if (d < meilleureDist) {
          meilleureDist = d;
          meilleur = p;
        }
      }
    };
    const dernierAnneau = Math.min(
      anneauMax,
      Math.max(Math.abs(minCx - x), Math.abs(maxCx - x), Math.abs(minCy - y), Math.abs(maxCy - y)),
    );
    for (let anneau = premierAnneau; anneau <= dernierAnneau; anneau++) {
      const dxMin = Math.max(-anneau, minCx - x),
        dxMax = Math.min(anneau, maxCx - x);
      const dyMin = Math.max(-anneau, minCy - y),
        dyMax = Math.min(anneau, maxCy - y);
      for (let dx = dxMin; dx <= dxMax; dx++) {
        if (Math.abs(dx) === anneau) {
          for (let dy = dyMin; dy <= dyMax; dy++) examiner(dx, dy);
        } else {
          if (-anneau >= dyMin) examiner(dx, -anneau);
          if (anneau <= dyMax) examiner(dx, anneau);
        }
      }
      if (meilleur >= 0 && anneau > 0) break;
    }
    if (meilleur < 0) return Infinity;
    return cT[meilleur] + (facteur * meilleureDist) / vitesseRepli;
  };
}

/**
 * Diagnostic de la frontière d'une zone (même résultat que analyzeFrontier,
 * graph.js) sur tableaux : appartenance par drapeaux au lieu d'un Set
 * d'identifiants, paires de nœuds numérotées au lieu de clés texte, temps
 * voiture effectif lu dans le cache commun (mêmes nombres que
 * estimateCarTime, voir tempsVoitureEffectifCSR). Tronçons parcourus dans le
 * même ordre, donc même tronçon retenu pour une paire en double.
 * @param {object} idx  indexerGraphe @param {Array} edges  graph.edges
 * @param {string} mode @param {Uint8Array} gagne  drapeaux des nœuds gagnants
 * @param {Float64Array} tempsMode  Infinity si non atteint
 * @param {(i:number)=>number} voiture  temps voiture effectif (facteur de trajets compris)
 * @param {number} penalite  s
 */
export function analyserFrontiereCSR(idx, edges, mode, gagne, tempsMode, voiture, penalite) {
  const { n, de, vers } = idx;
  const counts = { excludedByFilter: 0, beyondTimeBudget: 0, carWins: 0, other: 0 };
  const vues = new Set();
  for (let e = 0; e < de.length; e++) {
    const a = de[e],
      b = vers[e];
    const dansA = gagne[a] === 1,
      dansB = gagne[b] === 1;
    if (dansA === dansB) continue;
    const dehors = dansA ? b : a;
    const cle = a < b ? a * n + b : b * n + a;
    if (vues.has(cle)) continue;
    vues.add(cle);
    if (!isEdgeUsable(edges[e], mode)) {
      counts.excludedByFilter++;
      continue;
    }
    const mt = tempsMode[dehors];
    if (mt === Infinity) {
      counts.beyondTimeBudget++;
      continue;
    }
    if (mt >= voiture(dehors) + penalite) counts.carWins++;
    else counts.other++;
  }
  return counts;
}
