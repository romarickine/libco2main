// ==========================================================================
// Accès réseau : réseau routier BD TOPO IGN (WFS, par lot), altimétrie IGN
// (par lot), géocodage IGN
// ==========================================================================
const rateLimiter = (() => {
  let timestamps = [];
  return { async wait(maxPerSec = 5) { for (;;) { const now = Date.now(); timestamps = timestamps.filter((t) => now - t < 1000); if (timestamps.length < maxPerSec) { timestamps.push(now); return; } await new Promise((r) => setTimeout(r, 1000 - (now - timestamps[0]) + 5)); } } };
})();

// Limiteur dédié au WFS, distinct de celui de l'altimétrie/géocodage : la
// documentation IGN annonce 30 req/s sur le WFS, mais un 429 réel a été
// observé avec des vagues de 20 tirées d'un coup (la fenêtre glissante d'une
// seconde peut être dépassée si plusieurs vagues se chevauchent). On reste
// nettement en dessous de la limite documentée, avec de la marge.
// Réglable (voir setWfsMaxRequestsPerSecond) : la documentation IGN annonce
// 30 req/s, mais un usage soutenu (comme une longue session de test) peut
// déclencher un ralentissement anti-abus côté serveur indépendant du débit
// instantané — dans ce cas, seul un débit nettement plus prudent (et un peu
// de patience) y remédie, aucun code côté client ne peut le contourner.
let wfsMaxRequestsPerSecond = 10;
/** Permet d'ajuster le débit WFS max depuis l'appelant (un import ES6 ne peut
 * pas réassigner directement une variable exportée par un autre module). */
export function setWfsMaxRequestsPerSecond(value) { wfsMaxRequestsPerSecond = value; }

const wfsRateLimiter = (() => {
  let timestamps = [];
  return { async wait() { const maxPerSec = wfsMaxRequestsPerSecond; for (;;) { const now = Date.now(); timestamps = timestamps.filter((t) => now - t < 1000); if (timestamps.length < maxPerSec) { timestamps.push(now); return; } await new Promise((r) => setTimeout(r, 1000 - (now - timestamps[0]) + 5)); } } };
})();

async function fetchWithRetry(url, options, maxAttempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await rateLimiter.wait();
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 403) { lastError = new Error('HTTP ' + res.status); await new Promise((r) => setTimeout(r, 500 * (attempt + 1))); continue; }
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return await res.json();
    } catch (e) { lastError = e; await new Promise((r) => setTimeout(r, 300 * (attempt + 1))); }
  }
  throw lastError;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Récupère les tronçons de route BD TOPO® par lots (pagination WFS) sur
// l'emprise autour du point de départ. Domaine data.geopf.fr — le même que
// l'altimétrie et le géocodage, déjà accessibles depuis ce réseau (contrairement
// aux services communautaires OSM/Overpass, souvent filtrés par les pare-feux
// d'établissement).
async function fetchIGNRoadsPage(bbox, pageSize, startIndex, maxAttempts = 6) {
  const url = 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature'
    + '&TYPENAMES=BDTOPO_V3:troncon_de_route&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326'
    + '&BBOX=' + bbox
    + '&count=' + pageSize + '&startIndex=' + startIndex;

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await wfsRateLimiter.wait();
    let res;
    try {
      res = await fetchWithTimeout(url, {}, 25000);
    } catch (e) {
      lastError = new Error('Échec réseau vers le WFS IGN (' + (e.name === 'AbortError' ? 'délai dépassé' : e.message) + '). URL : ' + url);
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      continue;
    }
    const rawText = await res.text();
    if (res.status === 429 || res.status === 503) {
      // Backoff exponentiel : un simple pic passager se règle vite, mais si
      // le serveur applique un ralentissement anti-abus soutenu (usage
      // intensif prolongé depuis la même IP), il faut attendre nettement
      // plus longtemps avant de retenter, pas juste quelques centaines de ms.
      lastError = new Error('Le WFS IGN a répondu HTTP ' + res.status + ' (limite de débit). URL : ' + url);
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
      continue;
    }
    if (!res.ok) { throw new Error('Le WFS IGN a répondu HTTP ' + res.status + '. URL : ' + url + ' — réponse : ' + rawText.slice(0, 500)); }

    let json;
    try {
      json = JSON.parse(rawText);
    } catch (e) {
      throw new Error('Réponse WFS IGN non JSON (probablement une erreur XML du service). URL : ' + url + ' — début de la réponse : ' + rawText.slice(0, 500));
    }
    if (json.exceptionText || json.exceptionReport || json.code) {
      throw new Error('Le WFS IGN a renvoyé une exception : ' + JSON.stringify(json).slice(0, 500) + '. URL : ' + url);
    }
    return { features: json.features || [], url, rawText };
  }
  throw new Error(lastError ? lastError.message + ' (après ' + maxAttempts + ' tentatives)' : 'Échec inconnu du WFS IGN.');
}

