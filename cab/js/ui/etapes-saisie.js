/**
 * ui/etapes-saisie.js — les huit étapes du questionnaire
 * ---------------------------------------------------------------------------
 * Profil, déplacements, local, numérique, matériel, déchets, alimentation,
 * services : chaque fonction remplit la zone de l'étape et branche ses
 * champs. majBadgesEtTotal met à jour les estimations affichées en direct
 * sans redessiner l'étape (pour ne pas interrompre la saisie).
 *
 * Utilisé par : ui.js (renderWizard), main.js via ui.js (majBadgesEtTotal).
 * (Découpé de ui.js en septembre 2026 : un fichier par responsabilité.)
 */
import { FAMILLES, FE_ENERGIE, FE_TRANSPORT } from "../../../shared/js/data/facteurs-emission.js";
import {
  ICONES,
  attacherCases,
  attacherChampsNombre,
  attacherChampsNombreDispatch,
  attacherSelects,
  badgeLive,
  champNombreHtml,
  fmt,
} from "./commun.js";
import { ZONES, chargerCommunes, kmModalTotal } from "../../../shared/js/data/zonage-insee.js";
import { echapperHtml } from "../../../shared/js/echappement.js";
import { activerListeSuggestions, majListeSuggestions } from "../../../shared/js/accessibilite.js";

// Met à jour, sans redessiner tout le formulaire, les badges en direct et le
// total affiché dans l'en-tête — appelé à chaque frappe dans un champ
// numérique pour rester réactif sans casser la saisie clavier en cours.
export function majBadgesEtTotal(resultats) {
  const det = resultats.detail;
  const simples = {
    domTrav: det.domTrav,
    visites: det.visites,
    congres: det.congres,
    localElec: det.localElec,
    localChauffage: det.localChauffage,
    localDeporte: det.localDeporte,
    patientele: det.patientele,
    numOrdisFixes: det.numOrdisFixes,
    numOrdisPortables: det.numOrdisPortables,
    numEcrans: det.numEcrans,
    numUsage: det.numUsage,
    mobilier: det.mobilier,
    alimentation: det.alimentation,
    servicesCompta: det.servicesCompta,
    servicesSousTraitance: det.servicesSousTraitance,
    fret: det.fret,
    medicamentsVendus: det.medicamentsVendus,
    parapharmacie: det.parapharmacie,
    prescriptionsMedicaments: det.prescriptionsMedicaments,
    prescriptionsActes: det.prescriptionsActes,
  };
  Object.entries(simples).forEach(([k, v]) => {
    const elmt = document.querySelector(`[data-badge="${k}"]`);
    if (elmt) elmt.textContent = `≈ ${fmt(v)} kgCO2e/an`;
  });
  Object.entries(det.materiel || {}).forEach(([id, v]) => {
    const elmt = document.querySelector(`[data-badge="materiel_${id}"]`);
    if (elmt) elmt.textContent = `≈ ${fmt(v)} kgCO2e/an`;
  });
  Object.entries(det.grosMateriel || {}).forEach(([id, v]) => {
    const elmt = document.querySelector(`[data-badge="gros_${id}"]`);
    if (elmt) elmt.textContent = `≈ ${fmt(v)} kgCO2e/an`;
  });
  const totalEl = document.querySelector(".total-en-cours");
  if (totalEl) totalEl.textContent = `Total en cours : ${resultats.totalT.toFixed(2)} tCO2e/an`;
  Object.entries(det.dechets || {}).forEach(([cle, v]) => {
    const elmt = document.querySelector(`[data-badge="${cle}"]`);
    if (elmt) elmt.textContent = `≈ ${fmt(v)} kgCO2e/an`;
  });
}

