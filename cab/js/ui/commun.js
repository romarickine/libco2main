// © 2026 Lib&CO2 SASU — tous droits réservés. Reproduction, modification ou redistribution du code interdites sans accord écrit préalable.
/**
 * ui/commun.js — briques communes aux écrans de Cab
 * ---------------------------------------------------------------------------
 * Pictogrammes des familles de métiers, formatage des nombres, champs de
 * saisie numériques avec badge « kgCO2e/an » en direct, et branchement des
 * écouteurs de formulaire (nombres, listes, cases à cocher). Transforme les
 * URL des sources en liens cliquables.
 *
 * Utilisé par : ui.js, ui/etapes-saisie.js, ui/ecran-resultats.js.
 * (Découpé de ui.js en septembre 2026 : un fichier par responsabilité.)
 */
import { valeurBornee, messageBorne } from "../../../shared/js/bornes-saisie.js";
// Pictogrammes des familles et postes. Plus affichés depuis la refonte du
// 03/11/2026 (les émojis alourdissaient l'interface) ; conservés pour un
// usage éventuel.
export const ICONES = {
  sante: "🩺",
  juridique: "⚖️",
  conseil: "📈",
  archi: "📐",
  artisanat: "🔨",
  autre: "💼",
  deplacements: "🚗",
  patientele: "👥",
  local: "🏢",
  numerique: "💻",
  materiel: "📦",
  alimentation: "🍽️",
  services: "💼",
  fret: "🚚",
};

/**
 * Formate un nombre à la française (espace des milliers, virgule).
 * @param {number} n
 * @param {number} [dec=0]  Nombre de décimales.
 * @returns {string}
 */
