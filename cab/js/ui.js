/**
 * ui.js
 * ----------------------------------------------------------------------
 * Toutes les fonctions de rendu de l'interface (DOM). Ce fichier ne fait
 * aucun calcul (voir calcul.js) et ne touche jamais au stockage
 * directement (voir stockage.js) : il reçoit des données et des fonctions
 * de rappel (callbacks) depuis main.js, et se contente d'afficher et de
 * relayer les interactions utilisateur.
 * ----------------------------------------------------------------------
 */
import { FAMILLES, CATEGORIES_META, FE_TRANSPORT, FE_ENERGIE } from "./data/facteurs-emission.js";
import { ZONES, chercherCommunes, kmModalTotal } from "./data/zonage-insee.js";
import { dessinerGraphiqueRepartition, dessinerJaugeEngagement } from "./graphiques.js";
import { construireTableauEvolution, afficherGraphiqueEvolution } from "./evolution.js";

// Petites icônes (glyphes unicode sobres, pas de dépendance externe).
const ICONES = {
  sante: "🩺", juridique: "⚖️", conseil: "📈", archi: "📐", artisanat: "🔨", autre: "💼",
  deplacements: "🚗", patientele: "👥", local: "🏢", numerique: "💻", materiel: "📦",
  alimentation: "🍽️", services: "💼", fret: "🚚",
};

function fmt(n, dec = 0) { return Number(n).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }

// ============================================================================
// ÉCRAN D'INTRODUCTION
// ============================================================================
export function renderIntro(root, { onStart }) {
  root.innerHTML = `
    <div class="intro">
      <img src="assets/logo/logo-libco2.png" alt="Lib&CO2" class="logo-intro" />
      <div class="badge">🌿 Outil pour les professionnels libéraux</div>
      <p class="lead">Estimez, en quelques minutes, l'ordre de grandeur des émissions de gaz à effet de serre de votre activité indépendante — et identifiez les leviers de décarbonation les plus pertinents pour vous.</p>
      <p class="sub">Méthodologie inspirée de kinéCO2 (Lib&CO2, Carbone 4) — facteurs d'émission ADEME Base Empreinte, report modal de la patientèle/clientèle basé sur l'Enquête Mobilité des Personnes 2019.</p>
      <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
        <button class="bouton bouton-primaire" id="btn-demarrer">Démarrer mon estimation ›</button>
        <a href="pourquoi-compter-le-carbone.html" class="icone-info-tooltip" data-tooltip="Pourquoi compter le carbone ?" aria-label="Pourquoi compter le carbone ?">?</a>
      </div>
      <div class="grille-features">
        <div class="feature-card"><div>✨</div><div class="titre">5 minutes</div><div class="desc">Un parcours court, pensé pour ne pas vous perdre.</div></div>
        <div class="feature-card"><div>📊</div><div class="titre">8 postes clés</div><div class="desc">Déplacements, local, numérique, matériel, achats…</div></div>
        <div class="feature-card"><div>🏆</div><div class="titre">Jauge d'engagement</div><div class="desc">Visualisez votre trajectoire vers l'Accord de Paris.</div></div>
        <div class="feature-card"><div>✅</div><div class="titre">Plan d'action</div><div class="desc">Des leviers priorisés, avec un ordre de coût.</div></div>
      </div>
      <p class="mentions">Version bêta-test. Les résultats sont des ordres de grandeur destinés à éclairer vos décisions, pas un bilan d'émissions de gaz à effet de serre réglementaire (BEGES).</p>
      <p class="mentions">🔒 Vos données restent sur votre appareil (aucun serveur, aucun compte) · 📖 Code source ouvert sur <a href="https://github.com/romarickine/libco2cab" target="_blank" rel="noopener" style="color:inherit;">GitHub</a> · <a href="mentions-legales.html" style="color:inherit;">Mentions légales</a></p>
    </div>
  `;
  document.getElementById("btn-demarrer").addEventListener("click", onStart);
}

// ============================================================================
// PROPOSITION DE REPRISE D'UN BROUILLON
// ============================================================================
export function renderPropositionBrouillon(root, { date, onReprendre, onIgnorer }) {
  const d = new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  root.innerHTML = `
    <div class="conteneur-etroit">
      <div class="carte" style="text-align:center; margin-top: 60px;">
        <div style="font-size:15px; font-weight:700; margin-bottom:8px;">Reprendre votre saisie précédente ?</div>
        <div class="texte-discret" style="margin-bottom:18px;">Une saisie non terminée a été sauvegardée le ${d}.</div>
        <button class="bouton bouton-primaire" id="btn-reprendre" style="margin-right:10px;">Reprendre</button>
        <button class="bouton bouton-secondaire" id="btn-ignorer">Recommencer à zéro</button>
      </div>
    </div>
  `;
  document.getElementById("btn-reprendre").addEventListener("click", onReprendre);
  document.getElementById("btn-ignorer").addEventListener("click", onIgnorer);
}

// ============================================================================
// ASSISTANT (WIZARD)
// ============================================================================
const TITRES_ETAPES = {
  profil: "Votre profil",
  deplacements: "Vos déplacements professionnels",
  local: "Votre local professionnel",
  numerique: "Vos usages numériques",
  materiel: "Matériel et consommables métier",
  alimentation: "Alimentation professionnelle",
  services: "Achats de services & livraisons",
};