// --- Étape 1 : Profil --------------------------------------------------------
export function renderStepProfil(el, { data, famille, ctx }) {
  const p = data.profil;
  el.innerHTML = `
    <div class="groupe-champs-titre">Votre activité</div>
    <div class="champ">
      <label class="libelle">Famille de métier</label>
      <div class="grille-familles">
        ${FAMILLES.map(
          (f) => `
          <div class="carte-famille ${f.id === p.familleId ? "selectionne" : ""}" data-famille="${f.id}">
            <span>${ICONES[f.icon] || "•"}</span>
            <div class="titre">${f.label}</div>
          </div>`,
        ).join("")}
      </div>
    </div>
    <div class="champ">
      <label class="libelle">Votre métier précis</label>
      <select class="champ-select" data-champ-select="metierId">
        ${famille.metiers.map((m) => `<option value="${m}" ${m === p.metierId ? "selected" : ""}>${m}</option>`).join("")}
      </select>
    </div>
    <hr class="separateur" />
    <div class="groupe-champs-titre">Votre structure</div>
    <div class="champ">
      <label class="libelle">Mode de pratique</label>
      <select class="champ-select" data-champ-select="mode">
        <option value="seul" ${p.mode === "seul" ? "selected" : ""}>Seul(e), sans salarié</option>
        <option value="associes" ${p.mode === "associes" ? "selected" : ""}>En association / ${famille.lieuLabel} de groupe</option>
        <option value="employeur" ${p.mode === "employeur" ? "selected" : ""}>Avec salarié(s)</option>
      </select>
    </div>
    ${
      p.mode !== "seul"
        ? `
      <div data-style="display:flex; gap:18px;">
        <div class="champ"><label class="libelle">Praticiens (ETP) dans la structure</label>${champNombreHtml("nbPraticiens", p.nbPraticiens, { min: 1 })}</div>
        ${p.mode === "employeur" ? `<div class="champ"><label class="libelle">Salariés (ETP)</label>${champNombreHtml("nbSalaries", p.nbSalaries, { min: 0 })}</div>` : ""}
      </div>`
        : `<div class="texte-discret" data-style="margin-top:-12px; margin-bottom:22px; display:flex; gap:5px;">ℹ️ Vous exercez seul(e) : la structure compte 1 praticien (vous-même).</div>`
    }

    <hr class="separateur" />
    <div class="groupe-champs-titre">Votre zone géographique</div>
    <div class="champ" id="zone-finder">
      <label class="libelle">Ville de votre activité</label>
      <div class="aide" data-style="margin-bottom:8px;">Utilisée pour estimer les déplacements de votre patientèle/clientèle, à partir du zonage INSEE en aires urbaines 2010 (le même que celui utilisé par l'Enquête Mobilité des Personnes 2019) — recherche 100% locale, sans connexion requise.</div>
      <div class="zone-suggestions">
        <input type="text" id="input-ville" placeholder="Tapez le nom de votre ville (ex : Saint-Étienne)" value="${echapperHtml(p.villeLabel)}" autocomplete="off" />
        <div class="liste-suggestions" id="liste-suggestions-ville" data-style="display:none;"></div>
      </div>
      <div id="ville-confirmee"></div>
      <div class="texte-discret" data-style="margin-top:10px; margin-bottom:6px;">Vous pouvez ajuster manuellement si nécessaire :</div>
      <select class="champ-select" data-champ-select="zoneId" aria-label="Zone géographique (ajustement manuel)">
        ${ZONES.map((z) => `<option value="${z.id}" ${z.id === p.zoneId ? "selected" : ""}>${z.label}</option>`).join("")}
      </select>
    </div>

    <hr class="separateur" />
    <div class="groupe-champs-titre">Votre volume d'activité</div>
    <div class="champ">
      <label class="libelle">Nombre total de ${famille.acteLabel} réalisé(e)s par an, pour l'ensemble de ${famille.lieuArticleLe}</label>
      <div class="aide">Ce bilan d'émissions porte sur l'ensemble de ${famille.lieuArticleLe}, pas seulement sur votre propre activité : additionnez les ${famille.acteLabel} de tous les praticiens de la structure.</div>
      ${champNombreHtml("nbActesAn", p.nbActesAn, { min: 1 })}
    </div>

    <div class="champ">
      <label class="libelle">Part des ${famille.acteLabel} réalisé(e)s dans ${p.mode === "seul" ? "votre" : "le"} ${famille.lieuLabel} : <span id="valeur-partCabinet">${p.partCabinet}</span>%</label>
      <div class="aide">Le reste est supposé réalisé au domicile du/de la ${famille.publicSingulier} ou à distance (visio).</div>
      <input type="range" min="0" max="100" value="${p.partCabinet}" data-champ-range="partCabinet" id="range-partCabinet" />
    </div>

    <div class="champ">
      <label class="libelle">Recevez-vous de la ${famille.publicLabel} dans un lieu fixe ?</label>
      <div class="groupe-boutons">
        <button class="bouton-choix ${p.recoitPublic ? "selectionne" : ""}" data-recoit="true">Oui</button>
        <button class="bouton-choix ${!p.recoitPublic ? "selectionne" : ""}" data-recoit="false">Non</button>
      </div>
    </div>
  `;

  el.querySelectorAll("[data-famille]").forEach((c) =>
    c.addEventListener("click", () => ctx.onChangeFamille(c.dataset.famille)),
  );
  attacherSelects(el, ctx.onChangeProfil);
  attacherChampsNombre(el, ctx.onChangeProfilLive);
  el.querySelector("#range-partCabinet").addEventListener("input", (e) => {
    document.getElementById("valeur-partCabinet").textContent = e.target.value;
    ctx.onChangeProfilLive("partCabinet", Number(e.target.value));
  });
  el.querySelectorAll("[data-recoit]").forEach((b) =>
    b.addEventListener("click", () => ctx.onChangeProfil("recoitPublic", b.dataset.recoit === "true")),
  );

  // Autocomplétion ville
  const inputVille = el.querySelector("#input-ville");
  const listeSugg = el.querySelector("#liste-suggestions-ville");
  const zoneActuelleObj = ZONES.find((z) => z.id === p.zoneId);
  if (p.villeLabel && zoneActuelleObj) {
    el.querySelector("#ville-confirmee").innerHTML =
      `<div data-style="font-size:12.5px; color:var(--couleur-primaire); background:var(--couleur-primaire-fond); border-radius:8px; padding:8px 12px; margin-top:10px;"><strong>${echapperHtml(p.villeLabel)}</strong> → zone associée : <strong>${echapperHtml(zoneActuelleObj.label)}</strong></div>`;
  }
  // La liste des communes se charge dès l'affichage de l'étape, pour que les
  // suggestions soient immédiates à la première frappe.
  chargerCommunes();
  let suggestions = [];
  const choisirVille = (option) => {
    const c = suggestions.find((x) => x.code === option.dataset.code);
    ctx.onChangeProfil("villeLabel", c.nom);
    ctx.onChangeProfil("zoneId", c.zoneId);
  };
  activerListeSuggestions(inputVille, listeSugg, choisirVille);
  inputVille.addEventListener("input", async () => {
    const saisie = inputVille.value;
    const { chercherCommunes } = await chargerCommunes();
    if (inputVille.value !== saisie) return; // une frappe plus récente a pris le relais
    suggestions = chercherCommunes(saisie, 10);
    if (suggestions.length === 0) {
      listeSugg.style.display = "none";
      majListeSuggestions(inputVille, listeSugg, false);
      return;
    }
    listeSugg.innerHTML = suggestions
      .map(
        (c) =>
          `<div class="suggestion" role="option" data-code="${echapperHtml(c.code)}"><span>${echapperHtml(c.nom)}</span><span class="texte-discret">(${echapperHtml(c.dep)})</span></div>`,
      )
      .join("");
    listeSugg.style.display = "block";
    majListeSuggestions(inputVille, listeSugg, true);
    listeSugg.querySelectorAll("[data-code]").forEach((s) => {
      s.addEventListener("mousedown", () => choisirVille(s));
    });
  });
  inputVille.addEventListener("blur", () =>
    setTimeout(() => {
      listeSugg.style.display = "none";
      majListeSuggestions(inputVille, listeSugg, false);
    }, 150),
  );
}

