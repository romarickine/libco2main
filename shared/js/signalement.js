// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
/**
 * signalement.js — signaler un bug ou faire une suggestion, en deux clics
 * ---------------------------------------------------------------------------
 * Un bouton discret, fixe en bas à droite (« Un souci ? Une idée ? » sur
 * ordinateur, « ?! » sur téléphone), ouvre une petite fenêtre :
 * type (bug ou suggestion), texte libre, case pour joindre ses saisies. Le
 * bouton « Préparer l'e-mail » ouvre la messagerie de l'usager avec le
 * message prêt (décision du porteur, 14/11/2026 : e-mail pré-rempli, rien ne
 * transite par le site). L'usager voit tout ce qui sera envoyé avant
 * d'envoyer, et peut copier le message s'il n'a pas de messagerie configurée
 * (webmail).
 *
 * Contexte joint automatiquement : outil, écran ou étape, version du site,
 * navigateur, taille d'écran, date. Les saisies ne sont jointes que si la
 * case est cochée.
 *
 * Utilisation (une fois par outil) :
 *   installerSignalement({
 *     outil: "Lib&CO2 Cab",
 *     ecran: () => "Questionnaire, étape Local",   // facultatif
 *     saisies: () => objet ou texte,                // facultatif
 *     defauts: () => objet,                         // facultatif : seuls les écarts sont joints
 *     libelleSaisies: "Joindre mes saisies",        // facultatif
 *   });
 *
 * Styles : shared/css/signalement.css (à lier dans la page).
 * Utilisé par : cab/js/main.js, msp/js/main-msp.js, iso/js/main.js.
 */
import { ADRESSE_CONTACT } from "./contact.js";

// Date de la version du site, à mettre à jour à chaque livraison notable.
export const VERSION_SITE = "2026-11-14";

// Au-delà, certaines messageries tronquent un lien mailto : le message est
// alors raccourci dans l'e-mail et l'usager est invité à coller la version
// complète (copiée dans le presse-papiers).
const LONGUEUR_MAX_MAILTO = 1800;

const TYPES = {
  bug: { libelle: "Un bug", objet: "Lib&CO2 — bug", invite: "Ce qui s'est passé, et ce que vous attendiez :" },
  suggestion: { libelle: "Une suggestion", objet: "Lib&CO2 — suggestion", invite: "Votre idée :" },
};

let options = null;
let dialogue = null;
let typeChoisi = "bug";

/** Contexte technique, sans aucune saisie. */
function contexteTechnique() {
  let ecran = "";
  try {
    ecran = options.ecran ? options.ecran() : "";
  } catch {
    ecran = "";
  }
  return [
    `Outil : ${options.outil}`,
    ecran ? `Écran : ${ecran}` : null,
    `Version du site : ${VERSION_SITE}`,
    `Page : ${location.pathname}${location.search}`,
    `Navigateur : ${navigator.userAgent}`,
    `Fenêtre : ${window.innerWidth} × ${window.innerHeight} px (zoom ${Math.round((window.devicePixelRatio || 1) * 100)} %)`,
    `Date : ${new Date().toLocaleString("fr-FR")}`,
  ].filter(Boolean);
}

/**
 * Ce qui diffère des valeurs par défaut (objets comparés champ par champ,
 * tableaux et valeurs simples en entier). Garde le message court : un lien
 * mailto trop long est tronqué par certaines messageries.
 */
function ecarts(valeur, defaut) {
  if (defaut === undefined) return valeur;
  if (valeur && typeof valeur === "object" && !Array.isArray(valeur) && defaut && typeof defaut === "object" && !Array.isArray(defaut)) {
    const r = {};
    for (const [k, v] of Object.entries(valeur)) {
      const e = ecarts(v, defaut[k]);
      if (e !== undefined) r[k] = e;
    }
    return Object.keys(r).length ? r : undefined;
  }
  return JSON.stringify(valeur) === JSON.stringify(defaut) ? undefined : valeur;
}

function texteSaisies() {
  if (!options.saisies) return "";
  try {
    const s = options.saisies();
    if (typeof s === "string") return s;
    if (options.defauts) {
      const e = ecarts(s, options.defauts());
      return e === undefined ? "(aucune modification des valeurs par défaut)" : "(écarts aux valeurs par défaut) " + JSON.stringify(e);
    }
    return JSON.stringify(s);
  } catch {
    return "(saisies indisponibles)";
  }
}

/** Corps complet du message. */
function corpsMessage() {
  const t = TYPES[typeChoisi];
  const texte = dialogue.querySelector("#sig-texte").value.trim();
  const joindre = dialogue.querySelector("#sig-saisies")?.checked;
  const lignes = ["Bonjour,", "", t.invite, texte || "", "", "— Contexte (ajouté automatiquement) —", ...contexteTechnique()];
  if (joindre) {
    lignes.push("", "— Mes saisies —", texteSaisies());
  }
  return lignes.join("\n");
}

function objetMessage() {
  return `${TYPES[typeChoisi].objet} (${options.outil})`;
}

function lienMailto(corps) {
  return `mailto:${ADRESSE_CONTACT}?subject=${encodeURIComponent(objetMessage())}&body=${encodeURIComponent(corps)}`;
}

