// ==========================================================================
// Dijkstra à origine unique avec coupure de temps
// (méthode de référence pour le calcul d'isochrone en réseau —
// cf. Wagner et al. 2016, "Fast Computation of Isochrones in Road Networks")
// ==========================================================================

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(priority, value) {
    this.items.push([priority, value]);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent][0] <= this.items[i][0]) { break; }
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }
  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let smallest = i;
        if (l < this.items.length && this.items[l][0] < this.items[smallest][0]) { smallest = l; }
        if (r < this.items.length && this.items[r][0] < this.items[smallest][0]) { smallest = r; }
        if (smallest === i) { break; }
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * @param {Map<string, Array<{to:string, cost:number}>>} adjacency
 * @param {string} originId
 * @param {number} maxCost Coupure (secondes) : on n'explore pas au-delà.
 * @param {Map<string, number>} [distanceOut] Rempli, si fourni, avec la
 *   distance (m) parcourue le long du même chemin optimal en temps — utile
 *   pour le diagnostic (distinguer une vitesse sous-estimée d'un détour).
 * @param {Map<string, number>} [delayOut] Rempli, si fourni, avec le cumul
 *   des pénalités de carrefour le long du même chemin — utile pour le
 *   diagnostic (vérifier si un temps élevé vient d'un enchaînement de
 *   carrefours).
 * @returns {Map<string, number>} temps d'accès (secondes) par nœud atteint
 */
export function dijkstra(adjacency, originId, maxCost, distanceOut, delayOut) {
  const dist = new Map();
  const heap = new MinHeap();
  dist.set(originId, 0);
  if (distanceOut) { distanceOut.set(originId, 0); }
  if (delayOut) { delayOut.set(originId, 0); }
  heap.push(0, originId);
  while (heap.size > 0) {
    const [d, u] = heap.pop();
    if (d > (dist.get(u) ?? Infinity)) { continue; }
    if (d > maxCost) { continue; }
    const neighbors = adjacency.get(u) || [];
    for (const { to, cost, length, delay } of neighbors) {
      const nd = d + cost;
      if (nd > maxCost) { continue; }
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        if (distanceOut) { distanceOut.set(to, (distanceOut.get(u) ?? 0) + (length ?? 0)); }
        if (delayOut) { delayOut.set(to, (delayOut.get(u) ?? 0) + (delay ?? 0)); }
        heap.push(nd, to);
      }
    }
  }
  return dist;
}