// --- Étape 2 : Déplacements professionnels ----------------------------------
export function renderStepDeplacements(el, { data, resultats, ctx }) {
  const d = data.deplacements;
  const det = resultats.detail;
  const nbEquipe = (data.profil.nbPraticiens || 1) + (data.profil.nbSalaries || 0);
  const optionsMode = (excludeAvion) =>
    Object.entries(FE_TRANSPORT)
      .filter(([k]) => !excludeAvion || !k.startsWith("avion"))
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join("");

  el.innerHTML = `
    <p class="texte-discret" data-style="margin-top:-8px; margin-bottom:14px;">Trajets domicile-travail, visites professionnelles (domicile client/patient, EHPAD, chantiers…) et déplacements pour congrès ou représentations.</p>
    ${
      nbEquipe > 1
        ? `
      <div class="encadre-info" data-style="margin-bottom:20px;">
        <strong>⚠️ Vous avez indiqué ${nbEquipe} personnes dans la structure (praticiens + salariés).</strong>
        <div data-style="font-size:12.5px; color:var(--lc-vert-info); margin-top:4px; line-height:1.5;">Ce poste doit couvrir <strong>l'ensemble de l'équipe</strong>, pas seulement vos propres trajets : additionnez (ou estimez en moyenne × ${nbEquipe}) les distances domicile-travail, les visites et les déplacements pour congrès de tous les praticiens et salariés de la structure.</div>
      </div>
    `
        : `<p class="texte-discret" data-style="margin-top:-10px; margin-bottom:20px;">Si la structure compte plusieurs praticiens ou salariés, ces champs doivent couvrir l'ensemble de l'équipe, pas seulement vos propres trajets.</p>`
    }
    <div data-style="display:flex; gap:18px; flex-wrap:wrap;">
      <div class="champ"><label class="libelle">Mode de transport principal domicile-travail</label><select class="champ-select" data-champ-select="modeDomTrav">${optionsMode(true)}</select></div>
      <div class="champ"><label class="libelle">Distance aller (km)</label>${champNombreHtml("kmAllerJour", d.kmAllerJour)}</div>
      <div class="champ"><label class="libelle">Jours travaillés / semaine</label>${champNombreHtml("joursSemaine", d.joursSemaine, { step: 0.5 })}</div>
      <div class="champ"><label class="libelle">Semaines travaillées / an${badgeLive(det.domTrav, "domTrav")}</label>${champNombreHtml("semainesAn", d.semainesAn, { max: 52 })}</div>
    </div>
    <hr class="separateur" />
    <div data-style="display:flex; gap:18px; flex-wrap:wrap;">
      <div class="champ"><label class="libelle">Km parcourus par an en visites professionnelles</label><div class="aide">Domicile de patients/clients, EHPAD, chantiers, rendez-vous extérieurs — pour l'ensemble de la structure.</div>${champNombreHtml("kmVisitesAn", d.kmVisitesAn)}</div>
      <div class="champ"><label class="libelle">Mode de transport principal pour ces visites${badgeLive(det.visites, "visites")}</label><select class="champ-select" data-champ-select="modeVisites">${optionsMode(true)}</select></div>
    </div>
    <hr class="separateur" />
    <div data-style="display:flex; gap:18px; flex-wrap:wrap;">
      <div class="champ"><label class="libelle">Congrès / formations / représentations par an</label>${champNombreHtml("nbCongresAn", d.nbCongresAn)}</div>
      <div class="champ"><label class="libelle">Mode de transport principal</label>
        <select class="champ-select" data-champ-select="modeCongres">
          <option value="voiture_thermique">Voiture thermique</option>
          <option value="voiture_electrique">Voiture électrique</option>
          <option value="train_tgv">Train / TGV</option>
          <option value="avion_court">Avion court-courrier</option>
          <option value="avion_moyen">Avion moyen-courrier</option>
          <option value="avion_long">Avion long-courrier</option>
        </select>
      </div>
      <div class="champ"><label class="libelle">Distance aller-retour moyenne (km)${badgeLive(det.congres, "congres")}</label>${champNombreHtml("kmCongresAR", d.kmCongresAR)}</div>
    </div>
  `;
  attacherSelects(el, ctx.onChangeDeplacements);
  attacherChampsNombre(el, ctx.onChangeDeplacementsLive);
  el.querySelector('[data-champ-select="modeDomTrav"]').value = d.modeDomTrav;
  el.querySelector('[data-champ-select="modeVisites"]').value = d.modeVisites;
  el.querySelector('[data-champ-select="modeCongres"]').value = d.modeCongres;
}

