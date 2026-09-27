/**
 * export/excel.js — export du détail des calculs (classeur Excel)
 * ---------------------------------------------------------------------------
 * Classeur multi-feuilles au format SpreadsheetML (XML natif d'Excel, sans
 * bibliothèque) : détail de chaque poste, réventilation par praticien et
 * facteurs d'émission utilisés, pour que chaque chiffre soit vérifiable.
 *
 * Utilisé par : ui/evenements.js (action « exporter-excel »).
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { APL_PROFESSIONS, APL_REFERENCE_NATIONALE } from "../data/apl-msp.js";
import {
  FACTEURS_MOBILIER_UNITE,
  FACTEURS_VEHICULES_USAGE_FABRICATION,
  FACTEUR_BATIMENT_SANTE,
  FE_MEDICAMENTS_EUR,
  PROFESSIONS_PRESCRIPTRICES,
} from "../data/facteurs-emission-msp.js";
import {
  FACTEURS_NUMERIQUE_FABRICATION,
  FE_DASRI,
  FE_DECHETS,
  FE_ENERGIE,
  FE_FRET_COLIS,
  FE_GROS_MATERIEL_MASSIF,
  FE_GROS_MATERIEL_STANDARD,
  FE_MONETAIRE,
  FE_REPAS,
  FE_TRANSPORT,
  RATIOS_ENERGIE_PAR_ACTIVITE,
} from "../../../shared/js/data/facteurs-emission.js";
import { LABELS_ENERGIES, LABELS_MOBILIER, LABELS_MODES, xmlEchappe } from "../ui/commun.js";

function celluleTexte(v) {
  return `<Cell><Data ss:Type="String">${xmlEchappe(v)}</Data></Cell>`;
}
function celluleNombre(v) {
  const n = Number(v);
  return `<Cell><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`;
}
function ligneExcel(cellules) {
  return `<Row>${cellules.join("")}</Row>`;
}
function feuilleExcel(nom, lignes) {
  return `<Worksheet ss:Name="${xmlEchappe(nom.slice(0, 31))}"><Table>${lignes.join("")}</Table></Worksheet>`;
}

/**
 * Télécharge le détail complet des calculs (classeur SpreadsheetML, ouvrable
 * dans Excel, LibreOffice ou Google Sheets) : une feuille par poste, la
 * réventilation par praticien et les facteurs d'émission avec leur source.
 * @param {object} etat  Doit contenir dernierResultat (sinon message dans la page).
 */
