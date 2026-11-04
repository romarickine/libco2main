// ==========================================================================
// Web Worker du calcul de la carte : téléchargement IGN, graphe, plus courts
// chemins et vectorisation tournent hors de la page, qui reste fluide
// (barre de progression, défilement, carte) même sur un réseau parisien.
// Messages reçus :  { type: "calculer", id, params } | { type: "inspecter", id, lon, lat }
// Messages envoyés : { type: "etat", id, etat } | { type: "resultat", id, resultat }
//                    | { type: "inspection", id, info } | { type: "erreur", id, message }
// Le réseau du dernier calcul reste ici (diagnostics), pour l'inspection d'un point.
// ==========================================================================
import { calculerCarte } from "./calcul-carte.js";
import { inspecterPoint } from "./inspection.js";

let diagnostics = null;

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === "calculer") {
    try {
      diagnostics = null;
      const r = await calculerCarte({
        ...msg.params,
        onEtat: (etat) => self.postMessage({ type: "etat", id: msg.id, etat }),
      });
      diagnostics = r.computation.diagnostics;
      const computation = { ...r.computation, diagnostics: undefined };
      self.postMessage({ type: "resultat", id: msg.id, resultat: { ...r, computation } });
    } catch (err) {
      self.postMessage({ type: "erreur", id: msg.id, message: err && err.message ? err.message : String(err) });
    }
  } else if (msg.type === "inspecter") {
    try {
      const info = diagnostics ? inspecterPoint(diagnostics, msg.lon, msg.lat) : null;
      self.postMessage({ type: "inspection", id: msg.id, info });
    } catch (err) {
      self.postMessage({ type: "erreur", id: msg.id, message: err && err.message ? err.message : String(err) });
    }
  }
};
// Signale que le module (et tous ses imports) s'est chargé : sans ce signal,
// la page repasse au calcul dans la page elle-même (voir calcul-arriere-plan.js).
self.postMessage({ type: "pret" });
