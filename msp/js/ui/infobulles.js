/**
 * ui/infobulles.js — bulles d'information
 * ---------------------------------------------------------------------------
 * Bulle de message temporaire et infobulles des graphiques (au survol comme
 * au toucher, contrairement aux <title> SVG natifs).
 *
 * Utilisé par : main-msp.js, ui-msp.js, ui/evenements.js.
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */

// ---------------------------------------------------------------------------
// ÉCOUTEURS D'ÉVÉNEMENTS
// Affiche un petit message flottant temporaire (3,5 s), pour prévenir d'une
// saisie visiblement erronée sans interrompre la saisie avec un alert()
// bloquant. Réutilisable pour d'autres validations similaires à l'avenir.
export function afficherBulle(texte) {
  const ancienne = document.getElementById("bulle-avertissement");
  if (ancienne) ancienne.remove();
  const bulle = document.createElement("div");
  bulle.id = "bulle-avertissement";
  bulle.textContent = texte;
  bulle.style.cssText =
    "position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#1B2B26; color:#fff; padding:14px 22px; border-radius:10px; font-size:14px; max-width:min(90vw, 420px); text-align:center; box-shadow:0 8px 24px rgba(0,0,0,.25); z-index:9999; line-height:1.4;";
  document.body.appendChild(bulle);
  setTimeout(() => bulle.remove(), 3500);
}

// ---------------------------------------------------------------------------
// INFOBULLES DE GRAPHIQUE — remplace les <title> SVG natifs, qui ne
// s'affichent jamais au toucher sur mobile (seulement au survol souris).
// Une seule bulle réutilisée pour tous les graphiques, positionnée près du
// doigt/pointeur, qui fonctionne à la fois en survol et au toucher.
let elementInfobulle = null;
function obtenirElementInfobulle() {
  if (!elementInfobulle) {
    elementInfobulle = document.createElement("div");
    elementInfobulle.className = "infobulle-graphe";
    document.body.appendChild(elementInfobulle);
  }
  return elementInfobulle;
}

function positionnerInfobulle(bulle, clientX, clientY) {
  const marge = 12;
  let x = clientX + marge,
    y = clientY - 14;
  const largeurEcran = window.innerWidth,
    hauteurEcran = window.innerHeight;
  bulle.style.left = "0px";
  bulle.style.top = "0px";
  bulle.style.display = "block";
  const rect = bulle.getBoundingClientRect();
  if (x + rect.width > largeurEcran - marge) x = clientX - rect.width - marge;
  x = Math.max(marge, Math.min(x, largeurEcran - rect.width - marge));
  if (y < marge) y = clientY + 20;
  if (y + rect.height > hauteurEcran - marge) y = hauteurEcran - rect.height - marge;
  bulle.style.left = x + "px";
  bulle.style.top = y + "px";
}

/**
 * Affiche une infobulle au survol ou au toucher des segments de graphique
 * (.segment-survolable), à la place des <title> SVG invisibles sur mobile.
 * @param {HTMLElement} app
 */
export function attacherTooltipsGraphes(app) {
  const bulle = obtenirElementInfobulle();
  const masquer = () => {
    bulle.style.display = "none";
  };

  app.querySelectorAll(".segment-survolable").forEach((el) => {
    el.addEventListener("mouseenter", (ev) => {
      bulle.textContent = el.dataset.tooltip;
      positionnerInfobulle(bulle, ev.clientX, ev.clientY);
    });
    el.addEventListener("mousemove", (ev) => positionnerInfobulle(bulle, ev.clientX, ev.clientY));
    el.addEventListener("mouseleave", masquer);
    el.addEventListener(
      "touchstart",
      (ev) => {
        const t = ev.touches[0];
        bulle.textContent = el.dataset.tooltip;
        positionnerInfobulle(bulle, t.clientX, t.clientY);
        ev.stopPropagation();
      },
      { passive: true },
    );
  });

  // Masque l'infobulle si l'utilisateur touche ailleurs qu'un segment.
  if (!attacherTooltipsGraphes.ecouteurGlobalPose) {
    document.addEventListener(
      "touchstart",
      (ev) => {
        if (!ev.target.closest?.(".segment-survolable")) masquer();
      },
      { passive: true },
    );
    attacherTooltipsGraphes.ecouteurGlobalPose = true;
  }
}
