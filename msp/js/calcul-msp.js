// Calcul pur du bilan d'émissions MSP. Ne touche jamais au DOM (comme calcul.js
// du socle individuel). Toutes les dépendances sont maintenant résolues :
// zonage-insee.js et facteurs-emission.js sont des copies conformes du socle
// individuel fournies par Romaric ; resolve-commune-msp.js et
// facteurs-emission-msp.js sont les seuls ajouts propres à la MSP.

import { ZONES, MOTIFS_MODE_SHARE, modalAjusteParMotif } from './data/zonage-insee.js';
import { resolveZoneFromCommune } from './data/resolve-commune-msp.js';
import {
  FE_TRANSPORT,
  FE_ENERGIE,
  RATIOS_ENERGIE_PAR_ACTIVITE,
  FE_MONETAIRE,
  FE_FRET_COLIS,
  FE_GROS_MATERIEL_STANDARD,
  FE_GROS_MATERIEL_MASSIF,
  FE_REPAS
} from './data/facteurs-emission.js';
import { coefficientRarete } from './data/apl-msp.js';
import {
  FACTEURS_VEHICULES_USAGE_FABRICATION,
  emissionsBatimentAnnuelles,
  emissionsImmobilisationAnnuelles,
  clefReventilationSurface,
  clefReventilationActes,
  FE_MEDICAMENTS_EUR,
  PROFESSIONS_PRESCRIPTRICES,
  calculerTauxDependanceFossile
} from './data/facteurs-emission-msp.js';

// Motif EMP2019 applicable aux MSP : santé/juridique partagent "autres_motifs_personnels"
// faute de mieux dans la donnée SDES (cf. zonage-insee.js). Coefficient APL vérifiable :
// les modes tarés < 5 mots par mode restent identiques au socle individuel.
const MOTIF_MSP = 'autres_motifs_personnels';

// Ratio énergie local MSP : catégorie ADEME "Commerces" (choix éditorial de Romaric,
// plutôt que la catégorie "Santé" du socle individuel). Correspond exactement à
// l'entrée déjà présente dans RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art (103/130).
const RATIO_LOCAL_MSP = RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art;

// ---------------------------------------------------------------------------
// 1. POSTE LOCAL (énergie + bâtiment)
export function calculLocal(structureMSP, anneeActuelle = new Date().getFullYear()) {
  const { surfaceTotale, local } = structureMSP;
  const elec_kWh = local.consoReelle?.elec_kWh ?? surfaceTotale * RATIO_LOCAL_MSP.elec;
  const chauffage_kWh = local.consoReelle?.chauffage_kWh ?? surfaceTotale * RATIO_LOCAL_MSP.chauffage;
  const feChauffage = FE_ENERGIE[local.energieChauffage].value;
  const feElec = FE_ENERGIE.electricite.value;

  let emissionsEnergie = elec_kWh * feElec + chauffage_kWh * feChauffage;

  if (local.localDeporte) {
    const s = local.localDeporte.surface;
    emissionsEnergie += (s * RATIO_LOCAL_MSP.elec) * feElec
                       + (s * RATIO_LOCAL_MSP.chauffage) * FE_ENERGIE.gaz.value; // toujours gaz, convention du socle
  }

  const emissionsBatiment = emissionsBatimentAnnuelles(
    surfaceTotale, local.batiment.anneeConstruction, local.batiment.renovationLourde, anneeActuelle
  );

  return { emissionsEnergie, emissionsBatiment, total: emissionsEnergie + emissionsBatiment };
}

