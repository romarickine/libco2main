// ==========================================================================
// Accès réseau : réseau routier BD TOPO IGN (WFS, par lot), altimétrie IGN
// (par lot), géocodage IGN
// ==========================================================================
// ---------------------------------------------------------------------------
// Ménagement des services de l'IGN (diagnostic du 06/10/2026, essai réel à
// Vourles dans Chrome) : avec 5 requêtes/s d'altimétrie tirées toutes en même
// temps, 32 requêtes sur 69 ont reçu un refus 429, et le calcul a duré plus de
// 3 minutes. D'où, pour tous les appels :
//   - un débit sous la limite documentée et un nombre de requêtes EN COURS
//     plafonné (une réponse d'altimétrie prend 3 à 10 s : le serveur voit
//     s'empiler les requêtes même à débit modéré) ;
//   - après un 429, une pause commune de 5 s (blocage annoncé par l'IGN) avant
//     toute nouvelle requête vers ce service, au lieu de réessayer en rafale ;
//   - une attente croissante avec une part aléatoire (gigue), pour que les
//     requêtes en échec ne repartent pas toutes au même instant.
// Limites par IP : cartes.gouv.fr, « Limites d'usage des API » [Sourcé, lu le
// 03/10/2026] : WFS 30/s, altimétrie 5/s, géocodage 50/s ; 429 + 5 s de blocage.
// ---------------------------------------------------------------------------
const PAUSE_APRES_429_MS = 5000; // [Sourcé] durée du blocage annoncée par l'IGN
const pausesService = { wfs: 0, alti: 0 }; // heure (ms) jusqu'à laquelle attendre
async function attendrePause(service) {
  const reste = pausesService[service] - Date.now();
  if (reste > 0) await new Promise((r) => setTimeout(r, reste));
}
function signalerRefus(service) {
  // Gigue : chaque client repart à un instant légèrement différent.
  pausesService[service] = Math.max(pausesService[service], Date.now() + PAUSE_APRES_429_MS + Math.random() * 1000);
}
/** Attente croissante avec gigue : base × 2^essai, ± 50 %. */
function attenteGigue(baseMs, essai) {
  return baseMs * Math.pow(2, essai) * (0.5 + Math.random());
}
/** Exécute les tâches avec au plus `max` en cours à la fois ; résultats dans l'ordre. */
async function enParallele(taches, max) {
  const resultats = new Array(taches.length);
  let suivante = 0;
  const ouvrier = async () => {
    while (suivante < taches.length) {
      const i = suivante++;
      resultats[i] = await taches[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(max, taches.length) }, ouvrier));
  return resultats;
}
// Requêtes simultanées au plus [Estimé : assez pour ne pas ralentir, assez peu
// pour ne pas saturer ; à ajuster après mesure en conditions réelles].
const WFS_EN_COURS_MAX = 4;
const ALTI_EN_COURS_MAX = 2;
const ALTI_REQUETES_PAR_SECONDE = 4; // 80 % de la limite de 5/s (marge du cahier carto)

