/**
 * ui/ecran-resultats.js — écran de restitution (étape 6)
 * ---------------------------------------------------------------------------
 * Résultats du bilan : total et ratio par acte, répartition par poste et par
 * praticien, indicateur de dépendance fossile, historique, zone d'export.
 *
 * Utilisé par : ui-msp.js (rendreEcranCourant).
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { COULEURS_POSTES, fmt, fmtDecimal } from "./commun.js";
import { OBJECTIF_2050_KG, RATIO_NATIONAL_MEDECINE_VILLE_KG } from "../data/facteurs-emission-msp.js";
import { calculerAvancement } from "../ui-msp.js";
import { echapperHtml } from "../../../shared/js/echappement.js";
import { getHistoriqueBilans } from "../main-msp.js";
import { svgBarresEmpilees, svgCamembertAnneau } from "./graphiques-svg.js";

// ---------------------------------------------------------------------------
// ÉCRAN 6 — Restitution (graphiques SVG natifs, sans dépendance externe)
export function rendreRestitution(etat) {
  const r = etat.dernierResultat;
  const complet = calculerAvancement(etat);
  const pretACalculer = complet[1] && complet[2] && complet[3];
  return `
  <section class="ecran">
    <h2>6. Résultats</h2>
    ${!pretACalculer ? '<p class="alerte">Complétez d\'abord le profil, le local et au moins un praticien (étapes 1 à 3) avant de calculer.</p>' : ""}
    <button data-action="calculer" class="bouton-principal bouton-large" ${!pretACalculer ? "disabled" : ""}>Calculer le bilan</button>
    ${r ? rendreResultats(r, etat) : '<p class="aide" data-style="margin-top: 1rem;">Le résultat s\'affichera ici une fois le calcul lancé.</p>'}
  </section>`;
}

function rendreCarteAffiche(r) {
  return `
  <div class="carte">
    <h3 class="carte-titre">Affiche pour la salle d'attente</h3>
    <p class="aide">Génère une image de synthèse (empreinte de la MSP, répartition par poste, empreinte de chaque praticien) prête à imprimer ou à afficher à l'accueil.</p>
    <button data-action="exporter-affiche" class="bouton-principal" ${!r ? "disabled" : ""}>Générer l'affiche (image)</button>
    <p id="affiche-statut" class="aide" data-style="margin-top: 0.6rem"></p>
  </div>`;
}

function rendreHistorique() {
  const historique = getHistoriqueBilans().slice(0, 8);
  if (historique.length === 0)
    return '<p class="aide">Aucun bilan enregistré pour l\'instant — le premier calcul sera automatiquement archivé.</p>';
  return `
  <table class="table-historique">
    <tr><th>Date</th><th>Structure</th><th>Empreinte totale</th></tr>
    ${historique
      .map(
        (b) => `<tr>
      <td>${new Date(b.horodatage).toLocaleDateString("fr-FR")}</td>
      <td>${b.structureMSP?.nom ? echapperHtml(b.structureMSP.nom) : "—"}</td>
      <td>${fmt((b.resultat?.empreinteTotale || 0) / 1000)} tCO2e/an</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

function rendreResultats(r, etat) {
  const nomsPraticiens = Object.fromEntries(etat.praticiens.map((p, i) => [p.id, `Praticien ${i + 1}`]));
  const dependance = r.tauxDependanceFossile;

  const donneesPostes = [
    { label: "Local (énergie + bâtiment)", valeur: r.parPoste.local.total },
    { label: "Déplacements patientèle", valeur: r.parPoste.patientele.total },
    { label: "Domicile-travail (usage)", valeur: r.parPoste.domicileTravail.domicileTravail.usage },
    { label: "Tournées à domicile (usage)", valeur: r.parPoste.domicileTravail.tournees.usage },
    { label: "Congrès / formations (usage)", valeur: r.parPoste.domicileTravail.deplacementsProAnnuels.usage },
    { label: "Immobilisation véhicules", valeur: r.parPoste.domicileTravail.fabricationVehiculeTotal },
    { label: "Alimentation professionnelle", valeur: r.parPoste.alimentation.total },
    // Prescriptions et médicaments/parapharmacie : inclus dans ce graphique
    // uniquement si la case "Inclure prescriptions et médicaments" est
    // cochée, pour ne jamais contredire visuellement le total affiché
    // juste au-dessus (voir empreinteAffichee plus bas).
    ...(etat.inclureMedicaments
      ? [
          { label: "Prescriptions (médicaments + actes externes)", valeur: r.parPoste.prescriptions.total },
          { label: "Médicaments et parapharmacie vendus (officine)", valeur: r.parPoste.medicamentsPharmacie.total },
        ]
      : []),
    { label: "Postes mutualisés", valeur: r.parPoste.support.total },
    { label: "Déchets de la structure", valeur: r.parPoste.dechets.total },
    { label: "Immobilisations diverses", valeur: r.parPoste.immobilisations },
  ]
    .filter((d) => d.valeur > 0)
    .sort((a, b) => b.valeur - a.valeur);

  const seriesEmpreinte = [
    { cle: "partLocal", label: "Local", couleur: COULEURS_POSTES[0] },
    { cle: "partPatientele", label: "Patientèle", couleur: COULEURS_POSTES[1] },
    { cle: "partDeplacementsPro", label: "Déplacements pro.", couleur: COULEURS_POSTES[2] },
    { cle: "partAlimentation", label: "Alimentation", couleur: "#4E8FA3" },
    { cle: "partPrescriptions", label: "Prescriptions", couleur: "#8A6FB0" },
    { cle: "partMedicamentsPharmacie", label: "Médicaments vendus", couleur: "#B0708A" },
    { cle: "partImmobilisations", label: "Immobilisations", couleur: COULEURS_POSTES[3] },
    { cle: "partSupport", label: "Postes mutualisés", couleur: COULEURS_POSTES[4] },
    { cle: "partDechets", label: "Déchets", couleur: "#6B7F5C" },
  ];
  const parActe = !!etat.affichageParActe;
  const totalActesMSP = etat.praticiens.reduce((s, p) => s + p.nbActesAnnuel, 0) || 1;

  const donneesEmpilees = etat.praticiens.map((p) => {
    const e = r.empreintesPraticiens.find((x) => x.id === p.id);
    const diviseur = parActe ? p.nbActesAnnuel || 1 : 1;
    return {
      label: nomsPraticiens[p.id],
      partLocal: e.partLocal / diviseur,
      partPatientele: e.partPatientele / diviseur,
      partDeplacementsPro: e.partDeplacementsPro / diviseur,
      partAlimentation: e.partAlimentation / diviseur,
      partPrescriptions: e.partPrescriptions / diviseur,
      partMedicamentsPharmacie: e.partMedicamentsPharmacie / diviseur,
      partImmobilisations: e.partImmobilisations / diviseur,
      partSupport: e.partSupport / diviseur,
      partDechets: e.partDechets / diviseur,
    };
  });
  const diviseurAdmin = parActe ? totalActesMSP : 1;
  donneesEmpilees.push({
    label: "Fonctions support (MSP)",
    partLocal: r.empreinteStaffAdmin.partLocal / diviseurAdmin,
    partPatientele: 0,
    partDeplacementsPro: r.empreinteStaffAdmin.partDeplacements / diviseurAdmin,
    partAlimentation: 0,
    partPrescriptions: 0,
    partMedicamentsPharmacie: 0,
    partImmobilisations: r.empreinteStaffAdmin.partImmobilisations / diviseurAdmin,
    partSupport: 0,
    partDechets: 0,
  });

  // "kgCO2e total/acte" affichés : hors prescriptions ET hors médicaments/
  // parapharmacie d'officine par défaut (comparabilité entre MSP avec et
  // sans pharmacie/prescripteurs intégrés) — case à cocher pour inclure les
  // deux ensemble (voir calculMedicamentsPharmacie dans calcul-msp.js pour
  // la logique de soustraction anti-double-comptage).
  const aDesMedicaments = r.parPoste.prescriptions.total > 0 || r.parPoste.medicamentsPharmacie.total > 0;
  const inclureMedicaments = !!etat.inclureMedicaments;
  const empreinteAffichee = inclureMedicaments ? r.empreinteTotaleAvecMedicaments : r.empreinteTotaleSansMedicaments;
  const ratioAffiche = inclureMedicaments ? r.ratioParActeAvecMedicaments : r.ratioParActeSansMedicaments;

  return `
  <div class="resultats">
    ${
      r.structureIncomplete?.surfaceManquante || r.structureIncomplete?.actesManquants
        ? `
      <div class="alerte" data-style="margin-bottom:1rem;">
        ⚠️ ${r.structureIncomplete.surfaceManquante ? `La <strong>surface totale de la structure</strong> n'est pas renseignée (étape "Profil") — ` : ""}${r.structureIncomplete.actesManquants ? `<strong>aucun praticien n'a de nombre d'actes annuel renseigné</strong> — ` : ""}les fiches individuelles ci-dessous ne peuvent pas être réparties tant que ${r.structureIncomplete.surfaceManquante && r.structureIncomplete.actesManquants ? "ces champs ne sont pas complétés" : "ce champ n\u2019est pas complété"}. L'empreinte totale de la structure, elle, reste correcte.
      </div>`
        : ""
    }
    <div class="chiffres-cles">
      <div class="chiffre-cle">
        <span class="chiffre-cle-valeur">${fmt(empreinteAffichee / 1000)}</span>
        <span class="chiffre-cle-unite">tCO2e / an</span>
        <span class="chiffre-cle-label">Empreinte totale de la MSP</span>
      </div>
      <div class="chiffre-cle">
        <span class="chiffre-cle-valeur">${ratioAffiche != null ? ratioAffiche.toFixed(1) : "—"}</span>
        <span class="chiffre-cle-unite">kgCO2e / acte</span>
        <span class="chiffre-cle-label">Ratio moyen par acte</span>
      </div>
    </div>
    ${
      aDesMedicaments
        ? `
      <div class="carte" data-style="margin-top:1rem;">
        <h3 class="carte-titre">Prescriptions et médicaments — hors comparaison</h3>
        <p class="aide">Ce bloc regroupe deux postes volontairement exclus du total ci-dessus par défaut, pour que l'empreinte de la MSP reste comparable à une structure sans prescripteurs ni pharmacie intégrée.</p>
        <div class="ligne-double">
          <div>
            <p class="sous-carte-titre">Prescriptions des praticiens</p>
            <p class="chiffre-secondaire">${fmt(r.parPoste.prescriptions.total)} kgCO2e/an</p>
            <p class="aide">Médicaments et actes prescrits par les praticiens de la structure (médecins, sages-femmes, chirurgiens-dentistes).</p>
          </div>
          <div>
            <p class="sous-carte-titre">Médicaments et parapharmacie vendus en officine</p>
            <p class="chiffre-secondaire">${fmt(r.parPoste.medicamentsPharmacie.total)} kgCO2e/an</p>
            <p class="aide">Chiffre d'affaires du pharmacien de la structure, net de la part déjà comptée dans les prescriptions ci-dessus (pour éviter un double comptage — voir le coefficient d'achat renseigné sur sa fiche praticien).</p>
          </div>
        </div>
        <label data-style="display:flex; align-items:center; gap:8px; margin-top:1rem; cursor:pointer;">
          <input type="checkbox" data-action="toggle-inclure-medicaments" ${inclureMedicaments ? "checked" : ""} />
          Inclure prescriptions et médicaments dans l'empreinte totale affichée ci-dessus
        </label>
      </div>`
        : ""
    }

    <div class="carte">
      <h3 class="carte-titre">
        Dépendance aux énergies fossiles
        <span class="info-icone-conteneur">
          <span class="info-icone" tabindex="0">i</span>
          <span class="info-bulle-detail">
            <strong>Méthode de calcul</strong><br><br>
            <strong>Moyenne nationale médecine de ville (2023) : ${RATIO_NATIONAL_MEDECINE_VILLE_KG} kgCO2e/acte.</strong><br>
            = 23% des 49 MtCO2e du secteur santé français (The Shift Project, "Décarboner la santé", 2023) ÷ 2,256 milliards d'actes de médecine de ville (médecins, auxiliaires médicaux, sages-femmes, dentistes — CNAM/Ameli 2023 ; biologie médicale — Biol'AM 2023, prescripteurs ville, sous hypothèse de 3 actes NABM par passage en laboratoire).<br><br>
            <strong>Objectif national 2050 "sur les actes", sans prévention : -61,2%.</strong><br>
            The Shift Project (2021) : scénario où le secteur santé passe de 49 à 19 MtCO2e via la décarbonation des postes d'émission et une baisse de 60% de l'intensité carbone des médicaments/dispositifs médicaux — <em>sans</em> réduire le volume de soins par la prévention (ce dernier levier porterait l'objectif à -80%, hors périmètre de cet indicateur).<br><br>
            Objectif dérivé : ${OBJECTIF_2050_KG.toFixed(2)} kgCO2e/acte.<br><br>
            <strong>Indicateur affiché</strong> = progression entre la moyenne nationale (0%, ${RATIO_NATIONAL_MEDECINE_VILLE_KG} kg) et l'objectif 2050 (100%, ${OBJECTIF_2050_KG.toFixed(2)} kg) : (moyenne nationale − votre ratio) ÷ (moyenne nationale − objectif 2050) × 100, plafonné entre 0% et 100%.
          </span>
        </span>
      </h3>
      <p class="aide">Progression de votre structure entre la moyenne nationale actuelle (0%) et l'objectif national de décarbonation 2050 "sur les actes" (100%).</p>
      ${
        dependance
          ? `
        <div class="chiffres-cles">
          <div class="chiffre-cle">
            <span class="chiffre-cle-valeur">${dependance.progressionVersObjectif2050.toFixed(0)}%</span>
            <span class="chiffre-cle-unite">du chemin vers l'objectif 2050</span>
            <span class="chiffre-cle-label">${dependance.progressionVersObjectif2050 >= 100 ? "Objectif 2050 déjà atteint" : dependance.progressionVersObjectif2050 <= 0 ? "Au niveau ou au-dessus de la moyenne nationale — tout reste à faire" : `Reste ${(100 - dependance.progressionVersObjectif2050).toFixed(0)}% du chemin à parcourir`}</span>
          </div>
        </div>`
          : '<p class="aide">Calculez le bilan pour voir cet indicateur.</p>'
      }
    </div>

    <h3 class="carte-titre">Répartition par poste (MSP entière)</h3>
    <p class="aide">Passez la souris sur une part du graphique pour voir le chiffre exact.</p>
    ${svgCamembertAnneau(donneesPostes)}

    <details class="details-resultats" data-details-key="resultats-detail-praticien">
      <summary><span>Voir le détail par praticien</span></summary>
      <p class="aide">Chaque praticien porte sa propre empreinte (local au prorata de sa surface, ses déplacements propres, son alimentation, ses immobilisations dédiées, sa part des postes mutualisés au prorata des actes réalisés en cabinet). Les fonctions support de la MSP (staff administratif) ont leur propre empreinte, distincte, pour cibler les bonnes actions au bon endroit. La somme de toutes ces empreintes reconstitue exactement l'empreinte totale de la MSP.</p>
      <div class="toggle-groupe">
        <button data-action="affichage-total" class="toggle-bouton ${!parActe ? "actif" : ""}">Total (kgCO2e/an)</button>
        <button data-action="affichage-par-acte" class="toggle-bouton ${parActe ? "actif" : ""}">Par séance (kgCO2e/acte)</button>
      </div>
      ${parActe ? "<p class=\"aide\">Le staff admin n'a pas d'actes propres : sa ligne est ramenée au nombre total d'actes de la MSP (contribution des fonctions support par séance réalisée).</p>" : ""}
      ${svgBarresEmpilees(donneesEmpilees, seriesEmpreinte, { unite: parActe ? "kgCO2e/acte" : "kgCO2e", formatteur: parActe ? fmtDecimal : fmt })}
    </details>

    <div class="carte" data-style="margin-top: 2rem">
      <h3 class="carte-titre">Télécharger le détail des calculs</h3>
      <p class="aide">Fichier Excel complet : résultats par poste, réventilation par praticien, et tous les facteurs d'émission utilisés avec leur source — de quoi comprendre et vérifier chaque chiffre.</p>
      <button data-action="exporter-excel" class="bouton-principal">Télécharger le détail (Excel)</button>
      <p id="export-statut" class="aide" data-style="margin-top: 0.8rem"></p>
    </div>

    ${rendreCarteAffiche(r)}

    <div class="carte">
      <h3 class="carte-titre">Suivre l'évolution dans le temps</h3>
      <p class="aide">Chaque bilan calculé est conservé automatiquement sur cet appareil. Exportez une archive pour la garder en lieu sûr ou la reprendre sur un autre appareil/navigateur — l'import fusionne avec l'historique déjà présent, sans rien écraser.</p>
      <div class="ligne-double">
        <button data-action="exporter-archive" class="bouton-secondaire">Exporter l'archive</button>
        <label class="bouton-secondaire bouton-fichier">Importer une archive
          <input type="file" id="import-archive-fichier" accept="application/json" data-style="display:none">
        </label>
      </div>
      <p id="archive-statut" class="aide" data-style="margin-top: 0.6rem"></p>
      ${rendreHistorique()}
    </div>

    <div class="carte">
      <h3 class="carte-titre">Partager pour le tableau de bord comparatif (optionnel)</h3>
      <p class="aide">Un tableau de bord compare les résultats de plusieurs structures participantes. Le partage est entièrement volontaire — rien n'est envoyé sans votre action explicite ci-dessous.</p>
      <p class="aide" data-style="background: var(--couleur-fond); border-radius: var(--rayon-bouton); padding: 0.8rem; margin: 0 0 0.9rem;">En cliquant sur "Exporter et partager", vous acceptez que les données de ce fichier — l'empreinte carbone de votre structure, sa répartition par poste, et le détail par praticien sans aucun nom ni donnée personnelle identifiable au-delà du nom de votre structure — soient transmises à libetco2@gmail.com pour construire un tableau de bord comparatif entre structures participantes. Vous pouvez demander la suppression de ces données à tout moment en contactant cette même adresse. Aucune donnée n'est transmise sans cette action explicite de votre part.</p>
      <label data-style="display:flex; align-items:flex-start; gap:0.5rem; font-weight:500;">
        <input type="checkbox" id="consentement-dashboard" data-style="width:1.1rem;height:1.1rem;margin-top:0.15rem;flex-shrink:0;accent-color:var(--couleur-primaire)">
        <span>J'ai lu et j'accepte que ces données soient partagées dans les conditions décrites ci-dessus.</span>
      </label>
      <button data-action="exporter-dashboard" id="bouton-exporter-dashboard" class="bouton-principal" disabled data-style="margin-top: 0.9rem">Exporter et partager</button>
      <p id="dashboard-statut" class="aide" data-style="margin-top: 0.6rem"></p>
    </div>

    <div class="carte carte-invitation">
      <h3 class="carte-titre">Et maintenant ?</h3>
      <p class="aide">Ce bilan n'est utile que s'il débouche sur des actions concrètes. Découvrez les pistes d'action adaptées à chaque poste, avec leur potentiel de réduction chiffré pour votre structure.</p>
      <button data-action="aller-ecran" data-numero="7" class="bouton-principal bouton-large">Découvrir les pistes d'action →</button>
    </div>
  </div>`;
}