// ---------------------------------------------------------------------------
// 2. DÉPLACEMENTS PATIENTÈLE — pondération APL + ajustement motif (modalAjusteParMotif
// et ZONES sont repris tels quels du socle individuel ; seule la pondération APL est
// ajoutée, appliquée à chaque praticien individuellement plutôt qu'à la zone globale)
export function calculDeplacementsPatientele(praticiens, codeCommuneMSP) {
  const zone = resolveZoneFromCommune(codeCommuneMSP);
  const distancesAjustees = modalAjusteParMotif(zone, MOTIF_MSP); // { mode: km }

  let emissionsTotales = 0;
  const detailParPraticien = [];

  for (const p of praticiens) {
    const coeffRarete = coefficientRarete(p.professionAPL, codeCommuneMSP);
    const nbActesLieuFixe = p.nbActesAnnuel * (p.partLieuFixe / 100);

    let emissionsPraticien = 0;
    for (const [mode, distanceBase] of Object.entries(distancesAjustees)) {
      const distanceAjustee = distanceBase * coeffRarete;
      emissionsPraticien += nbActesLieuFixe * distanceAjustee * FE_TRANSPORT[mode].value;
    }
    emissionsTotales += emissionsPraticien;
    detailParPraticien.push({ id: p.id, coeffRarete, emissions: emissionsPraticien });
  }

  return { total: emissionsTotales, detailParPraticien };
}

// ---------------------------------------------------------------------------
// 2bis. ALIMENTATION PROFESSIONNELLE — par praticien, directe (pas de réventilation)
export function calculAlimentation(praticiens) {
  let emissionsTotales = 0;
  const detailParPraticien = [];

  for (const p of praticiens) {
    const repasAnnuels = p.alimentation.repasParSemaine * p.semainesTravailleesAn;
    const repasVege = repasAnnuels * (p.alimentation.pctVegetarien / 100);
    const repasStandard = repasAnnuels - repasVege;
    const emissions = repasVege * FE_REPAS.vegetarien + repasStandard * FE_REPAS.standard;
    emissionsTotales += emissions;
    detailParPraticien.push({ id: p.id, repasAnnuels, emissions });
  }

  return { total: emissionsTotales, detailParPraticien };
}

// ---------------------------------------------------------------------------
// 2ter. PRESCRIPTIONS — médicaments (SOURCÉ, sans risque de double comptage :
// rien d'autre dans l'outil ne capte la fabrication d'un médicament) + actes
// paramédicaux prescrits réalisés HORS de la structure (Option A retenue :
// les actes prescrits réalisés PAR UN COLLÈGUE DE LA MÊME MSP sont exclus,
// car déjà comptés dans le propre bilan de ce collègue — seuls les actes
// externes sont ajoutés ici, pour ne jamais compter deux fois la même
// émission au sein du total MSP).
//
// Le poids d'un acte externe est estimé par le ratio kgCO2e/acte déjà
// mesuré POUR CETTE PROFESSION AU SEIN DE LA MÊME MSP (meilleure référence
// locale disponible, à défaut d'un bilan réel du praticien externe) — ESTIMÉ
// et explicitement signalé comme tel. Si aucun praticien de cette profession
// n'existe dans la MSP, l'acte externe n'est pas chiffrable (0, signalé).
export function calculerRatiosParActeParProfession(praticiens, empreintesPraticiensBase) {
  const sommeParProfession = {};
  for (const p of praticiens) {
    const e = empreintesPraticiensBase.find(x => x.id === p.id);
    if (!e || !p.professionAPL || !p.nbActesAnnuel) continue;
    if (!sommeParProfession[p.professionAPL]) sommeParProfession[p.professionAPL] = { emissions: 0, actes: 0 };
    sommeParProfession[p.professionAPL].emissions += e.total;
    sommeParProfession[p.professionAPL].actes += p.nbActesAnnuel;
  }
  const ratios = {};
  for (const [profession, s] of Object.entries(sommeParProfession)) {
    ratios[profession] = s.actes > 0 ? s.emissions / s.actes : null;
  }
  return ratios;
}

export function calculPrescriptions(praticiens, ratiosParActeParProfession) {
  let emissionsTotales = 0;
  const detailParPraticien = [];

  for (const p of praticiens) {
    if (!PROFESSIONS_PRESCRIPTRICES.includes(p.professionAPL)) continue;
    const emissionsMedicaments = (p.prescriptions?.montantAnnuelMedicaments || 0) * FE_MEDICAMENTS_EUR;

    let emissionsActesExternes = 0;
    for (const ligne of p.prescriptions?.actesParamedicauxExternes || []) {
      const ratio = ratiosParActeParProfession[ligne.profession];
      if (ratio != null) emissionsActesExternes += ligne.nbActesAnnuel * ratio;
    }

    const total = emissionsMedicaments + emissionsActesExternes;
    emissionsTotales += total;
    detailParPraticien.push({ id: p.id, emissionsMedicaments, emissionsActesExternes, total });
  }

  return { total: emissionsTotales, detailParPraticien };
}

