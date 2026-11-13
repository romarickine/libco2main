// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
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
const VERSION_BASE = 2; // 2 : magasin des altitudes (09/11/2026)
const MAGASIN_ALTI = "alti";
const ALTI_ENTREES_MAX = 3000;
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
        if (!db.objectStoreNames.contains(MAGASIN_ALTI)) {
          const a = db.createObjectStore(MAGASIN_ALTI, { keyPath: "cle" });
          a.createIndex("t", "t");
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Autre onglet passé à une version plus récente : on libère la base.
        db.onversionchange = () => db.close();
        resolve(db);
      };
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
  elaguerMagasin(db, MAGASIN, CACHE_ENTREES_MAX);
}
function elaguerMagasin(db, magasin, maximum) {
  try {
    const tx = db.transaction(magasin, "readwrite");
    const m = tx.objectStore(magasin);
    const compte = m.count();
    compte.onsuccess = () => {
      let enTrop = compte.result - maximum;
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

// --------------------------------------------------------------------------
// Altitudes de l'API IGN (points sans Z dans la BD TOPO®), rangées par case
// de 0,02° : { cle, t, z: { "lon,lat" (5 décimales) : altitude } }. Même
// valeur que celle que l'API a renvoyée, donc même calcul qu'avec une
// nouvelle requête ; même durée de vie que les réponses du WFS.
// --------------------------------------------------------------------------

/** Contenu des cases demandées (moins de 30 jours) : Map case → { point : z }. */
export async function lireAltitudes(cases) {
  const out = new Map();
  const db = await ouvrir();
  if (!db || cases.size === 0) return out;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(MAGASIN_ALTI, "readonly");
      const m = tx.objectStore(MAGASIN_ALTI);
      const limite = Date.now() - DUREE_VIE_MS;
      for (const cle of cases) {
        const req = m.get(cle);
        req.onsuccess = () => {
          const v = req.result;
          if (v && v.t >= limite) out.set(cle, v.z);
        };
      }
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => resolve(out);
      tx.onabort = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}

let ecrituresAlti = 0;
/** Ajoute des altitudes aux cases (fusion avec l'existant ; échec ignoré). */
export async function ecrireAltitudes(parCase) {
  const db = await ouvrir();
  if (!db || parCase.size === 0) return;
  try {
    const tx = db.transaction(MAGASIN_ALTI, "readwrite");
    const m = tx.objectStore(MAGASIN_ALTI);
    const maintenant = Date.now();
    for (const [cle, z] of parCase) {
      const req = m.get(cle);
      req.onsuccess = () => {
        const v = req.result;
        const fusion = v && maintenant - v.t < DUREE_VIE_MS ? Object.assign(v.z, z) : z;
        m.put({ cle, t: v && maintenant - v.t < DUREE_VIE_MS ? v.t : maintenant, z: fusion });
      };
    }
    tx.onerror = (e) => e.preventDefault?.();
    if (++ecrituresAlti % 10 === 0) elaguerMagasin(db, MAGASIN_ALTI, ALTI_ENTREES_MAX);
  } catch {
    /* sans cache */
  }
}
