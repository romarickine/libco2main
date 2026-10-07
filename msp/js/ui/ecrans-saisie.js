/**
 * ui/ecrans-saisie.js — écrans de saisie (étapes 0 à 5)
 * ---------------------------------------------------------------------------
 * Construit le HTML des écrans d'accueil, profil de la structure, local,
 * praticiens (une carte par praticien), staff administratif et postes
 * mutualisés. Ne calcule rien : lit l'état et renvoie du HTML.
 *
 * Utilisé par : ui-msp.js (rendreEcranCourant).
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import {
  ENERGIES,
  LABELS_ENERGIES,
  LABELS_MOBILIER,
  LABELS_MODES,
  MODES_DEPLACEMENT,
  PROFESSIONS_APL,
  fmt,
} from "./commun.js";
import { FACTEURS_MOBILIER_UNITE, PROFESSIONS_PRESCRIPTRICES } from "../data/facteurs-emission-msp.js";
import { calculerSurfaceDeclaree } from "../main-msp.js";
import { echapperHtml } from "../../../shared/js/echappement.js";
import { rendrePiedNavigation } from "../ui-msp.js";

// ---------------------------------------------------------------------------
// ÉCRAN 1 — Profil
// ---------------------------------------------------------------------------
// ÉCRAN 0 — Accueil, affiché uniquement à la première visite (le brouillon
// sauvegardé reprend ensuite directement là où l'utilisateur s'est arrêté).
export function rendreAccueil() {
  return `
  <section class="ecran ecran-accueil">
    <h2>Bienvenue</h2>
    <p class="accueil-texte">Lib&amp;CO2 MSP estime, en ordre de grandeur, l'empreinte carbone annuelle de votre maison de santé pluriprofessionnelle et de chaque praticien qui y exerce. Un seul répondant complète le formulaire pour toute la structure. Comptez environ 15 à 20 minutes si les informations sont sous la main.</p>
    <button data-action="aller-ecran" data-numero="1" class="bouton-principal bouton-large">Commencer</button>
  </section>`;
}

/**
 * Étape 1 : nom de la structure, commune (recherche par nom), surface totale.
 * @param {object} etat
 * @returns {string} HTML
 */
export function rendreProfil(etat) {
  const s = etat.structureMSP;
  return `
  <section class="ecran">
    <h2>1. Profil de la structure</h2>
    <p class="aide">Ce bilan est pensé pour être rempli par une seule personne, au nom de l'ensemble de la structure — pas un par praticien.</p>
    <label>Nom de la MSP (optionnel)
      <input type="text" data-path="structureMSP.nom" value="${echapperHtml(s.nom)}">
    </label>
    <label>Commune
      <input type="text" id="recherche-commune" placeholder="Tapez le nom de la commune..." autocomplete="off" value="${s.commune ? echapperHtml(s.communeNom) : ""}">
      <div id="resultats-commune" class="autocomplete-resultats"></div>
      ${s.commune ? `<p class="commune-selectionnee">✓ Commune sélectionnée (code INSEE ${echapperHtml(s.commune)})</p>` : '<p class="aide">Sélectionnez une commune dans la liste de suggestions qui apparaît sous le champ — un nom simplement tapé sans clic sur une suggestion ne sera pas pris en compte.</p>'}
    </label>
    <label>Surface totale de la structure (m²)
      <input type="number" min="0" data-path="structureMSP.surfaceTotale" value="${s.surfaceTotale ?? ""}">
    </label>
    <p class="aide">La surface totale doit correspondre à la somme des surfaces dédiées que vous saisirez pour chaque praticien et pour le staff admin (écrans suivants) — c'est la clé utilisée pour répartir les émissions du local entre chacun. Si la somme déclarée est inférieure au total (espaces communs non répartis individuellement), la part manquante est automatiquement rattachée aux fonctions support de la MSP plutôt que d'être perdue.</p>
    ${(() => {
      const { declaree, totale, depassement } = calculerSurfaceDeclaree(etat);
      if (!totale) return "";
      return depassement
        ? `<p class="alerte">La somme des surfaces déclarées par les praticiens et le staff admin (${fmt(declaree)} m²) dépasse la surface totale de la structure (${fmt(totale)} m²) — vérifiez qu'un même espace n'a pas été compté pour plusieurs personnes.</p>`
        : `<p class="aide">Surface déclarée jusqu'ici (praticiens + staff admin) : ${fmt(declaree)} / ${fmt(totale)} m².</p>`;
    })()}
    ${rendrePiedNavigation(etat)}
  </section>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 2 — Local & bâtiment