// --- Étape 3 : Local ----------------------------------------------------------
export function renderStepLocal(el, { data, famille, zone, resultats, ctx }) {
  const l = data.local;
  const p = data.profil;
  const det = resultats.detail;
  el.innerHTML = `
    <div class="champ">
      <label class="libelle">Exercez-vous dans un ${famille.lieuLabel} professionnel (local dédié) ?</label>
      <div class="groupe-boutons">
        <button class="bouton-choix ${l.aLocal ? "selectionne" : ""}" data-alocal="true">Oui</button>
        <button class="bouton-choix ${!l.aLocal ? "selectionne" : ""}" data-alocal="false">Non (uniquement à domicile / itinérant)</button>
      </div>
    </div>
    ${
      l.aLocal
        ? `
      <div data-style="display:flex; gap:18px; flex-wrap:wrap;">
        <div class="champ"><label class="libelle">Surface du ${famille.lieuLabel} (m²)</label>${champNombreHtml("surface", l.surface)}</div>
        <div class="champ"><label class="libelle">Énergie principale de chauffage</label>
          <select class="champ-select" data-champ-select="energieChauffage">
            ${Object.entries(FE_ENERGIE)
              .map(([k, v]) => `<option value="${k}" ${k === l.energieChauffage ? "selected" : ""}>${v.label}</option>`)
              .join("")}
          </select>
        </div>
      </div>
      <p class="texte-discret" data-style="margin-top:-8px; margin-bottom:16px;">Par défaut, la consommation est estimée à partir de ratios ADEME adaptés à votre activité (Bâtiment - Chiffres clés). Vous pouvez saisir vos consommations réelles si vous les connaissez.</p>
      <div data-style="display:flex; gap:14px; margin-bottom:8px;">${badgeLive(det.localElec, "localElec")}${badgeLive(det.localChauffage, "localChauffage")}</div>

      <div class="champ"><label class="libelle"><input type="checkbox" data-champ-case="consoElecConnue" ${l.consoElecConnue ? "checked" : ""} data-style="margin-right:8px;" />Je connais ma consommation réelle d'électricité (factures)</label>
        ${l.consoElecConnue ? champNombreHtml("consoElecKwh", l.consoElecKwh, { suffix: "kWh/an" }) : ""}
      </div>
      <div class="champ"><label class="libelle"><input type="checkbox" data-champ-case="consoChauffageConnue" ${l.consoChauffageConnue ? "checked" : ""} data-style="margin-right:8px;" />Je connais ma consommation réelle de chauffage (factures)</label>
        ${l.consoChauffageConnue ? champNombreHtml("consoChauffageKwh", l.consoChauffageKwh, { suffix: "kWh/an" }) : ""}
      </div>
      <hr class="separateur" />
      <div class="champ"><label class="libelle"><input type="checkbox" data-champ-case="localDeporte" ${l.localDeporte ? "checked" : ""} data-style="margin-right:8px;" />Utilisez-vous un local déporté (ex : EHPAD, antenne secondaire) ?${badgeLive(det.localDeporte, "localDeporte")}</label>
        ${l.localDeporte ? champNombreHtml("surfaceDeportee", l.surfaceDeportee, { suffix: "m² approx." }) : ""}
      </div>
      ${
        p.recoitPublic
          ? `
        <div class="encadre-info">
          <div data-style="font-weight:600; font-size:13.5px;">Déplacements de votre ${famille.publicLabel} vers ${famille.lieuArticleLe}${badgeLive(det.patientele, "patientele")}</div>
          <div data-style="font-size:12px; color:var(--lc-vert-info); margin-top:6px; line-height:1.5;">
            Calculés automatiquement à partir de la zone choisie à l'étape précédente (<strong>${zone.label}</strong>), selon la répartition modale de cette zone, ajustée au motif de déplacement le plus proche de votre activité (Enquête Mobilité des Personnes 2019, SDES) — zone géographique déterminée via le zonage INSEE en aires urbaines 2010.
            Base : ${Math.round(resultats.nbActesLieuFixe)} ${famille.acteLabel} réalisé(e)s ${famille.lieuArticleLe}, sur environ ${kmModalTotal(zone).toFixed(1)} km aller-retour par ${famille.uniteActe} en moyenne (tous modes confondus).
          </div>
        </div>`
          : ""
      }
    `
        : ""
    }
  `;
  el.querySelectorAll("[data-alocal]").forEach((b) =>
    b.addEventListener("click", () => ctx.onChangeLocal("aLocal", b.dataset.alocal === "true")),
  );
  attacherSelects(el, ctx.onChangeLocal);
  attacherChampsNombre(el, ctx.onChangeLocalLive);
  attacherCases(el, ctx.onChangeLocal);
}