function majApercu() {
  dialogue.querySelector("#sig-apercu").textContent = corpsMessage();
  for (const b of dialogue.querySelectorAll("[data-sig-type]")) {
    const actif = b.dataset.sigType === typeChoisi;
    b.classList.toggle("sig-type-actif", actif);
    b.setAttribute("aria-pressed", String(actif));
  }
  dialogue.querySelector("#sig-invite").textContent = TYPES[typeChoisi].invite;
}

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

function annoncer(texte) {
  dialogue.querySelector("#sig-etat").textContent = texte;
}

async function preparerEmail() {
  const corps = corpsMessage();
  let lien = lienMailto(corps);
  if (lien.length > LONGUEUR_MAX_MAILTO) {
    // Message trop long pour un lien : on garde le début dans l'e-mail et on
    // copie la version complète.
    const copie = await copier(corps);
    const court = corps.split("— Mes saisies —")[0] + "— Mes saisies —\n" + (copie ? "(collez ici le message complet, copié dans votre presse-papiers)" : "(trop longues pour être jointes automatiquement)");
    lien = lienMailto(court);
    annoncer(copie ? "Message long : la version complète, avec vos saisies, est copiée. Collez-la dans l'e-mail." : "Message long : vos saisies n'ont pas pu être jointes.");
  } else {
    annoncer("Votre messagerie s'ouvre avec le message prêt. Rien n'est envoyé tant que vous ne cliquez pas sur « Envoyer ».");
  }
  window.location.href = lien;
}

async function copierMessage() {
  const ok = await copier(`À : ${ADRESSE_CONTACT}\nObjet : ${objetMessage()}\n\n${corpsMessage()}`);
  annoncer(ok ? `Message copié. Collez-le dans un e-mail à ${ADRESSE_CONTACT}.` : `Copie impossible : sélectionnez l'aperçu ci-dessous et copiez-le à la main, puis envoyez-le à ${ADRESSE_CONTACT}.`);
}

function creerDialogue() {
  const d = document.createElement("dialog");
  d.className = "sig-dialogue";
  d.setAttribute("aria-labelledby", "sig-titre");
  d.innerHTML = `
    <form method="dialog" class="sig-form">
      <div class="sig-entete">
        <h2 id="sig-titre">Signaler un bug ou faire une suggestion</h2>
        <button type="submit" class="sig-fermer" aria-label="Fermer">×</button>
      </div>
      <div class="sig-types" role="group" aria-label="Type de message">
        ${Object.entries(TYPES)
          .map(([cle, t]) => `<button type="button" class="sig-type" data-sig-type="${cle}" aria-pressed="false">${t.libelle}</button>`)
          .join("")}
      </div>
      <label class="sig-libelle" for="sig-texte" id="sig-invite"></label>
      <textarea id="sig-texte" rows="5"></textarea>
      ${
        options.saisies
          ? `<label class="sig-case"><input type="checkbox" id="sig-saisies" /> ${options.libelleSaisies || "Joindre mes saisies (utile pour reproduire un bug)"}</label>`
          : ""
      }
      <details class="sig-details">
        <summary>Voir tout ce qui sera envoyé</summary>
        <pre id="sig-apercu" class="sig-apercu"></pre>
      </details>
      <div class="sig-actions">
        <button type="button" class="sig-principal" id="sig-email">Préparer l'e-mail</button>
        <button type="button" class="sig-secondaire" id="sig-copier">Copier le message</button>
      </div>
      <p class="sig-note">Le message part de votre messagerie, vers ${ADRESSE_CONTACT}. Rien n'est envoyé par le site.</p>
      <p class="sig-etat" id="sig-etat" role="status" aria-live="polite"></p>
    </form>`;
  document.body.appendChild(d);
  d.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sig-type]");
    if (b) {
      typeChoisi = b.dataset.sigType;
      majApercu();
    }
    if (e.target === d) d.close(); // clic sur le fond
  });
  d.addEventListener("input", majApercu);
  d.addEventListener("change", majApercu);
  d.querySelector("#sig-email").addEventListener("click", preparerEmail);
  d.querySelector("#sig-copier").addEventListener("click", copierMessage);
  return d;
}

function ouvrir() {
  if (!dialogue) dialogue = creerDialogue();
  annoncer("");
  majApercu();
  dialogue.showModal();
  dialogue.querySelector("#sig-texte").focus();
}

/**
 * Ajoute le bouton de signalement à la page.
 * @param {{outil: string, ecran?: () => string, saisies?: () => (object|string), libelleSaisies?: string}} opts
 */
export function installerSignalement(opts) {
  options = opts;
  if (document.querySelector(".sig-bouton")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sig-bouton";
  // Texte long sur ordinateur, « ?! » sur téléphone (signalement.css) ;
  // le libellé complet reste lu par les lecteurs d'écran.
  b.innerHTML = '<span class="sig-long" aria-hidden="true">Un souci ? Une idée ?</span><span class="sig-court" aria-hidden="true">?!</span>';
  b.setAttribute("aria-label", "Signaler un bug ou suggérer une idée");
  b.title = "Signaler un bug ou suggérer une idée";
  b.addEventListener("click", ouvrir);
  document.body.appendChild(b);
}
