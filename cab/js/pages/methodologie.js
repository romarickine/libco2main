// Script de la page methodologie.html : génère les tableaux de facteurs à
// partir des fichiers de données de l'outil (aucune valeur recopiée), pour
// que la page affiche toujours exactement ce que le calcul utilise.
import {
  FE_TRANSPORT,
  FE_ENERGIE,
  FACTEURS_NUMERIQUE_FABRICATION,
  FE_DECHETS,
  FE_DASRI,
  AUTRES_FACTEURS,
  ACTIONS,
  COST_LABELS,
  VALEUR_ACTION_CLIMAT_EUR_KG,
} from "../../../shared/js/data/facteurs-emission.js";
import {
  FACTEURS_VEHICULES_USAGE_FABRICATION,
  FACTEUR_BATIMENT_SANTE,
  FACTEURS_MOBILIER_UNITE,
  ACTIONS_MSP_SUPPLEMENTAIRES,
} from "../../../msp/js/data/facteurs-emission-msp.js";
import { echapperHtml } from "../../../shared/js/echappement.js";

const nombre = (v) =>
  typeof v === "number"
    ? v.toLocaleString("fr-FR", v !== 0 && Math.abs(v) < 1 ? { maximumSignificantDigits: 4 } : { maximumFractionDigits: 2 })
    : echapperHtml(String(v));

/** Retire les balises HTML (une source contient un lien) avant échappement. */
const texte = (s) => echapperHtml(String(s ?? "").replace(/<[^>]*>/g, ""));

function statutDe(source) {
  const s = String(source || "");
  if (/^ESTIMÉ/.test(s)) return { cle: "estime", libelle: "ESTIMÉ" };
  if (/^SOURCÉ \(/.test(s)) return { cle: "partiel", libelle: s.slice(0, s.indexOf(")") + 1) };
  if (/^SOURCÉ/.test(s)) return { cle: "source", libelle: "SOURCÉ" };
  return { cle: "estime", libelle: "—" };
}

function sansStatut(source) {
  return String(source || "").replace(/^(SOURCÉ|ESTIMÉ)( \([^)]*\))?(, calcul (exact|explicite))?\s*—\s*/, "");
}

const compteur = { source: 0, partiel: 0, estime: 0 };

function tableau(titre, lignes, colonnes = ["Poste", "Valeur", "Unité", "Statut et source"]) {
  const corps = lignes
    .map((l) => {
      const st = statutDe(l.source);
      compteur[st.cle]++;
      return `<tr>
        <th scope="row">${texte(l.label)}</th>
        <td class="num">${nombre(l.valeur)}</td>
        <td>${texte(l.unite)}</td>
        <td><span class="badge-statut statut-${st.cle}">${texte(st.libelle)}</span> ${texte(sansStatut(l.source))}</td>
      </tr>`;
    })
    .join("");
  return `<h3>${texte(titre)}</h3>
    <div class="table-defilante" tabindex="0" role="region" aria-label="${texte(titre)}">
      <table class="table-methodo">
        <thead><tr>${colonnes.map((c) => `<th scope="col">${texte(c)}</th>`).join("")}</tr></thead>
        <tbody>${corps}</tbody>
      </table>
    </div>`;
}

const depuis = (obj, unite) =>
  Object.values(obj).map((f) => ({ label: f.label, valeur: f.value, unite: unite(f), source: f.source }));

const groupes = new Map();
for (const f of AUTRES_FACTEURS) {
  if (!groupes.has(f.groupe)) groupes.set(f.groupe, []);
  groupes.get(f.groupe).push(f);
}

const energie = Object.values(FE_ENERGIE).flatMap((f) =>
  f.valueChauffage !== undefined
    ? [
        { label: f.label.replace(/\s*\(.*\)/, "") + " — usages spécifiques", valeur: f.value, unite: "kgCO2e/kWh", source: f.source },
        { label: f.label.replace(/\s*\(.*\)/, "") + " — chauffage", valeur: f.valueChauffage, unite: "kgCO2e/kWh", source: f.source },
      ]
    : [{ label: f.label, valeur: f.value, unite: "kgCO2e/kWh", source: f.source }],
);

const TC = ["bus", "metro_tram", "rer_ter", "tgv", "avion_court", "avion_moyen", "avion_long"];
let html = "";
html += tableau(
  "Déplacements",
  Object.entries(FE_TRANSPORT).map(([cle, f]) => ({
    label: f.label,
    valeur: f.value,
    unite: TC.includes(cle) ? "kgCO2e/passager.km" : "kgCO2e/km",
    source: f.source,
  })),
);
html += tableau("Énergie du local", energie);
if (groupes.has("Local")) html += tableau("Consommation par défaut du local", groupes.get("Local"));
html += tableau(
  "Numérique — fabrication",
  [
    { label: "Ordinateur fixe", valeur: FACTEURS_NUMERIQUE_FABRICATION.ordinateurFixe.valeur, unite: "kgCO2e/appareil", source: FACTEURS_NUMERIQUE_FABRICATION.ordinateurFixe.source },
    { label: "Ordinateur portable", valeur: FACTEURS_NUMERIQUE_FABRICATION.ordinateurPortable.valeur, unite: "kgCO2e/appareil", source: FACTEURS_NUMERIQUE_FABRICATION.ordinateurPortable.source },
    { label: "Écran supplémentaire", valeur: FACTEURS_NUMERIQUE_FABRICATION.ecranSupplementaire.valeur, unite: "kgCO2e/appareil", source: FACTEURS_NUMERIQUE_FABRICATION.ecranSupplementaire.source },
    ...(groupes.get("Numérique") || []),
  ],
);
for (const g of ["Alimentation", "Achats (ratios monétaires)", "Fret", "Immobilisations"]) {
  if (groupes.has(g)) html += tableau(g, groupes.get(g));
}
html += tableau("Déchets — traitement en fin de vie", [
  ...depuis(FE_DECHETS, () => "kgCO2e/kg"),
  { label: FE_DASRI.label, valeur: FE_DASRI.value, unite: "kgCO2e/kg", source: FE_DASRI.source },
]);
document.getElementById("tables-facteurs").innerHTML = html;

