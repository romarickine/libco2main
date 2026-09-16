// ==========================================================================
// Grille hexagonale : tamponnage le long des rues gagnantes.
// Coordonnées axiales standard (cf. Red Blob Games, "Hexagonal Grids") avec
// arrondi cube exact — affichage direct des hexagones (pas de fusion en un
// contour unique : sur un réseau de rues qui se croisent à angle droit,
// plusieurs hexagones se touchent au même sommet, ce qu'un traceur de
// contour naïf confond avec des boucles séparées et fragmente à tort).
// ==========================================================================

const EARTH_RADIUS = 6371000;

export class HexGrid {
  constructor(refLon, refLat, hexSize, precision = 6) {
    this.refLon = refLon; this.refLat = refLat;
    this.hexSize = Math.max(hexSize, 1);
    this.precision = Math.max(1, Math.min(10, precision));
    this.R = this.hexSize / Math.sqrt(3);
    this.mPerDegLat = (Math.PI / 180) * EARTH_RADIUS;
    this.mPerDegLon = (Math.PI / 180) * EARTH_RADIUS * Math.cos((refLat * Math.PI) / 180);
  }
  toLocalMeters(lon, lat) { return [(lon - this.refLon) * this.mPerDegLon, (lat - this.refLat) * this.mPerDegLat]; }
  toLonLat(x, y) { return [this.refLon + x / this.mPerDegLon, this.refLat + y / this.mPerDegLat]; }
  pixelToAxial(px, py) {
    const q = (Math.sqrt(3) / 3 * px - (1 / 3) * py) / this.R;
    const r = ((2 / 3) * py) / this.R;
    return this.axialRound(q, r);
  }
  axialRound(q, r) {
    let x = q, z = r, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) { rx = -ry - rz; } else if (dy > dz) { ry = -rx - rz; } else { rz = -rx - ry; }
    return [rx, rz];
  }
  axialToPixel(q, r) { return [this.R * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r), this.R * 1.5 * r]; }
  hexagonVertices(centerX, centerY) {
    const verts = [30, 90, 150, 210, 270, 330].map((a) => { const rad = (a * Math.PI) / 180; return [centerX + this.R * Math.cos(rad), centerY + this.R * Math.sin(rad)]; });
    verts.push(verts[0]);
    return verts;
  }
  addPointToGrid(hexagons, lon, lat) {
    const [px, py] = this.toLocalMeters(lon, lat);
    const [q, r] = this.pixelToAxial(px, py);
    const key = q + ',' + r;
    if (!hexagons[key]) {
      const [cx, cy] = this.axialToPixel(q, r);
      const coordinates = this.hexagonVertices(cx, cy).map(([x, y]) => { const [lo, la] = this.toLonLat(x, y); return [+lo.toFixed(this.precision), +la.toFixed(this.precision)]; });
      hexagons[key] = { coordinates };
    }
    return key;
  }
  addSegmentToGrid(hexagons, lon1, lat1, lon2, lat2) {
    const lengthKm = HexGrid.coordDistance(lon1, lat1, lon2, lat2);
    const steps = Math.max(1, Math.ceil((lengthKm * 1000) / (this.hexSize * 0.5)));
    for (let i = 0; i <= steps; i++) { const t = i / steps; this.addPointToGrid(hexagons, lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t); }
  }
  static coordDistance(lon1, lat1, lon2, lat2) {
    const R = EARTH_RADIUS / 1000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

// ==========================================================================
// Traçage de contour vectoriel : transforme le "tapis" d'hexagones en un
// polygone plein avec un contour net, plutôt que d'afficher chaque hexagone
// individuellement (aspect grêlé/pointillé, surtout en zone moins dense).
//
// Principe (suivi de frontière type DCEL) : à chaque sommet où plusieurs
// arêtes de bordure se rejoignent (carrefour dense), on prend celle qui fait
// le virage le plus serré à droite par rapport à la direction d'arrivée —
// ça garde le contour sur la frontière extérieure même aux points de jonction
// multiple, là où un simple appariement "première arête trouvée" se perd et
// fragmente la forme en dizaines de petites boucles.
//
// Cette trace produit aussi de vraies petites boucles internes légitimes :
// un îlot urbain entouré de rues sur ses 4 côtés a un intérieur non couvert
// par aucune rue, donc un vrai "trou" topologique. On choisit de les ignorer
// (remplir ces petits trous) pour un rendu plus lisible plutôt que de les
// représenter comme des trous de polygone.
// ==========================================================================
export function traceOuterBoundaries(hexagons, precision) {
  const keyFmt = (a, b) => a.toFixed(precision) + ',' + b.toFixed(precision);
  const segKeyUndirected = (p1, p2) => {
    const a = keyFmt(p1[0], p1[1]), b = keyFmt(p2[0], p2[1]);
    return a < b ? a + '|' + b : b + '|' + a;
  };
  const edgeCount = new Map();
  for (const key in hexagons) {
    const c = hexagons[key].coordinates;
    for (let i = 0; i < c.length - 1; i++) { const k = segKeyUndirected(c[i], c[i + 1]); edgeCount.set(k, (edgeCount.get(k) || 0) + 1); }
  }
  const boundaryEdges = [];
  for (const key in hexagons) {
    const c = hexagons[key].coordinates;
    for (let i = 0; i < c.length - 1; i++) {
      const p1 = c[i], p2 = c[i + 1];
      if (edgeCount.get(segKeyUndirected(p1, p2)) === 1) { boundaryEdges.push({ start: p1, end: p2 }); }
    }
  }
  const byStart = new Map();
  for (const e of boundaryEdges) {
    const k = keyFmt(e.start[0], e.start[1]);
    if (!byStart.has(k)) { byStart.set(k, []); }
    byStart.get(k).push(e);
  }
  const used = new Set();
  const loops = [];
  for (const e0 of boundaryEdges) {
    if (used.has(e0)) { continue; }
    const loop = [e0.start];
    let current = e0;
    let guard = 0;
    const maxSteps = boundaryEdges.length + 2;
    for (;;) {
      used.add(current);
      loop.push(current.end);
      const endKey = keyFmt(current.end[0], current.end[1]);
      const candidates = (byStart.get(endKey) || []).filter((c) => c === e0 || !used.has(c));
      if (candidates.length === 0) { break; }
      let next = candidates[0];
      if (candidates.length > 1) {
        const inAngle = Math.atan2(current.end[1] - current.start[1], current.end[0] - current.start[0]);
        let bestTurn = Infinity;
        for (const cand of candidates) {
          const outAngle = Math.atan2(cand.end[1] - cand.start[1], cand.end[0] - cand.start[0]);
          let turn = inAngle - outAngle;
          while (turn <= 0) { turn += 2 * Math.PI; }
          while (turn > 2 * Math.PI) { turn -= 2 * Math.PI; }
          if (turn < bestTurn) { bestTurn = turn; next = cand; }
        }
      }
      if (next === e0) { break; }
      current = next;
      guard++;
      if (guard > maxSteps) { break; }
    }
    if (loop.length > 3) { loops.push(loop); }
  }
  return loops;
}

function polygonArea(loop) {
  let area = 0;
  for (let i = 0; i < loop.length - 1; i++) { area += loop[i][0] * loop[i + 1][1] - loop[i + 1][0] * loop[i][1]; }
  return area / 2;
}

function pointInLoop(point, loop) {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = loop.length - 2; i < loop.length - 1; j = i++) {
    const [xi, yi] = loop[i], [xj, yj] = loop[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) { inside = !inside; }
  }
  return inside;
}

