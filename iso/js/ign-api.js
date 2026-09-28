// ==========================================================================
// Accès réseau : réseau routier BD TOPO IGN (WFS, par lot), altimétrie IGN
// (par lot), géocodage IGN
// ==========================================================================
const rateLimiter = (() => {
  let timestamps = [];
  return {
    async wait(maxPerSec = 5) {
      for (;;) {
        const now = Date.now();
        timestamps = timestamps.filter((t) => now - t < 1000);
        if (timestamps.length < maxPerSec) {
          timestamps.push(now);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 - (now - timestamps[0]) + 5));
      }
    },
  };
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
export function setWfsMaxRequestsPerSecond(value) {
  wfsMaxRequestsPerSecond = value;
}

const wfsRateLimiter = (() => {
  let timestamps = [];
  return {
    async wait() {
      const maxPerSec = wfsMaxRequestsPerSecond;
      for (;;) {
        const now = Date.now();
        timestamps = timestamps.filter((t) => now - t < 1000);
        if (timestamps.length < maxPerSec) {
          timestamps.push(now);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 - (now - timestamps[0]) + 5));
      }
    },
  };
})();

// Nouvel essai en cas d'échec réseau (« Failed to fetch »), de limite de
// débit (429) ou d'erreur serveur (5xx) : les services de la Géoplateforme
// connaissent des saturations passagères (constatées le 28/09/2026), qui se
// résorbent en quelques secondes. Attente croissante : 0,5 s, 1 s, 2 s, 4 s.
async function fetchWithRetry(url, options, maxAttempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await rateLimiter.wait();
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 403) {
        lastError = new Error("HTTP " + res.status);
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
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
  const url =
    "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature" +
    "&TYPENAMES=BDTOPO_V3:troncon_de_route&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326" +
    "&BBOX=" +
    bbox +
    "&count=" +
    pageSize +
    "&startIndex=" +
    startIndex;

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await wfsRateLimiter.wait();
    let res;
    try {
      res = await fetchWithTimeout(url, {}, 25000);
    } catch (e) {
      lastError = new Error(
        "Échec réseau vers le WFS IGN (" + (e.name === "AbortError" ? "délai dépassé" : e.message) + "). URL : " + url,
      );
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      continue;
    }
    const rawText = await res.text();
    if (res.status === 429 || res.status === 503) {
      // Backoff exponentiel : un simple pic passager se règle vite, mais si
      // le serveur applique un ralentissement anti-abus soutenu (usage
      // intensif prolongé depuis la même IP), il faut attendre nettement
      // plus longtemps avant de retenter, pas juste quelques centaines de ms.
      lastError = new Error("Le WFS IGN a répondu HTTP " + res.status + " (limite de débit). URL : " + url);
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
      continue;
    }
    // Saturation passagère du serveur IGN : erreur 5xx, ou erreur 400 dont le
    // texte trahit un manque de connexions côté serveur (« Unable to obtain
    // connection … pool error Timeout », constaté le 28/09/2026). Ce n'est
    // pas une requête invalide : on réessaie avec une attente croissante.
    const saturationServeur =
      res.status >= 500 || /Unable to obtain connection|pool error|Timeout waiting/i.test(rawText);
    if (!res.ok && saturationServeur) {
      lastError = new Error(
        "Le WFS IGN est saturé (HTTP " + res.status + "). URL : " + url + " — réponse : " + rawText.slice(0, 300),
      );
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
      continue;
    }
    if (!res.ok) {
      throw new Error(
        "Le WFS IGN a répondu HTTP " + res.status + ". URL : " + url + " — réponse : " + rawText.slice(0, 500),
      );
    }

    let json;
    try {
      json = JSON.parse(rawText);
    } catch (e) {
      throw new Error(
        "Réponse WFS IGN non JSON (probablement une erreur XML du service). URL : " +
          url +
          " — début de la réponse : " +
          rawText.slice(0, 500),
      );
    }
    if (json.exceptionText || json.exceptionReport || json.code) {
      throw new Error("Le WFS IGN a renvoyé une exception : " + JSON.stringify(json).slice(0, 500) + ". URL : " + url);
    }
    // numberMatched : nombre total de tronçons de l'emprise, annoncé par le
    // serveur (WFS 2.0) ; permet de ne demander que les pages nécessaires.
    return { features: json.features || [], numberMatched: json.numberMatched, url, rawText };
  }
  throw new Error(
    lastError ? lastError.message + " (après " + maxAttempts + " tentatives)" : "Échec inconnu du WFS IGN.",
  );
}