/**
 * Fonction générique : répartit un kilométrage annuel entre plusieurs modes
 * (ex. 70% voiture / 30% vélo), chaque mode appliquant son propre facteur
 * usage/fabrication. Réutilisée pour les trois blocs de la section
 * "Déplacements" d'un praticien (domicile-travail, tournées, déplacements
 * professionnels annuels), qui ne diffèrent que par la façon dont le
 * kilométrage annuel total est obtenu en amont.
 */
function calculModeMixteAnnuel(kmAnnuelsTotal, modes) {
  let emissionsUsage = 0;
  let emissionsFabricationVehicule = 0;
  for (const { mode, part } of modes) {
    const kmAnnuelsMode = kmAnnuelsTotal * (part / 100);
    const fVehicule = FACTEURS_VEHICULES_USAGE_FABRICATION[mode];
    if (fVehicule) {
      emissionsUsage += kmAnnuelsMode * fVehicule.usage;
      emissionsFabricationVehicule += kmAnnuelsMode * fVehicule.fabrication;
    } else {
      emissionsUsage += kmAnnuelsMode * FE_TRANSPORT[mode].value; // dont marche = 0
    }
  }
  return { kmAnnuels: kmAnnuelsTotal, emissionsUsage, emissionsFabricationVehicule };
}

function calculDomicileTravailUnePersonne(km_aller, mode, joursSemaine, semainesAn) {
  const kmAnnuels = km_aller * 2 * joursSemaine * semainesAn;
  const fVehicule = FACTEURS_VEHICULES_USAGE_FABRICATION[mode];
  if (fVehicule) {
    return {
      kmAnnuels,
      emissionsUsage: kmAnnuels * fVehicule.usage,
      emissionsFabricationVehicule: kmAnnuels * fVehicule.fabrication
    };
  }
  return { kmAnnuels, emissionsUsage: kmAnnuels * FE_TRANSPORT[mode].value, emissionsFabricationVehicule: 0 };
}