export function exporterExcel(etat) {
  const zoneStatut = document.getElementById("export-statut");
  if (!etat.dernierResultat) {
    if (zoneStatut) {
      zoneStatut.textContent = 'Calculez d\'abord le bilan (bouton "Calculer le bilan" en haut de cet écran).';
      zoneStatut.classList.add("aide-alerte");
    }
    return;
  }
  const r = etat.dernierResultat;
  const nomsPraticiens = Object.fromEntries(etat.praticiens.map((p, i) => [p.id, `Praticien ${i + 1}`]));
  const feuilles = [];

  // --- Feuille 1 : Résumé ---
  feuilles.push(
    feuilleExcel("Résumé", [
      ligneExcel([celluleTexte("Lib&CO2 MSP — Détail des calculs"), celluleTexte("")]),
      ligneExcel([celluleTexte("Structure"), celluleTexte(etat.structureMSP.nom || "(non renseigné)")]),
      ligneExcel([celluleTexte("Commune (code INSEE)"), celluleTexte(etat.structureMSP.commune || "")]),
      ligneExcel([celluleTexte("Date d'export"), celluleTexte(new Date().toLocaleDateString("fr-FR"))]),
      ligneExcel([celluleTexte(""), celluleTexte("")]),
      ligneExcel([celluleTexte("Empreinte totale MSP (kgCO2e/an)"), celluleNombre(r.empreinteTotale)]),
      ligneExcel([celluleTexte("Empreinte totale MSP (tCO2e/an)"), celluleNombre(r.empreinteTotale / 1000)]),
      ligneExcel([celluleTexte("Ratio moyen par acte (kgCO2e/acte)"), celluleNombre(r.ratioParActe ?? 0)]),
    ]),
  );

  // --- Feuille 2 : Postes MSP (détail complet) ---
  const lignesPostes = [ligneExcel([celluleTexte("Poste"), celluleTexte("Sous-poste"), celluleTexte("kgCO2e/an")])];
  lignesPostes.push(
    ligneExcel([celluleTexte("Local"), celluleTexte("Énergie"), celluleNombre(r.parPoste.local.emissionsEnergie)]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Local"),
      celluleTexte("Bâtiment (construction)"),
      celluleNombre(r.parPoste.local.emissionsBatiment),
    ]),
  );
  lignesPostes.push(
    ligneExcel([celluleTexte("Déplacements patientèle"), celluleTexte(""), celluleNombre(r.parPoste.patientele.total)]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Déplacements professionnels"),
      celluleTexte("Domicile-travail — usage"),
      celluleNombre(r.parPoste.domicileTravail.domicileTravail.usage),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Déplacements professionnels"),
      celluleTexte("Domicile-travail — fabrication véhicule"),
      celluleNombre(r.parPoste.domicileTravail.domicileTravail.fabricationVehicule),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Déplacements professionnels"),
      celluleTexte("Tournées à domicile — usage"),
      celluleNombre(r.parPoste.domicileTravail.tournees.usage),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Déplacements professionnels"),
      celluleTexte("Tournées à domicile — fabrication véhicule"),
      celluleNombre(r.parPoste.domicileTravail.tournees.fabricationVehicule),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Déplacements professionnels"),
      celluleTexte("Congrès/formations — usage"),
      celluleNombre(r.parPoste.domicileTravail.deplacementsProAnnuels.usage),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Déplacements professionnels"),
      celluleTexte("Congrès/formations — fabrication véhicule"),
      celluleNombre(r.parPoste.domicileTravail.deplacementsProAnnuels.fabricationVehicule),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Alimentation professionnelle"),
      celluleTexte(""),
      celluleNombre(r.parPoste.alimentation.total),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Prescriptions"),
      celluleTexte("Médicaments"),
      celluleNombre(r.parPoste.prescriptions.detailParPraticien.reduce((s, d) => s + d.emissionsMedicaments, 0)),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Prescriptions"),
      celluleTexte("Actes paramédicaux externes (estimation par ratio local)"),
      celluleNombre(r.parPoste.prescriptions.detailParPraticien.reduce((s, d) => s + d.emissionsActesExternes, 0)),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Médicaments et parapharmacie (officine)"),
      celluleTexte("Médicaments vendus, net des prescriptions déjà comptées"),
      celluleNombre(
        r.parPoste.medicamentsPharmacie.detailParPraticien.reduce((s, d) => s + d.emissionsMedicamentsNet, 0),
      ),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Médicaments et parapharmacie (officine)"),
      celluleTexte("Parapharmacie"),
      celluleNombre(
        r.parPoste.medicamentsPharmacie.detailParPraticien.reduce((s, d) => s + d.emissionsParapharmacie, 0),
      ),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Postes mutualisés"),
      celluleTexte("Matériel de secrétariat"),
      celluleNombre(r.parPoste.support.materielSecretariat),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Postes mutualisés"),
      celluleTexte("Services (compta/banque/assurance/sous-traitance)"),
      celluleNombre(r.parPoste.support.services),
    ]),
  );
  lignesPostes.push(
    ligneExcel([celluleTexte("Postes mutualisés"), celluleTexte("Fret"), celluleNombre(r.parPoste.support.fret)]),
  );
  for (const cle of Object.keys(FE_DECHETS)) {
    lignesPostes.push(
      ligneExcel([
        celluleTexte("Déchets de la structure"),
        celluleTexte(FE_DECHETS[cle].label),
        celluleNombre(r.parPoste.dechets.detail[cle] || 0),
      ]),
    );
  }
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Déchets de la structure"),
      celluleTexte(FE_DASRI.label),
      celluleNombre(r.parPoste.dechets.detail.dasri || 0),
    ]),
  );
  lignesPostes.push(
    ligneExcel([
      celluleTexte("Immobilisations"),
      celluleTexte("Numérique + matériel + mobilier (tous praticiens et staff admin)"),
      celluleNombre(r.parPoste.immobilisations),
    ]),
  );
  feuilles.push(feuilleExcel("Postes MSP", lignesPostes));

  // --- Feuille 3 : Empreinte par praticien ---
  const lignesEmpreinte = [
    ligneExcel([
      celluleTexte("Praticien"),
      celluleTexte("Local"),
      celluleTexte("Patientèle"),
      celluleTexte("Déplacements pro."),
      celluleTexte("Alimentation"),
      celluleTexte("Prescriptions"),
      celluleTexte("Médicaments (officine)"),
      celluleTexte("Immobilisations"),
      celluleTexte("Postes mutualisés"),
      celluleTexte("Total kgCO2e/an"),
    ]),
  ];
  for (const p of etat.praticiens) {
    const e = r.empreintesPraticiens.find((x) => x.id === p.id);
    lignesEmpreinte.push(
      ligneExcel([
        celluleTexte(nomsPraticiens[p.id]),
        celluleNombre(e.partLocal),
        celluleNombre(e.partPatientele),
        celluleNombre(e.partDeplacementsPro),
        celluleNombre(e.partAlimentation),
        celluleNombre(e.partPrescriptions),
        celluleNombre(e.partMedicamentsPharmacie),
        celluleNombre(e.partImmobilisations),
        celluleNombre(e.partSupport),
        celluleNombre(e.total),
      ]),
    );
  }
  lignesEmpreinte.push(
    ligneExcel([
      celluleTexte("Fonctions support (MSP)"),
      celluleNombre(r.empreinteStaffAdmin.partLocal),
      celluleNombre(0),
      celluleNombre(r.empreinteStaffAdmin.partDeplacements),
      celluleNombre(0),
      celluleNombre(0),
      celluleNombre(0),
      celluleNombre(r.empreinteStaffAdmin.partImmobilisations),
      celluleNombre(0),
      celluleNombre(r.empreinteStaffAdmin.total),
    ]),
  );
  feuilles.push(feuilleExcel("Empreinte par praticien", lignesEmpreinte));

  // --- Feuille 3bis : Détail des prescriptions ---
  const lignesPrescriptions = [
    ligneExcel([
      celluleTexte("Praticien"),
      celluleTexte("Médicaments prescrits (€)"),
      celluleTexte("Émissions médicaments (kgCO2e)"),
      celluleTexte("Émissions actes externes (kgCO2e)"),
      celluleTexte("Total prescriptions (kgCO2e)"),
    ]),
  ];
  for (const p of etat.praticiens) {
    if (!PROFESSIONS_PRESCRIPTRICES.includes(p.professionAPL)) continue;
    const d = r.parPoste.prescriptions.detailParPraticien.find((x) => x.id === p.id);
    lignesPrescriptions.push(
      ligneExcel([
        celluleTexte(nomsPraticiens[p.id]),
        celluleNombre(p.prescriptions.montantAnnuelMedicaments),
        celluleNombre(d?.emissionsMedicaments ?? 0),
        celluleNombre(d?.emissionsActesExternes ?? 0),
        celluleNombre(d?.total ?? 0),
      ]),
    );
  }
  lignesPrescriptions.push(
    ligneExcel([celluleTexte(""), celluleTexte(""), celluleTexte(""), celluleTexte(""), celluleTexte("")]),
  );
  lignesPrescriptions.push(
    ligneExcel([
      celluleTexte("Méthode"),
      celluleTexte(
        "Médicaments : facteur SOURCÉ 0,5 kgCO2e/€ (Shift Project/ADEME Base Empreinte). Actes externes : ratio kgCO2e/acte ESTIMÉ, dérivé de la même profession au sein de cette MSP. Option A retenue : les actes prescrits réalisés par un collègue de la même MSP sont exclus (déjà comptés dans son propre bilan).",
      ),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
    ]),
  );
  feuilles.push(feuilleExcel("Prescriptions", lignesPrescriptions));

  // --- Feuille 3ter : Détail médicaments et parapharmacie (officine) ---
  const lignesMedicamentsOfficine = [
    ligneExcel([
      celluleTexte("Praticien"),
      celluleTexte("CA médicaments déclaré (€)"),
      celluleTexte("CA parapharmacie (€)"),
      celluleTexte("Coefficient d\u2019achat prescriptions (%)"),
      celluleTexte("Prescriptions médicaments de la MSP (€, toutes professions)"),
      celluleTexte("CA médicaments net (€)"),
      celluleTexte("Émissions médicaments net (kgCO2e)"),
      celluleTexte("Émissions parapharmacie (kgCO2e)"),
      celluleTexte("Total (kgCO2e)"),
    ]),
  ];
  const totalPrescriptionsEurosExport = etat.praticiens.reduce(
    (s, p) =>
      s + (PROFESSIONS_PRESCRIPTRICES.includes(p.professionAPL) ? p.prescriptions?.montantAnnuelMedicaments || 0 : 0),
    0,
  );
  for (const p of etat.praticiens) {
    if (p.professionAPL !== "pharmacien") continue;
    const d = r.parPoste.medicamentsPharmacie.detailParPraticien.find((x) => x.id === p.id);
    lignesMedicamentsOfficine.push(
      ligneExcel([
        celluleTexte(nomsPraticiens[p.id]),
        celluleNombre(p.pharmacien?.caMedicaments || 0),
        celluleNombre(p.pharmacien?.caParapharmacie || 0),
        celluleNombre(p.pharmacien?.coeffAchatPrescriptions ?? 100),
        celluleNombre(totalPrescriptionsEurosExport),
        celluleNombre(d?.caMedicamentsNet ?? 0),
        celluleNombre(d?.emissionsMedicamentsNet ?? 0),
        celluleNombre(d?.emissionsParapharmacie ?? 0),
        celluleNombre(d?.total ?? 0),
      ]),
    );
  }
  lignesMedicamentsOfficine.push(
    ligneExcel([
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
    ]),
  );
  lignesMedicamentsOfficine.push(
    ligneExcel([
      celluleTexte("Méthode"),
      celluleTexte(
        "CA médicaments net = CA médicaments déclaré − (coefficient d\u2019achat × total des prescriptions médicaments de la structure), plafonné à 0 — évite de compter deux fois les médicaments prescrits par un praticien de la MSP puis achetés dans sa propre officine. Facteur SOURCÉ 0,5 kgCO2e/€ (Shift Project/ADEME Base Empreinte) pour les médicaments ; facteur biens_consommables pour la parapharmacie. Poste exclu du total par défaut, comme les prescriptions (case à cocher en résultats).",
      ),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
      celluleTexte(""),
    ]),
  );
  if (lignesMedicamentsOfficine.length > 2)
    feuilles.push(feuilleExcel("Médicaments (officine)", lignesMedicamentsOfficine));

  // --- Feuille 4 : Clés de réventilation ---
  const lignesClefs = [
    ligneExcel([
      celluleTexte("Praticien"),
      celluleTexte("Surface dédiée (m²)"),
      celluleTexte("% surface totale"),
      celluleTexte("Actes annuels"),
      celluleTexte("Part au lieu fixe (%)"),
      celluleTexte("Actes en cabinet"),
      celluleTexte("% actes cabinet (clé postes mutualisés)"),
      celluleTexte("Coefficient rareté APL"),
    ]),
  ];
  const surfaceTotale = etat.structureMSP.surfaceTotale || 1;
  const totalActesCabinet = etat.praticiens.reduce((s, p) => s + p.nbActesAnnuel * (p.partLieuFixe / 100), 0) || 1;
  for (const p of etat.praticiens) {
    const actesCabinet = p.nbActesAnnuel * (p.partLieuFixe / 100);
    const coeff = r.parPoste.patientele.detailParPraticien.find((x) => x.id === p.id)?.coeffRarete ?? 1;
    lignesClefs.push(
      ligneExcel([
        celluleTexte(nomsPraticiens[p.id]),
        celluleNombre(p.surfaceDediee),
        celluleNombre((p.surfaceDediee / surfaceTotale) * 100),
        celluleNombre(p.nbActesAnnuel),
        celluleNombre(p.partLieuFixe),
        celluleNombre(actesCabinet),
        celluleNombre((actesCabinet / totalActesCabinet) * 100),
        celluleNombre(coeff),
      ]),
    );
  }
  feuilles.push(feuilleExcel("Clés de réventilation", lignesClefs));

  // --- Feuille 5 : Facteurs — Transport ---
  const lignesTransport = [
    ligneExcel([
      celluleTexte("Mode"),
      celluleTexte("Usage (kgCO2e/km)"),
      celluleTexte("Fabrication (kgCO2e/km)"),
      celluleTexte("Total (kgCO2e/km)"),
      celluleTexte("Source"),
    ]),
  ];
  for (const [cle, f] of Object.entries(FE_TRANSPORT)) {
    const vFab = FACTEURS_VEHICULES_USAGE_FABRICATION[cle];
    lignesTransport.push(
      ligneExcel([
        celluleTexte(LABELS_MODES[cle] || cle),
        celluleNombre(vFab ? vFab.usage : f.value),
        celluleNombre(vFab ? vFab.fabrication : 0),
        celluleNombre(f.value),
        celluleTexte(f.source || ""),
      ]),
    );
  }
  feuilles.push(feuilleExcel("Facteurs - Transport", lignesTransport));

  // --- Feuille 6 : Facteurs — Énergie, local, bâtiment ---
  const lignesEnergie = [
    ligneExcel([celluleTexte("Élément"), celluleTexte("Valeur"), celluleTexte("Unité"), celluleTexte("Source")]),
  ];
  for (const [cle, f] of Object.entries(FE_ENERGIE)) {
    lignesEnergie.push(
      ligneExcel([
        celluleTexte(LABELS_ENERGIES[cle] || cle),
        celluleNombre(f.value),
        celluleTexte("kgCO2e/kWh"),
        celluleTexte(f.source || ""),
      ]),
    );
  }
  lignesEnergie.push(
    ligneExcel([
      celluleTexte("Ratio local MSP — chauffage"),
      celluleNombre(RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art.chauffage),
      celluleTexte("kWh/m²/an"),
      celluleTexte("ADEME/CEREN, catégorie Commerces"),
    ]),
  );
  lignesEnergie.push(
    ligneExcel([
      celluleTexte("Ratio local MSP — électricité"),
      celluleNombre(RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art.elec),
      celluleTexte("kWh/m²/an"),
      celluleTexte("ADEME/CEREN, catégorie Commerces"),
    ]),
  );
  lignesEnergie.push(
    ligneExcel([
      celluleTexte("Bâtiment — construction (établissement de santé béton)"),
      celluleNombre(FACTEUR_BATIMENT_SANTE.kgCO2e_m2),
      celluleTexte("kgCO2e/m²"),
      celluleTexte("Base Carbone ADEME V23.10"),
    ]),
  );
  lignesEnergie.push(
    ligneExcel([
      celluleTexte("Bâtiment — durée d'amortissement"),
      celluleNombre(FACTEUR_BATIMENT_SANTE.dureeAmortissementAns),
      celluleTexte("années"),
      celluleTexte("Choix éditorial"),
    ]),
  );
  lignesEnergie.push(
    ligneExcel([
      celluleTexte("Bâtiment — seuil rénovation lourde"),
      celluleNombre(FACTEUR_BATIMENT_SANTE.seuilRenovationLourde_eur_m2),
      celluleTexte("€/m²"),
      celluleTexte("Réglementation locaux non résidentiels"),
    ]),
  );
  feuilles.push(feuilleExcel("Facteurs - Énergie", lignesEnergie));

  // --- Feuille 7 : Facteurs — Immobilisations ---
  const lignesImmo = [
    ligneExcel([celluleTexte("Élément"), celluleTexte("Valeur brute"), celluleTexte("Unité"), celluleTexte("Source")]),
  ];
  lignesImmo.push(
    ligneExcel([
      celluleTexte("Ordinateur fixe (fabrication)"),
      celluleNombre(FACTEURS_NUMERIQUE_FABRICATION.ordinateurFixe.valeur),
      celluleTexte("kgCO2e"),
      celluleTexte(FACTEURS_NUMERIQUE_FABRICATION.ordinateurFixe.source),
    ]),
  );
  lignesImmo.push(
    ligneExcel([
      celluleTexte("Ordinateur portable (fabrication)"),
      celluleNombre(FACTEURS_NUMERIQUE_FABRICATION.ordinateurPortable.valeur),
      celluleTexte("kgCO2e"),
      celluleTexte(FACTEURS_NUMERIQUE_FABRICATION.ordinateurPortable.source),
    ]),
  );
  lignesImmo.push(
    ligneExcel([
      celluleTexte("Écran supplémentaire (fabrication)"),
      celluleNombre(FACTEURS_NUMERIQUE_FABRICATION.ecranSupplementaire.valeur),
      celluleTexte("kgCO2e"),
      celluleTexte(FACTEURS_NUMERIQUE_FABRICATION.ecranSupplementaire.source),
    ]),
  );
  lignesImmo.push(
    ligneExcel([
      celluleTexte("Équipement lourd standard / autre matériel info."),
      celluleNombre(FE_GROS_MATERIEL_STANDARD),
      celluleTexte("kgCO2e/€"),
      celluleTexte("Base Carbone (repris du socle individuel)"),
    ]),
  );
  lignesImmo.push(
    ligneExcel([
      celluleTexte("Équipement massif (>60kg)"),
      celluleNombre(FE_GROS_MATERIEL_MASSIF),
      celluleTexte("kgCO2e/€"),
      celluleTexte("Base Carbone (repris du socle individuel)"),
    ]),
  );
  for (const [cle, v] of Object.entries(FACTEURS_MOBILIER_UNITE)) {
    lignesImmo.push(
      ligneExcel([
        celluleTexte("Mobilier — " + (LABELS_MOBILIER[cle] || cle)),
        celluleNombre(v),
        celluleTexte("kgCO2e/unité"),
        celluleTexte("Base Carbone V23.10"),
      ]),
    );
  }
  feuilles.push(feuilleExcel("Facteurs - Immobilisations", lignesImmo));

  // --- Feuille 8 : Facteurs — Monétaires et fret ---
  const lignesMonetaire = [ligneExcel([celluleTexte("Élément"), celluleTexte("Valeur"), celluleTexte("Unité")])];
  lignesMonetaire.push(
    ligneExcel([
      celluleTexte("Services administratifs (compta/banque/assurance)"),
      celluleNombre(FE_MONETAIRE.services_administratifs),
      celluleTexte("kgCO2e/€"),
    ]),
  );
  lignesMonetaire.push(
    ligneExcel([
      celluleTexte("Prestations spécialisées (sous-traitance, documentation, licences)"),
      celluleNombre(FE_MONETAIRE.prestations_specialisees),
      celluleTexte("kgCO2e/€"),
    ]),
  );
  lignesMonetaire.push(
    ligneExcel([
      celluleTexte("Biens et consommables (matériel secrétariat)"),
      celluleNombre(FE_MONETAIRE.biens_consommables),
      celluleTexte("kgCO2e/€"),
    ]),
  );
  lignesMonetaire.push(
    ligneExcel([celluleTexte("Fret / colis"), celluleNombre(FE_FRET_COLIS), celluleTexte("kgCO2e/colis")]),
  );
  lignesMonetaire.push(
    ligneExcel([celluleTexte("Repas standard"), celluleNombre(FE_REPAS.standard), celluleTexte("kgCO2e/repas")]),
  );
  lignesMonetaire.push(
    ligneExcel([celluleTexte("Repas végétarien"), celluleNombre(FE_REPAS.vegetarien), celluleTexte("kgCO2e/repas")]),
  );
  lignesMonetaire.push(
    ligneExcel([celluleTexte("Médicaments prescrits"), celluleNombre(FE_MEDICAMENTS_EUR), celluleTexte("kgCO2e/€")]),
  );
  feuilles.push(feuilleExcel("Facteurs - Monétaires", lignesMonetaire));

  // --- Feuille 9 : APL — références nationales ---
  const lignesApl = [
    ligneExcel([celluleTexte("Profession"), celluleTexte("Référence nationale 2024"), celluleTexte("Unité")]),
  ];
  const labelsApl = {
    medecin_generaliste: "Médecin généraliste (≤65 ans)",
    infirmier: "Infirmier(ère)",
    sage_femme: "Sage-femme",
    kinesitherapeute: "Kinésithérapeute",
    chirurgien_dentiste: "Chirurgien(ne)-dentiste",
  };
  APL_PROFESSIONS.forEach((prof, i) => {
    lignesApl.push(
      ligneExcel([
        celluleTexte(labelsApl[prof] || prof),
        celluleNombre(APL_REFERENCE_NATIONALE[i]),
        celluleTexte(prof === "medecin_generaliste" ? "consultations/hab" : "ETP/100 000 hab"),
      ]),
    );
  });
  lignesApl.push(ligneExcel([celluleTexte(""), celluleTexte(""), celluleTexte("")]));
  lignesApl.push(
    ligneExcel([
      celluleTexte("Source"),
      celluleTexte("DREES — data.drees.solidarites-sante.gouv.fr, millésime 2024"),
      celluleTexte(""),
    ]),
  );
  feuilles.push(feuilleExcel("Facteurs - APL", lignesApl));

  const classeur = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${feuilles.join("\n")}
</Workbook>`;

  const dateDuJour = new Date().toISOString().slice(0, 10);
  const nomStructure = (etat.structureMSP.nom || "msp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const nomFichier = `libco2-msp-detail-calculs-${nomStructure || "export"}-${dateDuJour}.xls`;

  const blob = new Blob([classeur], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);

  if (zoneStatut) {
    zoneStatut.classList.remove("aide-alerte");
    zoneStatut.textContent = `Fichier "${nomFichier}" téléchargé — ouvrable directement dans Excel, LibreOffice Calc ou Google Sheets.`;
  }
}