const SRC_VEHICULES = "SOURCÉ — Base Carbone® V23.6 (ADEME), mêmes éléments que les déplacements (ids 43791, 28011, 28007), décomposés en usage et fabrication pour éviter un double comptage avec le véhicule déclaré en immobilisation.";
const SRC_MOBILIER = "SOURCÉ — Base Carbone® V23.6 (ADEME), éléments ids 26958 à 26965 (chaises, tables, armoire, canapés), vérifiés le 06/10/2026.";
const LIB_VEHICULES = { voiture_thermique: "Voiture thermique", voiture_hybride: "Voiture hybride", voiture_electrique: "Voiture électrique" };
const LIB_MOBILIER = {
  chaiseBois: "Chaise en bois",
  chaisePlastique: "Chaise en plastique",
  chaiseBoisTextile: "Chaise bois et textile",
  tableBoisMassif: "Table en bois massif",
  tableRepresentative: "Table (représentative)",
  armoire: "Armoire",
  canapeTextile: "Canapé textile",
  canapeCuir: "Canapé cuir",
};
let htmlMsp = "";
htmlMsp += tableau(
  "Véhicules des praticiens — usage et fabrication",
  Object.entries(FACTEURS_VEHICULES_USAGE_FABRICATION).map(([cle, f]) => ({
    label: LIB_VEHICULES[cle] || cle,
    valeur: `${nombre(f.usage)} + ${nombre(f.fabrication)}`,
    unite: "kgCO2e/km (usage + fabrication)",
    source: SRC_VEHICULES,
  })),
);
htmlMsp += tableau("Bâtiment de santé", [
  {
    label: "Construction (structure béton)",
    valeur: FACTEUR_BATIMENT_SANTE.kgCO2e_m2,
    unite: "kgCO2e/m²",
    source: "SOURCÉ — Base Carbone® V23.6 (ADEME), « Établissement de santé, structure en béton », id 20739.",
  },
  {
    label: "Durée d'amortissement du bâtiment",
    valeur: FACTEUR_BATIMENT_SANTE.dureeAmortissementAns,
    unite: "ans",
    source: "ESTIMÉ (choix éditorial) — plus prudent que la période de référence de 50 ans de la RE2020 : une durée plus courte donne des émissions annuelles plus hautes.",
  },
]);
htmlMsp += tableau(
  "Mobilier compté à l'unité",
  Object.entries(FACTEURS_MOBILIER_UNITE).map(([cle, v]) => ({
    label: LIB_MOBILIER[cle] || cle,
    valeur: v,
    unite: "kgCO2e/unité",
    source: SRC_MOBILIER,
  })),
);
htmlMsp += `<p class="methodo-note">Les médicaments (prescrits ou vendus) utilisent le même ratio monétaire que Lib&CO2 Cab (tableau « Achats »).</p>`;
document.getElementById("tables-msp").innerHTML = htmlMsp;

const actions = [...ACTIONS, ...ACTIONS_MSP_SUPPLEMENTAIRES];
document.getElementById("table-actions").innerHTML = tableau(
  "Actions",
  actions.map((a) => ({
    label: a.titre,
    valeur:
      a.unit === "degres"
        ? `${nombre(Math.round(a.maxReductionParDegre * 1000) / 10)} % par °C`
        : `${nombre(Math.round(a.maxReduction * 1000) / 10)} %`,
    unite: a.id.startsWith("msp") ? "MSP" : "Cab et MSP",
    source: a.source,
  })),
  ["Action", "Gain maximal", "Outil", "Statut et source"],
);

// Coût des actions : coût net pour le praticien et coût d'abattement publié
// (pas de statut compté : ce ne sont pas des facteurs d'émission).
const lignesCout = actions
  .map(
    (a) => `<tr>
      <th scope="row">${texte(a.titre)}</th>
      <td><span class="badge-statut statut-cout-${a.cost}">${texte(COST_LABELS[a.cost])}</span><br>${texte(a.coutKg)}</td>
      <td>${texte(a.coutNet?.calcul || "")}</td>
      <td>${texte(a.coutAbattement || "Non publié.")}</td>
    </tr>`,
  )
  .join("");
document.getElementById("table-couts").innerHTML = `
  <div class="table-defilante" tabindex="0" role="region" aria-label="Coût des actions">
    <table class="table-methodo">
      <thead><tr><th scope="col">Action</th><th scope="col">Coût net pour le praticien</th><th scope="col">Calcul et sources</th><th scope="col">Coût d'abattement publié</th></tr></thead>
      <tbody>${lignesCout}</tbody>
    </table>
  </div>`;
document.getElementById("seuil-vac").textContent = nombre(VALEUR_ACTION_CLIMAT_EUR_KG);

const total = compteur.source + compteur.partiel + compteur.estime;
document.getElementById("bilan-statuts").textContent =
  `Sur ${total} valeurs présentées ci-dessous (facteurs et gains d'actions) : ${compteur.source} sourcées, ${compteur.partiel} sourcées en partie, ${compteur.estime} estimées.`;