// Récupère le réseau pour une emprise BBOX donnée, par pages parallélisées
// (par vagues) plutôt qu'enchaînées une par une en série. La taille de page
// (wfsPageSize, figée dans config.js — WFS_PAGE_SIZE, non réglable depuis
// l'interface) : la documentation officielle de l'IGN annonce une limite de
// 30 requêtes/seconde sur le WFS, mais le nombre maximum d'objets par requête
// ("count") n'est pas documenté précisément et varie selon les couches —
// 1000 est la valeur sûre la plus couramment documentée pour les flux WFS
// Géoportail/Géoplateforme.
async function fetchAllIGNRoadPages(bbox, wfsPageSize, onWaveDone) {
  const waveSize = 20; // sous la limite documentée de 30 req/s, avec marge de sécurité
  const maxWaves = 100; // jusqu'à 100 * 20 * wfsPageSize tronçons au total
  const allFeatures = [];
  let last = null;
  let truncated = false;

  outer:
  for (let wave = 0; wave < maxWaves; wave++) {
    const startIndexes = [];
    for (let i = 0; i < waveSize; i++) { startIndexes.push((wave * waveSize + i) * wfsPageSize); }
    const pages = await Promise.all(startIndexes.map((startIndex) => fetchIGNRoadsPage(bbox, wfsPageSize, startIndex)));
    let waveIncomplete = false;
    for (const page of pages) {
      last = page;
      for (const f of page.features) { allFeatures.push(f); }
      if (page.features.length < wfsPageSize) { waveIncomplete = true; }
    }
    // Progression estimée (asymptotique) : le nombre total de vagues n'est pas
    // connu tant que le téléchargement n'est pas fini, donc on approche 100%
    // sans jamais l'atteindre avant la fin réelle — ça donne un mouvement
    // continu plutôt qu'une barre figée pendant tout le téléchargement.
    if (onWaveDone) { onWaveDone(1 - 1 / (1 + (wave + 1) * 0.6)); }
    if (waveIncomplete) { break; }
    if (wave === maxWaves - 1) { truncated = true; }
  }

  return { features: allFeatures, last, truncated };
}

export async function fetchIGNRoads(lon, lat, radiusMeters, wfsPageSize, onWaveDone) {
  const dLat = radiusMeters / 111320;
  const dLon = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const minLon = lon - dLon, maxLon = lon + dLon, minLat = lat - dLat, maxLat = lat + dLat;

  // L'ordre des axes attendu par BBOX avec SRSNAME=EPSG:4326 varie selon les
  // implémentations WFS (lon,lat "GIS classique" vs lat,lon "ISO strict") —
  // on essaie les deux avant d'abandonner, plutôt que de deviner à l'aveugle.
  const bboxLonLat = minLon + ',' + minLat + ',' + maxLon + ',' + maxLat;
  const bboxLatLon = minLat + ',' + minLon + ',' + maxLat + ',' + maxLon;

  const attemptLonLat = await fetchAllIGNRoadPages(bboxLonLat, wfsPageSize, onWaveDone);
  if (attemptLonLat.features.length > 0) { return { type: 'FeatureCollection', features: attemptLonLat.features, truncated: attemptLonLat.truncated, rawFeatureCount: attemptLonLat.features.length }; }

  const attemptLatLon = await fetchAllIGNRoadPages(bboxLatLon, wfsPageSize, onWaveDone);
  if (attemptLatLon.features.length > 0) { return { type: 'FeatureCollection', features: attemptLatLon.features, truncated: attemptLatLon.truncated, rawFeatureCount: attemptLatLon.features.length }; }

  throw new Error(
    'Le WFS IGN a répondu sans erreur mais sans aucun tronçon, avec les deux ordres d\u2019axes testés. '
    + 'Essai 1 (lon,lat) : ' + attemptLonLat.last.url + ' → ' + attemptLonLat.last.rawText.slice(0, 300)
    + ' | Essai 2 (lat,lon) : ' + attemptLatLon.last.url + ' → ' + attemptLatLon.last.rawText.slice(0, 300)
  );
}