export function renderWizard(root, ctx) {
  const { etapes, etapeIndex, data, famille, zone, resultats } = ctx;
  const etapeId = etapes[etapeIndex];
  const estPremiere = etapeIndex === 0;
  const estDerniere = etapeIndex === etapes.length - 1;
  const titre = etapeId === "local" ? `Votre ${famille.lieuLabel} professionnel` : TITRES_ETAPES[etapeId];

  root.innerHTML = `
    <div class="conteneur-etroit">
      <div class="entete-app">
        <img src="assets/logo/logo-libco2.png" alt="Lib&CO2" />
        <div class="total-en-cours">Total en cours : ${resultats.totalT.toFixed(2)} tCO2e/an</div>
      </div>
      <div class="barre-progression">
        ${etapes.map((e, i) => `<div class="segment ${i <= etapeIndex ? "actif" : ""}"></div>`).join("")}
      </div>
      <div class="eyebrow">Étape ${etapeIndex + 1} / ${etapes.length}</div>
      <h2 class="titre-serif" style="font-size:30px; margin: 4px 0 28px;">${titre}</h2>
      <div class="carte" style="padding:28px;" id="contenu-etape"></div>
      <div class="pas-actions">
        <button class="bouton bouton-secondaire" id="btn-precedent" ${estPremiere ? "disabled" : ""}>‹ Précédent</button>
        <button class="bouton bouton-primaire" id="btn-suivant">${estDerniere ? "Voir mon estimation" : "Suivant"} ›</button>
      </div>
    </div>
  `;

  const conteneurEtape = document.getElementById("contenu-etape");
  const rendus = {
    profil: renderStepProfil, deplacements: renderStepDeplacements, local: renderStepLocal,
    numerique: renderStepNumerique, materiel: renderStepMateriel, alimentation: renderStepAlimentation,
    services: renderStepServices,
  };
  rendus[etapeId](conteneurEtape, { data, famille, zone, resultats, ctx });

  document.getElementById("btn-precedent").addEventListener("click", ctx.onPrev);
  document.getElementById("btn-suivant").addEventListener("click", ctx.onNext);
}

// --- Aides de rendu de champ ------------------------------------------------
function champNombreHtml(fieldKey, value, { min = 0, max, step, suffix = "" } = {}) {
  const v = value === 0 ? "" : value;
  return `<span style="display:inline-flex; align-items:center; gap:8px;">
    <input type="number" class="champ-nombre" data-field="${fieldKey}" data-champ-nombre="${fieldKey}"
      value="${v}" placeholder="0" ${min !== undefined ? `min="${min}"` : ""} ${max !== undefined ? `max="${max}"` : ""} ${step !== undefined ? `step="${step}"` : ""} />
    ${suffix ? `<span class="texte-discret">${suffix}</span>` : ""}
  </span>`;
}
function badgeLive(kg, cle) {
  if (kg === undefined || kg === null) return "";
  return `<span class="badge-live" data-badge="${cle || ""}">≈ ${fmt(kg)} kgCO2e/an</span>`;
}
// Met à jour, sans redessiner tout le formulaire, les badges en direct et le
// total affiché dans l'en-tête — appelé à chaque frappe dans un champ
// numérique pour rester réactif sans casser la saisie clavier en cours.
export function majBadgesEtTotal(resultats) {
  const det = resultats.detail;
  const simples = {
    domTrav: det.domTrav, visites: det.visites, congres: det.congres,
    localElec: det.localElec, localChauffage: det.localChauffage, localDeporte: det.localDeporte, patientele: det.patientele,
    numOrdisFixes: det.numOrdisFixes, numOrdisPortables: det.numOrdisPortables, numEcrans: det.numEcrans, numUsage: det.numUsage,
    mobilier: det.mobilier, alimentation: det.alimentation,
    servicesCompta: det.servicesCompta, servicesSousTraitance: det.servicesSousTraitance, fret: det.fret,
    medicamentsVendus: det.medicamentsVendus, parapharmacie: det.parapharmacie,
    prescriptionsMedicaments: det.prescriptionsMedicaments, prescriptionsActes: det.prescriptionsActes,
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
}
// Attache les gestionnaires pour tous les champs numériques du conteneur.
// onChangeLive(field, value, resultatsRecalcules) est appelé à chaque frappe
// SANS redessiner tout le formulaire (seuls les badges et le total sont mis
// à jour, voir majBadgesEtTotal) — c'est ce qui évite de perdre des frappes
// lors d'une saisie rapide au clavier. Gère aussi le focus/sélection au clic
// pour éviter le bug du "0" collé devant la saisie.
function attacherChampsNombre(conteneur, onChangeLive) {
  conteneur.querySelectorAll("[data-champ-nombre]").forEach((input) => {
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => {
      const val = input.value === "" ? 0 : Number(input.value);
      onChangeLive(input.dataset.champNombre, val);
    });
  });
}
// Variante de attacherChampsNombre pour un conteneur dont les champs
// numériques doivent être distribués vers PLUSIEURS callbacks différents
// selon leur identifiant (ex. étape "Matériel", qui mélange consommables,
// gros matériel, médicaments, prescriptions). `regles` est une liste
// ordonnée de { prefixe, cb } ou { cle, cb } ; la première règle qui
// correspond est utilisée, le préfixe étant retiré de l'identifiant transmis.
function attacherChampsNombreDispatch(conteneur, regles) {
  conteneur.querySelectorAll("[data-champ-nombre]").forEach((input) => {
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => {
      const val = input.value === "" ? 0 : Number(input.value);
      const key = input.dataset.champNombre;
      const regle = regles.find((r) => (r.prefixe && key.startsWith(r.prefixe)) || r.cle === key);
      if (!regle) return;
      if (regle.prefixe) regle.cb(key.replace(regle.prefixe, ""), val);
      else regle.cb(val);
    });
  });
}
function attacherSelects(conteneur, onChange) {
  conteneur.querySelectorAll("[data-champ-select]").forEach((sel) => {
    sel.addEventListener("change", () => onChange(sel.dataset.champSelect, sel.value));
  });
}
function attacherCases(conteneur, onChange) {
  conteneur.querySelectorAll("[data-champ-case]").forEach((c) => {
    c.addEventListener("change", () => onChange(c.dataset.champCase, c.checked));
  });
}
function attacherRanges(conteneur, onChange) {
  conteneur.querySelectorAll("[data-champ-range]").forEach((r) => {
    r.addEventListener("input", () => onChange(r.dataset.champRange, Number(r.value)));
  });
}

