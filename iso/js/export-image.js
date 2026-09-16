// ==========================================================================
// Export de carte en image JPEG HD
// ==========================================================================
import { getModeColors } from './colors.js';

// Mathématiques standard des tuiles Web Mercator (identiques à celles
// utilisées par Leaflet/OSM/IGN pour les tuiles WMTS "PM" déjà affichées à
// l'écran) : coordonnées géographiques -> position en pixels absolus à un
// niveau de zoom donné, tuiles de 256px.
function lonLatToPixel(lon, lat, zoom) {
  const n = Math.pow(2, zoom) * 256;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
  return { x, y };
}

function loadTileImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // tuile manquante : on continue sans elle plutôt que d'échouer tout l'export
    img.src = url;
  });
}

// Renvoie l'emprise (ouest, sud, est, nord) à afficher : la plus grande zone
// calculée (VAE si présente, sinon vélo, sinon marche) et le point de départ,
// avec une marge pour que le contour de la zone ne touche pas le bord.
function computeExportBounds(computation) {
  let minLon = computation.lon, maxLon = computation.lon, minLat = computation.lat, maxLat = computation.lat;
  const widen = (lon, lat) => {
    if (lon < minLon) { minLon = lon; } if (lon > maxLon) { maxLon = lon; }
    if (lat < minLat) { minLat = lat; } if (lat > maxLat) { maxLat = lat; }
  };
  for (const key of ['Ebike', 'Bike', 'Walk']) {
    const r = computation.results[key];
    if (!r || r.polygons.length === 0) { continue; }
    for (const poly of r.polygons) {
      for (const [lon, lat] of poly[0]) { widen(lon, lat); }
    }
    break; // la plus grande zone (Ebike en priorité) suffit à cadrer toutes les autres, qui lui sont imbriquées
  }
  // Pas de marge ajoutée ici : gérée précisément par le zoom fractionnaire de
  // exportMapImage, qui calcule exactement le niveau nécessaire pour une
  // marge donnée plutôt que d'ajouter une marge en degrés à l'aveugle puis
  // d'espérer qu'un zoom entier tombe pile dessus.
  if (minLon === maxLon) { minLon -= 0.01; maxLon += 0.01; }
  if (minLat === maxLat) { minLat -= 0.01; maxLat += 0.01; }
  return { west: minLon, east: maxLon, south: minLat, north: maxLat };
}

function drawRoundedBox(ctx, x, y, w, h, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.strokeStyle = '#d8ded6';
  ctx.lineWidth = Math.max(1, r / 8);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', curY = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line, x, curY);
      line = word + ' ';
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, curY);
}

/**
 * @param {object} computation lastComputation ({ results, lat, lon, address }) tenu par l'appelant (js/ui.js)
 * @param {'ign'|'satellite'} basemapChoice
 * @param {'web'|'print300'} resolutionChoice
 * @param {(msg:string) => void} onStatus
 */
