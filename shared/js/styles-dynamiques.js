/**
 * styles-dynamiques.js — styles calculés compatibles avec une CSP stricte
 * ---------------------------------------------------------------------------
 * Rôle : la politique de sécurité du site (en-tête Content-Security-Policy,
 * voir .htaccess) interdit les attributs style="…" écrits dans le HTML, y
 * compris dans le HTML produit par JavaScript (innerHTML). C'est voulu : cela
 * bloque l'injection de styles. Mais les écrans de Cab, MSP et de la carte ont
 * besoin de styles CALCULÉS (largeur d'une barre en %, couleur d'un poste…).
 *
 * Règle : dans les gabarits HTML générés par JavaScript, écrire
 * data-style="…" au lieu de style="…". Ce module repère ces attributs dès que
 * les éléments sont insérés dans la page et applique le style par l'interface
 * CSSOM (element.style.cssText), que la CSP autorise. L'application a lieu
 * avant l'affichage suivant (MutationObserver), donc sans clignotement.
 *
 * Les valeurs insérées dans data-style viennent du code (nombres, couleurs de
 * la charte), jamais d'une saisie de l'utilisateur sans échappement.
 *
 * Pages statiques : pas de data-style ; les styles y sont dans des fichiers CSS.
 *
 * Utilisé par : cab/js/main.js, msp/js/main-msp.js, iso/js/main.js (importé
 * EN PREMIER pour être actif avant le premier rendu).
 */

const ATTRIBUT = "data-style";

/** Applique data-style à l'élément et à ses descendants. */
export function appliquerStylesDynamiques(racine) {
  if (!racine || racine.nodeType !== 1) return;
  if (racine.hasAttribute(ATTRIBUT)) appliquer(racine);
  for (const el of racine.querySelectorAll("[" + ATTRIBUT + "]")) appliquer(el);
}

function appliquer(el) {
  const style = el.getAttribute(ATTRIBUT);
  if (style == null) return; // retrait de l'attribut (par nous) : rien à faire
  // On ajoute au style existant plutôt que de l'écraser : un script peut déjà
  // avoir posé une propriété (ex. display) sur cet élément.
  el.style.cssText += ";" + style;
  el.removeAttribute(ATTRIBUT);
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const observateur = new globalThis.MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") appliquer(m.target);
      else for (const n of m.addedNodes) appliquerStylesDynamiques(n);
    }
  });
  observateur.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [ATTRIBUT],
  });
  // Éléments déjà présents (si le module est chargé après un premier rendu).
  appliquerStylesDynamiques(document.documentElement);
}
