// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// ==========================================================================
// Interface : carte, formulaire, rendu
// (Leaflet est chargé globalement via <script> dans index.html — pas un
// module ES6, d'où l'usage direct de la variable globale L.)
// ==========================================================================
import { calculerCarteArrierePlan } from "./calcul-arriere-plan.js";
import { creerCoucheTuiles, surveillerFondDeCarte, suivreTailleCarte } from "./fond-carte.js";
import { geocodeAddress, fetchAddressSuggestions } from "./ign-api.js";
import { exportMapImage } from "./export-image.js";
import { echapperHtml } from "../../shared/js/echappement.js";
import { MESSAGE_DEPART_REFUSE } from "./isochrones.js";
import { getModeColors } from "./colors.js";

/**
 * Réglages des îlots passés dans l'adresse de la page, pour les essais :
 * ?ilots=off (seule la zone reliée au départ) ou
 * ?ilots=minHex,ancreMin,distParHexM,partDegradée%,pochesVoitureMax (ex. 5,40,100,70,10).
 * Sans paramètre : valeurs de config.js.
 * @returns {object|false|undefined}
 */
function reglagesIlotsDepuisUrl() {
  const v = new URLSearchParams(location.search).get("ilots");
  if (v == null) return undefined;
  if (v === "off") return false;
  const [minHex, ancreMin, distParHexM, deg, poches] = v.split(",").map(Number);
  const r = {};
  if (Number.isFinite(minHex)) r.minHex = minHex;
  if (Number.isFinite(ancreMin)) r.ancreMin = ancreMin;
  if (Number.isFinite(distParHexM)) r.distParHexM = distParHexM;
  if (Number.isFinite(deg)) r.partDegradeeMax = deg / 100;
  if (Number.isFinite(poches)) r.pochesVoitureMax = poches;
  return r;
}
import { URBAN_CLASSIFICATION_RADIUS_M, haversineMeters } from "./graph.js";

/**
 * Démarre l'interface : carte Leaflet (fonds IGN), formulaire d'adresse avec
 * suggestions, lancement du calcul, affichage des zones, export image et
 * outil de diagnostic. Fonction volumineuse (environ 660 lignes) : à
 * découper lors de sa prochaine évolution.
 */
