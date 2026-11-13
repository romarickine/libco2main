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
  FE_TRANSPORT,
  FE_ENERGIE,
  feChauffage,
  RATIOS_ENERGIE_PAR_ACTIVITE,
  FE_NUMERIQUE,
  FE_REPAS,
  FE_MONETAIRE,
  FE_FRET_COLIS,
  FE_MOBILIER,
  DUREE_AMORTISSEMENT_ANS,
  FACTEURS_VEHICULES_USAGE_FABRICATION,
  FACTEURS_BATIMENT_PAR_ACTIVITE,
  emissionsBatimentAnnuelles,
  ACTIONS,
  COST_WEIGHT,
  FE_DECHETS,
  FE_DASRI,
} from "../../shared/js/data/facteurs-emission.js";
import { gainPartConcernee, reductionPlan } from "../../shared/js/plan-actions.js";
import { emissionsPatienteleParActe } from "../../shared/js/data/zonage-insee.js";

// Part « fabrication du véhicule » d'un facteur de transport (kgCO2e/km) :
// voitures seulement (Base Carbone, voir FACTEURS_VEHICULES_USAGE_FABRICATION).
const fabricationParKm = (mode) => FACTEURS_VEHICULES_USAGE_FABRICATION[mode]?.fabrication || 0;

// Calcule l'empreinte carbone liée aux déplacements professionnels
// (domicile-travail + visites + congrès/formations).
// Depuis le 12/11/2026, la fabrication des voitures est présentée en
// immobilisations : domTrav, visites et congres sont l'usage (carburant ou
// électricité), fabrication la part véhicule. usage + fabrication = facteur
// complet de FE_TRANSPORT, le total de l'empreinte est inchangé.
// Entrée : data.deplacements (état du formulaire)
// Sortie : { domTrav, visites, congres, total, fabrication, parts } en kgCO2e/an
export function calculDeplacementsPro(d) {
  const kmDomTravAn = d.kmAllerJour * 2 * d.joursSemaine * d.semainesAn;
  const modeCongres = d.modeCongres === "train_tgv" ? "tgv" : d.modeCongres;
  const kmCongres = d.nbCongresAn * d.kmCongresAR;
  const fabDomTrav = kmDomTravAn * fabricationParKm(d.modeDomTrav);
  const fabVisites = d.kmVisitesAn * fabricationParKm(d.modeVisites);
  const fabCongres = kmCongres * fabricationParKm(modeCongres);
  const domTrav = kmDomTravAn * FE_TRANSPORT[d.modeDomTrav].value - fabDomTrav;
  const visites = d.kmVisitesAn * FE_TRANSPORT[d.modeVisites].value - fabVisites;
  const feCongres = FE_TRANSPORT[modeCongres].value;
  const congres = kmCongres * feCongres - fabCongres;
  // Kilomètres par mode, pour calculer le gain de chaque action sur la seule
  // part qu'elle concerne (voir shared/js/plan-actions.js).
  const parts = {
    quotidien: [
      { km: kmDomTravAn, mode: d.modeDomTrav },
      { km: d.kmVisitesAn, mode: d.modeVisites },
    ],
    congres: { km: d.nbCongresAn * d.kmCongresAR, mode: d.modeCongres === "train_tgv" ? "tgv" : d.modeCongres, kg: congres },
  };
  const fabrication = fabDomTrav + fabVisites + fabCongres;
  return { domTrav, visites, congres, total: domTrav + visites + congres, fabrication, parts };
}

