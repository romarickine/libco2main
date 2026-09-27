/**
 * etat-initial.js
 * ---------------------------------------------------------------------------
 * Rôle : décrire la forme d'une saisie complète de Lib&CO2 Cab (valeurs par
 * défaut de chaque étape du formulaire) et compléter un brouillon ancien avec
 * les champs ajoutés depuis.
 *
 * Pourquoi un module séparé : main.js démarre l'application dès son
 * chargement (accès à la page). Isoler ces fonctions pures permet de les
 * réutiliser dans les tests (tests/cab.test.js) sans navigateur.
 *
 * Utilisé par : main.js, tests/cab.test.js.
 * Dépendances : data/facteurs-emission.js (liste des familles de métiers).
 */
import { FAMILLES } from "../../shared/js/data/facteurs-emission.js";

/**
 * Renvoie une saisie complète avec les valeurs par défaut du formulaire.
 * Unités : distances en km, surfaces en m², montants en €/an.
 * @returns {object} { profil, deplacements, local, numerique, materiel, … }
 */
export function etatInitial() {
  return {
    profil: {
      familleId: "sante",
      metierId: FAMILLES[0].metiers[0],
      mode: "seul",
      nbPraticiens: 1,
      nbSalaries: 0,
      zoneId: "moyen_pole",
      villeLabel: "",
      nbActesAn: 3000,
      partCabinet: 70,
      recoitPublic: true,
    },
    deplacements: {
      modeDomTrav: "voiture_thermique",
      kmAllerJour: 8,
      joursSemaine: 4.5,
      semainesAn: 45,
      kmVisitesAn: 1500,
      modeVisites: "voiture_thermique",
      nbCongresAn: 2,
      modeCongres: "train_tgv",
      kmCongresAR: 400,
    },
    local: {
      aLocal: true,
      surface: 40,
      energieChauffage: "gaz",
      consoElecConnue: false,
      consoElecKwh: 0,
      consoChauffageConnue: false,
      consoChauffageKwh: 0,
      localDeporte: false,
      surfaceDeportee: 15,
    },
    numerique: { nbOrdisFixes: 0, nbOrdisPortables: 1, nbEcransSuppl: 1, usage: "moyen" },
    materiel: {},
    investissements: { actif: false, mobilier: 0, gros: {} },
    dechets: {
      plastique: 0,
      metal: 0,
      papier: 0,
      carton: 0,
      aluminium: 0,
      verre: 0,
      menagers: 0,
      electronique: 0,
      dasri: 0,
    },
    alimentation: { repasParSemaine: 2, partVegetarienne: 30 },
    services: { servicesAn: 3000, sousTraitanceAn: 1000, nbColisAn: 20 },
    pharmacien: { caMedicaments: 0, caParapharmacie: 0 },
    prescriptions: { active: false, depenseMedicaments: 0, depenseActes: 0 },
  };
}

// Fusionne un état sauvegardé (brouillon ou bilan historique) avec les
// valeurs par défaut actuelles, section par section. Indispensable pour
// rester compatible avec des données enregistrées par une version
// antérieure de l'outil : si un nouveau champ ou une nouvelle section est
// ajoutée au formulaire plus tard, un ancien brouillon ne doit jamais faire
// planter le rendu faute de cette clé — il doit simplement récupérer sa
// valeur par défaut. Sans cette fusion, l'écran correspondant reste blanc
// (erreur JS silencieuse en production).
export function fusionnerAvecDefauts(donneesSauvegardees) {
  const defauts = etatInitial();
  const fusion = {};
  for (const section of Object.keys(defauts)) {
    fusion[section] = { ...defauts[section], ...(donneesSauvegardees[section] || {}) };
  }
  return fusion;
}
