/**
 * calcul.js
 * ----------------------------------------------------------------------
 * Fonctions de calcul pur du bilan d'émissions Lib&CO2. Aucune de ces
 * fonctions ne touche au DOM : elles prennent des données en entrée et
 * renvoient des nombres/objets en sortie, ce qui les rend testables
 * indépendamment de l'interface (voir js/ui.js pour l'affichage).
 * ----------------------------------------------------------------------
 */
import {
  FE_TRANSPORT, FE_ENERGIE, RATIOS_ENERGIE_PAR_ACTIVITE,
  FE_NUMERIQUE, FE_REPAS, FE_MONETAIRE, FE_FRET_COLIS, FE_MOBILIER, DUREE_AMORTISSEMENT_ANS,
  ACTIONS, COST_WEIGHT,
} from "./data/facteurs-emission.js";
import { emissionsPatienteleParActe } from "./data/zonage-insee.js";

// Calcule l'empreinte carbone liée aux déplacements professionnels
// (domicile-travail + visites + congrès/formations).
// Entrée : data.deplacements (état du formulaire)
// Sortie : { domTrav, visites, congres, total } en kgCO2e/an
export function calculDeplacementsPro(d) {
  const kmDomTravAn = d.kmAllerJour * 2 * d.joursSemaine * d.semainesAn;
  const domTrav = kmDomTravAn * FE_TRANSPORT[d.modeDomTrav].value;
  const visites = d.kmVisitesAn * FE_TRANSPORT[d.modeVisites].value;
  const feCongres = FE_TRANSPORT[d.modeCongres === "train_tgv" ? "tgv" : d.modeCongres].value;
  const congres = d.nbCongresAn * d.kmCongresAR * feCongres;
  return { domTrav, visites, congres, total: domTrav + visites + congres };
}

// Calcule l'empreinte des déplacements de la patientèle/clientèle vers le
// lieu fixe, à partir du report modal géographique de la zone, ajusté selon
// le motif de déplacement propre à la famille de métier (EMP 2019).
// Entrée : { zone, motifId, nbActesAn, partCabinet, recoitPublic, aLocal }
// Sortie : { total, nbActesLieuFixe } en kgCO2e/an
export function calculDeplacementsPatientele({ zone, motifId, nbActesAn, partCabinet, recoitPublic, aLocal }) {
  if (!recoitPublic || !aLocal) return { total: 0, nbActesLieuFixe: 0 };
  const nbActesLieuFixe = nbActesAn * (partCabinet / 100);
  const total = nbActesLieuFixe * emissionsPatienteleParActe(zone, motifId, FE_TRANSPORT);
  return { total, nbActesLieuFixe };
}

// Calcule l'empreinte du local professionnel (énergie), y compris un
// éventuel local déporté. Les ratios de consommation par défaut (à défaut
// de facture connue) varient selon l'activité de la famille de métier
// (ADEME/CEREN, Bâtiment - Chiffres clés 2012 : Santé, Bureaux, Commerces...).
// Entrée : data.local, familleId (clé de RATIOS_ENERGIE_PAR_ACTIVITE)
// Sortie : { elec, chauffage, deporte, total } en kgCO2e/an
export function calculLocal(l, familleId) {
  if (!l.aLocal) return { elec: 0, chauffage: 0, deporte: 0, total: 0 };
  const ratios = RATIOS_ENERGIE_PAR_ACTIVITE[familleId] || RATIOS_ENERGIE_PAR_ACTIVITE.autre;
  const elecKwh = l.consoElecConnue ? l.consoElecKwh : l.surface * ratios.elec;
  const chauffageKwh = l.consoChauffageConnue ? l.consoChauffageKwh : l.surface * ratios.chauffage;
  const elec = elecKwh * FE_ENERGIE.electricite.value;
  const chauffage = chauffageKwh * FE_ENERGIE[l.energieChauffage].value;
  let deporte = 0;
  if (l.localDeporte) {
    const elecDep = l.surfaceDeportee * ratios.elec;
    const chauffDep = l.surfaceDeportee * ratios.chauffage;
    deporte = elecDep * FE_ENERGIE.electricite.value + chauffDep * FE_ENERGIE.gaz.value;
  }
  return { elec, chauffage, deporte, total: elec + chauffage + deporte };
}