// --- Étape 1 : Profil --------------------------------------------------------
function renderStepProfil(el, { data, famille, ctx }) {
  const p = data.profil;
  el.innerHTML = `
    <div class="groupe-champs-titre">Votre activité</div>
    <div class="champ">
      <label class="libelle">Famille de métier</label>
      <div class="grille-familles">
        ${FAMILLES.map((f) => `
          <div class="carte-famille ${f.id === p.familleId ? "selectionne" : ""}" data-famille="${f.id}">
            <span>${ICONES[f.icon] || "•"}</span>
            <div class="titre">${f.label}</div>
          </div>`).join("")}
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
    ${p.mode !== "seul" ? `
      <div style="display:flex; gap:18px;">
        <div class="champ"><label class="libelle">Praticiens (ETP) dans la structure</label>${champNombreHtml("nbPraticiens", p.nbPraticiens, { min: 1 })}</div>
        ${p.mode === "employeur" ? `<div class="champ"><label class="libelle">Salariés (ETP)</label>${champNombreHtml("nbSalaries", p.nbSalaries, { min: 0 })}</div>` : ""}
      </div>` : `<div class="texte-discret" style="margin-top:-12px; margin-bottom:22px; display:flex; gap:5px;">ℹ️ Vous exercez seul(e) : la structure compte 1 praticien (vous-même).</div>`}

    <hr class="separateur" />
    <div class="groupe-champs-titre">Votre zone géographique</div>
    <div class="champ" id="zone-finder">
      <label class="libelle">Ville de votre activité</label>
      <div class="aide" style="margin-bottom:8px;">Utilisée pour estimer les déplacements de votre patientèle/clientèle, à partir du zonage INSEE en aires urbaines 2010 (le même que celui utilisé par l'Enquête Mobilité des Personnes 2019) — recherche 100% locale, sans connexion requise.</div>
      <div class="zone-suggestions">
        <input type="text" id="input-ville" placeholder="Tapez le nom de votre ville (ex : Saint-Étienne)" value="${p.villeLabel || ""}" autocomplete="off" />
        <div class="liste-suggestions" id="liste-suggestions-ville" style="display:none;"></div>
      </div>
      <div id="ville-confirmee"></div>
      <div class="texte-discret" style="margin-top:10px; margin-bottom:6px;">Vous pouvez ajuster manuellement si nécessaire :</div>
      <select class="champ-select" data-champ-select="zoneId">
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

  el.querySelectorAll("[data-famille]").forEach((c) => c.addEventListener("click", () => ctx.onChangeFamille(c.dataset.famille)));
  attacherSelects(el, ctx.onChangeProfil);
  attacherChampsNombre(el, ctx.onChangeProfilLive);
  el.querySelector("#range-partCabinet").addEventListener("input", (e) => {
    document.getElementById("valeur-partCabinet").textContent = e.target.value;
    ctx.onChangeProfilLive("partCabinet", Number(e.target.value));
  });
  el.querySelectorAll("[data-recoit]").forEach((b) => b.addEventListener("click", () => ctx.onChangeProfil("recoitPublic", b.dataset.recoit === "true")));

  // Autocomplétion ville
  const inputVille = el.querySelector("#input-ville");
  const listeSugg = el.querySelector("#liste-suggestions-ville");
  const zoneActuelleObj = ZONES.find((z) => z.id === p.zoneId);
  if (p.villeLabel && zoneActuelleObj) {
    el.querySelector("#ville-confirmee").innerHTML = `<div style="font-size:12.5px; color:var(--couleur-primaire); background:var(--couleur-primaire-fond); border-radius:8px; padding:8px 12px; margin-top:10px;"><strong>${p.villeLabel}</strong> → zone associée : <strong>${zoneActuelleObj.label}</strong></div>`;
  }
  inputVille.addEventListener("input", () => {
    const suggestions = chercherCommunes(inputVille.value, 10);
    if (suggestions.length === 0) { listeSugg.style.display = "none"; return; }
    listeSugg.innerHTML = suggestions.map((c) => `<div class="suggestion" data-code="${c.code}"><span>${c.nom}</span><span class="texte-discret">(${c.dep})</span></div>`).join("");
    listeSugg.style.display = "block";
    listeSugg.querySelectorAll("[data-code]").forEach((s) => {
      s.addEventListener("mousedown", () => {
        const c = suggestions.find((x) => x.code === s.dataset.code);
        ctx.onChangeProfil("villeLabel", c.nom);
        ctx.onChangeProfil("zoneId", c.zoneId);
      });
    });
  });
  inputVille.addEventListener("blur", () => setTimeout(() => { listeSugg.style.display = "none"; }, 150));
}

// --- Étape 2 : Déplacements professionnels ----------------------------------
function renderStepDeplacements(el, { data, resultats, ctx }) {
  const d = data.deplacements;
  const det = resultats.detail;
  const optionsMode = (excludeAvion) => Object.entries(FE_TRANSPORT)
    .filter(([k]) => !excludeAvion || !k.startsWith("avion"))
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("");

  el.innerHTML = `
    <p class="texte-discret" style="margin-top:-8px; margin-bottom:20px;">Trajets domicile-travail, visites professionnelles (domicile client/patient, EHPAD, chantiers…) et déplacements pour congrès ou représentations.</p>
    <div style="display:flex; gap:18px; flex-wrap:wrap;">
      <div class="champ"><label class="libelle">Mode de transport principal domicile-travail</label><select class="champ-select" data-champ-select="modeDomTrav">${optionsMode(true)}</select></div>
      <div class="champ"><label class="libelle">Distance aller (km)</label>${champNombreHtml("kmAllerJour", d.kmAllerJour)}</div>
      <div class="champ"><label class="libelle">Jours travaillés / semaine</label>${champNombreHtml("joursSemaine", d.joursSemaine, { step: 0.5 })}</div>
      <div class="champ"><label class="libelle">Semaines travaillées / an${badgeLive(det.domTrav, "domTrav")}</label>${champNombreHtml("semainesAn", d.semainesAn, { max: 52 })}</div>
    </div>
    <hr class="separateur" />
    <div style="display:flex; gap:18px; flex-wrap:wrap;">
      <div class="champ"><label class="libelle">Km parcourus par an en visites professionnelles</label><div class="aide">Domicile de patients/clients, EHPAD, chantiers, rendez-vous extérieurs.</div>${champNombreHtml("kmVisitesAn", d.kmVisitesAn)}</div>
      <div class="champ"><label class="libelle">Mode de transport principal pour ces visites${badgeLive(det.visites, "visites")}</label><select class="champ-select" data-champ-select="modeVisites">${optionsMode(true)}</select></div>
    </div>
    <hr class="separateur" />
    <div style="display:flex; gap:18px; flex-wrap:wrap;">
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
function renderStepLocal(el, { data, famille, zone, resultats, ctx }) {
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
    ${l.aLocal ? `
      <div style="display:flex; gap:18px; flex-wrap:wrap;">
        <div class="champ"><label class="libelle">Surface du ${famille.lieuLabel} (m²)</label>${champNombreHtml("surface", l.surface)}</div>
        <div class="champ"><label class="libelle">Énergie principale de chauffage</label>
          <select class="champ-select" data-champ-select="energieChauffage">
            ${Object.entries(FE_ENERGIE).map(([k, v]) => `<option value="${k}" ${k === l.energieChauffage ? "selected" : ""}>${v.label}</option>`).join("")}
          </select>
        </div>
      </div>
      <p class="texte-discret" style="margin-top:-8px; margin-bottom:16px;">Par défaut, la consommation est estimée à partir de ratios ADEME adaptés à votre activité (Bâtiment - Chiffres clés). Vous pouvez saisir vos consommations réelles si vous les connaissez.</p>
      <div style="display:flex; gap:14px; margin-bottom:8px;">${badgeLive(det.localElec, "localElec")}${badgeLive(det.localChauffage, "localChauffage")}</div>

      <div class="champ"><label class="libelle"><input type="checkbox" data-champ-case="consoElecConnue" ${l.consoElecConnue ? "checked" : ""} style="margin-right:8px;" />Je connais ma consommation réelle d'électricité (factures)</label>
        ${l.consoElecConnue ? champNombreHtml("consoElecKwh", l.consoElecKwh, { suffix: "kWh/an" }) : ""}
      </div>
      <div class="champ"><label class="libelle"><input type="checkbox" data-champ-case="consoChauffageConnue" ${l.consoChauffageConnue ? "checked" : ""} style="margin-right:8px;" />Je connais ma consommation réelle de chauffage (factures)</label>
        ${l.consoChauffageConnue ? champNombreHtml("consoChauffageKwh", l.consoChauffageKwh, { suffix: "kWh/an" }) : ""}
      </div>
      <hr class="separateur" />
      <div class="champ"><label class="libelle"><input type="checkbox" data-champ-case="localDeporte" ${l.localDeporte ? "checked" : ""} style="margin-right:8px;" />Utilisez-vous un local déporté (ex : EHPAD, antenne secondaire) ?${badgeLive(det.localDeporte, "localDeporte")}</label>
        ${l.localDeporte ? champNombreHtml("surfaceDeportee", l.surfaceDeportee, { suffix: "m² approx." }) : ""}
      </div>
      ${p.recoitPublic ? `
        <div class="encadre-info">
          <div style="font-weight:600; font-size:13.5px;">Déplacements de votre ${famille.publicLabel} vers ${famille.lieuArticleLe}${badgeLive(det.patientele, "patientele")}</div>
          <div style="font-size:12px; color:#5C8A7A; margin-top:6px; line-height:1.5;">
            Calculés automatiquement à partir de la zone choisie à l'étape précédente (<strong>${zone.label}</strong>), selon la répartition modale de cette zone, ajustée au motif de déplacement le plus proche de votre activité (Enquête Mobilité des Personnes 2019, SDES) — zone géographique déterminée via le zonage INSEE en aires urbaines 2010.
            Base : ${Math.round(resultats.nbActesLieuFixe)} ${famille.acteLabel} réalisé(e)s ${famille.lieuArticleLe}, sur environ ${kmModalTotal(zone).toFixed(1)} km aller-retour par ${famille.uniteActe} en moyenne (tous modes confondus).
          </div>
        </div>` : ""}
    ` : ""}
  `;
  el.querySelectorAll("[data-alocal]").forEach((b) => b.addEventListener("click", () => ctx.onChangeLocal("aLocal", b.dataset.alocal === "true")));
  attacherSelects(el, ctx.onChangeLocal);
  attacherChampsNombre(el, ctx.onChangeLocalLive);
  attacherCases(el, ctx.onChangeLocal);
}

// --- Étape 4 : Numérique -------------------------------------------------------
function renderStepNumerique(el, { data, resultats, ctx }) {
  const n = data.numerique;
  const det = resultats.detail;
  el.innerHTML = `
    <div style="display:flex; gap:18px; flex-wrap:wrap;">
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
function renderStepMateriel(el, { data, famille, resultats, ctx }) {
  const inv = data.investissements;
  const det = resultats.detail;
  const estPharmacien = data.profil.metierId === "Pharmacien(ne) titulaire d'officine";
  const estSante = famille.id === "sante";
  // Filet de sécurité : ces deux sections ont été ajoutées après la mise en
  // production initiale ; un brouillon ou un état sauvegardé antérieur peut
  // ne pas les contenir. On retombe sur des valeurs neutres plutôt que de
  // laisser planter le rendu (voir aussi fusionnerAvecDefauts dans main.js,
  // qui couvre déjà le cas normal de reprise de brouillon).
  const presc = data.prescriptions || { active: false, depenseMedicaments: 0, depenseActes: 0 };
  data.pharmacien = data.pharmacien || { caMedicaments: 0, caParapharmacie: 0 };
  el.innerHTML = `
    <p class="texte-discret" style="margin-top:-8px; margin-bottom:20px;">Postes adaptés à votre famille de métier (<strong>${famille.label}</strong>). Une estimation en euros dépensés par an suffit.</p>
    ${famille.consommables.map((c) => `
      <div class="champ"><label class="libelle">${c.label}${badgeLive(det.materiel[c.id], `materiel_${c.id}`)}</label>${champNombreHtml(`materiel_${c.id}`, data.materiel[c.id] || 0, { suffix: "€ / an" })}</div>
    `).join("")}
    ${estPharmacien ? `
      <hr class="separateur" />
      <div class="groupe-champs-titre">Médicaments et parapharmacie vendus</div>
      <p class="texte-discret" style="margin-top:-6px; margin-bottom:16px;">Poste spécifique à l'officine : votre chiffre d'affaires HT, réparti entre médicaments et parapharmacie, chacun avec un facteur d'émission propre.</p>
      <div class="champ"><label class="libelle">Chiffre d'affaires médicaments (€ HT / an)${badgeLive(det.medicamentsVendus, "medicamentsVendus")}</label>${champNombreHtml("ca_medicaments", data.pharmacien.caMedicaments || 0, { suffix: "€ HT / an" })}</div>
      <div class="champ"><label class="libelle">Chiffre d'affaires parapharmacie (€ HT / an)${badgeLive(det.parapharmacie, "parapharmacie")}</label>${champNombreHtml("ca_parapharmacie", data.pharmacien.caParapharmacie || 0, { suffix: "€ HT / an" })}</div>
    ` : ""}
    ${estSante ? `
      <hr class="separateur" />
      <div class="groupe-champs-titre">Prescriptions</div>
      <div class="encadre-info">
        <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <input type="checkbox" data-champ-case="prescriptionActive" ${presc.active ? "checked" : ""} style="margin-top:3px;" />
          <span>
            <span style="font-weight:700; font-size:14px;">Je prescris des médicaments et/ou des actes médicaux (examens, dispositifs)</span>
            <div style="font-size:12px; color:#5C8A7A; margin-top:4px; line-height:1.5;">En tant que prescripteur, vous avez un levier de décarbonation propre (éco-prescription, déprescription). Ce poste est affiché séparément du reste du bilan, pour rester comparable avec les praticiens qui ne prescrivent pas.</div>
          </span>
        </label>
        ${presc.active ? `
          <div style="margin-top:18px;">
            <div class="champ"><label class="libelle">Dépense totale de médicaments prescrits, pour l'ensemble de la patientèle (€ / an)${badgeLive(det.prescriptionsMedicaments, "prescriptionsMedicaments")}</label>${champNombreHtml("presc_medicaments", presc.depenseMedicaments || 0, { suffix: "€ / an" })}</div>
            <div class="champ"><label class="libelle">Dépense totale d'actes prescrits — examens complémentaires, dispositifs (€ / an)${badgeLive(det.prescriptionsActes, "prescriptionsActes")}</label>${champNombreHtml("presc_actes", presc.depenseActes || 0, { suffix: "€ / an" })}</div>
            <p class="texte-discret" style="margin-top:-6px;">Une première approche à affiner : utilisez les montants que vous connaissez le mieux (ex. volume de prescriptions habituel), même approximatifs.</p>
          </div>` : ""}
      </div>
    ` : ""}
    <hr class="separateur" />
    <div class="encadre-info">
      <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
        <input type="checkbox" data-champ-case="actif" ${inv.actif ? "checked" : ""} style="margin-top:3px;" />
        <span>
          <span style="font-weight:700; font-size:14px;">J'ai fait des investissements en gros matériel (&gt; 60 kg) ou en mobilier il y a moins de 5 ans</span>
          <div style="font-size:12px; color:#5C8A7A; margin-top:4px; line-height:1.5;">Les équipements lourds et le mobilier professionnel sont comptabilisés au prorata de leur amortissement, par défaut sur 5 ans.</div>
        </span>
      </label>
      ${inv.actif ? `
        <div style="margin-top:18px;">
          <div style="font-weight:600; font-size:13.5px; margin-bottom:10px;">Gros matériel (valeur d'achat totale, en euros)</div>
          ${(famille.grosMateriel || []).map((g) => `
            <div class="champ"><label class="libelle">${g.label}${badgeLive(det.grosMateriel[g.id], `gros_${g.id}`)}</label>${champNombreHtml(`gros_${g.id}`, inv.gros[g.id] || 0, { suffix: "€ (valeur d'achat)" })}</div>
          `).join("")}
          <div style="font-weight:600; font-size:13.5px; margin-top:8px; margin-bottom:10px;">Mobilier professionnel (bureau, tables, chaises…)</div>
          <div class="champ"><label class="libelle">Valeur d'achat totale du mobilier récent${badgeLive(det.mobilier, "mobilier")}</label>${champNombreHtml("mobilier", inv.mobilier || 0, { suffix: "€ (valeur d'achat)" })}</div>
        </div>` : ""}
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

// --- Étape 6 : Alimentation --------------------------------------------------
function renderStepAlimentation(el, { data, resultats, ctx }) {
  const a = data.alimentation;
  el.innerHTML = `
    <div class="champ">
      <label class="libelle">Repas professionnels (déjeuners sur site ou au restaurant) par semaine : <span id="valeur-repas">${a.repasParSemaine}</span>${badgeLive(resultats.detail.alimentation, "alimentation")}</label>
      <input type="range" min="0" max="10" value="${a.repasParSemaine}" data-champ-range="repasParSemaine" id="range-repas" />
    </div>
    <div class="champ">
      <label class="libelle">Part de repas végétariens : <span id="valeur-vege">${a.partVegetarienne}</span>%</label>
      <input type="range" min="0" max="100" value="${a.partVegetarienne}" data-champ-range="partVegetarienne" id="range-vege" />
    </div>
  `;
  el.querySelector("#range-repas").addEventListener("input", (e) => { document.getElementById("valeur-repas").textContent = e.target.value; ctx.onChangeAlimentationLive("repasParSemaine", Number(e.target.value)); });
  el.querySelector("#range-vege").addEventListener("input", (e) => { document.getElementById("valeur-vege").textContent = e.target.value; ctx.onChangeAlimentationLive("partVegetarienne", Number(e.target.value)); });
}

// --- Étape 7 : Services ---------------------------------------------------------
function renderStepServices(el, { data, resultats, ctx }) {
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

// ============================================================================
// ÉCRAN RÉSULTATS
// ============================================================================
export function renderResultats(root, ctx) {
  const { famille, data, resultats, typeGraphique, actionsCalculees, afficherPlusActions, totalReductionPlan: reducPlan, typeCertificat, nomCabinet } = ctx;
  const topActions = actionsCalculees.slice(0, 5);
  const autresActions = actionsCalculees.slice(5);
  const objectif3ansKg = resultats.totalKg * 0.85;
  const pctReducPlan = resultats.totalKg > 0 ? (reducPlan / resultats.totalKg) * 100 : 0;
  const aDesPrescriptions = data.prescriptions.active && resultats.parPoste.prescriptions > 0;

  const donneesGraphique = Object.entries(resultats.parPoste)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: CATEGORIES_META[k].label, value: Math.round(v), color: CATEGORIES_META[k].color }))
    .sort((a, b) => b.value - a.value);

  root.innerHTML = `
    <div class="conteneur">
      <div class="entete-app">
        <img src="assets/logo/logo-libco2.png" alt="Lib&CO2" />
        <button class="lien-retour" id="btn-retour">‹ Revenir au questionnaire</button>
      </div>

      <div class="carte carte-hero">
        <div class="eyebrow">${famille.label}</div>
        <div class="ligne-hero">
          <div><div class="chiffre-hero titre-serif">${resultats.totalT.toFixed(2)} <small>tCO2e / an</small></div><div class="sous-legende">Empreinte annuelle de l'ensemble de ${famille.lieuArticleLe}</div></div>
          <div><div class="chiffre-hero titre-serif" style="color:var(--couleur-accent-ambre);">${resultats.parActe.toFixed(1)} <small>kgCO2e</small></div><div class="sous-legende">par ${famille.uniteActe}</div></div>
        </div>
        ${aDesPrescriptions ? `
          <div style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.15); font-size:12.5px; line-height:1.5; opacity:0.9;">
            Dont <strong>${resultats.totalT - resultats.totalTHorsPrescriptions > 0 ? (resultats.parPoste.prescriptions/1000).toFixed(2) : "0.00"} tCO2e/an</strong> lié·es aux prescriptions (médicaments, examens, dispositifs).
            Empreinte <strong>hors prescriptions : ${resultats.totalTHorsPrescriptions.toFixed(2)} tCO2e/an</strong> — c'est ce chiffre qui reste comparable à un praticien qui ne prescrit pas.
          </div>` : ""}
      </div>

      <div class="carte carte-graphique">
        <div class="entete-graphique">
          <div style="font-weight:700; font-size:14.5px;">Répartition par poste d'émission</div>
          <div class="toggle-graphique">
            <button data-type-graph="pie" class="${typeGraphique === "pie" ? "actif" : ""}">◔</button>
            <button data-type-graph="bar" class="${typeGraphique === "bar" ? "actif" : ""}">▤</button>
          </div>
        </div>
        <div class="zone-canvas-repartition"><canvas id="canvas-repartition"></canvas></div>
        <div class="legende-graphique">
          ${donneesGraphique.map((d) => `<div class="legende-item"><span class="pastille" style="background:${d.color}"></span><span class="libelle-poste">${d.label}</span><span class="valeur-poste">${fmt(d.value)} kg</span></div>`).join("")}
        </div>
        <div style="text-align:center; margin-top:10px;"><button class="bouton-reperes" id="btn-reperes">❓ Quelques repères</button></div>
      </div>

      <div class="zone-jauge-sticky" id="zone-jauge"></div>

      <div class="carte">
        <div style="font-weight:700; font-size:15px;">Pistes de décarbonation priorisées</div>
        <div class="texte-discret" style="margin-bottom:6px;">Top 5 des actions les plus efficaces (impact x coût). Cochez celles que vous envisagez — la jauge ci-dessus se met à jour en direct.</div>
        ${reducPlan > 0 ? `<div class="bandeau-plan">Avec les actions cochées, votre plan d'action représente environ <span class="texte-mono">-${fmt(reducPlan)} kgCO2e/an</span> (-${pctReducPlan.toFixed(0)}% de votre empreinte).</div>` : ""}
        <div id="liste-actions-top"></div>
        ${autresActions.length > 0 ? `
          <button class="bouton-voir-plus" id="btn-plus-actions">${afficherPlusActions ? "Masquer les autres actions ▲" : `Voir ${autresActions.length} autres actions moins impactantes ▼`}</button>
          <div id="liste-actions-autres" style="${afficherPlusActions ? "" : "display:none;"}"></div>` : ""}
      </div>

      <div class="carte">
        <div style="font-weight:700; font-size:14px; margin-bottom:6px;">Simuler un objectif par ${famille.uniteActe}</div>
        <div class="texte-discret" style="margin-bottom:10px;">Indiquez le niveau visé : la réduction totale nécessaire est calculée automatiquement.</div>
        ${champNombreHtml("objectifSeance", 0, { step: 0.1, suffix: `kgCO2e / ${famille.uniteActe} visé` })}
        <div id="resultat-simulateur" style="margin-top:12px; font-size:13px; line-height:1.55;"></div>
      </div>

      <div class="carte zone-certificat">
        <div style="font-weight:700; font-size:14.5px; margin-bottom:4px;">Exporter mon certificat</div>
        <div class="texte-discret" style="margin-bottom:12px;">Une image à partager ou à afficher, résumant votre estimation.</div>
        <input type="text" id="input-nom-cabinet" placeholder="Nom de ${famille.lieuArticleMon} (facultatif)" value="${nomCabinet || ""}" />
        <button class="bouton bouton-ambre" id="btn-export-certificat">⬇ Télécharger le certificat (PNG)</button>
        <div class="statut-certificat ${typeCertificat === "ok" ? "ok" : typeCertificat === "erreur" ? "erreur" : ""}">
          ${typeCertificat === "loading" ? "Génération en cours…" : typeCertificat === "erreur" ? "La génération a échoué — réessayez." : typeCertificat === "ok" ? "Certificat téléchargé ✓" : ""}
        </div>
        <canvas id="canvas-certificat" width="640" height="560" style="display:none;"></canvas>
      </div>

      <div class="carte" style="text-align:center;">
        <div style="font-weight:700; font-size:14.5px; margin-bottom:6px;">Suivre l'évolution de mon cabinet</div>
        <div class="texte-discret" style="margin-bottom:14px;">Enregistrez ce bilan pour le retrouver plus tard et suivre son évolution dans le temps.</div>
        <button class="bouton bouton-primaire" id="btn-enregistrer-bilan" style="margin-right:10px;">Enregistrer ce bilan</button>
        <button class="bouton bouton-secondaire" id="btn-voir-historique">Voir mon historique</button>
      </div>

      <div class="carte" style="text-align:center; background:var(--couleur-primaire-fond); border-style:dashed;">
        <div style="font-weight:700; font-size:14.5px; margin-bottom:6px;">🌍 Aller plus loin que le carbone</div>
        <div class="texte-discret" style="margin-bottom:14px;">Le carbone n'est qu'une des dimensions de l'impact environnemental d'une activité. Découvrez les autres enjeux à connaître (eau, ressources, biodiversité...).</div>
        <a href="les-autres-enjeux.html" class="bouton bouton-secondaire">Voir les autres enjeux ›</a>
      </div>

      <div style="text-align:center; margin-top:16px;"><button class="bouton-lien" id="btn-recommencer">↺ Recommencer une estimation</button></div>

      <p class="mentions">Version bêta-test — Ordres de grandeur indicatifs, non contractuels. Facteurs d'émission : ADEME Base Empreinte (dernière version disponible), méthodologie inspirée du rapport kinéCO2 (Lib&CO2, Carbone 4). Déplacements de la patientèle/clientèle : Enquête Mobilité des Personnes 2019 (SDES), report modal par zone (zonage INSEE en aires urbaines 2010) ajusté selon le motif de déplacement propre à chaque famille de métier. Référentiels : GHG Protocol, BEGES v5.</p>
      <p class="mentions"><a href="mentions-legales.html" style="color:inherit;">Mentions légales</a> · <a href="https://github.com/romarickine/libco2cab" target="_blank" rel="noopener" style="color:inherit;">Code source</a></p>
    </div>
    <div id="zone-modale"></div>
  `;

  // Le rendu graphique est en Canvas natif (pas de dépendance réseau), mais
  // on protège quand même le reste de l'écran en cas d'erreur inattendue.
  try {
    dessinerGraphiqueRepartition(document.getElementById("canvas-repartition"), donneesGraphique, typeGraphique);
  } catch (e) {
    console.error("Lib&CO2 — graphique de répartition indisponible :", e);
    document.querySelector(".zone-canvas-repartition").innerHTML = `<p class="texte-discret" style="padding-top:20px;">Graphique indisponible.</p>`;
  }
  // Jauge
  dessinerJaugeEngagement(document.getElementById("zone-jauge"), pctReducPlan, resultats.totalT, objectif3ansKg / 1000);
  // Listes d'actions
  document.getElementById("liste-actions-top").innerHTML = topActions.map((a, i) => ligneActionHtml(a, i + 1)).join("");
  const zoneAutres = document.getElementById("liste-actions-autres");
  if (zoneAutres) zoneAutres.innerHTML = autresActions.map((a, i) => ligneActionHtml(a, 6 + i)).join("");
  attacherEcouteursActions(root, ctx);

  // Écouteurs généraux
  document.getElementById("btn-retour").addEventListener("click", ctx.onBack);
  document.getElementById("btn-recommencer").addEventListener("click", ctx.onRestart);
  document.getElementById("btn-reperes").addEventListener("click", () => afficherModaleReperes(document.getElementById("zone-modale")));
  document.querySelectorAll("[data-type-graph]").forEach((b) => b.addEventListener("click", () => ctx.onChangeTypeGraphique(b.dataset.typeGraph)));
  if (zoneAutres) document.getElementById("btn-plus-actions").addEventListener("click", ctx.onToggleAfficherPlus);
  document.getElementById("input-nom-cabinet").addEventListener("input", (e) => ctx.onChangeNomCabinet(e.target.value));
  document.getElementById("btn-export-certificat").addEventListener("click", () => ctx.onExporterCertificat());
  document.getElementById("btn-enregistrer-bilan").addEventListener("click", ctx.onEnregistrerBilan);
  document.getElementById("btn-voir-historique").addEventListener("click", ctx.onVoirHistorique);

  // Simulateur d'objectif
  const inputObjectif = document.querySelector('[data-champ-nombre="objectifSeance"]');
  const zoneResultatSim = document.getElementById("resultat-simulateur");
  const majSimulateur = () => {
    const objectif = inputObjectif.value === "" ? 0 : Number(inputObjectif.value);
    if (objectif <= 0) { zoneResultatSim.innerHTML = ""; return; }
    const deltaKgParActe = resultats.parActe - objectif;
    if (deltaKgParActe <= 0) { zoneResultatSim.innerHTML = "Bonne nouvelle : votre empreinte actuelle est déjà inférieure ou égale à cet objectif."; return; }
    const reductionKg = deltaKgParActe * (resultats.totalKg / resultats.parActe);
    const reductionPct = (reductionKg / resultats.totalKg) * 100;
    let texte = `Pour atteindre <strong>${objectif} kgCO2e/${famille.uniteActe}</strong>, réduire d'environ <span class="texte-mono" style="color:var(--couleur-primaire); font-weight:700;">${fmt(reductionKg)} kgCO2e/an</span> (-${reductionPct.toFixed(0)}%).`;
    if (reducPlan > 0) texte += ` Le plan coché couvre ${Math.min(100, (reducPlan / reductionKg) * 100).toFixed(0)}% de cet objectif.`;
    zoneResultatSim.innerHTML = texte;
  };
  inputObjectif.addEventListener("focus", () => inputObjectif.select());
  inputObjectif.addEventListener("input", majSimulateur);
}

// Transforme une URL en clair présente dans un texte de source en lien
// cliquable (ouverture dans un nouvel onglet) — utilisé pour les actions
// qui renvoient vers un outil externe (ex. générateur de carte isochrone).
function lienifier(texte) {
  return texte.replace(/(https?:\/\/[^\s)]+|(?<=\()[a-z0-9.-]+\.[a-z]{2,}\/[a-z0-9/-]+(?=\)))/gi, (url) => {
    const href = url.startsWith("http") ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener">${url}</a>`;
  });
}