export function calculDeplacementsDomicileTravail(praticiens, staffAdmin) {
  // Chaque catégorie de trajet reste isolée (pas de fusion), pour permettre
  // une restitution détaillée poste par poste plutôt qu'un seul agrégat.
  let usageDomicileTravail = 0, fabricationDomicileTravail = 0;
  let usageTournees = 0, fabricationTournees = 0;
  let usageDeplacementsProAnnuels = 0, fabricationDeplacementsProAnnuels = 0;
  const detailParPraticien = [];

  for (const p of praticiens) {
    const kmAnnuelsDomicileTravail = p.distanceDomicileTravail * 2 * p.joursTravaillesSemaine * p.semainesTravailleesAn;
    const rTrajet = calculModeMixteAnnuel(kmAnnuelsDomicileTravail, p.modesDomicileTravail);
    const rTournees = calculModeMixteAnnuel(p.tourneesDomicile.kmAnnuel, p.tourneesDomicile.modes);
    const rCongres = calculModeMixteAnnuel(p.deplacementsProAnnuels.kmAnnuel, p.deplacementsProAnnuels.modes);

    usageDomicileTravail += rTrajet.emissionsUsage;
    fabricationDomicileTravail += rTrajet.emissionsFabricationVehicule;
    usageTournees += rTournees.emissionsUsage;
    fabricationTournees += rTournees.emissionsFabricationVehicule;
    usageDeplacementsProAnnuels += rCongres.emissionsUsage;
    fabricationDeplacementsProAnnuels += rCongres.emissionsFabricationVehicule;

    detailParPraticien.push({
      id: p.id,
      domicileTravail: rTrajet,
      tournees: rTournees,
      deplacementsProAnnuels: rCongres,
      kmAnnuels: rTrajet.kmAnnuels + rTournees.kmAnnuels + rCongres.kmAnnuels,
      emissionsUsage: rTrajet.emissionsUsage + rTournees.emissionsUsage + rCongres.emissionsUsage,
      emissionsFabricationVehicule: rTrajet.emissionsFabricationVehicule + rTournees.emissionsFabricationVehicule + rCongres.emissionsFabricationVehicule
    });
  }

  // Le staff admin n'a qu'un trajet domicile-travail (pas de tournées ni de congrès à ce jour).
  // Conservé isolément (en plus d'être ajouté aux agrégats) pour pouvoir calculer
  // l'empreinte propre du staff admin, distincte de celle des praticiens.
  const rAdmin = calculDomicileTravailUnePersonne(
    staffAdmin.distanceDomicileTravailMoyenne, staffAdmin.modeDomicileTravailMoyen,
    staffAdmin.joursTravaillesSemaine, staffAdmin.semainesTravailleesAn
  );
  const usageAdmin = rAdmin.emissionsUsage * staffAdmin.etp;
  const fabricationAdmin = rAdmin.emissionsFabricationVehicule * staffAdmin.etp;
  usageDomicileTravail += usageAdmin;
  fabricationDomicileTravail += fabricationAdmin;

  return {
    domicileTravail: { usage: usageDomicileTravail, fabricationVehicule: fabricationDomicileTravail, total: usageDomicileTravail + fabricationDomicileTravail },
    tournees: { usage: usageTournees, fabricationVehicule: fabricationTournees, total: usageTournees + fabricationTournees },
    deplacementsProAnnuels: { usage: usageDeplacementsProAnnuels, fabricationVehicule: fabricationDeplacementsProAnnuels, total: usageDeplacementsProAnnuels + fabricationDeplacementsProAnnuels },
    staffAdmin: { usage: usageAdmin, fabricationVehicule: fabricationAdmin, total: usageAdmin + fabricationAdmin },
    // Agrégats conservés pour le calcul de l'empreinte totale
    usageTotal: usageDomicileTravail + usageTournees + usageDeplacementsProAnnuels,
    fabricationVehiculeTotal: fabricationDomicileTravail + fabricationTournees + fabricationDeplacementsProAnnuels,
    detailParPraticien
  };
}

// ---------------------------------------------------------------------------
// 4. IMMOBILISATIONS (numérique, matériel lourd, mobilier) — durée de détention déclarée
export function calculImmobilisations(lignesImmobilisation) {
  return lignesImmobilisation.reduce(
    (total, l) => total + emissionsImmobilisationAnnuelles(l.quantite, l.facteurUnitaireBrut, l.dureeDetentionAns),
    0
  );
}

// ---------------------------------------------------------------------------
// 5. POSTES MUTUALISÉS
export function calculPostesMutualises(postesMutualises) {
  const materielSecretariat = postesMutualises.materielSecretariat.montantAnnuelConsommables * FE_MONETAIRE.biens_consommables;
  const services = (postesMutualises.services.comptaBanqueAssurance + postesMutualises.services.sousTraitance) * FE_MONETAIRE.services_intellectuels;
  const fret = postesMutualises.fret.nbColisAn * FE_FRET_COLIS;
  return { materielSecretariat, services, fret, total: materielSecretariat + services + fret };
}

// ---------------------------------------------------------------------------
// 6. RÉVENTILATION
/**
 * Réventilation du poste local par surface déclarée. Si la somme des
 * surfaces dédiées (praticiens + staff admin) est inférieure à la surface
 * totale de la structure, la surface résiduelle (espaces communs non
 * explicitement répartis : couloirs, accueil...) est rattachée aux
 * fonctions support de la MSP plutôt que de rester orpheline — garantit que
 * la somme des parts individuelles reconstitue toujours exactement le total.
 */
