// ==========================================================================
// Calcul de la carte dans un Web Worker (calcul-worker.js), avec repli sur un
// calcul dans la page si le navigateur ne sait pas lancer un worker de type
// module. Même contrat que calculerCarte (calcul-carte.js), à une différence
// près : computation.diagnostics ne contient plus le réseau, seulement
// inspecter(lon, lat) → Promise (données d'inspection, voir inspection.js).
// calculerCarte reste utilisable tel quel (outil de génération en lots).
// ==========================================================================
import { calculerCarte } from "./calcul-carte.js";
import { inspecterPoint } from "./inspection.js";

let worker = null;
let pret = null; // Promise<boolean> : le worker a-t-il démarré ?
let compteur = 0;
const enAttente = new Map(); // id → { resolve, reject, onEtat }

function demarrerWorker() {
  if (pret) return pret;
  pret = new Promise((resolve) => {
    if (typeof Worker === "undefined") return resolve(false);
    let w;
    try {
      w = new Worker(new URL("./calcul-worker.js", import.meta.url), { type: "module" });
    } catch {
      return resolve(false);
    }
    const delai = setTimeout(() => resolve(false), 15000);
    w.onerror = (ev) => {
      // Erreur avant le démarrage (module refusé, navigateur ancien) : repli.
      ev.preventDefault?.();
      clearTimeout(delai);
      resolve(false);
      // Arrêt en cours de route : le prochain calcul relancera un worker neuf.
      if (worker === w) {
        worker = null;
        pret = null;
      }
      for (const [, p] of enAttente) p.reject(new Error("Le calcul en arrière-plan s’est arrêté : " + (ev.message || "erreur inconnue")));
      enAttente.clear();
    };
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "pret") {
        clearTimeout(delai);
        worker = w;
        resolve(true);
        return;
      }
      const p = enAttente.get(m.id);
      if (!p) return;
      if (m.type === "etat") p.onEtat?.(m.etat);
      else if (m.type === "erreur") {
        enAttente.delete(m.id);
        p.reject(new Error(m.message));
      } else {
        enAttente.delete(m.id);
        p.resolve(m.type === "resultat" ? m.resultat : m.info);
      }
    };
  });
  return pret;
}

function demander(message, onEtat) {
  const id = ++compteur;
  return new Promise((resolve, reject) => {
    enAttente.set(id, { resolve, reject, onEtat });
    worker.postMessage({ ...message, id });
  });
}

/**
 * @param {object} p  Mêmes paramètres que calculerCarte (lon, lat, modes, direction, ilots, onEtat).
 * @returns {Promise<object>} Même résultat que calculerCarte ; computation.diagnostics = { inspecter }.
 */
export async function calculerCarteArrierePlan({ onEtat = () => {}, ...params }) {
  if (await demarrerWorker()) {
    const r = await demander({ type: "calculer", params }, onEtat);
    r.computation.diagnostics = { inspecter: (lon, lat) => demander({ type: "inspecter", lon, lat }) };
    return r;
  }
  // Repli : calcul dans la page (la page se fige pendant les phases longues).
  const r = await calculerCarte({ ...params, onEtat });
  const diag = r.computation.diagnostics;
  r.computation.diagnostics = { inspecter: async (lon, lat) => inspecterPoint(diag, lon, lat) };
  return r;
}