// --- Étape 4 : Numérique -------------------------------------------------------
export function renderStepNumerique(el, { data, resultats, ctx }) {
  const n = data.numerique;
  const det = resultats.detail;
  el.innerHTML = `
    <div data-style="display:flex; gap:18px; flex-wrap:wrap;">
      <div class="champ"><label class="libelle">Ordinateurs fixes${badgeLive(det.numOrdisFixes, "numOrdisFixes")}</label>${champNombreHtml("nbOrdisFixes", n.nbOrdisFixes)}</div>
      <div class="champ"><label class="libelle">Ordinateurs portables${badgeLive(det.numOrdisPortables, "numOrdisPortables")}</label>${champNombreHtml("nbOrdisPortables", n.nbOrdisPortables)}</div>
      <div class="champ"><label class="libelle">Écrans supplémentaires${badgeLive(det.numEcrans, "numEcrans")}</label>${champNombreHtml("nbEcransSuppl", n.nbEcransSuppl)}</div>
    </div>
    <div class="champ">
      <label class="libelle">Niveau d'usage numérique quotidien (mails, cloud, visio, stockage)${badgeLive(det.numUsage, "numUsage")}</label>
      <select class="champ-select" data-champ-select="usage">
        <option value="faible" ${n.usage === "faible" ? "selected" : ""}>Faible — peu de visio, peu de stockage cloud</option>
        <option value="moyen" ${n.usage === "moyen" ? "selected" : ""}>Moyen — usage courant</option>
        <option value="fort" ${n.usage === "fort" ? "selected" : ""}>Fort — beaucoup de visio, gros volumes de données</option>
      </select>
    </div>
  `;
  attacherSelects(el, ctx.onChangeNumerique);
  attacherChampsNombre(el, ctx.onChangeNumeriqueLive);
}