// Calcule l'empreinte numérique (matériel + usage).
// Entrée : data.numerique
// Sortie : { ordisFixes, ordisPortables, ecrans, usage, total } en kgCO2e/an
export function calculNumerique(n) {
  const ordisFixes = n.nbOrdisFixes * FE_NUMERIQUE.ordi_fixe_an;
  const ordisPortables = n.nbOrdisPortables * FE_NUMERIQUE.ordi_portable_an;
  const ecrans = n.nbEcransSuppl * FE_NUMERIQUE.ecran_an;
  const usage = FE_NUMERIQUE.usage_an[n.usage];
  return { ordisFixes, ordisPortables, ecrans, usage, total: ordisFixes + ordisPortables + ecrans + usage };
}

// Calcule l'empreinte du matériel et consommables métier (postes courants
// + gros matériel/mobilier amortis si l'utilisateur a coché ce cas).
// Entrée : famille (objet FAMILLES), materiel (€/an par poste),
//          investissements ({ actif, mobilier, gros })
// Sortie : { detailConsommables, detailGros, mobilier, total } en kgCO2e/an
export function calculMateriel(famille, materiel, investissements) {
  const detailConsommables = {};
  let totalConsommables = 0;
  famille.consommables.forEach((c) => {
    const euros = materiel[c.id] || 0;
    const kg = euros * c.factor;
    detailConsommables[c.id] = kg;
    totalConsommables += kg;
  });

  const detailGros = {};
  let totalGros = 0;
  let mobilier = 0;
  if (investissements.actif) {
    (famille.grosMateriel || []).forEach((g) => {
      const valeur = investissements.gros[g.id] || 0;
      const kg = (valeur * g.factor) / DUREE_AMORTISSEMENT_ANS;
      detailGros[g.id] = kg;
      totalGros += kg;
    });
    mobilier = (investissements.mobilier * FE_MOBILIER) / DUREE_AMORTISSEMENT_ANS;
  }

  return { detailConsommables, detailGros, mobilier, total: totalConsommables + totalGros + mobilier };
}

// Calcule l'empreinte de l'alimentation professionnelle.
// Entrée : { repasParSemaine, partVegetarienne, semainesAn }
// Sortie : total en kgCO2e/an
export function calculAlimentation({ repasParSemaine, partVegetarienne, semainesAn }) {
  const repasAn = repasParSemaine * semainesAn;
  const repasVege = repasAn * (partVegetarienne / 100);
  const repasStd = repasAn - repasVege;
  return repasVege * FE_REPAS.vegetarien + repasStd * FE_REPAS.standard;
}

// Calcule l'empreinte des achats de services et du fret/livraisons.
// Entrée : data.services
// Sortie : { compta, sousTraitance, fret, total } en kgCO2e/an
export function calculServicesEtFret(s) {
  const compta = s.servicesAn * FE_MONETAIRE.services_administratifs;
  const sousTraitance = s.sousTraitanceAn * FE_MONETAIRE.prestations_specialisees;
  const fret = s.nbColisAn * FE_FRET_COLIS;
  return { compta, sousTraitance, fret, total: compta + sousTraitance + fret };
}

// Calcule l'empreinte des médicaments et de la parapharmacie vendus par une
// officine (poste spécifique au métier "Pharmacien(ne) titulaire d'officine").
// Entrée : { caMedicaments, caParapharmacie } (chiffre d'affaires € HT/an)
// Sortie : { medicaments, parapharmacie, total } en kgCO2e/an
export function calculMedicaments({ caMedicaments = 0, caParapharmacie = 0 } = {}) {
  const medicaments = caMedicaments * FE_MONETAIRE.medicaments;
  const parapharmacie = caParapharmacie * FE_MONETAIRE.biens_consommables;
  return { medicaments, parapharmacie, total: medicaments + parapharmacie };
}

// Calcule l'empreinte des prescriptions (médicaments + actes médicaux
// prescrits : examens complémentaires, dispositifs) pour les professions de
// santé habilitées à prescrire. Poste optionnel et distinct du reste du
// bilan, pour permettre une comparaison à périmètre équivalent entre
// praticiens prescripteurs et non-prescripteurs (voir affichage résultats).
// Entrée : { active, depenseMedicaments, depenseActes } (€/an, pour
//           l'ensemble de la patientèle de la structure)
// Sortie : { medicaments, actes, total } en kgCO2e/an
export function calculPrescriptions({ active = false, depenseMedicaments = 0, depenseActes = 0 } = {}) {
  if (!active) return { medicaments: 0, actes: 0, total: 0 };
  const medicaments = depenseMedicaments * FE_MONETAIRE.medicaments;
  const actes = depenseActes * FE_MONETAIRE.actes_medicaux;
  return { medicaments, actes, total: medicaments + actes };
}