export function rendreLocalBatiment(etat) {
  const l = etat.structureMSP.local;
  return `
  <section class="ecran">
    <h2>2. Local et bâtiment</h2>
    <div class="carte">
      <h3 class="carte-titre">Bâtiment (carbone de construction)</h3>
      <label>Année de construction
        <input type="number" min="1800" max="2100" data-path="structureMSP.local.batiment.anneeConstruction" value="${l.batiment.anneeConstruction ?? ""}">
      </label>
      <p class="aide">Si le bâtiment a plus de 30 ans (construction ou dernière rénovation lourde), aucune émission de construction n'est comptée.</p>
      <details data-details-key="local-renovation">
        <summary><span>Rénovation lourde plus récente (optionnel)</span></summary>
        <div class="ligne-double">
          <label>Année<input type="number" min="1800" max="2100" data-path="structureMSP.local.batiment.renovationLourde.annee" value="${l.batiment.renovationLourde?.annee ?? ""}"></label>
          <label>Coût des travaux (€)<input type="number" min="0" data-path="structureMSP.local.batiment.renovationLourde.coutTravaux" value="${l.batiment.renovationLourde?.coutTravaux ?? ""}"></label>
        </div>
        <p class="aide">Une rénovation ne compte comme "lourde" que si son coût atteint au moins 275 €/m² de surface totale — seuil réglementaire des locaux non résidentiels.</p>
      </details>
    </div>

    <div class="carte">
      <h3 class="carte-titre">Énergie</h3>
      <label>Énergie de chauffage
        <select data-path="structureMSP.local.energieChauffage">
          ${ENERGIES.map((e) => `<option value="${e}" ${l.energieChauffage === e ? "selected" : ""}>${LABELS_ENERGIES[e]}</option>`).join("")}
        </select>
      </label>
      <p class="aide">Sans consommation réelle saisie ci-dessous, l'énergie est estimée à partir de la surface totale et du ratio ADEME/CEREN "locaux commerciaux" (103 kWh/m²/an chauffage, 130 kWh/m²/an électricité).</p>
      <details data-details-key="local-conso-reelle">
        <summary><span>Consommation réelle (optionnel, sinon estimation par ratio)</span></summary>
        <label>Électricité (kWh/an)
          <input type="number" min="0" data-path="structureMSP.local.consoReelle.elec_kWh" value="${l.consoReelle?.elec_kWh ?? ""}">
        </label>
        <label>Chauffage (kWh/an)
          <input type="number" min="0" data-path="structureMSP.local.consoReelle.chauffage_kWh" value="${l.consoReelle?.chauffage_kWh ?? ""}">
        </label>
      </details>
    </div>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 3 — Praticiens
export function rendrePraticiens(etat) {
  return `
  <section class="ecran">
    <h2>3. Praticiens <span class="compteur">${etat.praticiens.length}</span></h2>
    <p class="aide">Un bloc par praticien de la structure. Toutes les données sont à collecter par le répondant unique auprès de chaque praticien.</p>
    ${etat.praticiens.length === 0 ? '<p class="etat-vide">Aucun praticien ajouté pour l\'instant.</p>' : ""}
    ${etat.praticiens.map((p, i) => rendreCartePraticien(p, i)).join("")}
    <button data-action="ajouter-praticien" class="bouton-principal bouton-large bouton-ajouter-praticien">+ Ajouter un praticien</button>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

function rendreBlocModes(p, i, champDotPath, titre) {
  const modes = champDotPath.split(".").reduce((o, k) => o[k], p);
  const total = modes.reduce((s, m) => s + (m.part || 0), 0);
  const lignes = modes
    .map(
      (m, j) => `
    <div class="ligne-mode-transport">
      <select data-path="praticiens.${i}.${champDotPath}.${j}.mode" aria-label="${titre} : mode ${j + 1}">
        ${MODES_DEPLACEMENT.map((mo) => `<option value="${mo}" ${m.mode === mo ? "selected" : ""}>${LABELS_MODES[mo]}</option>`).join("")}
      </select>
      <input type="number" min="0" max="100" placeholder="%" data-path="praticiens.${i}.${champDotPath}.${j}.part" value="${m.part}" aria-label="${titre} : part du mode ${j + 1} (%)">
      ${modes.length > 1 ? `<button data-action="supprimer-mode" data-id="${p.id}" data-champ="${champDotPath}" data-index="${j}" class="bouton-danger-petit" aria-label="Supprimer le mode ${j + 1}">×</button>` : "<span></span>"}
    </div>`,
    )
    .join("");
  return `
    <p class="sous-titre-bloc">${titre}</p>
    ${lignes}
    <p class="aide ${total !== 100 ? "aide-alerte" : ""}">Total : ${total}% ${total !== 100 ? "— doit atteindre 100% pour un calcul exact" : "✓"}</p>
    <button data-action="ajouter-mode" data-id="${p.id}" data-champ="${champDotPath}" class="bouton-secondaire-petit">+ Ajouter un mode de transport</button>`;
}

function rendreSectionPrescriptions(p, i) {
  const lignes = p.prescriptions.actesParamedicauxExternes
    .map(
      (l, j) => `
    <div class="ligne-mode-transport">
      <select data-path="praticiens.${i}.prescriptions.actesParamedicauxExternes.${j}.profession">
        ${PROFESSIONS_APL.filter((pr) => pr.valeur)
          .map(
            (pr) => `<option value="${pr.valeur}" ${l.profession === pr.valeur ? "selected" : ""}>${pr.label}</option>`,
          )
          .join("")}
      </select>
      <input type="number" min="0" placeholder="Actes/an" data-path="praticiens.${i}.prescriptions.actesParamedicauxExternes.${j}.nbActesAnnuel" value="${l.nbActesAnnuel}">
      <button data-action="supprimer-mode" data-id="${p.id}" data-champ="prescriptions.actesParamedicauxExternes" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`,
    )
    .join("");
  return `
    <h4 class="section-titre">Prescriptions</h4>
    <label>Montant annuel de médicaments prescrits (€)
      <input type="number" min="0" data-path="praticiens.${i}.prescriptions.montantAnnuelMedicaments" value="${p.prescriptions.montantAnnuelMedicaments}">
    </label>
    <p class="aide">Facteur SOURCÉ (ADEME Base Carbone®, produits pharmaceutiques 2023, 0,194 kgCO2e/€). Aucun risque de double comptage : rien d'autre dans l'outil ne capte la fabrication des médicaments.</p>
    <p class="sous-titre-bloc">Actes paramédicaux prescrits réalisés en dehors de la structure</p>
    <p class="aide">Ne saisir que les actes réalisés par un praticien extérieur à cette MSP — ceux réalisés par un collègue de la structure sont déjà comptés dans son propre bilan, les compter ici créerait un double comptage. Le poids de chaque acte externe est estimé à partir du ratio kgCO2e/acte déjà mesuré pour la même profession au sein de cette MSP (à défaut d'un bilan réel du praticien externe) — non chiffrable si la profession n'est pas représentée dans la structure.</p>
    ${p.prescriptions.actesParamedicauxExternes.length > 0 ? `<div class="ligne-mode-transport ligne-materiel-entete"><span>Profession prescrite</span><span>Actes/an</span><span></span></div>` : ""}
    ${lignes}
    <button data-action="ajouter-prescription-externe" data-id="${p.id}" data-champ="prescriptions.actesParamedicauxExternes" class="bouton-secondaire-petit">+ Ajouter une profession prescrite</button>`;
}

function rendreSectionPharmacien(p, i) {
  const ph = p.pharmacien || { caMedicaments: 0, caParapharmacie: 0, coeffAchatPrescriptions: 100 };
  return `
    <h4 class="section-titre">Officine (chiffre d'affaires)</h4>
    <div class="ligne-double">
      <label>Chiffre d'affaires médicaments (€/an)
        <input type="number" min="0" data-path="praticiens.${i}.pharmacien.caMedicaments" value="${ph.caMedicaments}">
      </label>
      <label>Chiffre d'affaires parapharmacie (€/an)
        <input type="number" min="0" data-path="praticiens.${i}.pharmacien.caParapharmacie" value="${ph.caParapharmacie}">
      </label>
    </div>
    <label>Part des prescriptions de la structure honorées dans cette officine (%)
      <input type="number" min="0" max="100" data-path="praticiens.${i}.pharmacien.coeffAchatPrescriptions" value="${ph.coeffAchatPrescriptions}">
    </label>
    <p class="aide">Pour éviter de compter deux fois les mêmes médicaments (prescrits par un praticien de la structure, puis achetés ici), cette part est déduite du chiffre d'affaires médicaments avant conversion en émissions. 100% suppose que toutes les prescriptions de la structure sont honorées dans cette officine ; ajustez à la baisse si une partie de la patientèle achète ses médicaments ailleurs. La parapharmacie n'est pas concernée par cette déduction.</p>`;
}

function rendreCartePraticien(p, i) {
  return `
  <div class="carte carte-praticien" data-praticien-id="${p.id}">
    <div class="carte-praticien-entete">
      <h3 class="carte-titre">Praticien ${i + 1}</h3>
      <button data-action="supprimer-praticien" data-id="${p.id}" class="bouton-danger">Supprimer</button>
    </div>

    <label>Profession
      <select data-path="praticiens.${i}.professionAPL">
        ${PROFESSIONS_APL.map((pr) => `<option value="${pr.valeur ?? ""}" ${p.professionAPL === pr.valeur ? "selected" : ""}>${pr.label}</option>`).join("")}
      </select>
    </label>
    <div class="ligne-double">
      <label>Nombre d'actes annuel<input type="number" min="0" data-path="praticiens.${i}.nbActesAnnuel" value="${p.nbActesAnnuel}"></label>
      <label>Part au lieu fixe (%)<input type="number" min="0" max="100" data-path="praticiens.${i}.partLieuFixe" value="${p.partLieuFixe}"></label>
    </div>
    <label>Surface dédiée (m²)
      <input type="number" min="0" data-path="praticiens.${i}.surfaceDediee" value="${p.surfaceDediee}">
    </label>

    <h4 class="section-titre">Déplacements</h4>

    <div class="sous-carte">
      <p class="sous-carte-titre">Trajet domicile-travail</p>
      <div class="ligne-double">
        <label>Distance (km aller)<input type="number" min="0" data-path="praticiens.${i}.distanceDomicileTravail" value="${p.distanceDomicileTravail}"></label>
        <label>Jours travaillés/semaine<input type="number" min="0" max="7" data-path="praticiens.${i}.joursTravaillesSemaine" value="${p.joursTravaillesSemaine}"></label>
      </div>
      <label>Semaines travaillées/an
        <input type="number" min="0" max="52" data-path="praticiens.${i}.semainesTravailleesAn" value="${p.semainesTravailleesAn}">
      </label>
      ${rendreBlocModes(p, i, "modesDomicileTravail", "Modes de transport")}
    </div>

    <div class="sous-carte">
      <p class="sous-carte-titre">Tournées à domicile (visites au domicile des patients)</p>
      <label>Distance annuelle (km/an)
        <input type="number" min="0" data-path="praticiens.${i}.tourneesDomicile.kmAnnuel" value="${p.tourneesDomicile.kmAnnuel}">
      </label>
      ${rendreBlocModes(p, i, "tourneesDomicile.modes", "Modes de transport")}
    </div>

    <div class="sous-carte">
      <p class="sous-carte-titre">Déplacements professionnels annuels (congrès, formations, représentation...)</p>
      <label>Distance annuelle (km/an)
        <input type="number" min="0" data-path="praticiens.${i}.deplacementsProAnnuels.kmAnnuel" value="${p.deplacementsProAnnuels.kmAnnuel}">
      </label>
      ${rendreBlocModes(p, i, "deplacementsProAnnuels.modes", "Modes de transport")}
    </div>

    <h4 class="section-titre">Alimentation professionnelle</h4>
    <div class="ligne-double">
      <label>Repas par semaine
        <input type="number" min="0" max="21" data-path="praticiens.${i}.alimentation.repasParSemaine" value="${p.alimentation.repasParSemaine}">
      </label>
      <label>Part de repas végétariens (%)
        <input type="number" min="0" max="100" data-path="praticiens.${i}.alimentation.pctVegetarien" value="${p.alimentation.pctVegetarien}">
      </label>
    </div>
    <p class="aide">Repas pris dans le cadre de l'activité professionnelle (sur place, restauration liée au travail). Calcul : repas/semaine × semaines travaillées/an, réparti entre repas standard et végétarien selon le pourcentage indiqué.</p>

    ${PROFESSIONS_PRESCRIPTRICES.includes(p.professionAPL) ? rendreSectionPrescriptions(p, i) : ""}

    ${p.professionAPL === "pharmacien" ? rendreSectionPharmacien(p, i) : ""}

    <details data-details-key="praticien-${p.id}-numerique">
      <summary><span>Numérique</span></summary>
      <div class="ligne-triple">
        <label>Ordinateurs fixes<input type="number" min="0" data-path="praticiens.${i}.numerique.nbOrdisFixes" value="${p.numerique.nbOrdisFixes}"></label>
        <label>Ordinateurs portables<input type="number" min="0" data-path="praticiens.${i}.numerique.nbOrdisPortables" value="${p.numerique.nbOrdisPortables}"></label>
        <label>Écrans supplémentaires<input type="number" min="0" data-path="praticiens.${i}.numerique.nbEcransSuppl" value="${p.numerique.nbEcransSuppl}"></label>
      </div>
      <label>Durée de détention moyenne (années)
        <input type="number" min="1" data-path="praticiens.${i}.numerique.dureeDetentionOrdis" value="${p.numerique.dureeDetentionOrdis}">
      </label>
      ${rendreLignesMaterielInfo(p, i)}
    </details>

    <details data-details-key="praticien-${p.id}-materiel">
      <summary><span>Matériel médical/professionnel dédié</span></summary>
      ${rendreLignesMaterielDedie(p, i)}
    </details>

    <details data-details-key="praticien-${p.id}-mobilier">
      <summary><span>Mobilier dédié</span></summary>
      ${rendreLignesMobilier(p.mobilierDedie, p.id, "mobilierDedie")}
    </details>
  </div>`;
}

function rendreLignesMaterielInfo(p, i) {
  const lignes = p.numerique.autreMaterielInfo
    .map(
      (m, j) => `
    <div class="ligne-materiel">
      <input type="text" placeholder="Exemple : imprimante" data-path="praticiens.${i}.numerique.autreMaterielInfo.${j}.type" value="${m.type}">
      <input type="number" placeholder="0" data-path="praticiens.${i}.numerique.autreMaterielInfo.${j}.valeurAchat" value="${m.valeurAchat}">
      <input type="number" placeholder="5" data-path="praticiens.${i}.numerique.autreMaterielInfo.${j}.dureeDetention" value="${m.dureeDetention}">
      <button data-action="supprimer-ligne-praticien" data-id="${p.id}" data-champ="numerique.autreMaterielInfo" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`,
    )
    .join("");
  return `<p class="sous-titre-bloc">Autre matériel informatique (imprimante, lecteur de carte Vitale...)</p>
    ${p.numerique.autreMaterielInfo.length > 0 ? rendreEnteteLigneMateriel("Type", "Valeur d'achat (€)", "Durée (ans)") : ""}
    ${lignes}
    <button data-action="ajouter-materiel-info" data-id="${p.id}" class="bouton-secondaire-petit">+ Ajouter</button>`;
}

function rendreLignesMaterielDedie(p, i) {
  const lignes = p.materielDedie
    .map(
      (m, j) => `
    <div class="ligne-materiel">
      <input type="text" placeholder="Exemple : échographe" data-path="praticiens.${i}.materielDedie.${j}.type" value="${m.type}">
      <input type="number" placeholder="0" data-path="praticiens.${i}.materielDedie.${j}.valeurAchat" value="${m.valeurAchat}">
      <input type="number" placeholder="5" data-path="praticiens.${i}.materielDedie.${j}.dureeDetention" value="${m.dureeDetention}">
      <button data-action="supprimer-ligne-praticien" data-id="${p.id}" data-champ="materielDedie" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`,
    )
    .join("");
  return `${p.materielDedie.length > 0 ? rendreEnteteLigneMateriel("Type d'équipement", "Valeur d'achat (€)", "Durée (ans)") : ""}
    ${lignes}
    <button data-action="ajouter-materiel-dedie" data-id="${p.id}" class="bouton-secondaire-petit">+ Ajouter un équipement</button>`;
}

function rendreLignesMobilier(mobilier, ownerId, champ) {
  const options = Object.keys(FACTEURS_MOBILIER_UNITE);
  const lignes = mobilier
    .map(
      (m, j) => `
    <div class="ligne-materiel">
      <select data-path-mobilier="${ownerId}|${champ}|${j}|type">
        ${options.map((o) => `<option value="${o}" ${m.type === o ? "selected" : ""}>${LABELS_MOBILIER[o]}</option>`).join("")}
      </select>
      <input type="number" placeholder="1" data-path-mobilier="${ownerId}|${champ}|${j}|nombre" value="${m.nombre}">
      <input type="number" placeholder="10" data-path-mobilier="${ownerId}|${champ}|${j}|dureeDetention" value="${m.dureeDetention}">
      <button data-action="supprimer-mobilier" data-owner="${ownerId}" data-champ="${champ}" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`,
    )
    .join("");
  return `${mobilier.length > 0 ? rendreEnteteLigneMateriel("Type de mobilier", "Nombre", "Durée (ans)") : ""}
    ${lignes}
    <button data-action="ajouter-mobilier" data-owner="${ownerId}" data-champ="${champ}" class="bouton-secondaire-petit">+ Ajouter du mobilier</button>`;
}

function rendreEnteteLigneMateriel(c1, c2, c3) {
  return `<div class="ligne-materiel ligne-materiel-entete">
    <span>${c1}</span><span>${c2}</span><span>${c3}</span><span></span>
  </div>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 4 — Staff admin
export function rendreStaffAdmin(etat) {
  const a = etat.staffAdmin;
  return `
  <section class="ecran">
    <h2>4. Staff administratif</h2>
    <div class="ligne-double">
      <label>Effectif administratif (équivalent temps plein)<input type="number" min="0" step="0.1" data-path="staffAdmin.etp" value="${a.etp ?? ""}"></label>
      <label>Surface dédiée (m²)<input type="number" min="0" data-path="staffAdmin.surfaceDediee" value="${a.surfaceDediee ?? ""}"></label>
    </div>

    <div class="ligne-double">
      <label>Distance domicile-travail moyenne (km aller)<input type="number" min="0" data-path="staffAdmin.distanceDomicileTravailMoyenne" value="${a.distanceDomicileTravailMoyenne ?? ""}"></label>
      <label>Mode principal
        <select data-path="staffAdmin.modeDomicileTravailMoyen">
          ${MODES_DEPLACEMENT.map((m) => `<option value="${m}" ${a.modeDomicileTravailMoyen === m ? "selected" : ""}>${LABELS_MODES[m]}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="ligne-double">
      <label>Jours travaillés/semaine<input type="number" min="0" max="7" data-path="staffAdmin.joursTravaillesSemaine" value="${a.joursTravaillesSemaine}"></label>
      <label>Semaines travaillées/an<input type="number" min="0" max="52" data-path="staffAdmin.semainesTravailleesAn" value="${a.semainesTravailleesAn}"></label>
    </div>

    <div class="carte">
      <h3 class="carte-titre">Numérique</h3>
      <div class="ligne-triple">
        <label>Ordinateurs fixes<input type="number" min="0" data-path="staffAdmin.numerique.nbOrdisFixes" value="${a.numerique.nbOrdisFixes}"></label>
        <label>Ordinateurs portables<input type="number" min="0" data-path="staffAdmin.numerique.nbOrdisPortables" value="${a.numerique.nbOrdisPortables}"></label>
        <label>Écrans supplémentaires<input type="number" min="0" data-path="staffAdmin.numerique.nbEcransSuppl" value="${a.numerique.nbEcransSuppl}"></label>
      </div>
      <label>Durée de détention moyenne (années)
        <input type="number" min="1" data-path="staffAdmin.numerique.dureeDetentionOrdis" value="${a.numerique.dureeDetentionOrdis}">
      </label>
      <p class="sous-titre-bloc">Autre matériel informatique (imprimante, lecteur de carte Vitale...)</p>
      ${a.numerique.autreMaterielInfo.length > 0 ? rendreEnteteLigneMateriel("Type", "Valeur d'achat (€)", "Durée (ans)") : ""}
      ${a.numerique.autreMaterielInfo
        .map(
          (m, j) => `
        <div class="ligne-materiel">
          <input type="text" placeholder="Exemple : imprimante" data-path="staffAdmin.numerique.autreMaterielInfo.${j}.type" value="${m.type}">
          <input type="number" placeholder="0" data-path="staffAdmin.numerique.autreMaterielInfo.${j}.valeurAchat" value="${m.valeurAchat}">
          <input type="number" placeholder="5" data-path="staffAdmin.numerique.autreMaterielInfo.${j}.dureeDetention" value="${m.dureeDetention}">
          <button data-action="supprimer-ligne" data-chemin="staffAdmin.numerique.autreMaterielInfo" data-index="${j}" class="bouton-danger-petit">×</button>
        </div>`,
        )
        .join("")}
      <button data-action="ajouter-materiel-info-admin" class="bouton-secondaire-petit">+ Ajouter</button>
    </div>

    <div class="carte">
      <h3 class="carte-titre">Mobilier</h3>
      ${rendreLignesMobilier(a.mobilier, "staffAdmin", "mobilier")}
    </div>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 5 — Postes mutualisés
export function rendrePostesMutualises(etat) {
  const pm = etat.postesMutualises;
  return `
  <section class="ecran">
    <h2>5. Postes mutualisés</h2>
    <p class="alerte">Ces montants doivent couvrir l'ensemble de la structure — additionnez les frais de tous les praticiens et pas seulement les vôtres. Ils seront ensuite réventilés automatiquement vers chaque praticien au prorata de son nombre d'actes annuel.</p>
    <label>Matériel de secrétariat — montant annuel de consommables (€)
      <input type="number" min="0" data-path="postesMutualises.materielSecretariat.montantAnnuelConsommables" value="${pm.materielSecretariat.montantAnnuelConsommables}">
    </label>
    <div class="ligne-double">
      <label>Comptabilité / banque / assurance (€/an)<input type="number" min="0" data-path="postesMutualises.services.comptaBanqueAssurance" value="${pm.services.comptaBanqueAssurance}"></label>
      <label>Sous-traitance (€/an)<input type="number" min="0" data-path="postesMutualises.services.sousTraitance" value="${pm.services.sousTraitance}"></label>
    </div>
    <label>Nombre de colis reçus/an
      <input type="number" min="0" data-path="postesMutualises.fret.nbColisAn" value="${pm.fret.nbColisAn}">
    </label>

    <div class="carte">
      <h3 class="carte-titre">Déchets courants de la structure</h3>
      <p class="aide">Traitement en fin de vie uniquement (la fabrication est déjà comptée dans le matériel) — saisi en kg/semaine pour l'ensemble de la structure, converti automatiquement en kg/an (base 52 semaines).</p>
      <div class="ligne-double">
        <label>Plastique (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.plastique" value="${pm.dechets.plastique}"></label>
        <label>Métal, hors aluminium (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.metal" value="${pm.dechets.metal}"></label>
      </div>
      <div class="ligne-double">
        <label>Papier (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.papier" value="${pm.dechets.papier}"></label>
        <label>Carton (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.carton" value="${pm.dechets.carton}"></label>
      </div>
      <div class="ligne-double">
        <label>Aluminium (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.aluminium" value="${pm.dechets.aluminium}"></label>
        <label>Verre (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.verre" value="${pm.dechets.verre}"></label>
      </div>
      <div class="ligne-double">
        <label>Déchets ménagers non triés (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.menagers" value="${pm.dechets.menagers}"></label>
        <label>Déchets électroniques — DEEE (kg/semaine)<input type="number" min="0" step="0.5" data-path="postesMutualises.dechets.electronique" value="${pm.dechets.electronique}"></label>
      </div>
      <hr class="separateur" />
      <label>DASRI — déchets d'activité de soins à risques infectieux (kg/semaine)
        <input type="number" min="0" step="0.1" data-path="postesMutualises.dechets.dasri" value="${pm.dechets.dasri}">
      </label>
      <p class="aide">Matériel piquant/coupant, produits biologiques — incinération à haute température obligatoire, bien plus émissive que les déchets courants ci-dessus.</p>
    </div>

    <div class="carte">
      <h3 class="carte-titre">Matériel lourd partagé entre plusieurs praticiens</h3>
      <p class="aide">Un équipement utilisé par plusieurs praticiens (échographe commun, table d'examen partagée...) — à déclarer ici, pas dans le "matériel dédié" d'un praticien en particulier, pour éviter de l'oublier ou de le compter deux fois.</p>
      ${pm.materielPartage.length > 0 ? rendreEnteteLigneMateriel("Type d'équipement", "Valeur d'achat (€)", "Durée (ans)") : ""}
      ${pm.materielPartage
        .map(
          (m, j) => `
        <div class="ligne-materiel">
          <input type="text" placeholder="Exemple : échographe" data-path="postesMutualises.materielPartage.${j}.type" value="${m.type}">
          <input type="number" placeholder="0" data-path="postesMutualises.materielPartage.${j}.valeurAchat" value="${m.valeurAchat}">
          <input type="number" placeholder="5" data-path="postesMutualises.materielPartage.${j}.dureeDetention" value="${m.dureeDetention}">
          <button data-action="supprimer-ligne" data-chemin="postesMutualises.materielPartage" data-index="${j}" class="bouton-danger-petit">×</button>
        </div>`,
        )
        .join("")}
      <button data-action="ajouter-materiel-partage" class="bouton-secondaire-petit">+ Ajouter un équipement partagé</button>
    </div>
    ${rendrePiedNavigation(etat)}
  </section>`;
}