// --- Étape 5 : Matériel ---------------------------------------------------------
export function renderStepMateriel(el, { data, famille, resultats, ctx }) {
  const inv = data.investissements;
  const det = resultats.detail;
  const estPharmacien = data.profil.metierId === "Pharmacien(ne) titulaire d'officine";
  const estSante = famille.id === "sante";
  // Filet de sécurité : ces deux sections ont été ajoutées après la mise en
  // production initiale ; un brouillon ou un état sauvegardé antérieur peut
  // ne pas les contenir. On retombe sur des valeurs neutres plutôt que de
  // laisser planter le rendu (voir aussi fusionnerAvecDefauts dans etat-initial.js,
  // qui couvre déjà le cas normal de reprise de brouillon).
  const presc = data.prescriptions || { active: false, depenseMedicaments: 0, depenseActes: 0 };
  data.pharmacien = data.pharmacien || { caMedicaments: 0, caParapharmacie: 0 };
  el.innerHTML = `
    <p class="texte-discret" data-style="margin-top:-8px; margin-bottom:20px;">Postes adaptés à votre famille de métier (<strong>${famille.label}</strong>). Une estimation en euros dépensés par an suffit.</p>
    ${famille.consommables
      .map(
        (c) => `
      <div class="champ"><label class="libelle">${c.label}${badgeLive(det.materiel[c.id], `materiel_${c.id}`)}</label>${champNombreHtml(`materiel_${c.id}`, data.materiel[c.id] || 0, { suffix: "€ / an" })}</div>
    `,
      )
      .join("")}
    ${
      estPharmacien
        ? `
      <hr class="separateur" />
      <div class="groupe-champs-titre">Médicaments et parapharmacie vendus</div>
      <p class="texte-discret" data-style="margin-top:-6px; margin-bottom:16px;">Poste spécifique à l'officine : votre chiffre d'affaires HT, réparti entre médicaments et parapharmacie, chacun avec un facteur d'émission propre.</p>
      <div class="champ"><label class="libelle">Chiffre d'affaires médicaments (€ HT / an)${badgeLive(det.medicamentsVendus, "medicamentsVendus")}</label>${champNombreHtml("ca_medicaments", data.pharmacien.caMedicaments || 0, { suffix: "€ HT / an" })}</div>
      <div class="champ"><label class="libelle">Chiffre d'affaires parapharmacie (€ HT / an)${badgeLive(det.parapharmacie, "parapharmacie")}</label>${champNombreHtml("ca_parapharmacie", data.pharmacien.caParapharmacie || 0, { suffix: "€ HT / an" })}</div>
    `
        : ""
    }
    ${
      estSante
        ? `
      <hr class="separateur" />
      <div class="groupe-champs-titre">Prescriptions</div>
      <div class="encadre-info">
        <label data-style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <input type="checkbox" data-champ-case="prescriptionActive" ${presc.active ? "checked" : ""} data-style="margin-top:3px;" />
          <span>
            <span data-style="font-weight:700; font-size:14px;">Des praticiens de la structure prescrivent des médicaments et/ou des actes médicaux (examens, dispositifs)</span>
            <div data-style="font-size:12px; color:var(--lc-vert-info); margin-top:4px; line-height:1.5;">En tant que prescripteurs, vous avez un levier de décarbonation propre (éco-prescription, déprescription). Ce poste est affiché séparément du reste du bilan, pour rester comparable avec les structures qui ne prescrivent pas.</div>
          </span>
        </label>
        ${
          presc.active
            ? `
          <div data-style="margin-top:18px;">
            <div class="champ"><label class="libelle">Dépense totale de médicaments prescrits, pour l'ensemble de la patientèle de la structure (€ / an)${badgeLive(det.prescriptionsMedicaments, "prescriptionsMedicaments")}</label>${champNombreHtml("presc_medicaments", presc.depenseMedicaments || 0, { suffix: "€ / an" })}</div>
            <div class="champ"><label class="libelle">Dépense totale d'actes prescrits — examens complémentaires, dispositifs (€ / an)${badgeLive(det.prescriptionsActes, "prescriptionsActes")}</label>${champNombreHtml("presc_actes", presc.depenseActes || 0, { suffix: "€ / an" })}</div>
            <p class="texte-discret" data-style="margin-top:-6px;">Cumulez tous les praticiens prescripteurs de la structure, pas un seul. Une première approche à affiner : utilisez les montants que vous connaissez le mieux (ex. volume de prescriptions habituel), même approximatifs.</p>
          </div>`
            : ""
        }
      </div>
    `
        : ""
    }
    <hr class="separateur" />
    <div class="encadre-info">
      <label data-style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
        <input type="checkbox" data-champ-case="actif" ${inv.actif ? "checked" : ""} data-style="margin-top:3px;" />
        <span>
          <span data-style="font-weight:700; font-size:14px;">J'ai fait des investissements en gros matériel (&gt; 60 kg) ou en mobilier il y a moins de 5 ans</span>
          <div data-style="font-size:12px; color:var(--lc-vert-info); margin-top:4px; line-height:1.5;">Les équipements lourds et le mobilier professionnel sont comptabilisés au prorata de leur amortissement, par défaut sur 5 ans.</div>
        </span>
      </label>
      ${
        inv.actif
          ? `
        <div data-style="margin-top:18px;">
          <div data-style="font-weight:600; font-size:13.5px; margin-bottom:10px;">Gros matériel (valeur d'achat totale, en euros)</div>
          ${(famille.grosMateriel || [])
            .map(
              (g) => `
            <div class="champ"><label class="libelle">${g.label}${badgeLive(det.grosMateriel[g.id], `gros_${g.id}`)}</label>${champNombreHtml(`gros_${g.id}`, inv.gros[g.id] || 0, { suffix: "€ (valeur d'achat)" })}</div>
          `,
            )
            .join("")}
          <div data-style="font-weight:600; font-size:13.5px; margin-top:8px; margin-bottom:10px;">Mobilier professionnel (bureau, tables, chaises…)</div>
          <div class="champ"><label class="libelle">Valeur d'achat totale du mobilier récent${badgeLive(det.mobilier, "mobilier")}</label>${champNombreHtml("mobilier", inv.mobilier || 0, { suffix: "€ (valeur d'achat)" })}</div>
        </div>`
          : ""
      }
    </div>
  `;
  attacherCases(el, (f, v) => {
    if (f === "prescriptionActive") ctx.onChangePrescriptions("active", v);
    else ctx.onChangeInvestissements(f, v);
  });
  // Distribution déclarative des champs numériques vers le bon callback,
  // selon le préfixe de leur identifiant. Ajouter un nouveau champ de ce
  // type ne demande qu'une ligne ici, plutôt que d'allonger une chaîne
  // if/else — voir attacherChampsNombreDispatch ci-dessous.
  attacherChampsNombreDispatch(el, [
    { prefixe: "materiel_", cb: (id, v) => ctx.onChangeMaterielLive(id, v) },
    { prefixe: "gros_", cb: (id, v) => ctx.onChangeGrosMaterielLive(id, v) },
    { cle: "mobilier", cb: (v) => ctx.onChangeInvestissementsLive("mobilier", v) },
    { cle: "ca_medicaments", cb: (v) => ctx.onChangePharmacienLive("caMedicaments", v) },
    { cle: "ca_parapharmacie", cb: (v) => ctx.onChangePharmacienLive("caParapharmacie", v) },
    { cle: "presc_medicaments", cb: (v) => ctx.onChangePrescriptionsLive("depenseMedicaments", v) },
    { cle: "presc_actes", cb: (v) => ctx.onChangePrescriptionsLive("depenseActes", v) },
  ]);
}