/**
 * Construit des polygones GeoJSON [contour extérieur, trou1, trou2, ...] à
 * partir des boucles tracées. Une boucle interne à une autre est traitée
 * comme un vrai trou de polygone (pas rebouchée) dès lors qu'elle est assez
 * grande pour être une vraie zone exclue (ex. la zone d'un mode plus rapide,
 * contenue à l'intérieur) — seuls les petits trous (artefacts de topologie
 * du pavage, un îlot urbain isolé entouré de rues) sont comblés, pour éviter
 * l'effet gruyère sans réintroduire de chevauchement entre modes.
 */
export function buildPolygonsWithHoles(loops, minHoleAreaRatio) {
  const withArea = loops.map((loop) => ({ loop, absArea: Math.abs(polygonArea(loop)) }));
  withArea.sort((a, b) => b.absArea - a.absArea);
  const outers = [];
  for (const candidate of withArea) {
    const parent = outers.find((o) => pointInLoop(candidate.loop[0], o.loop));
    if (!parent) {
      outers.push({ loop: candidate.loop, area: candidate.absArea, holes: [] });
    } else if (candidate.absArea / parent.area >= minHoleAreaRatio) {
      parent.holes.push(candidate.loop);
    }
    // sinon : trou trop petit relativement à son contour -> comblé (ignoré)
  }
  return outers.map((o) => [o.loop, ...o.holes]);
}

/**
 * Lissage par "coupe de coins" (Chaikin, 1974) : remplace chaque sommet par
 * deux points à 1/4 et 3/4 de chaque arête, ce qui arrondit progressivement
 * les angles sans changer la forme générale du contour. Sert à adoucir
 * l'aspect "haché"/en dents de scie hérité de la grille hexagonale sous-
 * jacente, purement esthétique (n'affecte pas le calcul lui-même).
 *
 * Opération locale (par arête) : appliquée indépendamment à chaque anneau
 * (contour extérieur et trous), elle reste cohérente aux frontières entre
 * modes — un trou et le contour du mode voisin qui l'entoure partagent
 * exactement la même séquence de sommets d'origine, donc se lissent à
 * l'identique, sans jamais rouvrir l'ombre de chevauchement déjà réglée.
 */
function chaikinSmooth(ring, iterations) {
  let points = ring.slice(0, -1); // l'anneau est fermé (dernier point = premier) ; on l'enlève, on le remettra à la fin
  if (points.length < 4) { return ring; } // trop peu de sommets pour que le lissage ait un sens
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p0 = points[i], p1 = points[(i + 1) % n];
      next.push([p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25]);
      next.push([p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75]);
    }
    points = next;
  }
  points.push(points[0]); // referme l'anneau
  return points;
}

export function smoothPolygonsWithHoles(polygons, iterations) {
  return polygons.map((rings) => rings.map((ring) => chaikinSmooth(ring, iterations)));
}