export function reventilerLocal(emissionsLocalTotal, praticiens, staffAdmin, surfaceTotale) {
  const surfaceDeclaree = praticiens.reduce((s, p) => s + (p.surfaceDediee || 0), 0) + (staffAdmin.surfaceDediee || 0);
  const surfaceResiduelle = Math.max(surfaceTotale - surfaceDeclaree, 0);

  const result = praticiens.map(p => ({
    id: p.id, part: emissionsLocalTotal * clefReventilationSurface(p.surfaceDediee, surfaceTotale)
  }));
  const partAdminDeclaree = emissionsLocalTotal * clefReventilationSurface(staffAdmin.surfaceDediee, surfaceTotale);
  const partResiduelle = emissionsLocalTotal * clefReventilationSurface(surfaceResiduelle, surfaceTotale);
  result.push({ id: 'staffAdmin', part: partAdminDeclaree + partResiduelle });
  return result;
}

/**
 * Réventilation des postes mutualisés (matériel secrétariat, services, fret,
 * ainsi que le poste local et l'empreinte propre du staff admin dans le
 * calcul global) : clé = actes réalisés EN CABINET uniquement (nbActesAnnuel
 * × partLieuFixe), pas le nombre total d'actes. Les séances à domicile ne
 * consomment ni le secrétariat ni le local partagé — leur impact carbone
 * propre (tournées) est déjà comptabilisé séparément, par praticien.
 */
export function reventilerPostesSupport(emissionsSupportTotal, praticiens) {
  const totalActesCabinet = praticiens.reduce((s, p) => s + p.nbActesAnnuel * (p.partLieuFixe / 100), 0);
  return praticiens.map(p => {
    const actesCabinet = p.nbActesAnnuel * (p.partLieuFixe / 100);
    return { id: p.id, part: emissionsSupportTotal * clefReventilationActes(actesCabinet, totalActesCabinet) };
  });
}

// ---------------------------------------------------------------------------
// 7. EMPREINTE INDIVIDUELLE — chaque praticien et le staff admin (fonctions
// support de la MSP) obtiennent leur propre empreinte complète, pour cibler
// les bonnes actions de décarbonation à la bonne personne/fonction. La somme
// de toutes les empreintes individuelles reconstitue exactement l'empreinte
// totale de la MSP (aucune double comptabilisation, aucun résidu).

