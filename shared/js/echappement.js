/**
 * echappement.js
 * ---------------------------------------------------------------------------
 * Rôle : neutraliser les caractères spéciaux HTML avant d'insérer un texte
 * dans une chaîne de gabarit (template literal) destinée à `innerHTML`.
 *
 * Pourquoi : les écrans des outils sont construits en assemblant du HTML sous
 * forme de texte. Si une valeur saisie par l'utilisateur (nom du cabinet,
 * ville, nom de la structure…) ou reçue d'un service externe (suggestions
 * d'adresses IGN, archive JSON importée) contient `<`, `>`, `"` ou `&`, elle
 * serait interprétée comme du code HTML : au mieux le champ s'affiche mal
 * (un guillemet ferme l'attribut `value="…"`), au pire une balise injectée
 * s'exécute dans la page.
 *
 * Règle d'usage : toute valeur qui n'est pas une constante écrite dans le code
 * passe par `echapperHtml()` avant d'être interpolée dans du HTML, que ce soit
 * dans le contenu d'une balise ou dans un attribut entre guillemets doubles.
 * Pour écrire du texte seul dans un élément, préférer `element.textContent`,
 * qui n'interprète jamais le HTML.
 *
 * Utilisé par : cab/js/ui.js, cab/js/evolution.js, cab/js/graphiques.js,
 *               msp/js/ui-msp.js, iso/js/ui.js
 * Dépendances : aucune.
 */

/** Table de correspondance caractère → entité HTML. */
const ENTITES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Échappe une valeur pour l'insérer sans risque dans du HTML.
 *
 * @param {unknown} valeur  Texte, nombre, `null` ou `undefined`.
 * @returns {string}        Chaîne sûre ; `null`/`undefined` deviennent "".
 *
 * @example
 *   echapperHtml('Cabinet "Les Tilleuls" & associés')
 *   // → 'Cabinet &quot;Les Tilleuls&quot; &amp; associés'
 */
export function echapperHtml(valeur) {
  return String(valeur ?? "").replace(/[&<>"']/g, (c) => ENTITES[c]);
}