export function initUI() {
  const map = L.map("map").setView([46.6, 2.2], 6);
  // Fond IGN : tuiles redemandées en cas d'échec, message si certaines
  // manquent encore (fond-carte.js). Jeu de tuiles PM_0_19, niveaux 0 à 19
  // (GetCapabilities du WMTS, 04/11/2026).
  const CoucheTuiles = creerCoucheTuiles(L);
  const planIgn = new CoucheTuiles(
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM_0_19&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    { attribution: "&copy; IGN - Géoplateforme", maxZoom: 19 },
  );
  const satellite = new CoucheTuiles(
    "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM_0_19&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    { attribution: "&copy; IGN - Géoplateforme", maxZoom: 19 },
  );
  planIgn.addTo(map);
  surveillerFondDeCarte(L, map, [planIgn, satellite]);
  suivreTailleCarte(map);
  L.control.layers({ "Plan IGN": planIgn, "Satellite (orthophotos IGN)": satellite }).addTo(map);

  // Pas de marqueur tant qu'aucun point de départ n'a été choisi (adresse
  // uniquement — pas de sélection par clic sur la carte) — créé au premier besoin.
  let marker = null;
  function placeMarker(lat, lon) {
    if (!marker) {
      marker = L.marker([lat, lon]).addTo(map);
    } else {
      marker.setLatLng([lat, lon]);
    }
  }
  const layers = { Walk: [], Bike: [], Ebike: [] };
  let lastComputation = null; // { results, lat, lon, address } du dernier calcul réussi, pour l'export image
  const colors = getModeColors();

  function clearLayers() {
    for (const k in layers) {
      layers[k].forEach((l) => map.removeLayer(l));
      layers[k] = [];
    }
  }

  async function resolveAndGoToAddress(text) {
    const statusEl = document.getElementById("status");
    statusEl.className = "";
    statusEl.textContent = "Recherche de l\u2019adresse\u2026";
    try {
      const { lon, lat, label } = await geocodeAddress(text);
      document.getElementById("lat").value = lat.toFixed(6);
      document.getElementById("lon").value = lon.toFixed(6);
      placeMarker(lat, lon);
      map.setView([lat, lon], 15);
      statusEl.textContent = "Trouvé : " + label;
    } catch (e) {
      statusEl.className = "error";
      statusEl.textContent = "Adresse introuvable ou service indisponible.";
    }
  }

  document.getElementById("geocode").addEventListener("click", () => {
    const q = document.getElementById("address").value.trim();
    if (q) {
      resolveAndGoToAddress(q);
    }
  });

  // --- Autocomplétion en direct ---
  const addressInput = document.getElementById("address");
  const suggestionsBox = document.getElementById("addressSuggestions");
  let suggestionDebounceTimer = null;
  let currentSuggestions = [];
  let highlightedIndex = -1;

  function renderSuggestions(items) {
    currentSuggestions = items;
    highlightedIndex = -1;
    if (items.length === 0) {
      suggestionsBox.classList.remove("active");
      suggestionsBox.innerHTML = "";
      return;
    }
    suggestionsBox.innerHTML = items
      .map(
        (item, i) =>
          '<div class="address-suggestion-item" data-index="' +
          i +
          '">' +
          echapperHtml(item.fulltext || item.label || "") +
          "</div>",
      )
      .join("");
    suggestionsBox.classList.add("active");
  }

  function closeSuggestions() {
    suggestionsBox.classList.remove("active");
    suggestionsBox.innerHTML = "";
    currentSuggestions = [];
    highlightedIndex = -1;
  }

  function selectSuggestion(item) {
    const text = item.fulltext || item.label || "";
    addressInput.value = text;
    closeSuggestions();
    resolveAndGoToAddress(text);
  }

  addressInput.addEventListener("input", () => {
    const text = addressInput.value.trim();
    clearTimeout(suggestionDebounceTimer);
    if (text.length < 3) {
      closeSuggestions();
      return;
    }
    suggestionDebounceTimer = setTimeout(async () => {
      try {
        const results = await fetchAddressSuggestions(text);
        renderSuggestions(results);
      } catch (e) {
        closeSuggestions();
      }
    }, 300);
  });

  addressInput.addEventListener("keydown", (e) => {
    if (!suggestionsBox.classList.contains("active")) {
      return;
    }
    const items = suggestionsBox.querySelectorAll(".address-suggestion-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && currentSuggestions[highlightedIndex]) {
        e.preventDefault();
        selectSuggestion(currentSuggestions[highlightedIndex]);
        return;
      }
      closeSuggestions();
      return;
    } else if (e.key === "Escape") {
      closeSuggestions();
      return;
    } else {
      return;
    }
    items.forEach((el, i) => el.classList.toggle("highlighted", i === highlightedIndex));
  });

  suggestionsBox.addEventListener("click", (e) => {
    const target = e.target.closest(".address-suggestion-item");
    if (!target) {
      return;
    }
    const index = parseInt(target.dataset.index, 10);
    if (currentSuggestions[index]) {
      selectSuggestion(currentSuggestions[index]);
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target !== addressInput && !suggestionsBox.contains(e.target)) {
      closeSuggestions();
    }
  });

  // --- Fenêtre méthodologie ---
  const methodologyOverlay = document.getElementById("methodologyOverlay");
  for (const id of ["openMethodology", "openMethodologyBis"]) {
    document.getElementById(id)?.addEventListener("click", () => {
      methodologyOverlay.classList.add("active");
    });
  }
  document.getElementById("closeMethodology").addEventListener("click", () => {
    methodologyOverlay.classList.remove("active");
  });
  methodologyOverlay.addEventListener("click", (e) => {
    if (e.target === methodologyOverlay) {
      methodologyOverlay.classList.remove("active");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      methodologyOverlay.classList.remove("active");
    }
  });

  // --- Bascule formulaire / carte sur mobile ---
  const layoutEl = document.getElementById("layout");
  const tabFormButton = document.getElementById("tabFormButton");
  const tabMapButton = document.getElementById("tabMapButton");
  function showMobileTab(tab) {
    layoutEl.classList.toggle("show-sidebar", tab === "form");
    layoutEl.classList.toggle("show-map", tab === "map");
    tabFormButton.classList.toggle("active", tab === "form");
    tabMapButton.classList.toggle("active", tab === "map");
    if (tab === "map") {
      setTimeout(() => map.invalidateSize(), 50);
    } // Leaflet doit recalculer sa taille une fois visible
  }
  tabFormButton.addEventListener("click", () => showMobileTab("form"));
  tabMapButton.addEventListener("click", () => showMobileTab("map"));

  document.getElementById("compute").addEventListener("click", async () => {
    const btn = document.getElementById("compute");
    const statusEl = document.getElementById("status");
    const progressWrapper = document.getElementById("progressWrapper");
    const progressInner = document.getElementById("progressInner");
    const progressPercent = document.getElementById("progressPercent");

    const lat = parseFloat(document.getElementById("lat").value);
    const lon = parseFloat(document.getElementById("lon").value);
    if (!isFinite(lat) || !isFinite(lon)) {
      statusEl.className = "error";
      statusEl.textContent = "Choisissez d\u2019abord un point de départ (adresse, clic sur la carte, ou coordonnées).";
      return;
    }

    const direction = document.getElementById("direction")?.value || "aller-retour";
    const moment = document.getElementById("moment")?.value || "pointe";
    btn.disabled = true;
    statusEl.className = "";
    statusEl.textContent = "Démarrage…";
    progressWrapper.classList.add("active");
    progressInner.style.width = "0%";
    progressPercent.textContent = "0%";
    clearLayers();
    placeMarker(lat, lon);
    ["countWalk", "countBike", "countEbike"].forEach((id) => {
      document.getElementById(id).textContent = "";
    });

    try {
      const { computation, probeJunctionCount, probeChosenRadiusMeters, usedRadiusMeters, radiusRetried } =
        await calculerCarteArrierePlan({
          lon,
          lat,
          direction,
          moment,
          ilots: reglagesIlotsDepuisUrl(),
          onEtat: ({ message, fraction }) => {
            statusEl.textContent = message;
            const pct = Math.round(fraction * 100);
            progressInner.style.width = pct + "%";
            progressPercent.textContent = pct + "%";
          },
        });

      const {
        results,
        nodeCount,
        edgeCount,
        rawConnectivity,
        roadsTruncated,
        rawFeatureCount,
        urbanContext,
        delayCarApplied,
        facteurCongestion,
        partReseauUrbain,
        parkingLisiere,
        diagnostics,
      } = computation;

      document.getElementById("networkInfo").textContent =
        nodeCount +
        " nœuds, " +
        edgeCount +
        " rues (rayon interrogé : " +
        usedRadiusMeters / 1000 +
        " km, sonde : " +
        probeJunctionCount +
        " carrefours/1km) — contexte détecté : " +
        (urbanContext.isUrban ? "urbain" : "rural") +
        " (" +
        urbanContext.junctionCount +
        " carrefours à moins de " +
        URBAN_CLASSIFICATION_RADIUS_M +
        " m, délai voiture appliqué : " +
        delayCarApplied +
        " min ; temps voiture × " +
        String(facteurCongestion ?? 1).replace(".", ",") +
        (moment === "pointe" ? " en heure de pointe" : " en moyenne de la journée") +
        " sur les tronçons en ville, soit " +
        Math.round((partReseauUrbain ?? 0) * 100) +
        " % du réseau)" +
        (parkingLisiere
          ? " — adresse hors réseau voiture : voiture garée à " +
            parkingLisiere.distanceMeters +
            " m, marche ajoutée au temps voiture"
          : "");
      lastComputation = {
        results,
        lat,
        lon,
        address: document.getElementById("address").value.trim(),
        diagnostics,
        delayCarApplied,
        direction,
      };
      document.getElementById("exportSection").classList.add("active");
      document.getElementById("diagnosticSection").classList.add("active");

      // Anneaux non chevauchants : l'ordre d'empilement n'a plus d'incidence
      // visuelle (aucune zone ne recouvre une autre), on garde Ebike -> Bike ->
      // Walk par habitude de lecture (grand vers petit).
      for (const key of ["Ebike", "Bike", "Walk"]) {
        const r = results[key];
        document.getElementById("count" + key).textContent =
          r.hexagonCount + " hexagones" + (r.possiblyTruncated ? " ⚠️ tronquée" : "");
        if (r.polygons.length === 0) {
          continue;
        }
        const geojson = { type: "MultiPolygon", coordinates: r.polygons };
        const layer = L.geoJSON(geojson, {
          style: { color: colors[key], weight: 1.5, opacity: 1, fillColor: colors[key], fillOpacity: 0.5 },
        }).addTo(map);
        layers[key].push(layer);
      }

      showMobileTab("map");
      map.invalidateSize();
      const allLayers = [...layers.Walk, ...layers.Bike, ...layers.Ebike];
      if (allLayers.length > 0) {
        const group = L.featureGroup(allLayers);
        map.fitBounds(group.getBounds(), { maxZoom: 15 });
      }

      const modeLabelsFr = { Walk: "Marche", Bike: "Vélo", Ebike: "Vélo électrique" };
      const truncatedModes = ["Walk", "Bike", "Ebike"]
        .filter((key) => results[key].possiblyTruncated)
        .map((key) => modeLabelsFr[key]);
      const bikeEbikeIdentical =
        !results.Bike.possiblyTruncated &&
        !results.Ebike.possiblyTruncated &&
        results.Bike.hexagonCount > 0 &&
        results.Bike.hexagonCount === results.Ebike.hexagonCount;

      const formatDiagnosis = (d) => {
        const total = d.excludedByFilter + d.beyondTimeBudget + d.carWins + d.other;
        if (total === 0) {
          return 'aucune arête de frontière (zone entourée de "gagnant")';
        }
        const pct = (n) => Math.round((n / total) * 100);
        return (
          d.carWins +
          " arêtes (" +
          pct(d.carWins) +
          "%) où la voiture gagne réellement, " +
          d.excludedByFilter +
          " (" +
          pct(d.excludedByFilter) +
          "%) exclues par le filtre de vitesse, " +
          d.beyondTimeBudget +
          " (" +
          pct(d.beyondTimeBudget) +
          "%) hors du budget-temps du mode" +
          (d.other > 0 ? ", " + d.other + " (" + pct(d.other) + "%) autre" : "")
        );
      };

      const rawPct = Math.round((rawConnectivity.reachable / rawConnectivity.total) * 100);
      // Diagnostic technique (connexité brute) gardé pour la console, pas pour
      // l'utilisateur ; seul l'agrandissement du rayon lui est signalé.
      console.info(
        "Connexité brute du réseau : " + rawConnectivity.reachable + "/" + rawConnectivity.total + " nœuds (" + rawPct + " %).",
      );
      const connectivityNote = radiusRetried
        ? "Zone de calcul agrandie de " +
          probeChosenRadiusMeters / 1000 +
          " à " +
          usedRadiusMeters / 1000 +
          " km pour ne pas couper les zones."
        : "";

      if (roadsTruncated) {
        statusEl.className = "error";
        statusEl.textContent =
          "Calcul terminé, mais le téléchargement du réseau routier semble avoir été tronqué (" +
          rawFeatureCount +
          " tronçons récupérés, la limite de pagination a été atteinte) — le réseau est probablement incomplet dans cette zone très dense. " +
          connectivityNote;
      } else if (truncatedModes.length > 0) {
        statusEl.className = "error";
        statusEl.textContent =
          "Calcul terminé, mais la zone " +
          truncatedModes.join(" et ") +
          " atteint le bord du rayon interrogé (" +
          usedRadiusMeters +
          " m) — sa vraie limite est probablement plus loin, hors de la zone couverte par ce calcul. " +
          connectivityNote;
      } else if (bikeEbikeIdentical) {
        statusEl.className = "error";
        statusEl.textContent =
          "Calcul terminé, mais Vélo et VAE atteignent exactement la même limite. " +
          connectivityNote +
          " Diagnostic de la frontière — Vélo : " +
          formatDiagnosis(results.Bike.frontierDiagnosis) +
          ". VAE : " +
          formatDiagnosis(results.Ebike.frontierDiagnosis) +
          ".";
      } else {
        statusEl.className = "";
        statusEl.textContent = ("Calcul terminé. " + connectivityNote).trim();
      }
    } catch (e) {
      console.error(e);
      afficherErreurCalcul(statusEl, e);
    } finally {
      btn.disabled = false;
      progressWrapper.classList.remove("active");
    }
  });

  // --- Export de carte ---
  document.getElementById("exportButton").addEventListener("click", async () => {
    const exportButton = document.getElementById("exportButton");
    const exportStatus = document.getElementById("exportStatus");
    const basemapChoice = document.getElementById("exportBasemap").value;
    const resolutionChoice = document.getElementById("exportResolution").value;
    exportButton.disabled = true;
    try {
      await exportMapImage(lastComputation, basemapChoice, resolutionChoice, (msg) => {
        exportStatus.textContent = msg;
      });
    } finally {
      exportButton.disabled = false;
    }
  });

  // --- Temps de déplacement en un point cliqué ---
  // Le clic est toujours actif (plus de case à cocher préalable) : l'objectif
  // est que l'usager puisse valider en un coup d'œil la cohérence de la carte.
  let diagnosticMarker = null;
  const MODE_LABELS = { Walk: "Marche", Bike: "Vélo", Ebike: "Vélo électrique" };
  map.on("click", async (e) => {
    if (!lastComputation || !lastComputation.diagnostics) {
      document.getElementById("diagnosticOutput").style.display = "block";
      document.getElementById("diagnosticOutput").innerHTML = '<p class="hint">Lancez d’abord un calcul.</p>';
      return;
    }
    const calcul = lastComputation;
    const clickLon = e.latlng.lng,
      clickLat = e.latlng.lat;
    // Données calculées là où se trouve le réseau (worker, voir inspection.js).
    let info;
    try {
      info = await calcul.diagnostics.inspecter(clickLon, clickLat);
    } catch {
      return;
    }
    if (!info || calcul !== lastComputation) {
      return;
    }
    const { nodeLon, nodeLat, snapDistance, carDirect, carEffective, carNetworkDistance } = info;

    if (diagnosticMarker) {
      map.removeLayer(diagnosticMarker);
    }
    diagnosticMarker = L.circleMarker([nodeLat, nodeLon], {
      radius: 6,
      color: "#b3452f",
      fillColor: "#b3452f",
      fillOpacity: 0.8,
    }).addTo(map);

    const straightLineFromOrigin = haversineMeters(lastComputation.lon, lastComputation.lat, nodeLon, nodeLat);
    // Aller-retour : deux trajets, donc deux accès (vélo ou stationnement) et
    // deux comblements à pied jusqu'au réseau voiture (facteurTrajets, isochrones.js).
    const allerRetour = lastComputation.direction === "aller-retour";
    const facteurTrajets = info.facteurTrajets;
    const carIsFallback = carDirect === undefined && carEffective !== Infinity;
    const carIsUnreachable = carEffective === Infinity;

    // --- Affichage principal : temps total porte-à-porte (délai d'accès
    // inclus) pour chaque mode, directement comparable à la voiture, sans
    // avoir à déplier les détails techniques pour comprendre le calcul.
    // Le délai propre à chaque mode se déduit de carPenalty (déjà calculé
    // dans isochrones.js comme la différence de délai d'accès entre la
    // voiture et ce mode) et du délai voiture appliqué à ce calcul :
    // délai_mode = délai_voiture - carPenalty. Pour la marche, carPenalty =
    // délai_voiture (pas de délai propre) ; pour vélo/VAE, carPenalty =
    // délai_voiture - délai_vélo.
    const delayCarSeconds = lastComputation.delayCarApplied * 60 * facteurTrajets;
    const titres = {
      depart: "Temps de l’adresse jusqu’à ce point",
      arrivee: "Temps de ce point jusqu’à l’adresse",
      "aller-retour": "Temps aller + retour (adresse → ce point → adresse)",
    };
    let html =
      "<strong>" +
      (titres[lastComputation.direction] || titres.depart) +
      "</strong> (" +
      snapDistance.toFixed(0) +
      " m du point cliqué)<br>";
    const enTete = allerRetour
      ? ["Trajets aller + retour", "+ Accès (×2)", "Total aller-retour"]
      : ["Trajet", "+ Accès", "Total porte-à-porte"];
    html +=
      '<table data-style="width:100%; margin-top:4px;"><tr><th data-style="text-align:left;">Mode</th>' +
      enTete.map((t) => '<th data-style="text-align:left;">' + t + "</th>").join("") +
      "</tr>";
    const carTotalSeconds = carIsUnreachable ? null : carEffective + delayCarSeconds;
    for (const mode of info.modes) {
      const mt = mode.temps;
      const ownDelaySeconds = delayCarSeconds - mode.carPenalty * facteurTrajets;
      if (mt === undefined) {
        html += "<tr><td>" + (MODE_LABELS[mode.key] || mode.key) + '</td><td colspan="3">hors budget-temps</td></tr>';
        continue;
      }
      const totalSeconds = mt + ownDelaySeconds;
      const beatsCarr = carTotalSeconds !== null && totalSeconds < carTotalSeconds;
      const verdict = carTotalSeconds === null ? "" : beatsCarr ? " ✅" : " ❌";
      html +=
        "<tr><td>" +
        (MODE_LABELS[mode.key] || mode.key) +
        "</td><td>" +
        (mt / 60).toFixed(1) +
        " min</td><td>+" +
        (ownDelaySeconds / 60).toFixed(1) +
        " min</td><td><strong>" +
        (totalSeconds / 60).toFixed(1) +
        " min</strong>" +
        verdict +
        "</td></tr>";
    }
    if (carIsUnreachable) {
      html += '<tr><td>Voiture</td><td colspan="3">inaccessible</td></tr>';
    } else {
      html +=
        "<tr><td>Voiture</td><td>" +
        (carEffective / 60).toFixed(1) +
        " min" +
        (carIsFallback ? " (estimé)" : "") +
        "</td><td>+" +
        (delayCarSeconds / 60).toFixed(1) +
        " min</td><td><strong>" +
        (carTotalSeconds / 60).toFixed(1) +
        " min</strong></td></tr>";
    }
    html += "</table>";
    html +=
      '<p class="hint" data-style="margin-top:4px;">« Accès » = temps pour détacher/rattacher son vélo, ou trouver une place et se garer (plus long en ville)' +
      (allerRetour ? ", compté une fois à l’aller et une fois au retour" : "") +
      ". ✅ = ce mode " +
      (allerRetour ? "fait l’aller-retour plus vite" : "arrive plus vite") +
      " que la voiture porte-à-porte à ce point précis.</p>";

    // --- Détails techniques : repliés par défaut (usage interne, comparaison
    // à une source externe type Google Maps, diagnostic d'un détour ou d'une
    // vitesse suspecte) — pas destinés à l'usager final. ---
    let advancedHtml = "";
    advancedHtml +=
      "Degré du nœud (arêtes qui s’y rejoignent) : " +
      info.degre +
      (info.degre >= 3
        ? " — compté comme carrefour (pénalité voiture appliquée)"
        : " — pas un carrefour") +
      "<br>";
    advancedHtml +=
      "Distance à vol d’oiseau depuis le départ : " + (straightLineFromOrigin / 1000).toFixed(2) + " km<br><br>";
    advancedHtml += "<strong>Voiture</strong> : ";
    if (carIsUnreachable) {
      advancedHtml += "inaccessible (aucun accès voiture à moins de 5 km)";
    } else if (carIsFallback) {
      advancedHtml +=
        (carEffective / 60).toFixed(1) +
        " min <em>(estimé — nœud non relié au réseau voiture, repli via le point voiture le plus proche + marche)</em>";
    } else {
      advancedHtml += (carDirect / 60).toFixed(1) + " min (calculé directement)";
      if (carNetworkDistance !== undefined) {
        const detourRatio = carNetworkDistance / straightLineFromOrigin;
        const impliedSpeed = carNetworkDistance / 1000 / (carDirect / 3600);
        const junctionDelaySum = info.carJunctionDelay;
        const junctionCount = Math.round(junctionDelaySum / 6); // 6 s par carrefour pour la voiture
        const junctionShare = junctionDelaySum / carDirect;
        advancedHtml +=
          "<br>Distance réseau réellement parcourue : " +
          (carNetworkDistance / 1000).toFixed(2) +
          " km" +
          " (×" +
          detourRatio.toFixed(2) +
          " par rapport au vol d’oiseau)" +
          "<br>Vitesse moyenne implicite : " +
          impliedSpeed.toFixed(1) +
          " km/h" +
          "<br>Cumul des pénalités de carrefour sur ce trajet : " +
          (junctionDelaySum / 60).toFixed(1) +
          " min (" +
          junctionCount +
          " carrefours traversés, soit " +
          (junctionShare * 100).toFixed(0) +
          "% du temps total)" +
          (junctionShare > 0.3
            ? ' — <strong data-style="color:var(--danger);">part anormalement élevée, probablement des faux carrefours (ex. fusion erronée des deux sens d’une route à chaussées séparées)</strong>'
            : "") +
          (detourRatio > 1.6
            ? '<br><strong data-style="color:var(--danger);">Détour important, probablement topologique</strong>'
            : impliedSpeed < 30 && junctionShare <= 0.3
              ? '<br><strong data-style="color:var(--danger);">Vitesse anormalement basse, probablement une donnée de vitesse manquante/sous-estimée sur ce trajet</strong>'
              : "");
      }
    }

    // Attributs bruts des tronçons touchant ce nœud — pour vérifier directement
    // ce que le parseur a réellement lu (nature, vitesse_moyenne_vl, importance)
    // plutôt que de deviner depuis l'extérieur si un champ est mal nommé ou
    // absent. Le "rang" est celui utilisé pour décider si une pénalité de
    // carrefour s'applique — utile pour comprendre pourquoi un croisement
    // compte ou non.
    const incidentEdges = info.troncons;
    if (incidentEdges.length > 0) {
      advancedHtml += "<br><strong>Tronçons connectés à ce nœud (données brutes)</strong>";
      advancedHtml +=
        '<table data-style="width:100%; margin-top:4px;"><tr><th data-style="text-align:left;">Nature</th><th data-style="text-align:left;">Vitesse déclarée</th><th data-style="text-align:left;">Longueur</th></tr>';
      for (const e of incidentEdges) {
        advancedHtml +=
          "<tr><td>" +
          (e.nature || "<em>(vide)</em>") +
          "</td><td>" +
          (e.vitesse != null ? e.vitesse + " km/h" : "<em>absente</em>") +
          "</td><td>" +
          e.length.toFixed(0) +
          " m</td></tr>";
      }
      advancedHtml += "</table>";
    }

    advancedHtml +=
      '<br><br><table data-style="width:100%;"><tr><th data-style="text-align:left;">Mode</th><th data-style="text-align:left;">Temps</th><th data-style="text-align:left;">Seuil à battre</th><th data-style="text-align:left;">Résultat</th></tr>';
    for (const mode of info.modes) {
      const mt = mode.temps;
      const seuil = carEffective === Infinity ? Infinity : carEffective + mode.carPenalty * facteurTrajets;
      const label = mt === undefined ? "hors budget-temps" : (mt / 60).toFixed(1) + " min";
      const seuilLabel = seuil === Infinity ? "—" : (seuil / 60).toFixed(1) + " min";
      const verdict = mt === undefined ? "—" : mt < seuil ? "✅ gagne" : "❌ perd";
      advancedHtml +=
        "<tr><td>" + mode.key + "</td><td>" + label + "</td><td>" + seuilLabel + "</td><td>" + verdict + "</td></tr>";
    }
    advancedHtml += "</table>";

    html +=
      '<details data-style="margin-top:8px;"><summary data-style="cursor:pointer; color:var(--muted); font-size:11.5px;">Détails techniques (pour vérification)</summary>' +
      '<div data-style="margin-top:6px;">' +
      advancedHtml +
      "</div></details>";

    const out = document.getElementById("diagnosticOutput");
    out.style.display = "block";
    out.innerHTML = html;
  });
}

