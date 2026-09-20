// ==========================================================================
// Interface : carte, formulaire, rendu
// (Leaflet est chargé globalement via <script> dans index.html — pas un
// module ES6, d'où l'usage direct de la variable globale L.)
// ==========================================================================
import { computeIsochronesNetwork, probeJunctionDensity } from './isochrones.js';
import { geocodeAddress, fetchAddressSuggestions, setWfsMaxRequestsPerSecond } from './ign-api.js';
import { exportMapImage } from './export-image.js';
import { getModeColors } from './colors.js';
import { URBAN_CLASSIFICATION_RADIUS_M, findNearestNode, haversineMeters, estimateCarTime } from './graph.js';
import {
  NETWORK_RADIUS_PROBE_M, RADIUS_TIER_DENSE_MIN_JUNCTIONS, RADIUS_TIER_DENSE_M,
  RADIUS_TIER_INTERMEDIATE_MIN_JUNCTIONS, RADIUS_TIER_INTERMEDIATE_M, RADIUS_TIER_SPARSE_M,
  NETWORK_RADIUS_MAX_M, ELEVATION_GRID_SPACING_M, NODE_SNAP_TOLERANCE_M, WFS_PAGE_SIZE, WFS_MAX_REQUESTS_PER_SECOND,
} from './config.js';

// Choisit le rayon de réseau initial d'après la densité de carrefours mesurée
// par la sonde (voir config.js pour la justification des seuils et rayons).
function pickInitialRadius(junctionCount) {
  if (junctionCount >= RADIUS_TIER_DENSE_MIN_JUNCTIONS) { return RADIUS_TIER_DENSE_M; }
  if (junctionCount >= RADIUS_TIER_INTERMEDIATE_MIN_JUNCTIONS) { return RADIUS_TIER_INTERMEDIATE_M; }
  return RADIUS_TIER_SPARSE_M;
}