// Récupère le réseau pour une emprise BBOX donnée, par pages de wfsPageSize
// tronçons (WFS_PAGE_SIZE dans config.js : 4 800, sous le maximum de 5 000
// par requête annoncé par le serveur, contrainte CountDefault de son
// GetCapabilities, relevée le 28/09/2026).
// 1) Une première page donne le nombre total de tronçons (numberMatched) :
//    on ne demande ensuite QUE les pages restantes, par vagues parallèles de
//    20 au plus (sous la limite documentée de 30 requêtes/s par IP, le débit
//    étant de plus plafonné par wfsRateLimiter).
// 2) Si le serveur n'annonce pas ce total, on revient à l'ancienne méthode :
//    des vagues de 20 pages jusqu'à la première page incomplète.
async function fetchAllIGNRoadPages(bbox, wfsPageSize, onWaveDone) {
  const waveSize = 20;
  const maxPages = 2000; // garde-fou : 2 000 pages de wfsPageSize tronçons
  const first = await fetchIGNRoadsPage(bbox, wfsPageSize, 0);
  const allFeatures = [...first.features];
  let last = first;

  const total = Number(first.numberMatched);
  if (Number.isFinite(total) && total >= 0) {
    const pagesNeeded = Math.min(Math.ceil(total / wfsPageSize), maxPages);
    const truncated = Math.ceil(total / wfsPageSize) > maxPages;
    for (let start = 1; start < pagesNeeded; start += waveSize) {
      const indexes = [];
      for (let p = start; p < Math.min(start + waveSize, pagesNeeded); p++) indexes.push(p * wfsPageSize);
      const pages = await Promise.all(indexes.map((i) => fetchIGNRoadsPage(bbox, wfsPageSize, i)));
      for (const page of pages) {
        last = page;
        for (const f of page.features) allFeatures.push(f);
      }
      if (onWaveDone) onWaveDone(Math.min(1, (start + indexes.length) / pagesNeeded));
    }
    if (onWaveDone) onWaveDone(1);
    return { features: allFeatures, last, truncated };
  }

  // Repli : total inconnu.
  if (first.features.length < wfsPageSize) return { features: allFeatures, last, truncated: false };
  let truncated = false;
  for (let wave = 0; ; wave++) {
    const indexes = [];
    for (let i = 0; i < waveSize; i++) indexes.push((1 + wave * waveSize + i) * wfsPageSize);
    const pages = await Promise.all(indexes.map((i) => fetchIGNRoadsPage(bbox, wfsPageSize, i)));
    let incomplete = false;
    for (const page of pages) {
      last = page;
      for (const f of page.features) allFeatures.push(f);
      if (page.features.length < wfsPageSize) incomplete = true;
    }
    // Progression asymptotique : le total n'est pas connu.
    if (onWaveDone) onWaveDone(1 - 1 / (1 + (wave + 1) * 0.6));
    if (incomplete) break;
    if ((wave + 2) * waveSize >= maxPages) {
      truncated = true;
      break;
    }
  }
  return { features: allFeatures, last, truncated };
}

/**
 * Télécharge les tronçons BD TOPO® dans un carré autour d'un point (WFS IGN,
 * par pages), en essayant les deux ordres d'axes possibles du service.
 * @param {number} lon @param {number} lat @param {number} radiusMeters
 * @param {number} wfsPageSize  Tronçons par requête.
 * @param {(fraction: number) => void} [onWaveDone]  Progression, de 0 à 1.
 * @returns {Promise<{type: string, features: object[], truncated: boolean, rawFeatureCount: number}>}
 * @throws {Error} Si le service ne renvoie aucun tronçon.
 */