// Erreurs dues aux services de l'IGN (réseau coupé, saturation, limite de
// débit) plutôt qu'au calcul lui-même : message compréhensible pour
// l'utilisateur, détail technique replié en dessous (utile pour un
// signalement), et rien d'inséré en HTML brut.
const MOTIF_ERREUR_SERVICE =
  /Failed to fetch|NetworkError|Load failed|réseau|saturé|pool error|Unable to obtain connection|HTTP (429|5\d\d)|délai dépassé/i;

/**
 * Affiche l'échec d'un calcul dans la zone d'état.
 * @param {HTMLElement} statusEl  Zone d'état (#status).
 * @param {Error} erreur
 */
function afficherErreurCalcul(statusEl, erreur) {
  statusEl.className = "error";
  statusEl.textContent = "";
  const message = document.createElement("p");
  if (erreur.message === MESSAGE_DEPART_REFUSE) {
    // Point refusé (voie interdite à pied et à vélo) : consigne directe.
    message.textContent = MESSAGE_DEPART_REFUSE;
    statusEl.append(message);
    return;
  }
  message.textContent = MOTIF_ERREUR_SERVICE.test(erreur.message)
    ? "Les services de l\u2019IGN (réseau routier, altitudes) ne répondent pas correctement en ce moment : ils sont probablement saturés. Réessayez dans quelques minutes."
    : "Erreur pendant le calcul.";
  const details = document.createElement("details");
  const resume = document.createElement("summary");
  resume.textContent = "Détail technique";
  const texte = document.createElement("p");
  texte.textContent = erreur.message;
  details.append(resume, texte);
  statusEl.append(message, details);
}
