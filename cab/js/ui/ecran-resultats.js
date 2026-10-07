/**
 * ui/ecran-resultats.js — écran des résultats
 * ---------------------------------------------------------------------------
 * Empreinte annuelle et par acte, graphique de répartition, jauge
 * d'engagement, plan d'action priorisé (cases à cocher, curseurs),
 * simulateur d'objectif, certificat, repères pédagogiques.
 *
 * Utilisé par : main.js via ui.js (renderResultats).
 * (Découpé de ui.js en septembre 2026 : un fichier par responsabilité.)
 */
import { CATEGORIES_META, COST_LABELS } from "../../../shared/js/data/facteurs-emission.js";
import { champNombreHtml, fmt, lienifier } from "./commun.js";
import { dessinerGraphiqueRepartition, dessinerJaugeEngagement } from "../graphiques.js";
import { echapperHtml } from "../../../shared/js/echappement.js";

// ============================================================================
// ÉCRAN RÉSULTATS
// ============================================================================
export function renderResultats(root, ctx) {
  const {
    famille,
    data,
    resultats,
    typeGraphique,
    inclurePrescriptions,
    actionsCalculees,
    afficherPlusActions,
    totalReductionPlan: reducPlan,
    typeCertificat,
    nomCabinet,
  } = ctx;
  const topActions = actionsCalculees.slice(0, 5);
  const autresActions = actionsCalculees.slice(5);
  const objectif3ansKg = resultats.totalKg * 0.85;
  const pctReducPlan = resultats.totalKg > 0 ? (reducPlan / resultats.totalKg) * 100 : 0;
  const aDesPrescriptions = data.prescriptions.active && resultats.parPoste.prescriptions > 0;
  // "kgCO2e / acte" affiché en tête : hors prescriptions par défaut, pour
  // rester comparable à un praticien qui ne prescrit pas — c'était tout le
  // sens de la séparation de ce poste. L'utilisateur peut choisir d'inclure
  // les prescriptions via la case à cocher ci-dessous ; ce choix est aussi
  // répercuté sur le simulateur d'objectif et le certificat exportable,
  // pour rester cohérent partout où ce chiffre apparaît.
  const parActeAffiche =
    !aDesPrescriptions || inclurePrescriptions
      ? resultats.parActe
      : data.profil.nbActesAn > 0
        ? resultats.totalKgHorsPrescriptions / data.profil.nbActesAn
        : 0;
  const totalKgAffiche =
    !aDesPrescriptions || inclurePrescriptions ? resultats.totalKg : resultats.totalKgHorsPrescriptions;

  const donneesGraphique = Object.entries(resultats.parPoste)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: CATEGORIES_META[k].label, value: Math.round(v), color: CATEGORIES_META[k].color }))
    .sort((a, b) => b.value - a.value);

  root.innerHTML = `
    <div class="conteneur">
      <div class="entete-app">
        <a href="../index.html" title="Retour à Lib&CO2"><img src="../shared/assets/logo/logo-libco2.png" alt="Lib&CO2" /></a>
        <button class="lien-retour" id="btn-retour">‹ Revenir au questionnaire</button>
      </div>

      <div class="carte carte-hero">
        <div class="eyebrow">${famille.label}</div>
        <div class="ligne-hero">
          <div><div class="chiffre-hero titre-serif">${resultats.totalT.toFixed(2)} <small>tCO2e / an</small></div><div class="sous-legende">Empreinte annuelle de l'ensemble de ${famille.lieuArticleLe}</div></div>
          <div><div class="chiffre-hero titre-serif" data-style="color:var(--couleur-accent-ambre);">${parActeAffiche.toFixed(1)} <small>kgCO2e</small></div><div class="sous-legende">par ${famille.uniteActe}${aDesPrescriptions ? (inclurePrescriptions ? " (avec prescriptions)" : " (hors prescriptions)") : ""}</div></div>
        </div>
        ${
          aDesPrescriptions
            ? `
          <div data-style="margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.15); font-size:12.5px; line-height:1.5; opacity:0.9;">
            Dont <strong>${resultats.totalT - resultats.totalTHorsPrescriptions > 0 ? (resultats.parPoste.prescriptions / 1000).toFixed(2) : "0.00"} tCO2e/an</strong> lié·es aux prescriptions (médicaments, examens, dispositifs).
            Empreinte <strong>hors prescriptions : ${resultats.totalTHorsPrescriptions.toFixed(2)} tCO2e/an</strong> — c'est ce chiffre qui reste comparable à un praticien qui ne prescrit pas.
            <label data-style="display:flex; align-items:center; gap:8px; margin-top:10px; cursor:pointer; font-size:12.5px;">
              <input type="checkbox" id="chk-inclure-prescriptions" ${inclurePrescriptions ? "checked" : ""} />
              Inclure les prescriptions dans le "kgCO2e par ${famille.uniteActe}" affiché ci-dessus
            </label>
          </div>`
            : ""
        }
      </div>

      <div class="carte carte-graphique">
        <div class="entete-graphique">
          <div data-style="font-weight:700; font-size:14.5px;">Répartition par poste d'émission</div>
          <div class="toggle-graphique">
            <button data-type-graph="pie" class="${typeGraphique === "pie" ? "actif" : ""}">◔</button>
            <button data-type-graph="bar" class="${typeGraphique === "bar" ? "actif" : ""}">▤</button>
          </div>
        </div>
        <div class="zone-canvas-repartition"><canvas id="canvas-repartition"></canvas></div>
        <div class="legende-graphique">
          ${donneesGraphique.map((d) => `<div class="legende-item"><span class="pastille" data-style="background:${d.color}"></span><span class="libelle-poste">${d.label}</span><span class="valeur-poste">${fmt(d.value)} kg</span></div>`).join("")}
        </div>
        <div data-style="text-align:center; margin-top:10px;"><button class="bouton-reperes" id="btn-reperes">❓ Quelques repères</button></div>
      </div>

      <div class="zone-jauge-sticky" id="zone-jauge"></div>

      <div class="carte">
        <div data-style="font-weight:700; font-size:15px;">Pistes de décarbonation priorisées</div>
        <div class="texte-discret" data-style="margin-bottom:6px;">Top 5 des actions les plus efficaces (impact x coût). Cochez celles que vous envisagez — la jauge ci-dessus se met à jour en direct.</div>
        ${reducPlan > 0 ? `<div class="bandeau-plan">Avec les actions cochées, votre plan d'action représente environ <span class="texte-mono">-${fmt(reducPlan)} kgCO2e/an</span> (-${pctReducPlan.toFixed(0)}% de votre empreinte).</div>` : ""}
        <div id="liste-actions-top"></div>
        ${
          autresActions.length > 0
            ? `
          <button class="bouton-voir-plus" id="btn-plus-actions">${afficherPlusActions ? "Masquer les autres actions ▲" : `Voir ${autresActions.length} autres actions moins impactantes ▼`}</button>
          <div id="liste-actions-autres" data-style="${afficherPlusActions ? "" : "display:none;"}"></div>`
            : ""
        }
      </div>

      <div class="carte">
        <div data-style="font-weight:700; font-size:14px; margin-bottom:6px;">Simuler un objectif par ${famille.uniteActe}</div>
        <div class="texte-discret" data-style="margin-bottom:10px;">Indiquez le niveau visé : la réduction totale nécessaire est calculée automatiquement.</div>
        ${champNombreHtml("objectifSeance", 0, { step: 0.1, suffix: `kgCO2e / ${famille.uniteActe} visé`, libelle: `Objectif en kgCO2e par ${famille.uniteActe}` })}
        <div id="resultat-simulateur" data-style="margin-top:12px; font-size:13px; line-height:1.55;"></div>
      </div>

      <div class="carte zone-certificat">
        <div data-style="font-weight:700; font-size:14.5px; margin-bottom:4px;">Exporter mon certificat</div>
        <div class="texte-discret" data-style="margin-bottom:12px;">Une image à partager ou à afficher, résumant votre estimation.</div>
        <input type="text" id="input-nom-cabinet" aria-label="Nom affiché sur le certificat (facultatif)" placeholder="Nom de ${famille.lieuArticleMon} (facultatif)" value="${echapperHtml(nomCabinet)}" />
        <button class="bouton bouton-ambre" id="btn-export-certificat">⬇ Télécharger le certificat (PNG)</button>
        <div class="statut-certificat ${typeCertificat === "ok" ? "ok" : typeCertificat === "erreur" ? "erreur" : ""}">
          ${typeCertificat === "loading" ? "Génération en cours…" : typeCertificat === "erreur" ? "La génération a échoué — réessayez." : typeCertificat === "ok" ? "Certificat téléchargé ✓" : ""}
        </div>
        <canvas id="canvas-certificat" width="640" height="560" data-style="display:none;"></canvas>
      </div>

      <div class="carte" data-style="text-align:center;">
        <div data-style="font-weight:700; font-size:14.5px; margin-bottom:6px;">Suivre l'évolution de mon cabinet</div>
        <div class="texte-discret" data-style="margin-bottom:14px;">Enregistrez ce bilan pour le retrouver plus tard et suivre son évolution dans le temps.</div>
        <button class="bouton bouton-primaire" id="btn-enregistrer-bilan" data-style="margin-right:10px;">Enregistrer ce bilan</button>
        <button class="bouton bouton-secondaire" id="btn-voir-historique">Voir mon historique</button>
      </div>

      <div class="carte" data-style="text-align:center; background:var(--couleur-primaire-fond); border-style:dashed;">
        <div data-style="font-weight:700; font-size:14.5px; margin-bottom:6px;">🌍 Aller plus loin que le carbone</div>
        <div class="texte-discret" data-style="margin-bottom:14px;">Le carbone n'est qu'une des dimensions de l'impact environnemental d'une activité. Découvrez les autres enjeux à connaître (eau, ressources, biodiversité...).</div>
        <a href="les-autres-enjeux.html" class="bouton bouton-secondaire">Voir les autres enjeux ›</a>
      </div>

      <div data-style="text-align:center; margin-top:16px;"><button class="bouton-lien" id="btn-recommencer">↺ Recommencer une estimation</button></div>

      <p class="mentions">Version bêta-test — Ordres de grandeur indicatifs, non contractuels. Facteurs d'émission : ADEME Base Carbone® V23.6 et études publiées, détaillés sur la page <a href="methodologie.html">Méthodologie et facteurs d'émission</a> ; méthodologie inspirée du rapport kinéCO2 (Lib&CO2, Carbone 4). Déplacements de la patientèle/clientèle : Enquête Mobilité des Personnes 2019 (SDES), report modal par zone (zonage INSEE en aires urbaines 2010) ajusté selon le motif de déplacement propre à chaque famille de métier. Référentiels : GHG Protocol, BEGES v5.</p>
      <p class="mentions"><a href="../mentions-legales.html" data-style="color:inherit;">Mentions légales</a> · <a href="https://github.com/romarickine/libco2cab" target="_blank" rel="noopener" data-style="color:inherit;">Code source</a></p>
    </div>
    <div id="zone-modale"></div>
  `;

  // Le rendu graphique est en Canvas natif (pas de dépendance réseau), mais
  // on protège quand même le reste de l'écran en cas d'erreur inattendue.
  try {
    dessinerGraphiqueRepartition(document.getElementById("canvas-repartition"), donneesGraphique, typeGraphique);
  } catch (e) {
    console.error("Lib&CO2 — graphique de répartition indisponible :", e);
    document.querySelector(".zone-canvas-repartition").innerHTML =
      `<p class="texte-discret" data-style="padding-top:20px;">Graphique indisponible.</p>`;
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
  const chkPrescriptions = document.getElementById("chk-inclure-prescriptions");
  if (chkPrescriptions) chkPrescriptions.addEventListener("change", ctx.onToggleInclurePrescriptions);
  document.getElementById("btn-recommencer").addEventListener("click", ctx.onRestart);
  document
    .getElementById("btn-reperes")
    .addEventListener("click", () => afficherModaleReperes(document.getElementById("zone-modale")));
  document
    .querySelectorAll("[data-type-graph]")
    .forEach((b) => b.addEventListener("click", () => ctx.onChangeTypeGraphique(b.dataset.typeGraph)));
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
    if (objectif <= 0) {
      zoneResultatSim.innerHTML = "";
      return;
    }
    const deltaKgParActe = parActeAffiche - objectif;
    if (deltaKgParActe <= 0) {
      zoneResultatSim.innerHTML =
        "Bonne nouvelle : votre empreinte actuelle est déjà inférieure ou égale à cet objectif.";
      return;
    }
    const reductionKg = deltaKgParActe * (totalKgAffiche / parActeAffiche);
    const reductionPct = (reductionKg / totalKgAffiche) * 100;
    let texte = `Pour atteindre <strong>${objectif} kgCO2e/${famille.uniteActe}</strong>, réduire d'environ <span class="texte-mono" data-style="color:var(--couleur-primaire); font-weight:700;">${fmt(reductionKg)} kgCO2e/an</span> (-${reductionPct.toFixed(0)}%).`;
    if (reducPlan > 0)
      texte += ` Le plan coché couvre ${Math.min(100, (reducPlan / reductionKg) * 100).toFixed(0)}% de cet objectif.`;
    zoneResultatSim.innerHTML = texte;
  };
  inputObjectif.addEventListener("focus", () => inputObjectif.select());
  inputObjectif.addEventListener("input", majSimulateur);
}