// --- Étape : Déchets ----------------------------------------------------
export function renderStepDechets(el, { data, famille, resultats, ctx }) {
  const d = data.dechets;
  const estSante = famille.id === "sante";
  const nbEquipe = (data.profil.nbPraticiens || 1) + (data.profil.nbSalaries || 0);
  const detailDechets = resultats.detail.dechets || {};

  const champDechet = (cle, label) => `
    <div class="champ">
      <label class="libelle">${label} (kg/semaine)${badgeLive(detailDechets[cle], cle)}</label>
      ${champNombreHtml(cle, d[cle] || 0, { step: 0.5 })}
    </div>`;

  el.innerHTML = `
    <p class="texte-discret" data-style="margin-top:-8px; margin-bottom:6px;">Déchets courants générés par l'activité (emballages, consommables usagés, papier...) — le <strong>traitement en fin de vie</strong> uniquement. La fabrication de ces produits est déjà comptée dans le poste "Matériel et consommables" : ne recomptez pas la même chose ici.</p>
    ${
      nbEquipe > 1
        ? `
      <div class="encadre-info" data-style="margin-bottom:18px;">
        <strong>⚠️ ${nbEquipe} personnes dans la structure.</strong>
        <div data-style="font-size:12.5px; color:var(--lc-vert-info); margin-top:4px; line-height:1.5;">Estimez le volume de déchets pour <strong>l'ensemble de la structure</strong>, pas seulement le vôtre.</div>
      </div>
    `
        : ""
    }
    <div data-style="display:grid; grid-template-columns:1fr 1fr; gap:0 18px;">
      ${champDechet("plastique", "Plastique")}
      ${champDechet("metal", "Métal (hors aluminium)")}
      ${champDechet("papier", "Papier")}
      ${champDechet("carton", "Carton")}
      ${champDechet("aluminium", "Aluminium")}
      ${champDechet("verre", "Verre")}
      ${champDechet("menagers", "Déchets ménagers non triés")}
      ${champDechet("electronique", "Déchets électroniques (DEEE)")}
    </div>
    ${
      estSante
        ? `
      <hr class="separateur" />
      <div class="encadre-info">
        <div class="champ" data-style="margin-bottom:0;">
          <label class="libelle">DASRI — déchets d'activité de soins à risques infectieux (kg/semaine)${badgeLive(detailDechets.dasri, "dasri")}</label>
          ${champNombreHtml("dasri", d.dasri || 0, { step: 0.1 })}
        </div>
        <p class="aide" data-style="margin-top:8px; margin-bottom:0;">Matériel piquant/coupant, produits biologiques — incinération à haute température obligatoire (code de la santé publique), bien plus émissive que les déchets courants ci-dessus. Ne comptez ici que le DASRI, pas les déchets ménagers déjà saisis plus haut.</p>
      </div>
    `
        : ""
    }
  `;
  attacherChampsNombre(el, ctx.onChangeDechetsLive);
}