// ==========================================================================
// Grille altimétrique grossière + interpolation bilinéaire
// ==========================================================================
// L'altitude varie progressivement à l'échelle d'une ville — inutile
// d'interroger un point par nœud du réseau routier (souvent un nœud tous les
// 20-50 m aux carrefours denses). On échantillonne plutôt une grille régulière
// à une résolution plus grossière (150 m par défaut), et on interpole
// l'altitude de chaque nœud à partir des 4 points de grille qui l'encadrent.
export function buildElevationGrid(nodeCoords, spacingMeters) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [, [lon, lat]] of nodeCoords) {
    if (lon < minLon) { minLon = lon; } if (lon > maxLon) { maxLon = lon; }
    if (lat < minLat) { minLat = lat; } if (lat > maxLat) { maxLat = lat; }
  }
  const midLat = (minLat + maxLat) / 2;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((midLat * Math.PI) / 180);
  const dLat = spacingMeters / mPerDegLat;
  const dLon = spacingMeters / mPerDegLon;
  const cols = Math.max(1, Math.ceil((maxLon - minLon) / dLon)) + 1;
  const rows = Math.max(1, Math.ceil((maxLat - minLat) / dLat)) + 1;
  const points = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) { points.push({ id: r + '_' + c, lon: minLon + c * dLon, lat: minLat + r * dLat }); }
  }
  return { minLon, minLat, dLon, dLat, cols, rows, points };
}

export function bilinearElevation(grid, gridElevations, lon, lat) {
  const cf = (lon - grid.minLon) / grid.dLon;
  const rf = (lat - grid.minLat) / grid.dLat;
  const c0 = Math.max(0, Math.min(grid.cols - 2, Math.floor(cf)));
  const r0 = Math.max(0, Math.min(grid.rows - 2, Math.floor(rf)));
  const tx = Math.max(0, Math.min(1, cf - c0));
  const ty = Math.max(0, Math.min(1, rf - r0));
  const z00 = gridElevations.get(r0 + '_' + c0) ?? 0;
  const z10 = gridElevations.get(r0 + '_' + (c0 + 1)) ?? z00;
  const z01 = gridElevations.get((r0 + 1) + '_' + c0) ?? z00;
  const z11 = gridElevations.get((r0 + 1) + '_' + (c0 + 1)) ?? z00;
  const zTop = z00 + (z10 - z00) * tx;
  const zBot = z01 + (z11 - z01) * tx;
  return zTop + (zBot - zTop) * ty;
}

export async function fetchElevations(points, onChunkDone) {
  const elevations = new Map();
  // Lots volontairement petits (voir plus bas), mais surtout lancés en
  // PARALLÈLE : les attendre un par un en série annulerait tout l'intérêt du
  // limiteur de débit (5 en vol max) et rendrait le téléchargement très lent
  // sur un gros réseau (des centaines de lots).
  const chunkSize = 150;
  const chunks = [];
  for (let i = 0; i < points.length; i += chunkSize) { chunks.push(points.slice(i, i + chunkSize)); }
  let completedChunks = 0;

  const fetchChunk = async (chunk, chunkIndex) => {
    const lons = chunk.map((p) => p.lon.toFixed(5)).join('|');
    const lats = chunk.map((p) => p.lat.toFixed(5)).join('|');
    const url = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=' + lons + '&lat=' + lats
      + '&resource=ign_rge_alti_wld&delimiter=|&indent=false&measures=false';
    try {
      const json = await fetchWithRetry(url);
      const elevs = json.elevations || [];
      elevs.forEach((e, idx) => {
        if (!chunk[idx]) { return; }
        const z = e.z;
        // Plage plausible pour la France métropolitaine, généreuse (mer à
        // Mont Blanc) : écarte les valeurs sentinelles "pas de données"
        // (souvent -99999 ou similaire) plutôt que de les prendre au pied de
        // la lettre et de fausser toutes les pentes voisines.
        const plausible = typeof z === 'number' && Number.isFinite(z) && z > -500 && z < 5000;
        elevations.set(chunk[idx].id, plausible ? z : 0);
      });
    } catch (e) {
      throw new Error('Échec de récupération de l\u2019altimétrie (lot ' + (chunkIndex + 1) + '/' + chunks.length + ', ' + chunk.length + ' points, URL de ' + url.length + ' caractères) : ' + e.message);
    }
    completedChunks++;
    if (onChunkDone) { onChunkDone(completedChunks / chunks.length); }
  };

  await Promise.all(chunks.map((chunk, i) => fetchChunk(chunk, i)));
  return elevations;
}

export async function geocodeAddress(query) {
  const url = 'https://data.geopf.fr/geocodage/search?q=' + encodeURIComponent(query) + '&limit=1';
  const json = await fetchWithRetry(url);
  if (!json.features || json.features.length === 0) { throw new Error('Adresse introuvable'); }
  const [lon, lat] = json.features[0].geometry.coordinates;
  return { lon, lat, label: json.features[0].properties.label };
}

// Autocomplétion en direct sur la Base Adresse Nationale (via l'IGN) — limitée
// à 10 req/s par IP d'après la documentation officielle ; un anti-rebond de
// 300ms sur la saisie reste très largement sous cette limite.
export async function fetchAddressSuggestions(text) {
  const url = 'https://data.geopf.fr/geocodage/completion/?text=' + encodeURIComponent(text) + '&type=StreetAddress,PositionOfInterest&maximumResponses=8';
  const json = await fetchWithRetry(url);
  return json.results || [];
}