// Construction du bâtiment (12/11/2026) : carbone de construction amorti sur
// 30 ans depuis la construction ou la dernière rénovation lourde, facteur
// selon l'activité (FACTEURS_BATIMENT_PAR_ACTIVITE). Compté que l'on soit
// propriétaire ou locataire (décision du porteur). Année inconnue : rien.
// Entrée : data.local, familleId, anneeActuelle
// Sortie : kgCO2e/an
export function calculBatiment(l, familleId, anneeActuelle = new Date().getFullYear()) {
  if (!l.aLocal || !(l.surface > 0)) return 0;
  const facteur = (FACTEURS_BATIMENT_PAR_ACTIVITE[familleId] || FACTEURS_BATIMENT_PAR_ACTIVITE.autre).kgCO2e_m2;
  const renovation =
    l.anneeRenovation > 0 && l.coutRenovation > 0 ? { annee: l.anneeRenovation, coutTravaux: l.coutRenovation } : null;
  return emissionsBatimentAnnuelles(l.surface, l.anneeConstruction > 0 ? l.anneeConstruction : null, renovation, anneeActuelle, facteur);
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
// (ADEME, déclarations OPERAT 2024, partage chauffage SDES-CEREN 2019 : voir
// RATIOS_ENERGIE_PAR_ACTIVITE).
// Entrée : data.local, familleId (clé de RATIOS_ENERGIE_PAR_ACTIVITE)
// Sortie : { elec, chauffage, deporte, total } en kgCO2e/an
export function calculLocal(l, familleId) {
  if (!l.aLocal) return { elec: 0, chauffage: 0, deporte: 0, total: 0 };
  const ratios = RATIOS_ENERGIE_PAR_ACTIVITE[familleId] || RATIOS_ENERGIE_PAR_ACTIVITE.autre;
  const elecKwh = l.consoElecConnue ? l.consoElecKwh : l.surface * ratios.elec;
  const chauffageKwh = l.consoChauffageConnue ? l.consoChauffageKwh : l.surface * ratios.chauffage;
  const elec = elecKwh * FE_ENERGIE.electricite.value;
  const chauffage = chauffageKwh * feChauffage(l.energieChauffage);
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

// Calcule l'empreinte des déchets courants (traitement en fin de vie),
// poste par poste. Saisie en kg/semaine, convertie en kg/an via le nombre
// de semaines travaillées (même donnée que celle utilisée pour les
// déplacements domicile-travail, cohérence du référentiel temporel de
// l'outil). Le DASRI n'est ajouté que pour la famille Santé & paramédical.
// Entrée : data.dechets, semainesAn (déplacements pro), estSante (bool)
// Sortie : { total, detail: { plastique, metal, ..., dasri }, totalKg }
export function calculDechets(dechets, semainesAn, estSante) {
  const detail = {};
  let total = 0;
  for (const cle of Object.keys(FE_DECHETS)) {
    const kgSemaine = dechets[cle] || 0;
    const kgAn = kgSemaine * semainesAn;
    const emissions = kgAn * FE_DECHETS[cle].value;
    detail[cle] = emissions;
    total += emissions;
  }
  if (estSante) {
    const kgSemaineDasri = dechets.dasri || 0;
    const kgAnDasri = kgSemaineDasri * semainesAn;
    detail.dasri = kgAnDasri * FE_DASRI.value;
    total += detail.dasri;
  }
  return { total, detail };
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
    zone,
    motifId: famille.motifDeplacement,
    nbActesAn: data.profil.nbActesAn,
    partCabinet: data.profil.partCabinet,
    recoitPublic: data.profil.recoitPublic,
    aLocal: data.local.aLocal,
  });
  const lo = calculLocal(data.local, famille.id);
  const bat = calculBatiment(data.local, famille.id);
  const nu = calculNumerique(data.numerique);
  const ma = calculMateriel(famille, data.materiel, data.investissements);
  const al = calculAlimentation({ ...data.alimentation, semainesAn: data.deplacements.semainesAn });
  const de = calculDechets(data.dechets, data.deplacements.semainesAn, famille.id === "sante");
  const se = calculServicesEtFret(data.services);
  const med = calculMedicaments(data.pharmacien);
  const presc = calculPrescriptions(data.prescriptions);

  const parPoste = {
    deplacements_pro: dp.total,
    deplacements_patientele: dc.total,
    local: lo.total,
    numerique: nu.total,
    materiel: ma.total,
    dechets: de.total,
    alimentation: al,
    services: se.compta + se.sousTraitance,
    fret: se.fret,
    medicaments: med.total,
    prescriptions: presc.total,
    immobilisations: dp.fabrication + bat,
  };
  const totalKg = Object.values(parPoste).reduce((a, b) => a + b, 0);
  const totalKgHorsPrescriptions = totalKg - presc.total;

  const detail = {
    domTrav: dp.domTrav,
    visites: dp.visites,
    congres: dp.congres,
    deplacementsParts: dp.parts,
    energieChauffage: data.local.energieChauffage,
    patientele: dc.total,
    localElec: lo.elec,
    localChauffage: lo.chauffage,
    localDeporte: lo.deporte,
    immoVehicules: dp.fabrication,
    immoBatiment: bat,
    numOrdisFixes: nu.ordisFixes,
    numOrdisPortables: nu.ordisPortables,
    numEcrans: nu.ecrans,
    numUsage: nu.usage,
    materiel: ma.detailConsommables,
    grosMateriel: ma.detailGros,
    mobilier: ma.mobilier,
    dechets: de.detail,
    dechetsTotal: de.total,
    alimentation: al,
    servicesCompta: se.compta,
    servicesSousTraitance: se.sousTraitance,
    fret: se.fret,
    medicamentsVendus: med.medicaments,
    parapharmacie: med.parapharmacie,
    prescriptionsMedicaments: presc.medicaments,
    prescriptionsActes: presc.actes,
  };

  return {
    parPoste,
    totalKg,
    totalT: totalKg / 1000,
    totalKgHorsPrescriptions,
    totalTHorsPrescriptions: totalKgHorsPrescriptions / 1000,
    parActe: data.profil.nbActesAn > 0 ? totalKg / data.profil.nbActesAn : 0,
    detail,
    nbActesLieuFixe: dc.nbActesLieuFixe,
  };
}