export async function exportMapImage(computation, basemapChoice, resolutionChoice, onStatus) {
  if (!computation) { onStatus('Lancez d\u2019abord un calcul.'); return; }
  onStatus('Préparation de l\u2019image…');

  const colors = getModeColors();

  try {
    // Échelle du rendu, par rapport au format de base (2400x1800, ~100 DPI
    // sur un A1 841x594mm — le texte est déjà dessiné en vectoriel, donc ce
    // n'est pas le rendu qui "pixellise" en tant que tel, mais une densité de
    // pixels insuffisante pour une grande taille d'impression).
    // 300 DPI est le standard professionnel de l'impression grand format.
    // Un palier 600 DPI a été testé mais retiré : sur un A1 complet, il
    // dépasse la limite de canevas de Chrome (~268 millions de pixels contre
    // 296M requis) et échoue trop souvent pour être proposé de façon fiable.
    const SCALE_BY_RESOLUTION = { web: 1, print300: 9933 / 2400 };
    const SCALE = SCALE_BY_RESOLUTION[resolutionChoice] || SCALE_BY_RESOLUTION.print300;
    const S = (v) => Math.round(v * SCALE);

    const CANVAS_W = S(2400), CANVAS_H = S(1800);
    const estimatedPixels = CANVAS_W * CANVAS_H;
    if (estimatedPixels > 260_000_000) {
      onStatus('Génération d\u2019une très grande image (' + (estimatedPixels / 1e6).toFixed(0) + ' millions de pixels) — ça peut prendre plusieurs minutes et échouer selon votre navigateur ou la mémoire disponible…');
    }

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W; canvas.height = CANVAS_H;
    // Certains navigateurs n'échouent pas bruyamment sur un canevas trop
    // grand : ils réduisent silencieusement ses dimensions. On vérifie donc
    // explicitement plutôt que de continuer avec une image tronquée sans le
    // signaler.
    if (canvas.width !== CANVAS_W || canvas.height !== CANVAS_H) {
      throw new Error('Le navigateur n\u2019a pas pu créer un canevas de ' + CANVAS_W + '×' + CANVAS_H + 'px (probablement trop grand) — essayez une résolution d\u2019export inférieure.');
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) { throw new Error('Impossible d\u2019initialiser le contexte de dessin pour cette taille d\u2019image — essayez une résolution d\u2019export inférieure.'); }

    const TITLE_H = S(90), ATTRIB_H = S(34);
    const mapH = CANVAS_H - TITLE_H - ATTRIB_H;

    const bounds = computeExportBounds(computation);

    // Zoom FRACTIONNAIRE précis : on calcule le niveau exact (pas seulement
    // entier) auquel la zone occuperait (1 - 2*MARGIN) du cadre, en retenant
    // la dimension la plus contraignante pour respecter la marge minimale
    // demandée sur les deux axes. Les tuiles n'existent qu'à des niveaux
    // entiers : on récupère celles du niveau entier immédiatement inférieur,
    // puis on les agrandit (avec les zones tracées) du facteur d'échelle
    // manquant — un zoom entier seul peut laisser une marge bien plus grande
    // que prévu dès que le niveau idéal tombe juste au-dessus d'un palier.
    const MARGIN = 0.07; // 7% de marge de chaque côté (> minimum demandé de 5%)
    const rawW = lonLatToPixel(bounds.east, 0, 0).x - lonLatToPixel(bounds.west, 0, 0).x;
    const p1lat = lonLatToPixel(0, bounds.north, 0).y, p2lat = lonLatToPixel(0, bounds.south, 0).y;
    const rawH = p2lat - p1lat;
    const targetW = CANVAS_W * (1 - 2 * MARGIN), targetH = mapH * (1 - 2 * MARGIN);
    // zoom tel que rawDim * 2^zoom = targetDim, en retenant le zoom le plus
    // petit des deux (le plus contraignant) pour garantir la marge sur les 2 axes
    const zoomForW = Math.log2(targetW / rawW);
    const zoomForH = Math.log2(targetH / rawH);
    const zoomExact = Math.max(0, Math.min(18, Math.min(zoomForW, zoomForH)));
    const zoomTiles = Math.max(0, Math.min(18, Math.floor(zoomExact)));
    const tileScale = Math.pow(2, zoomExact - zoomTiles); // facteur d'agrandissement des tuiles (>= 1, < 2)

    const centerLon = (bounds.west + bounds.east) / 2;
    const centerLat = (bounds.south + bounds.north) / 2;
    // Tout le placement (centre, tuiles, polygones, marqueur) se fait dans
    // l'espace pixel du zoom FRACTIONNAIRE, pour un cadrage cohérent et précis.
    const centerPx = lonLatToPixel(centerLon, centerLat, zoomExact);
    const viewMinX = centerPx.x - CANVAS_W / 2;
    const viewMinY = centerPx.y - mapH / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // --- Tuiles du fond de carte ---
    onStatus('Téléchargement du fond de carte…');
    const layerName = basemapChoice === 'satellite' ? 'ORTHOIMAGERY.ORTHOPHOTOS' : 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2';
    const format = basemapChoice === 'satellite' ? 'image/jpeg' : 'image/png';
    const tileSizeScaled = 256 * tileScale;
    // Bornes des tuiles (au niveau entier zoomTiles) qui recouvrent la fenêtre
    // d'export, en repassant temporairement dans l'espace pixel non mis à
    // l'échelle pour retrouver les bons indices de tuile.
    const viewMinXAtTiles = viewMinX / tileScale, viewMinYAtTiles = viewMinY / tileScale;
    const viewMaxXAtTiles = (viewMinX + CANVAS_W) / tileScale, viewMaxYAtTiles = (viewMinY + mapH) / tileScale;
    const tileXMin = Math.floor(viewMinXAtTiles / 256), tileXMax = Math.floor(viewMaxXAtTiles / 256);
    const tileYMin = Math.floor(viewMinYAtTiles / 256), tileYMax = Math.floor(viewMaxYAtTiles / 256);
    const tileJobs = [];
    for (let tx = tileXMin; tx <= tileXMax; tx++) {
      for (let ty = tileYMin; ty <= tileYMax; ty++) {
        const url = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=' + layerName
          + '&STYLE=normal&FORMAT=' + encodeURIComponent(format) + '&TILEMATRIXSET=PM&TILEMATRIX=' + zoomTiles + '&TILEROW=' + ty + '&TILECOL=' + tx;
        tileJobs.push({ tx, ty, url });
      }
    }
    // Par petites vagues pour ne pas envoyer des dizaines de requêtes d'un coup
    const waveSize = 8;
    for (let i = 0; i < tileJobs.length; i += waveSize) {
      const wave = tileJobs.slice(i, i + waveSize);
      const images = await Promise.all(wave.map((job) => loadTileImage(job.url)));
      images.forEach((img, idx) => {
        if (!img) { return; }
        const job = wave[idx];
        const px = job.tx * tileSizeScaled - viewMinX, py = job.ty * tileSizeScaled - viewMinY + TITLE_H;
        ctx.drawImage(img, px, py, tileSizeScaled, tileSizeScaled);
      });
    }

    // --- Zones isochrones (mêmes couleurs, mêmes règles de trou que la carte en direct) ---
    onStatus('Dessin des zones…');
    function project(lon, lat) {
      const p = lonLatToPixel(lon, lat, zoomExact);
      return [p.x - viewMinX, p.y - viewMinY + TITLE_H];
    }
    const fillColors = { Ebike: colors.Ebike, Bike: colors.Bike, Walk: colors.Walk };
    for (const key of ['Ebike', 'Bike', 'Walk']) {
      const r = computation.results[key];
      if (!r || r.polygons.length === 0) { continue; }
      ctx.fillStyle = fillColors[key];
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = fillColors[key];
      ctx.lineWidth = S(2);
      for (const poly of r.polygons) {
        ctx.beginPath();
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const [x, y] = project(lon, lat);
            if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
          });
          ctx.closePath();
        }
        ctx.fill('evenodd');
        ctx.globalAlpha = 1;
        ctx.stroke();
        ctx.globalAlpha = 0.5;
      }
    }
    ctx.globalAlpha = 1;

    // --- Marqueur du point de départ ---
    const [markerX, markerY] = project(computation.lon, computation.lat);
    ctx.beginPath();
    ctx.arc(markerX, markerY, S(9), 0, 2 * Math.PI);
    ctx.fillStyle = '#1b2420';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(markerX, markerY, S(4), 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // --- Bandeau de titre ---
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, TITLE_H);
    ctx.strokeStyle = '#d8ded6';
    ctx.lineWidth = S(1);
    ctx.beginPath(); ctx.moveTo(0, TITLE_H); ctx.lineTo(CANVAS_W, TITLE_H); ctx.stroke();
    const addressLabel = computation.address || (computation.lat.toFixed(5) + ', ' + computation.lon.toFixed(5));
    ctx.fillStyle = '#1b2420';
    ctx.font = '700 ' + S(34) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Carte Isochrone de l\u2019adresse : ' + addressLabel, S(30), TITLE_H / 2);

    // --- Bandeau d'attribution ---
    ctx.fillStyle = '#f4f6f3';
    ctx.fillRect(0, CANVAS_H - ATTRIB_H, CANVAS_W, ATTRIB_H);
    ctx.fillStyle = '#6b756e';
    ctx.font = S(13) + 'px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('© IGN - Géoplateforme | Réseau BD TOPO® | Méthode : graphe routier + algorithme de Dijkstra, pente réelle', S(20), CANVAS_H - ATTRIB_H / 2);

    // --- Encart légende (bas gauche de la carte) ---
    const legendX = S(26), legendYTop = TITLE_H + mapH - S(166), legendW = S(300), legendH = S(140);
    drawRoundedBox(ctx, legendX, legendYTop, legendW, legendH, S(8));
    ctx.fillStyle = '#1b2420';
    ctx.font = '700 ' + S(16) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Légende', legendX + S(16), legendYTop + S(26));
    const legendRows = [
      ['Marche', colors.Walk],
      ['Vélo', colors.Bike],
      ['Vélo électrique', colors.Ebike],
    ];
    ctx.font = S(14) + 'px -apple-system, sans-serif';
    legendRows.forEach(([label, color], i) => {
      const y = legendYTop + S(54) + i * S(26);
      ctx.fillStyle = color;
      ctx.fillRect(legendX + S(16), y - S(9), S(16), S(16));
      ctx.fillStyle = '#1b2420';
      ctx.fillText(label, legendX + S(42), y - S(1));
    });
    ctx.fillStyle = '#1b2420';
    ctx.beginPath(); ctx.arc(legendX + S(22), legendYTop + legendH - S(14), S(6), 0, 2 * Math.PI); ctx.fill();
    ctx.font = S(12) + 'px -apple-system, sans-serif';
    ctx.fillText('Point de départ', legendX + S(42), legendYTop + legendH - S(14));

    // --- Encart explicatif (haut droit de la carte) ---
    const infoW = S(420), infoX = CANVAS_W - infoW - S(26), infoYTop = TITLE_H + S(22), infoH = S(190);
    drawRoundedBox(ctx, infoX, infoYTop, infoW, infoH, S(8));
    ctx.fillStyle = '#1b2420';
    ctx.font = '700 ' + S(16) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Qu\u2019est-ce qu\u2019une carte isochrone ?', infoX + S(18), infoYTop + S(26));
    ctx.font = S(13) + 'px -apple-system, sans-serif';
    ctx.fillStyle = '#3a423c';
    const infoText = 'Une carte isochrone montre les zones atteignables plus vite en marchant, à vélo ou à vélo électrique qu\u2019en voiture, depuis un même point de départ. Le calcul suit le vrai réseau de rues (pas à vol d\u2019oiseau) et tient compte du relief réel. Chaque couleur représente ce que ce mode ajoute par rapport au précédent (le vélo électrique inclut généralement le vélo, qui inclut généralement la marche).';
    wrapText(ctx, infoText, infoX + S(18), infoYTop + S(52), infoW - S(36), S(19));

    onStatus('Génération du fichier…');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) { throw new Error('La génération de l\u2019image a échoué.'); }
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeAddress = (addressLabel || 'export').replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
    a.href = downloadUrl;
    a.download = 'carte-isochrone-' + safeAddress + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
    onStatus('Image téléchargée.');
  } catch (e) {
    console.error(e);
    // Cause la plus probable : le fond de carte IGN ne renvoie pas d'en-tête
    // CORS autorisant la lecture des pixels par le navigateur, ce qui bloque
    // l'export (restriction de sécurité standard, pas un bug du code).
    onStatus('Échec de l\u2019export (' + e.message + '). Cause probable : le serveur de tuiles IGN ne semble pas autoriser la lecture des images depuis le navigateur (restriction de sécurité CORS) — en dernier recours, utilisez une capture d\u2019écran de la carte.');
  }
}