function ligneActionHtml(a, rang) {
  return `
    <div class="ligne-action">
      <div class="ligne-action-contenu">
        <input type="checkbox" data-toggle-action="${a.id}" data-default-pct="${a.defaultPct || 0}" ${a.checked ? "checked" : ""} style="margin-top:4px; flex-shrink:0;" />
        <div class="ligne-action-rang">${rang}</div>
        <div class="ligne-action-corps">
          <div class="titre">${a.titre}</div>
          <div class="meta">${CATEGORIES_META[a.poste].label} · ${a.coutKg}</div>
          <div class="source">Source : ${lienifier(a.source)}</div>
          ${a.checked && a.unit === "degres" ? `
            <div class="stepper-degres">
              <div style="font-size:12px; font-weight:600;">Variation de consigne :</div>
              <button data-degres-moins="${a.id}">−</button>
              <span class="texte-mono" style="font-weight:700;">${a.degres} °C</span>
              <button data-degres-plus="${a.id}">+</button>
            </div>` : ""}
          ${a.checked && a.hasPct ? `
            <div class="curseur-action">
              <div class="label-curseur">Déployé sur ${a.pct}% de ce poste</div>
              <input type="range" min="5" max="100" step="5" value="${a.pct}" data-pct-action="${a.id}" />
            </div>` : ""}
        </div>
        <div class="ligne-action-resultat">
          <div class="kg">-${fmt(a.potentielKg)} kg</div>
          <div class="badge-cout ${a.cost}">${a.cost === "gratuit" ? "Gratuit" : a.cost === "faible" ? "Faible coût" : "Investissement"}</div>
        </div>
      </div>
    </div>
  `;
}