function ligneActionHtml(a, rang) {
  return `
    <div class="ligne-action">
      <div class="ligne-action-contenu">
        <input type="checkbox" aria-label="Retenir l'action : ${echapperHtml(a.titre)}" data-toggle-action="${a.id}" data-default-pct="${a.defaultPct || 0}" ${a.checked ? "checked" : ""} data-style="margin-top:4px; flex-shrink:0;" />
        <div class="ligne-action-rang">${rang}</div>
        <div class="ligne-action-corps">
          <div class="titre">${a.titre}</div>
          <div class="meta">${CATEGORIES_META[a.poste].label} · coût net : ${a.coutKg}</div>
          <div class="source">Source : ${lienifier(a.source)}</div>
          ${
            a.checked && a.unit === "degres"
              ? `
            <div class="stepper-degres">
              <div data-style="font-size:12px; font-weight:600;">Variation de consigne :</div>
              <button data-degres-moins="${a.id}">−</button>
              <span class="texte-mono" data-style="font-weight:700;">${a.degres} °C</span>
              <button data-degres-plus="${a.id}">+</button>
            </div>`
              : ""
          }
          ${
            a.checked && a.hasPct
              ? `
            <div class="curseur-action">
              <div class="label-curseur">Déployé sur ${a.pct}% de ce poste</div>
              <input type="range" min="5" max="100" step="5" value="${a.pct}" data-pct-action="${a.id}" />
            </div>`
              : ""
          }
        </div>
        <div class="ligne-action-resultat">
          <div class="kg">-${fmt(a.potentielKg)} kg</div>
          <div class="badge-cout ${a.cost}">${COST_LABELS[a.cost]}</div>
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
  const fermer = () => {
    zoneModale.innerHTML = "";
  };
  document.getElementById("fond-modale").addEventListener("click", fermer);
  document.querySelector(".contenu-modale").addEventListener("click", (e) => e.stopPropagation());
  document.getElementById("fermer-modale").addEventListener("click", fermer);
}