// --- Étape 6 : Alimentation --------------------------------------------------
export function renderStepAlimentation(el, { data, resultats, ctx }) {
  const a = data.alimentation;
  const nbEquipe = (data.profil.nbPraticiens || 1) + (data.profil.nbSalaries || 0);
  // Le plafond du curseur doit suivre la taille de l'équipe : ce champ
  // compte les repas de TOUTE la structure (voir l'encart ci-dessous), donc
  // un cabinet de 10 ETP a mécaniquement besoin d'un maximum bien supérieur
  // à celui d'un praticien seul. Base : jusqu'à 5 repas/semaine/personne (un
  // déjeuner par jour travaillé), avec un plancher à 10 pour ne jamais être
  // plus restrictif qu'avant pour un praticien seul.
  const maxRepas = Math.max(10, nbEquipe * 5);
  el.innerHTML = `
    ${
      nbEquipe > 1
        ? `
      <div class="encadre-info" data-style="margin-bottom:18px;">
        <strong>⚠️ ${nbEquipe} personnes dans la structure.</strong>
        <div data-style="font-size:12.5px; color:var(--lc-vert-info); margin-top:4px; line-height:1.5;">Comptez le nombre de repas professionnels pour <strong>l'ensemble de l'équipe</strong> (tous les praticiens et salariés cumulés), pas seulement les vôtres.</div>
      </div>
    `
        : `<p class="texte-discret" data-style="margin-top:-6px; margin-bottom:16px;">Si la structure compte plusieurs praticiens ou salariés, ce total doit couvrir toute l'équipe.</p>`
    }
    <div class="champ">
      <label class="libelle">Repas professionnels (déjeuners sur site ou au restaurant) par semaine, pour l'ensemble de la structure : <span id="valeur-repas">${a.repasParSemaine}</span> <span class="texte-discret" data-style="font-weight:400;">/ ${maxRepas} max</span>${badgeLive(resultats.detail.alimentation, "alimentation")}</label>
      <input type="range" min="0" max="${maxRepas}" value="${Math.min(a.repasParSemaine, maxRepas)}" data-champ-range="repasParSemaine" id="range-repas" />
    </div>
    <div class="champ">
      <label class="libelle">Part de repas végétariens : <span id="valeur-vege">${a.partVegetarienne}</span>%</label>
      <input type="range" min="0" max="100" value="${a.partVegetarienne}" data-champ-range="partVegetarienne" id="range-vege" />
    </div>
  `;
  el.querySelector("#range-repas").addEventListener("input", (e) => {
    document.getElementById("valeur-repas").textContent = e.target.value;
    ctx.onChangeAlimentationLive("repasParSemaine", Number(e.target.value));
  });
  el.querySelector("#range-vege").addEventListener("input", (e) => {
    document.getElementById("valeur-vege").textContent = e.target.value;
    ctx.onChangeAlimentationLive("partVegetarienne", Number(e.target.value));
  });
}

// --- Étape 7 : Services ---------------------------------------------------------
export function renderStepServices(el, { data, resultats, ctx }) {
  const s = data.services;
  const det = resultats.detail;
  el.innerHTML = `
    <div class="champ"><label class="libelle">Comptabilité, banque, assurance, cotisations, courrier (€ / an)${badgeLive(det.servicesCompta, "servicesCompta")}</label>
      <div class="aide">Regroupez ces postes pour aller vite : un ratio moyen d'émission par euro dépensé est appliqué.</div>
      ${champNombreHtml("servicesAn", s.servicesAn)}
    </div>
    <div class="champ"><label class="libelle">Prestataires et sous-traitance (€ / an)${badgeLive(det.servicesSousTraitance, "servicesSousTraitance")}</label>${champNombreHtml("sousTraitanceAn", s.sousTraitanceAn)}</div>
    <div class="champ"><label class="libelle">Nombre de colis / livraisons reçus ou envoyés par an${badgeLive(det.fret, "fret")}</label>${champNombreHtml("nbColisAn", s.nbColisAn)}</div>
  `;
  attacherChampsNombre(el, ctx.onChangeServicesLive);
}