// ---------------------------------------------------------------------------
// 8. AGRÉGATION FINALE
export function calculBilanMSP(structureMSP, praticiens, staffAdmin, postesMutualises, immobilisationsParPraticien = {}, immobilisationsAdmin = [], lignesMaterielPartage = [], anneeActuelle) {
  const local = calculLocal(structureMSP, anneeActuelle);
  const patientele = calculDeplacementsPatientele(praticiens, structureMSP.commune);
  const domicileTravail = calculDeplacementsDomicileTravail(praticiens, staffAdmin);
  const alimentation = calculAlimentation(praticiens);
  const support = calculPostesMutualises(postesMutualises);
  // Matériel lourd partagé entre plusieurs praticiens (ex. échographe
  // commun) : réventilé comme les autres postes mutualisés, au prorata des
  // actes en cabinet — évite le "trou" où un équipement utilisé par
  // plusieurs praticiens n'avait nulle part où être déclaré.
  support.materielPartage = calculImmobilisations(lignesMaterielPartage);
  support.total += support.materielPartage;

  const immobilisationsParPraticienTotal = {};
  let immobilisationsPraticiensTotal = 0;
  for (const p of praticiens) {
    const t = calculImmobilisations(immobilisationsParPraticien[p.id] || []);
    immobilisationsParPraticienTotal[p.id] = t;
    immobilisationsPraticiensTotal += t;
  }
  const immobilisationsAdminTotal = calculImmobilisations(immobilisationsAdmin);
  const totalImmobilisations = immobilisationsPraticiensTotal + immobilisationsAdminTotal;

  const totalActes = praticiens.reduce((s, p) => s + p.nbActesAnnuel, 0);

  const empreinteTotale = local.total
    + patientele.total
    + domicileTravail.usageTotal
    + domicileTravail.fabricationVehiculeTotal
    + alimentation.total
    + support.total
    + totalImmobilisations;

  const reventilationLocalArr = reventilerLocal(local.total, praticiens, staffAdmin, structureMSP.surfaceTotale);
  const reventilationSupportArr = reventilerPostesSupport(support.total, praticiens);

  // Empreinte complète de chaque praticien (base, avant prescriptions) : sa
  // part de local (clé surface) + ses émissions patientèle propres + ses
  // déplacements pro propres (domicile-travail + tournées + congrès) + son
  // alimentation propre + ses immobilisations dédiées + sa part des postes
  // mutualisés (clé actes cabinet).
  const empreintesPraticiensBase = praticiens.map(p => {
    const partLocal = reventilationLocalArr.find(x => x.id === p.id)?.part ?? 0;
    const partPatientele = patientele.detailParPraticien.find(x => x.id === p.id)?.emissions ?? 0;
    const detailDT = domicileTravail.detailParPraticien.find(x => x.id === p.id);
    const partDeplacementsPro = detailDT ? (detailDT.emissionsUsage + detailDT.emissionsFabricationVehicule) : 0;
    const partAlimentation = alimentation.detailParPraticien.find(x => x.id === p.id)?.emissions ?? 0;
    const partImmobilisations = immobilisationsParPraticienTotal[p.id] || 0;
    const partSupport = reventilationSupportArr.find(x => x.id === p.id)?.part ?? 0;
    const total = partLocal + partPatientele + partDeplacementsPro + partAlimentation + partImmobilisations + partSupport;
    return { id: p.id, partLocal, partPatientele, partDeplacementsPro, partAlimentation, partImmobilisations, partSupport, total };
  });

  // Deuxième passe : prescriptions. Le ratio kgCO2e/acte "de référence" par
  // profession est dérivé du bilan de base ci-dessus (sans prescriptions),
  // pour servir de meilleure estimation locale disponible aux actes
  // paramédicaux prescrits réalisés hors de la MSP (cf. calculPrescriptions).
  const ratiosParActeParProfession = calculerRatiosParActeParProfession(praticiens, empreintesPraticiensBase);
  const prescriptions = calculPrescriptions(praticiens, ratiosParActeParProfession);

  const empreintesPraticiens = empreintesPraticiensBase.map(e => {
    const partPrescriptions = prescriptions.detailParPraticien.find(x => x.id === e.id)?.total ?? 0;
    return { ...e, partPrescriptions, total: e.total + partPrescriptions };
  });

  const empreinteTotaleAvecPrescriptions = empreinteTotale + prescriptions.total;

  // Empreinte propre du staff admin (fonctions support) : sa part de local +
  // son trajet domicile-travail + ses immobilisations propres. Ne reçoit pas
  // de part des postes mutualisés (c'est lui qui les "porte", pas l'inverse),
  // ni d'alimentation ni de prescriptions (postes saisis uniquement pour les
  // praticiens concernés à ce jour).
  const partLocalAdmin = reventilationLocalArr.find(x => x.id === 'staffAdmin')?.part ?? 0;
  const empreinteStaffAdmin = {
    partLocal: partLocalAdmin,
    partDeplacements: domicileTravail.staffAdmin.total,
    partImmobilisations: immobilisationsAdminTotal,
    total: partLocalAdmin + domicileTravail.staffAdmin.total + immobilisationsAdminTotal
  };

  const ratioParActeFinal = totalActes > 0 ? empreinteTotaleAvecPrescriptions / totalActes : null;

  return {
    parPoste: { local, patientele, domicileTravail, alimentation, prescriptions, support, immobilisations: totalImmobilisations },
    empreinteTotale: empreinteTotaleAvecPrescriptions,
    ratioParActe: ratioParActeFinal,
    tauxDependanceFossile: calculerTauxDependanceFossile(ratioParActeFinal),
    reventilationLocal: reventilationLocalArr,
    reventilationSupport: reventilationSupportArr,
    empreintesPraticiens,
    empreinteStaffAdmin
  };
}