// Calcule le bilan d'émissions complet à partir de l'état du formulaire.
// Entrée : data (état complet du formulaire), famille (objet FAMILLES), zone (objet ZONES)
// Sortie : { parPoste, totalKg, totalT, parActe, detail, nbActesLieuFixe,
//            totalKgHorsPrescriptions, totalTHorsPrescriptions }
export function calculerBilan(data, famille, zone) {
  const dp = calculDeplacementsPro(data.deplacements);
  const dc = calculDeplacementsPatientele({
    zone, motifId: famille.motifDeplacement, nbActesAn: data.profil.nbActesAn, partCabinet: data.profil.partCabinet,
    recoitPublic: data.profil.recoitPublic, aLocal: data.local.aLocal,
  });
  const lo = calculLocal(data.local, famille.id);
  const nu = calculNumerique(data.numerique);
  const ma = calculMateriel(famille, data.materiel, data.investissements);
  const al = calculAlimentation({ ...data.alimentation, semainesAn: data.deplacements.semainesAn });
  const se = calculServicesEtFret(data.services);
  const med = calculMedicaments(data.pharmacien);
  const presc = calculPrescriptions(data.prescriptions);

  const parPoste = {
    deplacements_pro: dp.total,
    deplacements_patientele: dc.total,
    local: lo.total,
    numerique: nu.total,
    materiel: ma.total,
    alimentation: al,
    services: se.compta + se.sousTraitance,
    fret: se.fret,
    medicaments: med.total,
    prescriptions: presc.total,
  };
  const totalKg = Object.values(parPoste).reduce((a, b) => a + b, 0);
  const totalKgHorsPrescriptions = totalKg - presc.total;

  const detail = {
    domTrav: dp.domTrav, visites: dp.visites, congres: dp.congres,
    patientele: dc.total,
    localElec: lo.elec, localChauffage: lo.chauffage, localDeporte: lo.deporte,
    numOrdisFixes: nu.ordisFixes, numOrdisPortables: nu.ordisPortables, numEcrans: nu.ecrans, numUsage: nu.usage,
    materiel: ma.detailConsommables, grosMateriel: ma.detailGros, mobilier: ma.mobilier,
    alimentation: al,
    servicesCompta: se.compta, servicesSousTraitance: se.sousTraitance, fret: se.fret,
    medicamentsVendus: med.medicaments, parapharmacie: med.parapharmacie,
    prescriptionsMedicaments: presc.medicaments, prescriptionsActes: presc.actes,
  };

  return {
    parPoste, totalKg, totalT: totalKg / 1000,
    totalKgHorsPrescriptions, totalTHorsPrescriptions: totalKgHorsPrescriptions / 1000,
    parActe: data.profil.nbActesAn > 0 ? totalKg / data.profil.nbActesAn : 0,
    detail, nbActesLieuFixe: dc.nbActesLieuFixe,
  };
}

// Calcule le catalogue d'actions de décarbonation trié par pertinence
// (impact / coût), avec le potentiel de réduction de chacune selon l'état
// de sélection courant (cochée ou non, curseur de déploiement).
// Entrée : results (sortie de calculerBilan), selectedActions (état UI :
//          { [actionId]: { checked, pct, degres } })
// Sortie : tableau d'actions enrichies, triées par score décroissant
export function calculerActions(results, selectedActions) {
  return ACTIONS.map((act) => {
    const isDegres = act.unit === "degres";
    const kgPoste = isDegres ? (results.detail.localChauffage || 0) : (results.parPoste[act.poste] || 0);
    const sel = selectedActions[act.id] || { checked: false, pct: act.defaultPct, degres: act.defaultDegres };
    let potentielKg;
    if (isDegres) {
      const degres = Math.min(sel.degres ?? act.defaultDegres, 5);
      potentielKg = kgPoste * act.maxReductionParDegre * degres;
    } else {
      const pctAppliquee = act.hasPct ? (sel.pct ?? act.defaultPct) : 100;
      potentielKg = kgPoste * act.maxReduction * (pctAppliquee / 100);
    }
    const score = potentielKg / COST_WEIGHT[act.cost];
    return { ...act, kgPoste, checked: sel.checked, pct: sel.pct ?? act.defaultPct, degres: sel.degres ?? act.defaultDegres, potentielKg, score };
  }).filter((a) => a.kgPoste > 0).sort((a, b) => b.score - a.score);
}

// Calcule la réduction totale (kgCO2e/an) représentée par les actions
// actuellement cochées dans le plan d'action de l'utilisateur.
export function totalReductionPlan(actionsCalculees) {
  return actionsCalculees.filter((a) => a.checked).reduce((s, a) => s + a.potentielKg, 0);
}
