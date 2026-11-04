// ==========================================================================
// Cache persistant des réponses du WFS IGN (IndexedDB du navigateur)
// ==========================================================================
// Une réponse est rangée sous son URL exacte (emprise, attributs, pagination) :
// le même morceau de réseau redemandé plus tard (même ville, autre adresse ou
// nouveau calcul) est relu sur l'appareil au lieu d'être retéléchargé. Les
// données ne quittent pas l'appareil ; ce sont des données publiques de l'IGN
// (BD TOPO®), aucune donnée personnelle.
// Durée de vie : 30 jours [Estimé : la BD TOPO® est mise à jour chaque
// trimestre ; au pire, un calcul utilise un réseau vieux d'un mois]. Taille
// bornée (CACHE_ENTREES_MAX réponses, environ 1 Mo chacune en ville dense).
// Sans IndexedDB (navigation privée stricte, quota plein, Node), tout
// continue sans cache : chaque fonction échoue en silence.
// ==========================================================================
const BASE = "libco2-iso";
const MAGASIN = "wfs";
const VERSION_BASE = 1;
const DUREE_VIE_MS = 30 * 24 * 3600 * 1000;
const CACHE_ENTREES_MAX = 300;

let ouverture = null;
function ouvrir() {
  if (ouverture) return ouverture;
  ouverture = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(BASE, VERSION_BASE);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(MAGASIN)) {
          const m = db.createObjectStore(MAGASIN, { keyPath: "url" });
          m.createIndex("t", "t");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return ouverture;
}

/** Réponse en cache pour cette URL (moins de 30 jours), sinon null. */
export async function lireCache(url) {
  const db = await ouvrir();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(MAGASIN, "readonly").objectStore(MAGASIN).get(url);
      req.onsuccess = () => {
        const v = req.result;
        resolve(v && Date.now() - v.t < DUREE_VIE_MS ? v.page : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let ecritures = 0;
/** Range une réponse (sans attendre la fin de l'écriture ; échec ignoré). */
export async function ecrireCache(url, page) {
  const db = await ouvrir();
  if (!db) return;
  try {
    const tx = db.transaction(MAGASIN, "readwrite");
    tx.objectStore(MAGASIN).put({ url, t: Date.now(), page });
    tx.onerror = (e) => e.preventDefault?.(); // quota plein : on continue sans cache
    if (++ecritures % 25 === 0) elaguer(db);
  } catch {
    /* sans cache */
  }
}

/** Supprime les entrées périmées, puis les plus anciennes au-delà du maximum. */
function elaguer(db) {
  try {
    const tx = db.transaction(MAGASIN, "readwrite");
    const m = tx.objectStore(MAGASIN);
    const compte = m.count();
    compte.onsuccess = () => {
      let enTrop = compte.result - CACHE_ENTREES_MAX;
      const limite = Date.now() - DUREE_VIE_MS;
      const curseur = m.index("t").openCursor();
      curseur.onsuccess = () => {
        const c = curseur.result;
        if (!c) return;
        if (enTrop > 0 || c.value.t < limite) {
          c.delete();
          enTrop--;
          c.continue();
        }
      };
    };
  } catch {
    /* sans cache */
  }
}