export async function fetchIGNRoads(lon, lat, radiusMeters, wfsPageSize, onWaveDone) {
  const dLat = radiusMeters / 111320;
  const dLon = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const minLon = lon - dLon,
    maxLon = lon + dLon,
    minLat = lat - dLat,
    maxLat = lat + dLat;

  // L'ordre des axes attendu par BBOX avec SRSNAME=EPSG:4326 varie selon les
  // implémentations WFS (lon,lat "GIS classique" vs lat,lon "ISO strict") —
  // on essaie les deux avant d'abandonner, plutôt que de deviner à l'aveugle.
  const bboxLonLat = minLon + "," + minLat + "," + maxLon + "," + maxLat;
  const bboxLatLon = minLat + "," + minLon + "," + maxLat + "," + maxLon;

  const attemptLonLat = await fetchAllIGNRoadPages(bboxLonLat, wfsPageSize, onWaveDone);
  if (attemptLonLat.features.length > 0) {
    return {
      type: "FeatureCollection",
      features: attemptLonLat.features,
      truncated: attemptLonLat.truncated,
      rawFeatureCount: attemptLonLat.features.length,
    };
  }

  const attemptLatLon = await fetchAllIGNRoadPages(bboxLatLon, wfsPageSize, onWaveDone);
  if (attemptLatLon.features.length > 0) {
    return {
      type: "FeatureCollection",
      features: attemptLatLon.features,
      truncated: attemptLatLon.truncated,
      rawFeatureCount: attemptLatLon.features.length,
    };
  }

  throw new Error(
    "Le WFS IGN a répondu sans erreur mais sans aucun tronçon, avec les deux ordres d\u2019axes testés. " +
      "Essai 1 (lon,lat) : " +
      attemptLonLat.last.url +
      " → " +
      attemptLonLat.last.rawText.slice(0, 300) +
      " | Essai 2 (lat,lon) : " +
      attemptLatLon.last.url +
      " → " +
      attemptLatLon.last.rawText.slice(0, 300),
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
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;
  for (const [, [lon, lat]] of nodeCoords) {
    if (lon < minLon) {
      minLon = lon;
    }
    if (lon > maxLon) {
      maxLon = lon;
    }
    if (lat < minLat) {
      minLat = lat;
    }
    if (lat > maxLat) {
      maxLat = lat;
    }
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
    for (let c = 0; c < cols; c++) {
      points.push({ id: r + "_" + c, lon: minLon + c * dLon, lat: minLat + r * dLat });
    }
  }
  return { minLon, minLat, dLon, dLat, cols, rows, points };
}

/**
 * Altitude d'un point par interpolation bilinéaire dans la grille
 * d'altitudes échantillonnée (voir buildElevationGrid).
 * @param {object} grid @param {Map} gridElevations @param {number} lon @param {number} lat
 * @returns {number} Mètres.
 */
export function bilinearElevation(grid, gridElevations, lon, lat) {
  const cf = (lon - grid.minLon) / grid.dLon;
  const rf = (lat - grid.minLat) / grid.dLat;
  const c0 = Math.max(0, Math.min(grid.cols - 2, Math.floor(cf)));
  const r0 = Math.max(0, Math.min(grid.rows - 2, Math.floor(rf)));
  const tx = Math.max(0, Math.min(1, cf - c0));
  const ty = Math.max(0, Math.min(1, rf - r0));
  const z00 = gridElevations.get(r0 + "_" + c0) ?? 0;
  const z10 = gridElevations.get(r0 + "_" + (c0 + 1)) ?? z00;
  const z01 = gridElevations.get(r0 + 1 + "_" + c0) ?? z00;
  const z11 = gridElevations.get(r0 + 1 + "_" + (c0 + 1)) ?? z00;
  const zTop = z00 + (z10 - z00) * tx;
  const zBot = z01 + (z11 - z01) * tx;
  return zTop + (zBot - zTop) * ty;
}

/**
 * Interroge l'API d'altimétrie de l'IGN pour une liste de points, par lots
 * proches de la limite documentée (5 000 points par requête), en parallèle.
 * @param {Array<{id: number, lon: number, lat: number}>} points
 * @param {(fraction: number) => void} [onChunkDone]
 * @returns {Promise<Map<number, number>>} Altitude (m) par identifiant de point ; 0 si la valeur renvoyée est aberrante.
 */
export async function fetchElevations(points, onChunkDone) {
  const elevations = new Map();
  // Lots proches de la limite documentée de l'API IGN (5000 points/requête,
  // https://geoservices.ign.fr/node/1439) plutôt que les petits lots de 150
  // utilisés jusqu'ici : la contrainte réelle du service est le DÉBIT (5
  // req/s, vérifié dans la documentation officielle — ni négociable ni
  // relevable côté client), pas le volume de points par requête. Empaqueter
  // largement divise donc le nombre de requêtes nécessaires par ~27 (270 -> 10
  // sur un réseau de taille courante), sans rien perdre en fiabilité.
  // POST (pris en charge par ce service, avec le même format de paramètres
  // qu'en GET, envoyés en JSON) plutôt que GET : une requête de 4000 points
  // en paramètres d'URL dépasserait largement les limites de longueur d'URL
  // (souvent 2 à 8 Ko selon les navigateurs/serveurs/proxies) — le corps
  // d'une requête POST n'a pas cette contrainte.
  const chunkSize = 4000;
  const chunks = [];
  for (let i = 0; i < points.length; i += chunkSize) {
    chunks.push(points.slice(i, i + chunkSize));
  }
  let completedChunks = 0;

  const fetchChunk = async (chunk, chunkIndex) => {
    const lons = chunk.map((p) => p.lon.toFixed(5)).join("|");
    const lats = chunk.map((p) => p.lat.toFixed(5)).join("|");
    const url = "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json";
    const body = JSON.stringify({
      lon: lons,
      lat: lats,
      resource: "ign_rge_alti_wld",
      delimiter: "|",
      indent: "false",
      measures: "false",
      zonly: "false",
    });
    try {
      const json = await fetchWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body,
      });
      const elevs = json.elevations || [];
      elevs.forEach((e, idx) => {
        if (!chunk[idx]) {
          return;
        }
        const z = e.z;
        // Plage plausible pour la France métropolitaine, généreuse (mer à
        // Mont Blanc) : écarte les valeurs sentinelles "pas de données"
        // (souvent -99999 ou similaire) plutôt que de les prendre au pied de
        // la lettre et de fausser toutes les pentes voisines.
        const plausible = typeof z === "number" && Number.isFinite(z) && z > -500 && z < 5000;
        elevations.set(chunk[idx].id, plausible ? z : 0);
      });
    } catch (e) {
      throw new Error(
        "Échec de récupération de l\u2019altimétrie (lot " +
          (chunkIndex + 1) +
          "/" +
          chunks.length +
          ", " +
          chunk.length +
          " points) : " +
          e.message,
      );
    }
    completedChunks++;
    if (onChunkDone) {
      onChunkDone(completedChunks / chunks.length);
    }
  };

  await Promise.all(chunks.map((chunk, i) => fetchChunk(chunk, i)));
  return elevations;
}

/**
 * Géocode une adresse avec le service de la Géoplateforme IGN.
 * @param {string} query
 * @returns {Promise<{lon: number, lat: number, label: string}>}
 * @throws {Error} « Adresse introuvable » si aucun résultat.
 */
export async function geocodeAddress(query) {
  const url = "https://data.geopf.fr/geocodage/search?q=" + encodeURIComponent(query) + "&limit=1";
  const json = await fetchWithRetry(url);
  if (!json.features || json.features.length === 0) {
    throw new Error("Adresse introuvable");
  }
  const [lon, lat] = json.features[0].geometry.coordinates;
  return { lon, lat, label: json.features[0].properties.label };
}

// Autocomplétion en direct sur la Base Adresse Nationale (via l'IGN) — limitée
// à 10 req/s par IP d'après la documentation officielle ; un anti-rebond de
// 300ms sur la saisie reste très largement sous cette limite.
export async function fetchAddressSuggestions(text) {
  const url =
    "https://data.geopf.fr/geocodage/completion/?text=" +
    encodeURIComponent(text) +
    "&type=StreetAddress,PositionOfInterest&maximumResponses=8";
  const json = await fetchWithRetry(url);
  return json.results || [];
}
