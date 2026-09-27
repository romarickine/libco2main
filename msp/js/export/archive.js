/**
 * export/archive.js — fichiers JSON (tableau de bord, archive)
 * ---------------------------------------------------------------------------
 * Export anonymisé pour le tableau de bord collectif (après consentement)
 * et archive de l'historique des bilans, à réimporter sur un autre appareil.
 *
 * Utilisé par : ui/evenements.js.
 * (Découpé de ui-msp.js en septembre 2026 : un fichier par responsabilité.)
 */
import { exporterArchive, getEtat, importerArchive } from "../main-msp.js";
import { rendreEcran } from "../ui-msp.js";

// ---------------------------------------------------------------------------
// ARCHIVE — export/import de l'historique des bilans, pour suivre
// l'évolution de la MSP dans le temps.
function telechargerJSON(objet, nomFichier) {
  const blob = new Blob([JSON.stringify(objet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PARTAGE POUR TABLEAU DE BORD — export anonymisé et volontaire (opt-in),
// distinct de l'archive complète. Le consentement est recueilli au moment
// de l'export et tracé DANS le fichier lui-même (texte + horodatage), pour
// qu'il reste rattaché à la donnée même si l'e-mail d'envoi se perd.
// Pas de collecte automatique, pas de service en ligne à maintenir : le
// fichier est ensuite compilé hors ligne, à la demande, avec l'outil
// "Compilateur tableau de bord MSP" fourni séparément.
const TEXTE_CONSENTEMENT_DASHBOARD =
  'En cliquant sur "Exporter et partager", vous acceptez que les données de ce fichier (empreinte carbone de votre structure, répartition par poste, détail par praticien sans aucun nom ni donnée personnelle identifiable au-delà du nom de la structure) soient transmises à libetco2@gmail.com pour construire un tableau de bord comparatif entre structures participantes. Vous pouvez en demander la suppression à tout moment en contactant cette même adresse.';

/**
 * Télécharge l'export anonymisé destiné au tableau de bord collectif :
 * consentement horodaté, totaux par poste, praticiens désignés « Praticien 1,
 * 2… » (aucun nom). Ne fait rien tant que le bilan n'est pas calculé.
 */
export function exporterDashboard() {
  const zoneStatut = document.getElementById("dashboard-statut");
  const etat = getEtat();
  const r = etat.dernierResultat;
  if (!r) {
    if (zoneStatut) {
      zoneStatut.classList.add("aide-alerte");
      zoneStatut.textContent = 'Calculez d\'abord le bilan (bouton "Calculer le bilan" en haut de cet écran).';
    }
    return;
  }

  const nomsPraticiensAnonymes = Object.fromEntries(etat.praticiens.map((p, i) => [p.id, `Praticien ${i + 1}`]));

  const export_ = {
    consentement: { texte: TEXTE_CONSENTEMENT_DASHBOARD, accepteLe: new Date().toISOString() },
    structure: { nom: etat.structureMSP.nom || null, commune: etat.structureMSP.commune || null },
    empreinteTotale_tCO2e_an: r.empreinteTotale / 1000,
    ratioParActe_kgCO2e: r.ratioParActe,
    repartitionParPoste_kgCO2e: {
      local: r.parPoste.local.total,
      patientele: r.parPoste.patientele.total,
      deplacementsPro: r.parPoste.domicileTravail.usageTotal + r.parPoste.domicileTravail.fabricationVehiculeTotal,
      alimentation: r.parPoste.alimentation.total,
      prescriptions: r.parPoste.prescriptions.total,
      postesMutualises: r.parPoste.support.total,
      immobilisations: r.parPoste.immobilisations,
    },
    praticiens: etat.praticiens.map((p) => {
      const e = r.empreintesPraticiens.find((x) => x.id === p.id);
      return {
        id: nomsPraticiensAnonymes[p.id],
        profession: p.professionAPL,
        total_kgCO2e_an: e.total,
        repartitionParPoste_kgCO2e: {
          local: e.partLocal,
          patientele: e.partPatientele,
          deplacementsPro: e.partDeplacementsPro,
          alimentation: e.partAlimentation,
          prescriptions: e.partPrescriptions,
          postesMutualises: e.partSupport,
          immobilisations: e.partImmobilisations,
        },
      };
    }),
    fonctionsSupport: {
      total_kgCO2e_an: r.empreinteStaffAdmin.total,
      repartitionParPoste_kgCO2e: {
        local: r.empreinteStaffAdmin.partLocal,
        deplacementsPro: r.empreinteStaffAdmin.partDeplacements,
        immobilisations: r.empreinteStaffAdmin.partImmobilisations,
      },
    },
  };

  const dateDuJour = new Date().toISOString().slice(0, 10);
  const nomStructure = (etat.structureMSP.nom || "msp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  telechargerJSON(export_, `libco2-msp-dashboard-${nomStructure || "export"}-${dateDuJour}.json`);

  if (zoneStatut) {
    zoneStatut.classList.remove("aide-alerte");
    zoneStatut.textContent =
      "Fichier téléchargé — envoyez-le par e-mail à l'adresse indiquée dans le texte ci-dessus pour qu'il soit intégré au tableau de bord.";
  }
}

/**
 * Télécharge l'historique complet des bilans (JSON), à réimporter sur un
 * autre appareil ou navigateur.
 */
export function exporterArchiveVersFichier() {
  const archive = exporterArchive();
  const dateDuJour = new Date().toISOString().slice(0, 10);
  telechargerJSON(archive, `libco2-msp-archive-${dateDuJour}.json`);
  const zoneStatut = document.getElementById("archive-statut");
  if (zoneStatut) {
    zoneStatut.classList.remove("aide-alerte");
    zoneStatut.textContent = `Archive téléchargée (${archive.bilans.length} bilan(s)).`;
  }
}

/**
 * Lit une archive JSON choisie par l'utilisateur et ajoute ses bilans à
 * l'historique ; le résultat (ou l'erreur) s'affiche dans la page.
 * @param {File} fichier
 */
export function importerArchiveDepuisFichier(fichier) {
  const zoneStatut = document.getElementById("archive-statut");
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const archive = JSON.parse(lecteur.result);
      const resultat = importerArchive(archive);
      if (zoneStatut) {
        zoneStatut.classList.remove("aide-alerte");
        zoneStatut.textContent = `${resultat.importes} bilan(s) importé(s)${resultat.ignores ? `, ${resultat.ignores} déjà présent(s) ignoré(s)` : ""}.`;
      }
      rendreEcran(getEtat());
    } catch (erreur) {
      if (zoneStatut) {
        zoneStatut.classList.add("aide-alerte");
        zoneStatut.textContent = `Échec de l'import : ${erreur.message}`;
      }
    }
  };
  lecteur.readAsText(fichier);
}