// Contexte du plan d'action (shared/js/plan-actions.js) : trajets par mode,
// chauffage du local.
function contexteActions(results) {
  const parts = results.detail.deplacementsParts || { quotidien: [], congres: { km: 0, mode: "" } };
  return {
    fe: (mode) => (FE_TRANSPORT[mode] ? FE_TRANSPORT[mode].value : 0),
    quotidien: parts.quotidien,
    congres: parts.congres.km > 0 ? [{ km: parts.congres.km, mode: parts.congres.mode }] : [],
    chauffageKg: results.detail.localChauffage || 0,
    energieChauffage: results.detail.energieChauffage,
  };
}
// Part touchée par une action (regroupement du plan sans double comptage).
const cleAction = (act) => (act.unit === "degres" ? "localChauffage" : act.detailKey || act.poste);

// Calcule le catalogue d'actions de décarbonation trié par pertinence
// (impact / coût), avec le potentiel de réduction de chacune selon l'état
// de sélection courant (cochée ou non, curseur de déploiement).
// Entrée : results (sortie de calculerBilan), selectedActions (état UI :
//          { [actionId]: { checked, pct, degres } })
// Sortie : tableau d'actions enrichies, triées par score décroissant
export function calculerActions(results, selectedActions) {
  const ctx = contexteActions(results);
  return ACTIONS.map((act) => {
    const isDegres = act.unit === "degres";
    const sel = selectedActions[act.id] || { checked: false, pct: act.defaultPct, degres: act.defaultDegres };
    const pctAppliquee = act.hasPct ? (sel.pct ?? act.defaultPct) : 100;
    let kgPoste, potentielKg, potentielMaxKg;
    const specifique = gainPartConcernee(act.id, ctx);
    if (specifique) {
      const { base, gainParPct } = specifique;
      kgPoste = base;
      potentielKg = gainParPct * pctAppliquee;
      potentielMaxKg = gainParPct * 100;
    } else {
      // Certaines actions ne concernent qu'une sous-partie d'un poste (ex.
      // l'isolation ne réduit que la part chauffage du local) : detailKey
      // pointe alors vers la bonne valeur dans results.detail plutôt que vers
      // le poste complet. À défaut, on retombe sur le poste entier.
      kgPoste = isDegres
        ? results.detail.localChauffage || 0
        : act.detailKey
          ? results.detail[act.detailKey] || 0
          : results.parPoste[act.poste] || 0;
      if (isDegres) {
        const degres = Math.min(sel.degres ?? act.defaultDegres, 5);
        potentielKg = kgPoste * act.maxReductionParDegre * degres;
        potentielMaxKg = kgPoste * act.maxReductionParDegre * 5;
      } else {
        potentielKg = kgPoste * act.maxReduction * (pctAppliquee / 100);
        potentielMaxKg = kgPoste * act.maxReduction;
      }
    }
    const score = potentielKg / COST_WEIGHT[act.cost];
    return {
      ...act,
      kgPoste,
      checked: sel.checked,
      pct: sel.pct ?? act.defaultPct,
      degres: sel.degres ?? act.defaultDegres,
      potentielKg,
      potentielMaxKg,
      score,
    };
  })
    // Seuil d'affichage (décision du porteur, 12/11/2026) : seules les
    // actions qui apportent un gain sont proposées (gain non nul à plein
    // déploiement).
    .filter((a) => a.potentielMaxKg > 0)
    .sort((a, b) => b.score - a.score);
}

// Calcule la réduction totale (kgCO2e/an) représentée par les actions
// actuellement cochées dans le plan d'action de l'utilisateur.
// Réduction totale du plan : les actions cochées qui touchent les mêmes
// émissions ne s'additionnent pas, elles s'appliquent l'une après l'autre sur
// ce qui reste (shared/js/plan-actions.js, décision du porteur, 12/11/2026).
export function totalReductionPlan(actionsCalculees, results) {
  const cochees = actionsCalculees.filter((a) => a.checked);
  if (!results) return cochees.reduce((s, a) => s + a.potentielKg, 0);
  return reductionPlan(
    cochees.map((a) => ({ ...a, cle: cleAction(a) })),
    contexteActions(results),
    (cle) => (results.detail[cle] ?? results.parPoste[cle] ?? 0),
  );
}