export function fmt(n, dec = 0) {
  return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// --- Aides de rendu de champ ------------------------------------------------
/**
 * Champ numérique relié à une clé de l'état (data-field), avec unité facultative.
 * @param {string} fieldKey  Clé du champ dans la section d'état courante.
 * @param {number} value  Valeur actuelle (0 affiché comme champ vide).
 * @param {{min?: number, max?: number, step?: number, suffix?: string, libelle?: string, raison?: string}} [options]
 *   `libelle` : nom accessible, à fournir quand aucun <label> visible ne précède le champ.
 *   `raison` : précision affichée avec le maximum (« pour 3 personnes ») ; bornes : shared/js/bornes-saisie.js.
 * @returns {string} HTML
 */
export function champNombreHtml(fieldKey, value, { min = 0, max, step, suffix = "", libelle, raison } = {}) {
  const v = value === 0 ? "" : value;
  return `<span data-style="display:inline-flex; align-items:center; gap:8px;">
    <input type="number" class="champ-nombre" data-field="${fieldKey}" data-champ-nombre="${fieldKey}"${libelle ? ` aria-label="${libelle}"` : ""}
      value="${v}" placeholder="0" ${min !== undefined ? `min="${min}"` : ""} ${max !== undefined ? `max="${max}"` : ""} ${step !== undefined ? `step="${step}"` : ""}${raison ? ` data-raison-max="${raison}"` : ""} />
    ${suffix ? `<span class="texte-discret">${suffix}</span>` : ""}
  </span>`;
}
/**
 * Badge « ≈ N kgCO2e/an » affiché à côté d'un champ, mis à jour en direct.
 * @param {number|null|undefined} kg  Émissions du champ ; rien n'est affiché si absent.
 * @param {string} [cle]  Identifiant du badge (attribut data-badge), pour sa mise à jour.
 * @returns {string} HTML
 */
export function badgeLive(kg, cle) {
  if (kg === undefined || kg === null) return "";
  return `<span class="badge-live" data-badge="${cle || ""}">≈ ${fmt(kg)} kgCO2e/an</span>`;
}
// Attache les gestionnaires pour tous les champs numériques du conteneur.
// onChangeLive(field, value, resultatsRecalcules) est appelé à chaque frappe
// SANS redessiner tout le formulaire (seuls les badges et le total sont mis
// à jour, voir majBadgesEtTotal) — c'est ce qui évite de perdre des frappes
// lors d'une saisie rapide au clavier. Gère aussi le focus/sélection au clic
// pour éviter le bug du "0" collé devant la saisie.
export function attacherChampsNombre(conteneur, onChangeLive) {
  conteneur.querySelectorAll("[data-champ-nombre]").forEach((input) => {
    input.addEventListener("focus", () => input.select());
    surveillerBornes(input);
    input.addEventListener("input", () => {
      onChangeLive(input.dataset.champNombre, valeurBornee(input).valeur);
    });
  });
}

// Bornes (05/11/2026, shared/js/bornes-saisie.js) : pendant la frappe, le
// calcul reçoit déjà la valeur ramenée dans les bornes et un message s'affiche
// sous le champ ; en quittant le champ, la valeur affichée est corrigée.
function surveillerBornes(input) {
  const message = () => {
    const ancre = input.closest(".champ") || input.parentElement;
    let m = ancre.querySelector(":scope > .message-borne");
    if (!m) {
      m = document.createElement("p");
      m.className = "message-borne";
      m.setAttribute("role", "status");
      ancre.appendChild(m);
    }
    return m;
  };
  const verifier = (corrigerChamp) => {
    const r = valeurBornee(input);
    const existant = (input.closest(".champ") || input.parentElement).querySelector(":scope > .message-borne");
    if (r.corrigee) {
      message().textContent = messageBorne(input, r.borne);
      if (corrigerChamp) input.value = r.valeur;
    } else if (existant && !corrigerChamp) {
      existant.remove();
    }
  };
  input.addEventListener("input", () => verifier(false));
  input.addEventListener("change", () => verifier(true));
}
// Variante de attacherChampsNombre pour un conteneur dont les champs
// numériques doivent être distribués vers PLUSIEURS callbacks différents
// selon leur identifiant (ex. étape "Matériel", qui mélange consommables,
// gros matériel, médicaments, prescriptions). `regles` est une liste
// ordonnée de { prefixe, cb } ou { cle, cb } ; la première règle qui
// correspond est utilisée, le préfixe étant retiré de l'identifiant transmis.
export function attacherChampsNombreDispatch(conteneur, regles) {
  conteneur.querySelectorAll("[data-champ-nombre]").forEach((input) => {
    input.addEventListener("focus", () => input.select());
    surveillerBornes(input);
    input.addEventListener("input", () => {
      const val = valeurBornee(input).valeur;
      const key = input.dataset.champNombre;
      const regle = regles.find((r) => (r.prefixe && key.startsWith(r.prefixe)) || r.cle === key);
      if (!regle) return;
      if (regle.prefixe) regle.cb(key.replace(regle.prefixe, ""), val);
      else regle.cb(val);
    });
  });
}
/**
 * Relaie le changement de chaque liste déroulante [data-champ-select].
 * @param {HTMLElement} conteneur
 * @param {(champ: string, valeur: string) => void} onChange
 */
export function attacherSelects(conteneur, onChange) {
  conteneur.querySelectorAll("[data-champ-select]").forEach((sel) => {
    sel.addEventListener("change", () => onChange(sel.dataset.champSelect, sel.value));
  });
}
/**
 * Relaie le changement de chaque case à cocher [data-champ-case].
 * @param {HTMLElement} conteneur
 * @param {(champ: string, coche: boolean) => void} onChange
 */
export function attacherCases(conteneur, onChange) {
  conteneur.querySelectorAll("[data-champ-case]").forEach((c) => {
    c.addEventListener("change", () => onChange(c.dataset.champCase, c.checked));
  });
}

// Transforme une URL en clair présente dans un texte de source en lien
// cliquable (ouverture dans un nouvel onglet) — utilisé pour les actions
// qui renvoient vers un outil externe (ex. générateur de carte isochrone).
export function lienifier(texte) {
  return texte.replace(/(https?:\/\/[^\s)]+|(?<=\()[a-z0-9.-]+\.[a-z]{2,}\/[a-z0-9/-]+(?=\)))/gi, (url) => {
    const href = url.startsWith("http") ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener">${url}</a>`;
  });
}

/**
 * Total en cours, à la française : « 7,74 tCO2e/an ».
 * @param {number} totalT  Total en tCO2e/an.
 * @returns {string}
 */
export function formatTotal(totalT) {
  return `${fmt(totalT, 2)} tCO2e/an`;
}
