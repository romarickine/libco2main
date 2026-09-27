/**
 * accessibilite.js — aides d'accessibilité communes aux applications
 * ---------------------------------------------------------------------------
 * Rôle : relier chaque libellé visible à son champ de saisie, pour que les
 * lecteurs d'écran annoncent la question avec le champ (WCAG 1.3.1 et 4.1.2)
 * et qu'un clic sur le libellé place le curseur dans le champ.
 *
 * Pourquoi un traitement après rendu plutôt que des attributs for/id écrits à
 * la main : les écrans de Cab et MSP comptent plus de 150 couples libellé /
 * champ générés dans des gabarits HTML ; les relier ici, en un seul endroit,
 * évite d'oublier les nouveaux champs. La règle suivie est celle de la mise en
 * page existante : le champ d'un libellé est le premier champ qui le suit dans
 * le même bloc parent, avant le libellé suivant.
 *
 * Utilisé par : cab/js/main.js et msp/js/ui-msp.js, après chaque rendu.
 */

const SELECTEUR_CHAMP = "input:not([type=hidden]):not([type=button]):not([type=submit]), select, textarea";
let compteur = 0;

/**
 * Relie les libellés sans attribut « for » au champ qui les suit.
 * Sans effet sur un libellé qui contient déjà son champ ou qui est déjà relié.
 * @param {ParentNode} conteneur  Zone qui vient d'être redessinée.
 * @param {string} [selecteurLibelle]  Libellés à traiter.
 */
export function relierLibelles(conteneur, selecteurLibelle = "label") {
  for (const libelle of conteneur.querySelectorAll(selecteurLibelle)) {
    if (libelle.htmlFor || libelle.querySelector(SELECTEUR_CHAMP)) continue;
    const champ = champSuivant(libelle);
    if (!champ) continue;
    if (!champ.id) champ.id = `champ-auto-${++compteur}`;
    libelle.htmlFor = champ.id;
  }
}

/**
 * Premier champ situé après le libellé dans son bloc parent, sans franchir
 * un autre libellé. Ignore un champ déjà nommé par un autre libellé.
 * @param {HTMLLabelElement} libelle
 * @returns {HTMLElement|null}
 */
function champSuivant(libelle) {
  const parent = libelle.parentElement;
  if (!parent) return null;
  const marcheur = document.createTreeWalker(parent, NodeFilter.SHOW_ELEMENT);
  marcheur.currentNode = libelle;
  for (let el = marcheur.nextNode(); el; el = marcheur.nextNode()) {
    if (libelle.contains(el)) continue; // contenu du libellé lui-même (badge…)
    if (el.tagName === "LABEL") return null;
    if (el.matches(SELECTEUR_CHAMP)) return el.labels?.length ? null : el;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Listes de suggestions (recherche de commune) : motif « combobox » WCAG/ARIA.
// Le focus reste dans le champ de saisie ; les flèches déplacent une option
// active (aria-activedescendant), Entrée la choisit, Échap ferme la liste.
// Évite qu'un utilisateur au clavier ne puisse pas choisir sa commune
// (WCAG 2.1.1), sans rien changer pour la souris.
// ---------------------------------------------------------------------------

/**
 * Prépare le champ et sa liste une fois, après le rendu de l'écran.
 * @param {HTMLInputElement} champ  Champ de recherche.
 * @param {HTMLElement} liste  Conteneur des suggestions (doit avoir un id).
 * @param {(option: HTMLElement) => void} choisir  Action à exécuter pour une option
 *   choisie au clavier (la même que pour un clic).
 */
export function activerListeSuggestions(champ, liste, choisir) {
  champ.setAttribute("role", "combobox");
  champ.setAttribute("aria-autocomplete", "list");
  champ.setAttribute("aria-controls", liste.id);
  champ.setAttribute("aria-expanded", "false");
  liste.setAttribute("role", "listbox");
  liste.setAttribute("aria-label", "Suggestions");

  champ.addEventListener("keydown", (ev) => {
    const options = [...liste.querySelectorAll("[role=option]")];
    if (!options.length || champ.getAttribute("aria-expanded") !== "true") return;
    const actuelle = options.findIndex((o) => o.getAttribute("aria-selected") === "true");
    let suivante = actuelle;
    if (ev.key === "ArrowDown") suivante = (actuelle + 1) % options.length;
    else if (ev.key === "ArrowUp") suivante = actuelle <= 0 ? options.length - 1 : actuelle - 1;
    else if (ev.key === "Enter" && actuelle >= 0) {
      ev.preventDefault();
      choisir(options[actuelle]);
      return;
    } else if (ev.key === "Escape") {
      liste.innerHTML = "";
      majListeSuggestions(champ, liste, false);
      return;
    } else return;
    ev.preventDefault();
    options.forEach((o, i) => o.setAttribute("aria-selected", String(i === suivante)));
    champ.setAttribute("aria-activedescendant", options[suivante].id);
    options[suivante].scrollIntoView({ block: "nearest" });
  });
}

/**
 * À appeler après chaque remplissage (ou vidage) de la liste : numérote les
 * options, remet l'option active à zéro et indique si la liste est ouverte.
 * @param {HTMLInputElement} champ
 * @param {HTMLElement} liste
 * @param {boolean} ouverte
 */
export function majListeSuggestions(champ, liste, ouverte) {
  liste.querySelectorAll("[role=option]").forEach((o, i) => {
    o.id = `${liste.id}-option-${i}`;
    o.setAttribute("aria-selected", "false");
  });
  champ.removeAttribute("aria-activedescendant");
  champ.setAttribute("aria-expanded", String(ouverte));
}