function attacherEcouteursActions(root, ctx) {
  root.querySelectorAll("[data-toggle-action]").forEach((c) => {
    c.addEventListener("change", () => ctx.onToggleAction(c.dataset.toggleAction, Number(c.dataset.defaultPct)));
  });
  root.querySelectorAll("[data-pct-action]").forEach((r) => {
    r.addEventListener("input", () => ctx.onSetActionPct(r.dataset.pctAction, Number(r.value)));
  });
  root.querySelectorAll("[data-degres-moins]").forEach((b) => {
    b.addEventListener("click", () => {
      const action = ctx.actionsCalculees.find((a) => a.id === b.dataset.degresMoins);
      ctx.onSetActionDegres(b.dataset.degresMoins, Math.max(1, (action ? action.degres : 1) - 1));
    });
  });
  root.querySelectorAll("[data-degres-plus]").forEach((b) => {
    b.addEventListener("click", () => {
      const action = ctx.actionsCalculees.find((a) => a.id === b.dataset.degresPlus);
      ctx.onSetActionDegres(b.dataset.degresPlus, Math.min(5, (action ? action.degres : 1) + 1));
    });
  });
}

const REPERES = [
  { label: "1 aller-retour Paris–New York en avion", kg: 1750 },
  { label: "1 an de chauffage au gaz d'un studio (25 m²)", kg: 950 },
  { label: "10 000 km parcourus en voiture thermique", kg: 2180 },
];
function afficherModaleReperes(zoneModale) {
  zoneModale.innerHTML = `
    <div class="fond-modale" id="fond-modale">
      <div class="carte contenu-modale">
        <button class="fermer-modale" id="fermer-modale">✕</button>
        <div class="titre-modale">❓ Pour se donner des repères</div>
        ${REPERES.map((r) => `<div class="ligne-repere"><span>${r.label}</span><span class="texte-mono texte-discret">≈ ${r.kg} kgCO2e</span></div>`).join("")}
      </div>
    </div>
  `;
  const fermer = () => { zoneModale.innerHTML = ""; };
  document.getElementById("fond-modale").addEventListener("click", fermer);
  document.querySelector(".contenu-modale").addEventListener("click", (e) => e.stopPropagation());
  document.getElementById("fermer-modale").addEventListener("click", fermer);
}