const rateLimiter = (() => {
  let timestamps = [];
  return {
    async wait(maxPerSec = ALTI_REQUETES_PAR_SECONDE) {
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
async function fetchWithRetry(url, options, maxAttempts = 5, service = "alti") {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await attendrePause(service);
    await rateLimiter.wait();
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        lastError = new Error("HTTP 429 (limite de débit de l'IGN)");
        signalerRefus(service);
        continue;
      }
      if (res.status === 403) {
        // Accès refusé : réessayer ne ferait qu'insister auprès d'un serveur
        // qui bloque déjà cette adresse IP.
        throw Object.assign(new Error("HTTP 403 : accès refusé par le service de l'IGN"), { definitif: true });
      }
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      return await res.json();
    } catch (e) {
      if (e.definitif) throw e;
      lastError = e;
      await new Promise((r) => setTimeout(r, attenteGigue(500, attempt)));
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
// Seuls les attributs lus par graph.js (parseIGNRoadsToGraph), plus la
// géométrie (3D : elle porte l'altitude de chaque sommet, voir isochrones.js).
// Relevé du 06/10/2026 sur 50 tronçons : 22,5 Ko au lieu de 147,6 Ko (-85 %).
// cleabs : identifiant unique du tronçon BD TOPO®, pour reconnaître un même
// tronçon renvoyé par deux emprises voisines (voir etendreIGNRoads).
const WFS_ATTRIBUTS = "cleabs,nature,sens_de_circulation,vitesse_moyenne_vl,acces_vehicule_leger,importance,prive,geometrie";

// Cache de session des pages WFS (même URL = même réponse) : une nouvelle
// tentative ou un second calcul à la même adresse ne retélécharge rien.
// Borné pour ne pas garder des centaines de Mo en mémoire.
const cachePagesWfs = new Map();
const CACHE_PAGES_MAX = 80;

async function fetchIGNRoadsPage(bbox, pageSize, startIndex, maxAttempts = 6) {
  const url =
    "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature" +
    "&TYPENAMES=BDTOPO_V3:troncon_de_route&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326" +
    "&PROPERTYNAME=" +
    WFS_ATTRIBUTS +
    "&BBOX=" +
    bbox +
    "&count=" +
    pageSize +
    "&startIndex=" +
    startIndex;

  if (cachePagesWfs.has(url)) return cachePagesWfs.get(url);
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await attendrePause("wfs");
    await wfsRateLimiter.wait();
    let res;
    try {
      res = await fetchWithTimeout(url, {}, 25000);
    } catch (e) {
      lastError = new Error(
        "Échec réseau vers le WFS IGN (" + (e.name === "AbortError" ? "délai dépassé" : e.message) + "). URL : " + url,
      );
      await new Promise((r) => setTimeout(r, attenteGigue(400, attempt)));
      continue;
    }
    const rawText = await res.text();
    if (res.status === 429 || res.status === 503) {
      // Backoff exponentiel : un simple pic passager se règle vite, mais si
      // le serveur applique un ralentissement anti-abus soutenu (usage
      // intensif prolongé depuis la même IP), il faut attendre nettement
      // plus longtemps avant de retenter, pas juste quelques centaines de ms.
      lastError = new Error("Le WFS IGN a répondu HTTP " + res.status + " (limite de débit). URL : " + url);
      signalerRefus("wfs");
      await new Promise((r) => setTimeout(r, attenteGigue(800, attempt)));
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
      await new Promise((r) => setTimeout(r, attenteGigue(800, attempt)));
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
    const page = { features: json.features || [], numberMatched: json.numberMatched, url, extrait: rawText.slice(0, 300) };
    if (cachePagesWfs.size >= CACHE_PAGES_MAX) cachePagesWfs.delete(cachePagesWfs.keys().next().value);
    cachePagesWfs.set(url, page);
    return page;
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
      const pages = await enParallele(
        indexes.map((i) => () => fetchIGNRoadsPage(bbox, wfsPageSize, i)),
        WFS_EN_COURS_MAX,
      );
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
    const pages = await enParallele(
      indexes.map((i) => () => fetchIGNRoadsPage(bbox, wfsPageSize, i)),
      WFS_EN_COURS_MAX,
    );
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

/** Emprise carrée (degrés) d'un rayon autour d'un point. */
export function empriseCarree(lon, lat, radiusMeters) {
  const dLat = radiusMeters / 111320;
  const dLon = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return { minLon: lon - dLon, minLat: lat - dLat, maxLon: lon + dLon, maxLat: lat + dLat };
}

function texteBbox(e, ordreAxes) {
  return ordreAxes === "latlon"
    ? e.minLat + "," + e.minLon + "," + e.maxLat + "," + e.maxLon
    : e.minLon + "," + e.minLat + "," + e.maxLon + "," + e.maxLat;
}

/** Identifiant d'un tronçon : cleabs BD TOPO®, à défaut l'identifiant WFS. */
function identifiantTroncon(f) {
  return (f.properties && f.properties.cleabs) || f.id || null;
}

/**
 * Supprime les doublons (même tronçon renvoyé par deux emprises) et range les
 * tronçons par identifiant. Le rangement rend le graphe indépendant de l'ordre
 * de téléchargement (la fusion des carrefours garde le premier point vu) :
 * réseau complet ou réseau étendu par anneau donnent exactement le même graphe.
 * Tronçons sans identifiant : gardés tels quels, en fin de liste.
 */
export function fusionnerTroncons(...listes) {
  const parId = new Map();
  const sansId = [];
  for (const liste of listes) {
    for (const f of liste) {
      const id = identifiantTroncon(f);
      if (id == null) sansId.push(f);
      else if (!parId.has(id)) parId.set(id, f);
    }
  }
  const ids = [...parId.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return [...ids.map((id) => parId.get(id)), ...sansId];
}

/**
 * Télécharge les tronçons BD TOPO® dans un carré autour d'un point (WFS IGN,
 * par pages), en essayant les deux ordres d'axes possibles du service.
 * @param {number} lon @param {number} lat @param {number} radiusMeters
 * @param {number} wfsPageSize  Tronçons par requête.
 * @param {(fraction: number) => void} [onWaveDone]  Progression, de 0 à 1.
 * @returns {Promise<{type: string, features: object[], truncated: boolean, rawFeatureCount: number,
 *   emprise: object, ordreAxes: string}>}  emprise et ordreAxes servent à étendre ce réseau (etendreIGNRoads).
 * @throws {Error} Si le service ne renvoie aucun tronçon.
 */
export async function fetchIGNRoads(lon, lat, radiusMeters, wfsPageSize, onWaveDone) {
  const emprise = empriseCarree(lon, lat, radiusMeters);

  // L'ordre des axes attendu par BBOX avec SRSNAME=EPSG:4326 varie selon les
  // implémentations WFS (lon,lat "GIS classique" vs lat,lon "ISO strict") —
  // on essaie les deux avant d'abandonner, plutôt que de deviner à l'aveugle.
  const essais = [];
  for (const ordreAxes of ["lonlat", "latlon"]) {
    const essai = await fetchAllIGNRoadPages(texteBbox(emprise, ordreAxes), wfsPageSize, onWaveDone);
    essais.push(essai);
    if (essai.features.length > 0) {
      const features = fusionnerTroncons(essai.features);
      return {
        type: "FeatureCollection",
        features,
        truncated: essai.truncated,
        rawFeatureCount: features.length,
        emprise,
        ordreAxes,
      };
    }
  }

  throw new Error(
    "Le WFS IGN a répondu sans erreur mais sans aucun tronçon, avec les deux ordres d\u2019axes testés. " +
      "Essai 1 (lon,lat) : " +
      essais[0].last.url +
      " → " +
      essais[0].last.extrait +
      " | Essai 2 (lat,lon) : " +
      essais[1].last.url +
      " → " +
      essais[1].last.extrait,
  );
}

/**
 * Étend un réseau déjà téléchargé à un rayon plus grand, en ne demandant que
 * l'anneau manquant : 4 rectangles (bandes nord et sud sur toute la largeur,
 * bandes ouest et est sur la hauteur de l'ancien carré). Le WFS renvoie tout
 * tronçon qui touche l'emprise demandée ; l'ancien carré et les 4 bandes
 * couvrent exactement le nouveau carré, donc on obtient les mêmes tronçons
 * qu'un téléchargement complet, les tronçons à cheval sur une limite
 * revenant deux fois (doublons supprimés par fusionnerTroncons).
 * Gain [Estimé, densité de rues uniforme] : de 11,5 à 15 km, l'anneau fait
 * 41 % du nouveau carré, soit environ 59 % de pages en moins sur la relance.
 * Repli sur un téléchargement complet si le réseau précédent est tronqué,
 * sans emprise connue, ou si le nouveau carré ne le contient pas.
 * @param {object|null} precedent  Résultat de fetchIGNRoads / etendreIGNRoads.
 * @param {number} lon @param {number} lat @param {number} radiusMeters
 * @param {number} wfsPageSize @param {(fraction: number) => void} [onWaveDone]
 * @returns {Promise<object>} même forme que fetchIGNRoads, plus `etendu` (true si l'anneau seul a été demandé).
 */
export async function etendreIGNRoads(precedent, lon, lat, radiusMeters, wfsPageSize, onWaveDone) {
  const a = empriseCarree(lon, lat, radiusMeters);
  const p = precedent && precedent.emprise;
  const contenu = p && a.minLon <= p.minLon && a.minLat <= p.minLat && a.maxLon >= p.maxLon && a.maxLat >= p.maxLat;
  if (!precedent || precedent.truncated || !precedent.ordreAxes || !contenu) {
    return { ...(await fetchIGNRoads(lon, lat, radiusMeters, wfsPageSize, onWaveDone)), etendu: false };
  }
  const bandes = [
    { minLon: a.minLon, minLat: p.maxLat, maxLon: a.maxLon, maxLat: a.maxLat }, // nord
    { minLon: a.minLon, minLat: a.minLat, maxLon: a.maxLon, maxLat: p.minLat }, // sud
    { minLon: a.minLon, minLat: p.minLat, maxLon: p.minLon, maxLat: p.maxLat }, // ouest
    { minLon: p.maxLon, minLat: p.minLat, maxLon: a.maxLon, maxLat: p.maxLat }, // est
  ].filter((b) => b.maxLon > b.minLon && b.maxLat > b.minLat);
  const listes = [precedent.features];
  let truncated = false;
  for (let i = 0; i < bandes.length; i++) {
    const r = await fetchAllIGNRoadPages(texteBbox(bandes[i], precedent.ordreAxes), wfsPageSize, (f) => {
      if (onWaveDone) onWaveDone((i + f) / bandes.length);
    });
    listes.push(r.features);
    truncated = truncated || r.truncated;
  }
  const features = fusionnerTroncons(...listes);
  return {
    type: "FeatureCollection",
    features,
    truncated,
    rawFeatureCount: features.length,
    emprise: a,
    ordreAxes: precedent.ordreAxes,
    etendu: true,
  };
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
// Cache de session des altitudes, par point arrondi comme dans la requête
// (5 décimales) : une relance au rayon maximal ne redemande pas les points
// déjà obtenus. Borné pour la mémoire.
const cacheAltitudes = new Map();
const CACHE_ALTITUDES_MAX = 500000;
const clePoint = (p) => p.lon.toFixed(5) + "," + p.lat.toFixed(5);

export async function fetchElevations(pointsDemandes, onChunkDone) {
  const elevations = new Map();
  const points = [];
  for (const p of pointsDemandes) {
    const z = cacheAltitudes.get(clePoint(p));
    if (z === undefined) points.push(p);
    else elevations.set(p.id, z);
  }
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
        if (cacheAltitudes.size >= CACHE_ALTITUDES_MAX) cacheAltitudes.delete(cacheAltitudes.keys().next().value);
        cacheAltitudes.set(clePoint(chunk[idx]), plausible ? z : 0);
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

  await enParallele(
    chunks.map((chunk, i) => () => fetchChunk(chunk, i)),
    ALTI_EN_COURS_MAX,
  );
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
