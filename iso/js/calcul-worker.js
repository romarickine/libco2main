// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
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

// Réseau de chaque moment du trajet (pointe, journée) : les deux cartes d'une
// même adresse sont calculées l'une après l'autre (ui.js).
let diagnostics = {};
// File : un calcul à la fois (le second moment tourne en arrière-plan ; un
// nouveau calcul demandé entre-temps attend la fin du précédent, le réseau
// gardé en mémoire n'étant pas fait pour deux calculs simultanés).
let file = Promise.resolve();

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "calculer") file = file.then(() => traiterCalcul(msg));
  else traiterInspection(msg);
};

async function traiterCalcul(msg) {
  {
    try {
      const moment = msg.params.moment || "pointe";
      if (!msg.params.rayonImpose) diagnostics = {};
      const r = await calculerCarte({
        ...msg.params,
        onEtat: (etat) => self.postMessage({ type: "etat", id: msg.id, etat }),
      });
      diagnostics[moment] = r.computation.diagnostics;
      const computation = { ...r.computation, diagnostics: undefined };
      self.postMessage({ type: "resultat", id: msg.id, resultat: { ...r, computation } });
    } catch (err) {
      self.postMessage({ type: "erreur", id: msg.id, message: err && err.message ? err.message : String(err) });
    }
  }
}

function traiterInspection(msg) {
  if (msg.type === "inspecter") {
    try {
      const d = diagnostics[msg.moment || "pointe"];
      const info = d ? inspecterPoint(d, msg.lon, msg.lat) : null;
      self.postMessage({ type: "inspection", id: msg.id, info });
    } catch (err) {
      self.postMessage({ type: "erreur", id: msg.id, message: err && err.message ? err.message : String(err) });
    }
  }
}
// Signale que le module (et tous ses imports) s'est chargé : sans ce signal,
// la page repasse au calcul dans la page elle-même (voir calcul-arriere-plan.js).
self.postMessage({ type: "pret" });