// ============================================================================
// ÉCRAN HISTORIQUE / ÉVOLUTION
// ============================================================================
export function renderHistorique(root, { bilans, onSupprimer, onBack, onNouveauBilan }) {
  root.innerHTML = `
    <div class="conteneur">
      <div class="entete-app">
        <img src="assets/logo/logo-libco2.png" alt="Lib&CO2" />
        <button class="lien-retour" id="btn-retour-hist">‹ Retour aux résultats</button>
      </div>
      <h2 class="titre-serif" style="font-size:28px; margin: 4px 0 20px;">Évolution de mon cabinet dans le temps</h2>
      ${bilans.length === 0 ? `<div class="carte"><p class="texte-discret">Aucun bilan enregistré pour l'instant. Depuis l'écran de résultats, cliquez sur "Enregistrer ce bilan" pour commencer un suivi dans le temps.</p></div>` : `
        <div class="carte">
          <div style="font-weight:700; font-size:14.5px; margin-bottom:10px;">Empreinte totale (tCO2e/an), poste par poste</div>
          ${bilans.length >= 2 ? `<div class="zone-canvas-evolution"><canvas id="canvas-evolution"></canvas></div>` : `<p class="texte-discret">Enregistrez au moins 2 bilans pour voir apparaître un graphique d'évolution.</p>`}
        </div>
        <div class="carte" id="zone-tableau-evolution"></div>
      `}
      <div style="text-align:center; margin-top:16px;"><button class="bouton bouton-primaire" id="btn-nouveau-bilan">Faire un nouveau bilan</button></div>
    </div>
  `;
  document.getElementById("btn-retour-hist").addEventListener("click", onBack);
  document.getElementById("btn-nouveau-bilan").addEventListener("click", onNouveauBilan);

  if (bilans.length > 0) {
    document.getElementById("zone-tableau-evolution").appendChild(construireTableauEvolution(bilans));
    root.querySelectorAll("[data-supprimer-bilan]").forEach((b) => {
      b.addEventListener("click", () => onSupprimer(b.dataset.supprimerBilan));
    });
    if (bilans.length >= 2) {
      try {
        afficherGraphiqueEvolution(bilans, document.getElementById("canvas-evolution"));
      } catch (e) {
        console.error("Lib&CO2 — graphique d'évolution indisponible :", e);
        document.querySelector(".zone-canvas-evolution").innerHTML = `<p class="texte-discret">Graphique indisponible.</p>`;
      }
    }
  }
}