export function initUI() {
  const map = L.map('map').setView([46.6, 2.2], 6);
  const planIgn = L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', { attribution: '&copy; IGN - Géoplateforme', maxZoom: 19 });
  const satellite = L.tileLayer('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', { attribution: '&copy; IGN - Géoplateforme', maxZoom: 19 });
  planIgn.addTo(map);
  L.control.layers({ 'Plan IGN': planIgn, 'Satellite (orthophotos IGN)': satellite }).addTo(map);

  // Pas de marqueur tant qu'aucun point de départ n'a été choisi (adresse
  // uniquement — pas de sélection par clic sur la carte) — créé au premier besoin.
  let marker = null;
  function placeMarker(lat, lon) {
    if (!marker) { marker = L.marker([lat, lon]).addTo(map); }
    else { marker.setLatLng([lat, lon]); }
  }
  let layers = { Walk: [], Bike: [], Ebike: [] };
  let lastComputation = null; // { results, lat, lon, address } du dernier calcul réussi, pour l'export image
  const colors = getModeColors();

  function clearLayers() { for (const k in layers) { layers[k].forEach((l) => map.removeLayer(l)); layers[k] = []; } }

  async function resolveAndGoToAddress(text) {
    const statusEl = document.getElementById('status');
    statusEl.className = ''; statusEl.textContent = 'Recherche de l\u2019adresse\u2026';
    try {
      const { lon, lat, label } = await geocodeAddress(text);
      document.getElementById('lat').value = lat.toFixed(6);
      document.getElementById('lon').value = lon.toFixed(6);
      placeMarker(lat, lon);
      map.setView([lat, lon], 15);
      statusEl.textContent = 'Trouvé : ' + label;
    } catch (e) {
      statusEl.className = 'error';
      statusEl.textContent = 'Adresse introuvable ou service indisponible.';
    }
  }

  document.getElementById('geocode').addEventListener('click', () => {
    const q = document.getElementById('address').value.trim();
    if (q) { resolveAndGoToAddress(q); }
  });

  // --- Autocomplétion en direct ---
  const addressInput = document.getElementById('address');
  const suggestionsBox = document.getElementById('addressSuggestions');
  let suggestionDebounceTimer = null;
  let currentSuggestions = [];
  let highlightedIndex = -1;

  function renderSuggestions(items) {
    currentSuggestions = items;
    highlightedIndex = -1;
    if (items.length === 0) { suggestionsBox.classList.remove('active'); suggestionsBox.innerHTML = ''; return; }
    suggestionsBox.innerHTML = items.map((item, i) => '<div class="address-suggestion-item" data-index="' + i + '">' + (item.fulltext || item.label || '') + '</div>').join('');
    suggestionsBox.classList.add('active');
  }

  function closeSuggestions() {
    suggestionsBox.classList.remove('active');
    suggestionsBox.innerHTML = '';
    currentSuggestions = [];
    highlightedIndex = -1;
  }

  function selectSuggestion(item) {
    const text = item.fulltext || item.label || '';
    addressInput.value = text;
    closeSuggestions();
    resolveAndGoToAddress(text);
  }

  addressInput.addEventListener('input', () => {
    const text = addressInput.value.trim();
    clearTimeout(suggestionDebounceTimer);
    if (text.length < 3) { closeSuggestions(); return; }
    suggestionDebounceTimer = setTimeout(async () => {
      try {
        const results = await fetchAddressSuggestions(text);
        renderSuggestions(results);
      } catch (e) { closeSuggestions(); }
    }, 300);
  });

  addressInput.addEventListener('keydown', (e) => {
    if (!suggestionsBox.classList.contains('active')) { return; }
    const items = suggestionsBox.querySelectorAll('.address-suggestion-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && currentSuggestions[highlightedIndex]) {
        e.preventDefault();
        selectSuggestion(currentSuggestions[highlightedIndex]);
        return;
      }
      closeSuggestions();
      return;
    } else if (e.key === 'Escape') {
      closeSuggestions();
      return;
    } else {
      return;
    }
    items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIndex));
  });

  suggestionsBox.addEventListener('click', (e) => {
    const target = e.target.closest('.address-suggestion-item');
    if (!target) { return; }
    const index = parseInt(target.dataset.index, 10);
    if (currentSuggestions[index]) { selectSuggestion(currentSuggestions[index]); }
  });

  document.addEventListener('click', (e) => {
    if (e.target !== addressInput && !suggestionsBox.contains(e.target)) { closeSuggestions(); }
  });

  // --- Fenêtre méthodologie ---
  const methodologyOverlay = document.getElementById('methodologyOverlay');
  document.getElementById('openMethodology').addEventListener('click', () => { methodologyOverlay.classList.add('active'); });
  document.getElementById('closeMethodology').addEventListener('click', () => { methodologyOverlay.classList.remove('active'); });
  methodologyOverlay.addEventListener('click', (e) => { if (e.target === methodologyOverlay) { methodologyOverlay.classList.remove('active'); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { methodologyOverlay.classList.remove('active'); } });

  // --- Bascule formulaire / carte sur mobile ---
  const layoutEl = document.getElementById('layout');
  const tabFormButton = document.getElementById('tabFormButton');
  const tabMapButton = document.getElementById('tabMapButton');
  function showMobileTab(tab) {
    layoutEl.classList.toggle('show-sidebar', tab === 'form');
    layoutEl.classList.toggle('show-map', tab === 'map');
    tabFormButton.classList.toggle('active', tab === 'form');
    tabMapButton.classList.toggle('active', tab === 'map');
    if (tab === 'map') { setTimeout(() => map.invalidateSize(), 50); } // Leaflet doit recalculer sa taille une fois visible
  }
  tabFormButton.addEventListener('click', () => showMobileTab('form'));
  tabMapButton.addEventListener('click', () => showMobileTab('map'));

  document.getElementById('compute').addEventListener('click', async () => {
    const btn = document.getElementById('compute');
    const statusEl = document.getElementById('status');
    const progressWrapper = document.getElementById('progressWrapper');
    const progressInner = document.getElementById('progressInner');
    const progressPercent = document.getElementById('progressPercent');

    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    if (!isFinite(lat) || !isFinite(lon)) { statusEl.className = 'error'; statusEl.textContent = 'Choisissez d\u2019abord un point de départ (adresse, clic sur la carte, ou coordonnées).'; return; }

    const opts = {
      lon, lat,
      elevationGridSpacingMeters: ELEVATION_GRID_SPACING_M,
      nodeSnapToleranceMeters: NODE_SNAP_TOLERANCE_M,
      wfsPageSize: WFS_PAGE_SIZE,
    };
    setWfsMaxRequestsPerSecond(WFS_MAX_REQUESTS_PER_SECOND);

    btn.disabled = true;
    statusEl.className = ''; statusEl.textContent = 'Démarrage…';
    progressWrapper.classList.add('active'); progressInner.style.width = '0%'; progressPercent.textContent = '0%';
    clearLayers();
    placeMarker(lat, lon);
    ['countWalk', 'countBike', 'countEbike'].forEach((id) => { document.getElementById(id).textContent = ''; });

    try {
      const makeOnProgress = (prefix) => (label, fraction) => {
        statusEl.textContent = prefix + label;
        const pct = Math.round(fraction * 100);
        progressInner.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
      };
      const isTruncated = (c) => c.roadsTruncated || ['Walk', 'Bike', 'Ebike'].some((k) => c.results[k].possiblyTruncated);

      // Sonde légère (1 km) pour choisir un rayon de départ adapté au
      // contexte, avant de lancer le téléchargement principal, coûteux.
      statusEl.textContent = 'Analyse du contexte local (sonde ' + (NETWORK_RADIUS_PROBE_M / 1000) + ' km)…';
      progressInner.style.width = '2%'; progressPercent.textContent = '2%';
      const probeJunctionCount = await probeJunctionDensity(lon, lat, NETWORK_RADIUS_PROBE_M, opts.nodeSnapToleranceMeters, opts.wfsPageSize);
      const probeChosenRadiusMeters = pickInitialRadius(probeJunctionCount);
      let usedRadiusMeters = probeChosenRadiusMeters;
      let computation = await computeIsochronesNetwork({
        ...opts, networkRadiusMeters: usedRadiusMeters,
        onProgress: makeOnProgress('Contexte : ' + probeJunctionCount + ' carrefours détectés en 1 km, rayon choisi ' + (usedRadiusMeters / 1000) + ' km — '),
      });

      // Filet de sécurité : si ce rayon adapté au contexte ne suffit
      // finalement pas (voir config.js — la relation carrefours/distance
      // n'est pas monotone, un hypercentre ou un rural très épars peuvent
      // dépasser toutes les estimations), on relance au rayon maximal.
      let radiusRetried = false;
      if (isTruncated(computation)) {
        radiusRetried = true;
        usedRadiusMeters = NETWORK_RADIUS_MAX_M;
        computation = await computeIsochronesNetwork({
          ...opts, networkRadiusMeters: usedRadiusMeters,
          onProgress: makeOnProgress('Rayon de ' + (probeChosenRadiusMeters / 1000) + ' km insuffisant, nouvel essai à ' + (NETWORK_RADIUS_MAX_M / 1000) + ' km — '),
        });
      }

      const { results, nodeCount, edgeCount, rawConnectivity, roadsTruncated, rawFeatureCount, urbanContext, delayCarApplied, diagnostics } = computation;

      document.getElementById('networkInfo').textContent = nodeCount + ' nœuds, ' + edgeCount + ' rues (rayon interrogé : ' + (usedRadiusMeters / 1000) + ' km, sonde : ' + probeJunctionCount + ' carrefours/1km) — contexte détecté : '
        + (urbanContext.isUrban ? 'urbain' : 'rural') + ' (' + urbanContext.junctionCount + ' carrefours à moins de ' + URBAN_CLASSIFICATION_RADIUS_M + ' m, délai voiture appliqué : ' + delayCarApplied + ' min)';
      lastComputation = { results, lat, lon, address: document.getElementById('address').value.trim(), diagnostics, delayCarApplied };
      document.getElementById('exportSection').classList.add('active');
      document.getElementById('diagnosticSection').classList.add('active');

      // Anneaux non chevauchants : l'ordre d'empilement n'a plus d'incidence
      // visuelle (aucune zone ne recouvre une autre), on garde Ebike -> Bike ->
      // Walk par habitude de lecture (grand vers petit).
      for (const key of ['Ebike', 'Bike', 'Walk']) {
        const r = results[key];
        document.getElementById('count' + key).textContent = r.hexagonCount + ' hexagones' + (r.possiblyTruncated ? ' ⚠️ tronquée' : '');
        if (r.polygons.length === 0) { continue; }
        const geojson = { type: 'MultiPolygon', coordinates: r.polygons };
        const layer = L.geoJSON(geojson, { style: { color: colors[key], weight: 1.5, opacity: 1, fillColor: colors[key], fillOpacity: 0.5 } }).addTo(map);
        layers[key].push(layer);
      }

      showMobileTab('map');
      map.invalidateSize();
      const allLayers = [...layers.Walk, ...layers.Bike, ...layers.Ebike];
      if (allLayers.length > 0) {
        const group = L.featureGroup(allLayers);
        map.fitBounds(group.getBounds(), { maxZoom: 15 });
      }

      const modeLabelsFr = { Walk: 'Marche', Bike: 'Vélo', Ebike: 'Vélo électrique' };
      const truncatedModes = ['Walk', 'Bike', 'Ebike'].filter((key) => results[key].possiblyTruncated).map((key) => modeLabelsFr[key]);
      const bikeEbikeIdentical = !results.Bike.possiblyTruncated && !results.Ebike.possiblyTruncated
        && results.Bike.hexagonCount > 0 && results.Bike.hexagonCount === results.Ebike.hexagonCount;

      const formatDiagnosis = (d) => {
        const total = d.excludedByFilter + d.beyondTimeBudget + d.carWins + d.other;
        if (total === 0) { return 'aucune arête de frontière (zone entourée de "gagnant")'; }
        const pct = (n) => Math.round((n / total) * 100);
        return d.carWins + ' arêtes (' + pct(d.carWins) + '%) où la voiture gagne réellement, '
          + d.excludedByFilter + ' (' + pct(d.excludedByFilter) + '%) exclues par le filtre de vitesse, '
          + d.beyondTimeBudget + ' (' + pct(d.beyondTimeBudget) + '%) hors du budget-temps du mode'
          + (d.other > 0 ? ', ' + d.other + ' (' + pct(d.other) + '%) autre' : '');
      };

      const rawPct = Math.round((rawConnectivity.reachable / rawConnectivity.total) * 100);
      const connectivityNote = 'Connexité brute du réseau : ' + rawConnectivity.reachable + '/' + rawConnectivity.total + ' nœuds (' + rawPct + '%).'
        + (radiusRetried ? ' Rayon de ' + (probeChosenRadiusMeters / 1000) + ' km (sonde) insuffisant ici, calcul refait à ' + (usedRadiusMeters / 1000) + ' km.' : '');

      if (roadsTruncated) {
        statusEl.className = 'error';
        statusEl.textContent = 'Calcul terminé, mais le téléchargement du réseau routier semble avoir été tronqué (' + rawFeatureCount + ' tronçons récupérés, la limite de pagination a été atteinte) — le réseau est probablement incomplet dans cette zone très dense. ' + connectivityNote;
      } else if (truncatedModes.length > 0) {
        statusEl.className = 'error';
        statusEl.textContent = 'Calcul terminé, mais la zone ' + truncatedModes.join(' et ') + ' atteint le bord du rayon interrogé (' + usedRadiusMeters + ' m) — sa vraie limite est probablement plus loin, hors de la zone couverte par ce calcul. ' + connectivityNote;
      } else if (bikeEbikeIdentical) {
        statusEl.className = 'error';
        statusEl.textContent = 'Calcul terminé, mais Vélo et VAE atteignent exactement la même limite. ' + connectivityNote + ' Diagnostic de la frontière — Vélo : ' + formatDiagnosis(results.Bike.frontierDiagnosis) + '. VAE : ' + formatDiagnosis(results.Ebike.frontierDiagnosis) + '.';
      } else {
        statusEl.className = '';
        statusEl.textContent = 'Calcul terminé. ' + connectivityNote;
      }
    } catch (e) {
      console.error(e);
      statusEl.className = 'error';
      statusEl.textContent = 'Erreur pendant le calcul (' + e.message + ').';
    } finally {
      btn.disabled = false;
      progressWrapper.classList.remove('active');
    }
  });

  // --- Export de carte ---
  document.getElementById('exportButton').addEventListener('click', async () => {
    const exportButton = document.getElementById('exportButton');
    const exportStatus = document.getElementById('exportStatus');
    const basemapChoice = document.getElementById('exportBasemap').value;
    const resolutionChoice = document.getElementById('exportResolution').value;
    exportButton.disabled = true;
    try {
      await exportMapImage(lastComputation, basemapChoice, resolutionChoice, (msg) => { exportStatus.textContent = msg; });
    } finally {
      exportButton.disabled = false;
    }
  });

  // --- Temps de déplacement en un point cliqué ---
  // Le clic est toujours actif (plus de case à cocher préalable) : l'objectif
  // est que l'usager puisse valider en un coup d'œil la cohérence de la carte.
  let diagnosticMarker = null;
  const MODE_LABELS = { Walk: 'Marche', Bike: 'Vélo', Ebike: 'Vélo électrique' };
  map.on('click', (e) => {
    if (!lastComputation || !lastComputation.diagnostics) {
      document.getElementById('diagnosticOutput').style.display = 'block';
      document.getElementById('diagnosticOutput').innerHTML = '<p class="hint">Lancez d’abord un calcul.</p>';
      return;
    }
    const { graph, carTimes, carDistances, carJunctionDelays, carIndex, modeTimesByKey, modeDefs, nodeDegrees } = lastComputation.diagnostics;
    const clickLon = e.latlng.lng, clickLat = e.latlng.lat;
    const nearestNode = findNearestNode(graph, clickLon, clickLat);
    if (nearestNode == null) { return; }
    const [nodeLon, nodeLat] = graph.nodeCoords.get(nearestNode);
    const snapDistance = haversineMeters(clickLon, clickLat, nodeLon, nodeLat);

    if (diagnosticMarker) { map.removeLayer(diagnosticMarker); }
    diagnosticMarker = L.circleMarker([nodeLat, nodeLon], { radius: 6, color: '#b3452f', fillColor: '#b3452f', fillOpacity: 0.8 }).addTo(map);

    const straightLineFromOrigin = haversineMeters(lastComputation.lon, lastComputation.lat, nodeLon, nodeLat);
    const carDirect = carTimes.get(nearestNode);
    const carEffective = estimateCarTime(carTimes, carIndex, nearestNode, graph.nodeCoords);
    const carIsFallback = carDirect === undefined && carEffective !== Infinity;
    const carIsUnreachable = carEffective === Infinity;
    const carNetworkDistance = carDistances.get(nearestNode); // distance réellement parcourue par la voiture (le long du chemin le plus rapide trouvé), pas à vol d'oiseau

    // --- Affichage principal : temps total porte-à-porte (délai d'accès
    // inclus) pour chaque mode, directement comparable à la voiture, sans
    // avoir à déplier les détails techniques pour comprendre le calcul.
    // Le délai propre à chaque mode se déduit de carPenalty (déjà calculé
    // dans isochrones.js comme la différence de délai d'accès entre la
    // voiture et ce mode) et du délai voiture appliqué à ce calcul :
    // délai_mode = délai_voiture - carPenalty. Pour la marche, carPenalty =
    // délai_voiture (pas de délai propre) ; pour vélo/VAE, carPenalty =
    // délai_voiture - délai_vélo.
    const delayCarSeconds = lastComputation.delayCarApplied * 60;
    let html = '<strong>Temps jusqu’à ce point</strong> (' + snapDistance.toFixed(0) + ' m du point cliqué)<br>';
    html += '<table style="width:100%; margin-top:4px;"><tr><th style="text-align:left;">Mode</th><th style="text-align:left;">Trajet</th><th style="text-align:left;">+ Accès</th><th style="text-align:left;">Total porte-à-porte</th></tr>';
    const carTotalSeconds = carIsUnreachable ? null : carEffective + delayCarSeconds;
    for (const mode of modeDefs) {
      const mt = modeTimesByKey[mode.key].get(nearestNode);
      const ownDelaySeconds = delayCarSeconds - mode.carPenalty;
      if (mt === undefined) {
        html += '<tr><td>' + (MODE_LABELS[mode.key] || mode.key) + '</td><td colspan="3">hors budget-temps</td></tr>';
        continue;
      }
      const totalSeconds = mt + ownDelaySeconds;
      const beatsCarr = carTotalSeconds !== null && totalSeconds < carTotalSeconds;
      const verdict = carTotalSeconds === null ? '' : (beatsCarr ? ' ✅' : ' ❌');
      html += '<tr><td>' + (MODE_LABELS[mode.key] || mode.key) + '</td><td>' + (mt / 60).toFixed(1) + ' min</td><td>+' + (ownDelaySeconds / 60).toFixed(1) + ' min</td><td><strong>' + (totalSeconds / 60).toFixed(1) + ' min</strong>' + verdict + '</td></tr>';
    }
    if (carIsUnreachable) {
      html += '<tr><td>Voiture</td><td colspan="3">inaccessible</td></tr>';
    } else {
      html += '<tr><td>Voiture</td><td>' + (carEffective / 60).toFixed(1) + ' min' + (carIsFallback ? ' (estimé)' : '') + '</td><td>+' + lastComputation.delayCarApplied.toFixed(1) + ' min</td><td><strong>' + (carTotalSeconds / 60).toFixed(1) + ' min</strong></td></tr>';
    }
    html += '</table>';
    html += '<p class="hint" style="margin-top:4px;">« Accès » = temps pour détacher/rattacher son vélo, ou trouver une place et se garer (plus long en ville). ✅ = ce mode arrive plus vite que la voiture porte-à-porte à ce point précis.</p>';

    // --- Détails techniques : repliés par défaut (usage interne, comparaison
    // à une source externe type Google Maps, diagnostic d'un détour ou d'une
    // vitesse suspecte) — pas destinés à l'usager final. ---
    let advancedHtml = '';
    advancedHtml += 'Degré du nœud (arêtes qui s’y rejoignent) : ' + (nodeDegrees.get(nearestNode) || 0)
      + ((nodeDegrees.get(nearestNode) || 0) >= 3 ? ' — compté comme carrefour (pénalité voiture appliquée)' : ' — pas un carrefour') + '<br>';
    advancedHtml += 'Distance à vol d’oiseau depuis le départ : ' + (straightLineFromOrigin / 1000).toFixed(2) + ' km<br><br>';
    advancedHtml += '<strong>Voiture</strong> : ';
    if (carIsUnreachable) {
      advancedHtml += 'inaccessible (aucun accès voiture à moins de 5 km)';
    } else if (carIsFallback) {
      advancedHtml += (carEffective / 60).toFixed(1) + ' min <em>(estimé — nœud non relié au réseau voiture, repli via le point voiture le plus proche + marche)</em>';
    } else {
      advancedHtml += (carDirect / 60).toFixed(1) + ' min (calculé directement)';
      if (carNetworkDistance !== undefined) {
        const detourRatio = carNetworkDistance / straightLineFromOrigin;
        const impliedSpeed = (carNetworkDistance / 1000) / (carDirect / 3600);
        const junctionDelaySum = carJunctionDelays.get(nearestNode) || 0;
        const junctionCount = Math.round(junctionDelaySum / 6); // 6 s par carrefour pour la voiture
        const junctionShare = junctionDelaySum / carDirect;
        advancedHtml += '<br>Distance réseau réellement parcourue : ' + (carNetworkDistance / 1000).toFixed(2) + ' km'
          + ' (×' + detourRatio.toFixed(2) + ' par rapport au vol d’oiseau)'
          + '<br>Vitesse moyenne implicite : ' + impliedSpeed.toFixed(1) + ' km/h'
          + '<br>Cumul des pénalités de carrefour sur ce trajet : ' + (junctionDelaySum / 60).toFixed(1) + ' min ('
          + junctionCount + ' carrefours traversés, soit ' + (junctionShare * 100).toFixed(0) + '% du temps total)'
          + (junctionShare > 0.3 ? ' — <strong style="color:var(--danger);">part anormalement élevée, probablement des faux carrefours (ex. fusion erronée des deux sens d’une route à chaussées séparées)</strong>' : '')
          + (detourRatio > 1.6 ? '<br><strong style="color:var(--danger);">Détour important, probablement topologique</strong>' : (impliedSpeed < 30 && junctionShare <= 0.3 ? '<br><strong style="color:var(--danger);">Vitesse anormalement basse, probablement une donnée de vitesse manquante/sous-estimée sur ce trajet</strong>' : ''));
      }
    }

    // Attributs bruts des tronçons touchant ce nœud — pour vérifier directement
    // ce que le parseur a réellement lu (nature, vitesse_moyenne_vl, importance)
    // plutôt que de deviner depuis l'extérieur si un champ est mal nommé ou
    // absent. Le "rang" est celui utilisé pour décider si une pénalité de
    // carrefour s'applique — utile pour comprendre pourquoi un croisement
    // compte ou non.
    const incidentEdges = graph.edges.filter((e) => e.from === nearestNode || e.to === nearestNode).slice(0, 6);
    if (incidentEdges.length > 0) {
      advancedHtml += '<br><strong>Tronçons connectés à ce nœud (données brutes)</strong>';
      advancedHtml += '<table style="width:100%; margin-top:4px;"><tr><th style="text-align:left;">Nature</th><th style="text-align:left;">Vitesse déclarée</th><th style="text-align:left;">Longueur</th></tr>';
      for (const e of incidentEdges) {
        advancedHtml += '<tr><td>' + (e.nature || '<em>(vide)</em>') + '</td><td>' + (e.vitesse != null ? e.vitesse + ' km/h' : '<em>absente</em>') + '</td><td>' + e.length.toFixed(0) + ' m</td></tr>';
      }
      advancedHtml += '</table>';
    }

    advancedHtml += '<br><br><table style="width:100%;"><tr><th style="text-align:left;">Mode</th><th style="text-align:left;">Temps</th><th style="text-align:left;">Seuil à battre</th><th style="text-align:left;">Résultat</th></tr>';
    for (const mode of modeDefs) {
      const mt = modeTimesByKey[mode.key].get(nearestNode);
      const seuil = carEffective === Infinity ? Infinity : carEffective + mode.carPenalty;
      const label = mt === undefined ? 'hors budget-temps' : (mt / 60).toFixed(1) + ' min';
      const seuilLabel = seuil === Infinity ? '—' : (seuil / 60).toFixed(1) + ' min';
      const verdict = mt === undefined ? '—' : (mt < seuil ? '✅ gagne' : '❌ perd');
      advancedHtml += '<tr><td>' + mode.key + '</td><td>' + label + '</td><td>' + seuilLabel + '</td><td>' + verdict + '</td></tr>';
    }
    advancedHtml += '</table>';

    html += '<details style="margin-top:8px;"><summary style="cursor:pointer; color:var(--muted); font-size:11.5px;">Détails techniques (pour vérification)</summary>'
      + '<div style="margin-top:6px;">' + advancedHtml + '</div></details>';

    const out = document.getElementById('diagnosticOutput');
    out.style.display = 'block';
    out.innerHTML = html;
  });
}
