import { getEtat, majEtat, allerEcran, ajouterPraticien, supprimerPraticien,
         ajouterLigne, supprimerLigne, ajouterLignePraticien, supprimerLignePraticien,
         calculerEtEnregistrer, calculerSurfaceDeclaree, exporterArchive, importerArchive,
         getHistoriqueBilans } from './main-msp.js';
import { chercherCommunes } from './data/zonage-insee.js';
import {
  FE_TRANSPORT, FE_ENERGIE, RATIOS_ENERGIE_PAR_ACTIVITE, FE_MONETAIRE, FE_FRET_COLIS,
  FE_GROS_MATERIEL_STANDARD, FE_GROS_MATERIEL_MASSIF, FE_REPAS, ACTIONS, CATEGORIES_META, COST_WEIGHT
} from './data/facteurs-emission.js';
import {
  FACTEURS_MOBILIER_UNITE, FACTEURS_VEHICULES_USAGE_FABRICATION,
  FACTEUR_BATIMENT_SANTE, FACTEURS_NUMERIQUE_BRUT, FE_MEDICAMENTS_EUR, PROFESSIONS_PRESCRIPTRICES,
  ACTIONS_MSP_SUPPLEMENTAIRES, RATIO_NATIONAL_MEDECINE_VILLE_KG, REDUCTION_OBJECTIF_2050_SANS_PREVENTION, OBJECTIF_2050_KG
} from './data/facteurs-emission-msp.js';
import { APL_PROFESSIONS, APL_REFERENCE_NATIONALE } from './data/apl-msp.js';

const ETAPES = ['Profil', 'Local', 'Praticiens', 'Staff admin', 'Postes mutualisés', 'Résultats', 'Pistes d\'action'];

const PROFESSIONS_APL = [
  { valeur: 'medecin_generaliste', label: 'Médecin généraliste' },
  { valeur: 'infirmier', label: 'Infirmier(ère)' },
  { valeur: 'sage_femme', label: 'Sage-femme' },
  { valeur: 'kinesitherapeute', label: 'Kinésithérapeute' },
  { valeur: 'chirurgien_dentiste', label: 'Chirurgien(ne)-dentiste' },
  { valeur: null, label: 'Autre profession de santé (ostéopathe, psychologue, diététicien...)' }
];

const MODES_DEPLACEMENT = [
  'voiture_thermique', 'voiture_hybride', 'voiture_electrique', 'deux_roues',
  'velo_meca', 'velo_elec', 'bus', 'metro_tram', 'rer_ter', 'tgv', 'marche'
];

const LABELS_MODES = {
  voiture_thermique: 'Voiture thermique',
  voiture_hybride: 'Voiture hybride',
  voiture_electrique: 'Voiture électrique',
  deux_roues: 'Deux-roues motorisé',
  velo_meca: 'Vélo (mécanique)',
  velo_elec: 'Vélo à assistance électrique',
  bus: 'Bus urbain',
  metro_tram: 'Métro / Tramway',
  rer_ter: 'RER / TER',
  tgv: 'TGV / grande ligne',
  marche: 'Marche à pied'
};

const ENERGIES = ['electricite', 'gaz', 'fioul', 'bois', 'reseau_chaleur', 'pac'];

const LABELS_ENERGIES = {
  electricite: 'Électricité',
  gaz: 'Gaz naturel',
  fioul: 'Fioul domestique',
  bois: 'Bois / biomasse',
  reseau_chaleur: 'Réseau de chaleur urbain',
  pac: 'Pompe à chaleur'
};

const LABELS_MOBILIER = {
  chaiseBois: 'Chaise bois',
  chaisePlastique: 'Chaise plastique',
  chaiseBoisTextile: 'Chaise bois et textile',
  tableBoisMassif: 'Table bois massif',
  tableRepresentative: 'Table de bureau',
  armoire: 'Armoire',
  canapeTextile: 'Canapé textile',
  canapeCuir: 'Canapé cuir'
};

const COULEURS_POSTES = ['#0071C1', '#2E673E', '#C98A2C', '#B85C5C', '#8A6FB0', '#4E8FA3'];

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

function fmtDecimal(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------
// RENDU PRINCIPAL — corrige la cause racine du bug de fermeture des menus :
// tout re-rendu remplace l'intégralité du HTML de l'écran (nécessaire pour
// rester synchronisé avec le state), ce qui réinitialise par défaut l'état
// d'affichage (menus <details> ouverts, position de défilement). On capture
// cet état juste avant de re-rendre et on le restaure juste après, à CHAQUE
// appel de rendreEcran — donc pour toute action future (pas seulement
// l'ajout de praticien), ce type de régression ne peut plus se reproduire.
export function rendreEcran(etat) {
  const app = document.getElementById('app');
  if (!app) return;

  const detailsOuverts = new Set(
    [...app.querySelectorAll('details[data-details-key]')].filter(d => d.open).map(d => d.dataset.detailsKey)
  );
  const positionDefilement = window.scrollY;

  // Préserve le focus clavier et la position du curseur à travers le
  // re-rendu complet de l'écran. Sans ça, l'élément focalisé était détruit
  // à chaque frappe/Tab : la navigation au clavier (Tab) s'interrompait en
  // boucle, et une saisie pouvait sembler nécessiter deux actions au lieu
  // d'une (la première mettait à jour le state mais perdait le focus).
  const actif = document.activeElement;
  let cheminActif = null, typeChemin = null, selectionDebut = null, selectionFin = null;
  if (actif && app.contains(actif)) {
    if (actif.dataset.path) { cheminActif = actif.dataset.path; typeChemin = 'data-path'; }
    else if (actif.dataset.pathMobilier) { cheminActif = actif.dataset.pathMobilier; typeChemin = 'data-path-mobilier'; }
    if (cheminActif && typeof actif.selectionStart === 'number') {
      selectionDebut = actif.selectionStart;
      selectionFin = actif.selectionEnd;
    }
  }

  app.innerHTML = (etat.ecranActuel === 0 ? '' : rendreNav(etat)) + rendreEcranCourant(etat);

  app.querySelectorAll('details[data-details-key]').forEach(d => {
    if (detailsOuverts.has(d.dataset.detailsKey)) d.open = true;
  });
  window.scrollTo(0, positionDefilement);

  if (cheminActif) {
    const nouvelElement = app.querySelector(`[${typeChemin}="${CSS.escape(cheminActif)}"]`);
    if (nouvelElement) {
      nouvelElement.focus({ preventScroll: true });
      if (selectionDebut != null && typeof nouvelElement.setSelectionRange === 'function') {
        try { nouvelElement.setSelectionRange(selectionDebut, selectionFin); } catch (e) { /* type d'input sans sélection de texte (ex. select) */ }
      }
    }
  }

  attacherEcouteurs(app);
  attacherTooltipsGraphes(app);
}

// ---------------------------------------------------------------------------
// AVANCEMENT — un coup d'œil pour savoir où on en est et ce qu'il reste à faire
function calculerAvancement(etat) {
  const s = etat.structureMSP;
  const complet = {
    1: !!(s.commune && s.surfaceTotale),
    2: !!(s.local.energieChauffage && s.local.batiment.anneeConstruction),
    3: etat.praticiens.length > 0 && etat.praticiens.every(p => p.professionAPL !== undefined && p.nbActesAnnuel > 0),
    4: etat.staffAdmin.etp != null,
    5: etat.ecranActuel > 5, // tous les champs peuvent légitimement rester à 0 : on ne peut pas se fier à leur contenu, donc on ne coche cette étape qu'une fois qu'elle a été réellement dépassée (pas dès le chargement)
    6: !!etat.dernierResultat,
    7: (etat.actionsSelectionnees || []).length > 0
  };
  return complet;
}

function rendreNav(etat) {
  const complet = calculerAvancement(etat);
  const nbEtapesCompletes = Object.values(complet).filter(Boolean).length;
  const pourcentage = Math.round((nbEtapesCompletes / ETAPES.length) * 100);

  return `
  <div class="barre-avancement" role="progressbar" aria-valuenow="${pourcentage}" aria-valuemin="0" aria-valuemax="100">
    <div class="barre-avancement-remplissage" style="width:${pourcentage}%"></div>
  </div>
  <nav class="nav-etapes">${ETAPES.map((label, i) => {
    const n = i + 1;
    const classes = ['etape'];
    if (n === etat.ecranActuel) classes.push('active');
    if (complet[n]) classes.push('complete');
    const puce = complet[n] ? '✓' : n;
    return `<button class="${classes.join(' ')}" data-action="aller-ecran" data-numero="${n}">
      <span class="etape-puce">${puce}</span><span class="etape-label">${label}</span>
    </button>`;
  }).join('')}</nav>`;
}

function rendreEcranCourant(etat) {
  switch (etat.ecranActuel) {
    case 0: return rendreAccueil(etat);
    case 1: return rendreProfil(etat);
    case 2: return rendreLocalBatiment(etat);
    case 3: return rendrePraticiens(etat);
    case 4: return rendreStaffAdmin(etat);
    case 5: return rendrePostesMutualises(etat);
    case 6: return rendreRestitution(etat);
    case 7: return rendreSolutions(etat);
    default: return '';
  }
}

function rendrePiedNavigation(etat) {
  const precedent = etat.ecranActuel > 1 ? `<button data-action="aller-ecran" data-numero="${etat.ecranActuel - 1}" class="bouton-secondaire">← Précédent</button>` : '<span></span>';
  const suivant = etat.ecranActuel < ETAPES.length ? `<button data-action="aller-ecran" data-numero="${etat.ecranActuel + 1}" class="bouton-principal">Suivant →</button>` : '<span></span>';
  return `<div class="pied-navigation">${precedent}${suivant}</div>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 1 — Profil
// ---------------------------------------------------------------------------
// ÉCRAN 0 — Accueil, affiché uniquement à la première visite (le brouillon
// sauvegardé reprend ensuite directement là où l'utilisateur s'est arrêté).
function rendreAccueil(etat) {
  return `
  <section class="ecran ecran-accueil">
    <h2>Bienvenue</h2>
    <p class="accueil-texte">Lib&amp;CO2 MSP estime, en ordre de grandeur, l'empreinte carbone annuelle de votre maison de santé pluriprofessionnelle et de chaque praticien qui y exerce. Un seul répondant complète le formulaire pour toute la structure. Comptez environ 15 à 20 minutes si les informations sont sous la main.</p>
    <button data-action="aller-ecran" data-numero="1" class="bouton-principal bouton-large">Commencer</button>
  </section>`;
}

function rendreProfil(etat) {
  const s = etat.structureMSP;
  return `
  <section class="ecran">
    <h2>1. Profil de la structure</h2>
    <p class="aide">Ce bilan est pensé pour être rempli par une seule personne, au nom de l'ensemble de la structure — pas un par praticien.</p>
    <label>Nom de la MSP (optionnel)
      <input type="text" data-path="structureMSP.nom" value="${s.nom || ''}">
    </label>
    <label>Commune
      <input type="text" id="recherche-commune" placeholder="Tapez le nom de la commune..." autocomplete="off" value="${s.commune ? (s.communeNom || '') : ''}">
      <div id="resultats-commune" class="autocomplete-resultats"></div>
      ${s.commune ? `<p class="commune-selectionnee">✓ Commune sélectionnée (code INSEE ${s.commune})</p>` : '<p class="aide">Sélectionnez une commune dans la liste de suggestions qui apparaît sous le champ — un nom simplement tapé sans clic sur une suggestion ne sera pas pris en compte.</p>'}
    </label>
    <label>Surface totale de la structure (m²)
      <input type="number" min="0" data-path="structureMSP.surfaceTotale" value="${s.surfaceTotale ?? ''}">
    </label>
    <p class="aide">La surface totale doit correspondre à la somme des surfaces dédiées que vous saisirez pour chaque praticien et pour le staff admin (écrans suivants) — c'est la clé utilisée pour répartir les émissions du local entre chacun. Si la somme déclarée est inférieure au total (espaces communs non répartis individuellement), la part manquante est automatiquement rattachée aux fonctions support de la MSP plutôt que d'être perdue.</p>
    ${(() => {
      const { declaree, totale, depassement } = calculerSurfaceDeclaree(etat);
      if (!totale) return '';
      return depassement
        ? `<p class="alerte">La somme des surfaces déclarées par les praticiens et le staff admin (${fmt(declaree)} m²) dépasse la surface totale de la structure (${fmt(totale)} m²) — vérifiez qu'un même espace n'a pas été compté pour plusieurs personnes.</p>`
        : `<p class="aide">Surface déclarée jusqu'ici (praticiens + staff admin) : ${fmt(declaree)} / ${fmt(totale)} m².</p>`;
    })()}
    ${rendrePiedNavigation(etat)}
  </section>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 2 — Local & bâtiment
function rendreLocalBatiment(etat) {
  const l = etat.structureMSP.local;
  return `
  <section class="ecran">
    <h2>2. Local et bâtiment</h2>
    <div class="carte">
      <h3 class="carte-titre">Bâtiment (carbone de construction)</h3>
      <label>Année de construction
        <input type="number" min="1800" max="2100" data-path="structureMSP.local.batiment.anneeConstruction" value="${l.batiment.anneeConstruction ?? ''}">
      </label>
      <p class="aide">Si le bâtiment a plus de 30 ans (construction ou dernière rénovation lourde), aucune émission de construction n'est comptée.</p>
      <details data-details-key="local-renovation">
        <summary><span>Rénovation lourde plus récente (optionnel)</span></summary>
        <div class="ligne-double">
          <label>Année<input type="number" min="1800" max="2100" data-path="structureMSP.local.batiment.renovationLourde.annee" value="${l.batiment.renovationLourde?.annee ?? ''}"></label>
          <label>Coût des travaux (€)<input type="number" min="0" data-path="structureMSP.local.batiment.renovationLourde.coutTravaux" value="${l.batiment.renovationLourde?.coutTravaux ?? ''}"></label>
        </div>
        <p class="aide">Une rénovation ne compte comme "lourde" que si son coût atteint au moins 275 €/m² de surface totale — seuil réglementaire des locaux non résidentiels.</p>
      </details>
    </div>

    <div class="carte">
      <h3 class="carte-titre">Énergie</h3>
      <label>Énergie de chauffage
        <select data-path="structureMSP.local.energieChauffage">
          ${ENERGIES.map(e => `<option value="${e}" ${l.energieChauffage === e ? 'selected' : ''}>${LABELS_ENERGIES[e]}</option>`).join('')}
        </select>
      </label>
      <p class="aide">Sans consommation réelle saisie ci-dessous, l'énergie est estimée à partir de la surface totale et du ratio ADEME/CEREN "locaux commerciaux" (103 kWh/m²/an chauffage, 130 kWh/m²/an électricité).</p>
      <details data-details-key="local-conso-reelle">
        <summary><span>Consommation réelle (optionnel, sinon estimation par ratio)</span></summary>
        <label>Électricité (kWh/an)
          <input type="number" min="0" data-path="structureMSP.local.consoReelle.elec_kWh" value="${l.consoReelle?.elec_kWh ?? ''}">
        </label>
        <label>Chauffage (kWh/an)
          <input type="number" min="0" data-path="structureMSP.local.consoReelle.chauffage_kWh" value="${l.consoReelle?.chauffage_kWh ?? ''}">
        </label>
      </details>
    </div>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 3 — Praticiens
function rendrePraticiens(etat) {
  return `
  <section class="ecran">
    <h2>3. Praticiens <span class="compteur">${etat.praticiens.length}</span></h2>
    <p class="aide">Un bloc par praticien de la structure. Toutes les données sont à collecter par le répondant unique auprès de chaque praticien.</p>
    ${etat.praticiens.length === 0 ? '<p class="etat-vide">Aucun praticien ajouté pour l\'instant.</p>' : ''}
    ${etat.praticiens.map((p, i) => rendreCartePraticien(p, i)).join('')}
    <button data-action="ajouter-praticien" class="bouton-principal bouton-large bouton-ajouter-praticien">+ Ajouter un praticien</button>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

function rendreBlocModes(p, i, champDotPath, titre) {
  const modes = champDotPath.split('.').reduce((o, k) => o[k], p);
  const total = modes.reduce((s, m) => s + (m.part || 0), 0);
  const lignes = modes.map((m, j) => `
    <div class="ligne-mode-transport">
      <select data-path="praticiens.${i}.${champDotPath}.${j}.mode">
        ${MODES_DEPLACEMENT.map(mo => `<option value="${mo}" ${m.mode === mo ? 'selected' : ''}>${LABELS_MODES[mo]}</option>`).join('')}
      </select>
      <input type="number" min="0" max="100" placeholder="%" data-path="praticiens.${i}.${champDotPath}.${j}.part" value="${m.part}">
      ${modes.length > 1 ? `<button data-action="supprimer-mode" data-id="${p.id}" data-champ="${champDotPath}" data-index="${j}" class="bouton-danger-petit">×</button>` : '<span></span>'}
    </div>`).join('');
  return `
    <p class="sous-titre-bloc">${titre}</p>
    ${lignes}
    <p class="aide ${total !== 100 ? 'aide-alerte' : ''}">Total : ${total}% ${total !== 100 ? '— doit atteindre 100% pour un calcul exact' : '✓'}</p>
    <button data-action="ajouter-mode" data-id="${p.id}" data-champ="${champDotPath}" class="bouton-secondaire-petit">+ Ajouter un mode de transport</button>`;
}

function rendreSectionPrescriptions(p, i) {
  const lignes = p.prescriptions.actesParamedicauxExternes.map((l, j) => `
    <div class="ligne-mode-transport">
      <select data-path="praticiens.${i}.prescriptions.actesParamedicauxExternes.${j}.profession">
        ${PROFESSIONS_APL.filter(pr => pr.valeur).map(pr => `<option value="${pr.valeur}" ${l.profession === pr.valeur ? 'selected' : ''}>${pr.label}</option>`).join('')}
      </select>
      <input type="number" min="0" placeholder="Actes/an" data-path="praticiens.${i}.prescriptions.actesParamedicauxExternes.${j}.nbActesAnnuel" value="${l.nbActesAnnuel}">
      <button data-action="supprimer-mode" data-id="${p.id}" data-champ="prescriptions.actesParamedicauxExternes" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`).join('');
  return `
    <h4 class="section-titre">Prescriptions</h4>
    <label>Montant annuel de médicaments prescrits (€)
      <input type="number" min="0" data-path="praticiens.${i}.prescriptions.montantAnnuelMedicaments" value="${p.prescriptions.montantAnnuelMedicaments}">
    </label>
    <p class="aide">Facteur SOURCÉ (The Shift Project / ADEME Base Empreinte, 0,5 kgCO2e/€). Aucun risque de double comptage : rien d'autre dans l'outil ne capte la fabrication des médicaments.</p>
    <p class="sous-titre-bloc">Actes paramédicaux prescrits réalisés en dehors de la structure</p>
    <p class="aide">Ne saisir que les actes réalisés par un praticien extérieur à cette MSP — ceux réalisés par un collègue de la structure sont déjà comptés dans son propre bilan, les compter ici créerait un double comptage. Le poids de chaque acte externe est estimé à partir du ratio kgCO2e/acte déjà mesuré pour la même profession au sein de cette MSP (à défaut d'un bilan réel du praticien externe) — non chiffrable si la profession n'est pas représentée dans la structure.</p>
    ${p.prescriptions.actesParamedicauxExternes.length > 0 ? `<div class="ligne-mode-transport ligne-materiel-entete"><span>Profession prescrite</span><span>Actes/an</span><span></span></div>` : ''}
    ${lignes}
    <button data-action="ajouter-prescription-externe" data-id="${p.id}" data-champ="prescriptions.actesParamedicauxExternes" class="bouton-secondaire-petit">+ Ajouter une profession prescrite</button>`;
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
        ${PROFESSIONS_APL.map(pr => `<option value="${pr.valeur ?? ''}" ${p.professionAPL === pr.valeur ? 'selected' : ''}>${pr.label}</option>`).join('')}
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
      ${rendreBlocModes(p, i, 'modesDomicileTravail', 'Modes de transport')}
    </div>

    <div class="sous-carte">
      <p class="sous-carte-titre">Tournées à domicile (visites au domicile des patients)</p>
      <label>Distance annuelle (km/an)
        <input type="number" min="0" data-path="praticiens.${i}.tourneesDomicile.kmAnnuel" value="${p.tourneesDomicile.kmAnnuel}">
      </label>
      ${rendreBlocModes(p, i, 'tourneesDomicile.modes', 'Modes de transport')}
    </div>

    <div class="sous-carte">
      <p class="sous-carte-titre">Déplacements professionnels annuels (congrès, formations, représentation...)</p>
      <label>Distance annuelle (km/an)
        <input type="number" min="0" data-path="praticiens.${i}.deplacementsProAnnuels.kmAnnuel" value="${p.deplacementsProAnnuels.kmAnnuel}">
      </label>
      ${rendreBlocModes(p, i, 'deplacementsProAnnuels.modes', 'Modes de transport')}
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

    ${PROFESSIONS_PRESCRIPTRICES.includes(p.professionAPL) ? rendreSectionPrescriptions(p, i) : ''}

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
      ${rendreLignesMobilier(p.mobilierDedie, p.id, 'mobilierDedie')}
    </details>
  </div>`;
}

function rendreLignesMaterielInfo(p, i) {
  const lignes = p.numerique.autreMaterielInfo.map((m, j) => `
    <div class="ligne-materiel">
      <input type="text" placeholder="Exemple : imprimante" data-path="praticiens.${i}.numerique.autreMaterielInfo.${j}.type" value="${m.type}">
      <input type="number" placeholder="0" data-path="praticiens.${i}.numerique.autreMaterielInfo.${j}.valeurAchat" value="${m.valeurAchat}">
      <input type="number" placeholder="5" data-path="praticiens.${i}.numerique.autreMaterielInfo.${j}.dureeDetention" value="${m.dureeDetention}">
      <button data-action="supprimer-ligne-praticien" data-id="${p.id}" data-champ="numerique.autreMaterielInfo" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`).join('');
  return `<p class="sous-titre-bloc">Autre matériel informatique (imprimante, lecteur de carte Vitale...)</p>
    ${p.numerique.autreMaterielInfo.length > 0 ? rendreEnteteLigneMateriel('Type', "Valeur d'achat (€)", 'Durée (ans)') : ''}
    ${lignes}
    <button data-action="ajouter-materiel-info" data-id="${p.id}" class="bouton-secondaire-petit">+ Ajouter</button>`;
}

function rendreLignesMaterielDedie(p, i) {
  const lignes = p.materielDedie.map((m, j) => `
    <div class="ligne-materiel">
      <input type="text" placeholder="Exemple : échographe" data-path="praticiens.${i}.materielDedie.${j}.type" value="${m.type}">
      <input type="number" placeholder="0" data-path="praticiens.${i}.materielDedie.${j}.valeurAchat" value="${m.valeurAchat}">
      <input type="number" placeholder="5" data-path="praticiens.${i}.materielDedie.${j}.dureeDetention" value="${m.dureeDetention}">
      <button data-action="supprimer-ligne-praticien" data-id="${p.id}" data-champ="materielDedie" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`).join('');
  return `${p.materielDedie.length > 0 ? rendreEnteteLigneMateriel('Type d\'équipement', "Valeur d'achat (€)", 'Durée (ans)') : ''}
    ${lignes}
    <button data-action="ajouter-materiel-dedie" data-id="${p.id}" class="bouton-secondaire-petit">+ Ajouter un équipement</button>`;
}

function rendreLignesMobilier(mobilier, ownerId, champ) {
  const options = Object.keys(FACTEURS_MOBILIER_UNITE);
  const lignes = mobilier.map((m, j) => `
    <div class="ligne-materiel">
      <select data-path-mobilier="${ownerId}|${champ}|${j}|type">
        ${options.map(o => `<option value="${o}" ${m.type === o ? 'selected' : ''}>${LABELS_MOBILIER[o]}</option>`).join('')}
      </select>
      <input type="number" placeholder="1" data-path-mobilier="${ownerId}|${champ}|${j}|nombre" value="${m.nombre}">
      <input type="number" placeholder="10" data-path-mobilier="${ownerId}|${champ}|${j}|dureeDetention" value="${m.dureeDetention}">
      <button data-action="supprimer-mobilier" data-owner="${ownerId}" data-champ="${champ}" data-index="${j}" class="bouton-danger-petit">×</button>
    </div>`).join('');
  return `${mobilier.length > 0 ? rendreEnteteLigneMateriel('Type de mobilier', 'Nombre', 'Durée (ans)') : ''}
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
function rendreStaffAdmin(etat) {
  const a = etat.staffAdmin;
  return `
  <section class="ecran">
    <h2>4. Staff administratif</h2>
    <div class="ligne-double">
      <label>Effectif administratif (équivalent temps plein)<input type="number" min="0" step="0.1" data-path="staffAdmin.etp" value="${a.etp ?? ''}"></label>
      <label>Surface dédiée (m²)<input type="number" min="0" data-path="staffAdmin.surfaceDediee" value="${a.surfaceDediee ?? ''}"></label>
    </div>

    <div class="ligne-double">
      <label>Distance domicile-travail moyenne (km aller)<input type="number" min="0" data-path="staffAdmin.distanceDomicileTravailMoyenne" value="${a.distanceDomicileTravailMoyenne ?? ''}"></label>
      <label>Mode principal
        <select data-path="staffAdmin.modeDomicileTravailMoyen">
          ${MODES_DEPLACEMENT.map(m => `<option value="${m}" ${a.modeDomicileTravailMoyen === m ? 'selected' : ''}>${LABELS_MODES[m]}</option>`).join('')}
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
      ${a.numerique.autreMaterielInfo.length > 0 ? rendreEnteteLigneMateriel('Type', "Valeur d'achat (€)", 'Durée (ans)') : ''}
      ${a.numerique.autreMaterielInfo.map((m, j) => `
        <div class="ligne-materiel">
          <input type="text" placeholder="Exemple : imprimante" data-path="staffAdmin.numerique.autreMaterielInfo.${j}.type" value="${m.type}">
          <input type="number" placeholder="0" data-path="staffAdmin.numerique.autreMaterielInfo.${j}.valeurAchat" value="${m.valeurAchat}">
          <input type="number" placeholder="5" data-path="staffAdmin.numerique.autreMaterielInfo.${j}.dureeDetention" value="${m.dureeDetention}">
          <button data-action="supprimer-ligne" data-chemin="staffAdmin.numerique.autreMaterielInfo" data-index="${j}" class="bouton-danger-petit">×</button>
        </div>`).join('')}
      <button data-action="ajouter-materiel-info-admin" class="bouton-secondaire-petit">+ Ajouter</button>
    </div>

    <div class="carte">
      <h3 class="carte-titre">Mobilier</h3>
      ${rendreLignesMobilier(a.mobilier, 'staffAdmin', 'mobilier')}
    </div>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 5 — Postes mutualisés
function rendrePostesMutualises(etat) {
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
      <h3 class="carte-titre">Matériel lourd partagé entre plusieurs praticiens</h3>
      <p class="aide">Un équipement utilisé par plusieurs praticiens (échographe commun, table d'examen partagée...) — à déclarer ici, pas dans le "matériel dédié" d'un praticien en particulier, pour éviter de l'oublier ou de le compter deux fois.</p>
      ${pm.materielPartage.length > 0 ? rendreEnteteLigneMateriel('Type d\'équipement', "Valeur d'achat (€)", 'Durée (ans)') : ''}
      ${pm.materielPartage.map((m, j) => `
        <div class="ligne-materiel">
          <input type="text" placeholder="Exemple : échographe" data-path="postesMutualises.materielPartage.${j}.type" value="${m.type}">
          <input type="number" placeholder="0" data-path="postesMutualises.materielPartage.${j}.valeurAchat" value="${m.valeurAchat}">
          <input type="number" placeholder="5" data-path="postesMutualises.materielPartage.${j}.dureeDetention" value="${m.dureeDetention}">
          <button data-action="supprimer-ligne" data-chemin="postesMutualises.materielPartage" data-index="${j}" class="bouton-danger-petit">×</button>
        </div>`).join('')}
      <button data-action="ajouter-materiel-partage" class="bouton-secondaire-petit">+ Ajouter un équipement partagé</button>
    </div>
    ${rendrePiedNavigation(etat)}
  </section>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 6 — Restitution (graphiques SVG natifs, sans dépendance externe)
function rendreRestitution(etat) {
  const r = etat.dernierResultat;
  const complet = calculerAvancement(etat);
  const pretACalculer = complet[1] && complet[2] && complet[3];
  return `
  <section class="ecran">
    <h2>6. Résultats</h2>
    ${!pretACalculer ? '<p class="alerte">Complétez d\'abord le profil, le local et au moins un praticien (étapes 1 à 3) avant de calculer.</p>' : ''}
    <button data-action="calculer" class="bouton-principal bouton-large" ${!pretACalculer ? 'disabled' : ''}>Calculer le bilan</button>
    ${r ? rendreResultats(r, etat) : '<p class="aide" style="margin-top: 1rem;">Le résultat s\'affichera ici une fois le calcul lancé.</p>'}
  </section>`;
}

/**
 * Camembert en anneau — répartition par poste. Remplace le graphique en
 * barres horizontales pour ce cas d'usage précis (une lecture "part du
 * tout" est plus immédiate en anneau qu'en barres). Les valeurs et le
 * calcul sous-jacent (items) sont strictement identiques à avant ; seule la
 * représentation change.
 */
function svgCamembertAnneau(items, { taille = 220, epaisseur = 34, unite = 'kgCO2e' } = {}) {
  const total = items.reduce((s, i) => s + i.valeur, 0) || 1;
  const rayon = (taille - epaisseur) / 2;
  const cx = taille / 2, cy = taille / 2;

  // Vrais segments d'arc indépendants (path), plutôt que des cercles
  // complets superposés avec stroke-dasharray : chaque segment n'occupe
  // que sa portion réelle du cercle, ce qui rend le survol/toucher fiable
  // sur chacun (avec des cercles empilés, la zone "invisible" d'un cercle
  // peut malgré tout intercepter les événements de pointeur au-dessus des
  // segments qu'il recouvre, rendant certains segments impossibles à survoler).
  let angleCourant = -Math.PI / 2;
  const point = (angle) => ({ x: cx + rayon * Math.cos(angle), y: cy + rayon * Math.sin(angle) });

  const segments = items.map((item, i) => {
    const couleur = item.couleur || COULEURS_POSTES[i % COULEURS_POSTES.length];
    const part = item.valeur / total;
    const angle = part * Math.PI * 2;
    const p0 = point(angleCourant);
    const p1 = point(angleCourant + angle);
    const grandArc = angle > Math.PI ? 1 : 0;
    const tooltip = `${item.label} : ${fmt(item.valeur)} ${unite} (${Math.round(part * 100)}%)`;
    const chemin = `<path d="M ${p0.x} ${p0.y} A ${rayon} ${rayon} 0 ${grandArc} 1 ${p1.x} ${p1.y}"
      fill="none" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="${items.length > 1 ? 'butt' : 'round'}"
      class="segment-survolable" data-tooltip="${xmlEchappe(tooltip)}"></path>`;
    angleCourant += angle;
    return chemin;
  }).join('');

  const legende = items.map((item, i) => {
    const couleur = item.couleur || COULEURS_POSTES[i % COULEURS_POSTES.length];
    return `<span class="legende-item"><span class="legende-puce" style="background:${couleur}"></span>${item.label}<span class="legende-pct">${Math.round((item.valeur / total) * 100)}%</span></span>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${taille} ${taille}" width="${taille}" height="${taille}" class="graphe-anneau" role="img" aria-label="Répartition par poste">
      <circle cx="${cx}" cy="${cy}" r="${rayon}" fill="none" stroke="var(--couleur-bordure-legere)" stroke-width="${epaisseur}"></circle>
      ${segments}
    </svg>
    <div class="legende-graphe">${legende}</div>`;
}

function svgBarresHorizontales(items, { largeur = 560, hauteurBarre = 28, espaceLabel = 22, espaceApresBarre = 18, unite = 'kgCO2e', reserveValeur = 110 } = {}) {
  const max = Math.max(...items.map(i => i.valeur), 1);
  const largeurZoneBarres = largeur - reserveValeur;
  const hauteurBloc = espaceLabel + hauteurBarre + espaceApresBarre;
  const hauteurTotale = items.length * hauteurBloc;
  const barres = items.map((item, i) => {
    const yBloc = i * hauteurBloc;
    const largeurBarre = Math.max((item.valeur / max) * largeurZoneBarres, 3);
    const couleur = item.couleur || COULEURS_POSTES[i % COULEURS_POSTES.length];
    return `
      <text x="0" y="${yBloc + 14}" class="svg-label">${item.label}</text>
      <rect x="0" y="${yBloc + espaceLabel}" width="${largeurBarre}" height="${hauteurBarre}" rx="4" fill="${couleur}" class="segment-survolable" data-tooltip="${xmlEchappe(item.label + ' : ' + fmt(item.valeur) + ' ' + unite)}"></rect>
      <text x="${largeurBarre + 8}" y="${yBloc + espaceLabel + hauteurBarre / 2 + 4}" class="svg-valeur">${fmt(item.valeur)} ${unite}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${largeur} ${hauteurTotale}" class="graphe-barres" role="img" aria-label="Graphique en barres">${barres}</svg>`;
}

/**
 * Barres empilées : une barre par entité (praticien...), segmentée par poste.
 * Remplace le tableau "Détail par praticien" par une lecture visuelle directe.
 */
/**
 * Jauge en demi-cercle, 0 à 30% (plafond de la jauge d'engagement).
 * Trois zones de couleur (pas engagé / trajectoire 1 an / trajectoire 3 ans+)
 * et une aiguille indiquant la position actuelle.
 */
function svgJaugeDemiCercle(pct) {
  const cx = 150, cy = 130, rayon = 110;
  const pctCappe = Math.max(0, Math.min(pct, 30));
  const angleDe = (valeurPct) => Math.PI - (valeurPct / 30) * Math.PI; // 0% -> 180°(gauche), 30% -> 0°(droite)
  const point = (angle, r) => ({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) });

  const arc = (pctDebut, pctFin, couleur) => {
    const a0 = angleDe(pctDebut), a1 = angleDe(pctFin);
    const p0 = point(a0, rayon), p1 = point(a1, rayon);
    return `<path d="M ${p0.x} ${p0.y} A ${rayon} ${rayon} 0 0 1 ${p1.x} ${p1.y}" stroke="${couleur}" stroke-width="22" fill="none" stroke-linecap="butt"></path>`;
  };

  const angleAiguille = angleDe(pctCappe);
  const pointeAiguille = point(angleAiguille, rayon - 30);

  return `
  <svg viewBox="0 0 300 155" class="jauge-svg" role="img" aria-label="Jauge d'engagement, ${pctCappe.toFixed(1)}%">
    ${arc(0, 5, '#B85C5C')}
    ${arc(5, 15, '#C98A2C')}
    ${arc(15, 30, '#2E673E')}
    <line x1="${cx}" y1="${cy}" x2="${pointeAiguille.x}" y2="${pointeAiguille.y}" stroke="var(--couleur-encre)" stroke-width="3" stroke-linecap="round"></line>
    <circle cx="${cx}" cy="${cy}" r="6" fill="var(--couleur-encre)"></circle>
    <text x="${cx}" y="${cy - 20}" text-anchor="middle" class="jauge-valeur">${pctCappe.toFixed(1)}%</text>
    <text x="30" y="${cy + 18}" class="jauge-repere">0%</text>
    <text x="270" y="${cy + 18}" text-anchor="end" class="jauge-repere">30%</text>
  </svg>`;
}

function svgBarresEmpilees(donnees, series, { largeur = 560, hauteurBarre = 30, espaceLabel = 20, espaceApresBarre = 26, unite = 'kgCO2e', reserveValeur = 110, formatteur = fmt } = {}) {
  const totaux = donnees.map(d => series.reduce((s, ser) => s + (d[ser.cle] || 0), 0));
  const max = Math.max(...totaux, 1);
  const largeurZone = largeur - reserveValeur;
  const hauteurBloc = espaceLabel + hauteurBarre + espaceApresBarre;
  const hauteurTotale = donnees.length * hauteurBloc;

  const barres = donnees.map((d, i) => {
    const yBloc = i * hauteurBloc;
    let xCursor = 0;
    const segments = series.map(ser => {
      const valeur = d[ser.cle] || 0;
      if (valeur <= 0) return '';
      const largeurSeg = (valeur / max) * largeurZone;
      const rect = `<rect x="${xCursor}" y="${yBloc + espaceLabel}" width="${largeurSeg}" height="${hauteurBarre}" fill="${ser.couleur}" class="segment-survolable" data-tooltip="${xmlEchappe(ser.label + ' : ' + formatteur(valeur) + ' ' + unite)}"></rect>`;
      xCursor += largeurSeg;
      return rect;
    }).join('');
    return `
      <text x="0" y="${yBloc + 14}" class="svg-label">${d.label}</text>
      ${segments}
      <text x="${xCursor + 8}" y="${yBloc + espaceLabel + hauteurBarre / 2 + 4}" class="svg-valeur">${formatteur(totaux[i])} ${unite}</text>`;
  }).join('');

  const legende = series.map(ser => `<span class="legende-item"><span class="legende-puce" style="background:${ser.couleur}"></span>${ser.label}</span>`).join('');

  return `<div class="legende-graphe">${legende}</div>
    <svg viewBox="0 0 ${largeur} ${hauteurTotale}" class="graphe-barres" role="img" aria-label="Graphique en barres empilées">${barres}</svg>`;
}

function rendreCarteAffiche(r, etat) {
  return `
  <div class="carte">
    <h3 class="carte-titre">Affiche pour la salle d'attente</h3>
    <p class="aide">Génère une image de synthèse (empreinte de la MSP, répartition par poste, empreinte de chaque praticien) prête à imprimer ou à afficher à l'accueil.</p>
    <button data-action="exporter-affiche" class="bouton-principal" ${!r ? 'disabled' : ''}>Générer l'affiche (image)</button>
    <p id="affiche-statut" class="aide" style="margin-top: 0.6rem"></p>
  </div>`;
}

function rendreHistorique() {
  const historique = getHistoriqueBilans().slice(0, 8);
  if (historique.length === 0) return '<p class="aide">Aucun bilan enregistré pour l\'instant — le premier calcul sera automatiquement archivé.</p>';
  return `
  <table class="table-historique">
    <tr><th>Date</th><th>Structure</th><th>Empreinte totale</th></tr>
    ${historique.map(b => `<tr>
      <td>${new Date(b.horodatage).toLocaleDateString('fr-FR')}</td>
      <td>${b.structureMSP?.nom || '—'}</td>
      <td>${fmt((b.resultat?.empreinteTotale || 0) / 1000)} tCO2e/an</td>
    </tr>`).join('')}
  </table>`;
}

function rendreResultats(r, etat) {
  const nomsPraticiens = Object.fromEntries(etat.praticiens.map((p, i) => [p.id, `Praticien ${i + 1}`]));
  const dependance = r.tauxDependanceFossile;

  const donneesPostes = [
    { label: 'Local (énergie + bâtiment)', valeur: r.parPoste.local.total },
    { label: 'Déplacements patientèle', valeur: r.parPoste.patientele.total },
    { label: 'Domicile-travail (usage)', valeur: r.parPoste.domicileTravail.domicileTravail.usage },
    { label: 'Tournées à domicile (usage)', valeur: r.parPoste.domicileTravail.tournees.usage },
    { label: 'Congrès / formations (usage)', valeur: r.parPoste.domicileTravail.deplacementsProAnnuels.usage },
    { label: 'Immobilisation véhicules', valeur: r.parPoste.domicileTravail.fabricationVehiculeTotal },
    { label: 'Alimentation professionnelle', valeur: r.parPoste.alimentation.total },
    { label: 'Prescriptions (médicaments + actes externes)', valeur: r.parPoste.prescriptions.total },
    { label: 'Postes mutualisés', valeur: r.parPoste.support.total },
    { label: 'Immobilisations diverses', valeur: r.parPoste.immobilisations }
  ].filter(d => d.valeur > 0).sort((a, b) => b.valeur - a.valeur);

  const seriesEmpreinte = [
    { cle: 'partLocal', label: 'Local', couleur: COULEURS_POSTES[0] },
    { cle: 'partPatientele', label: 'Patientèle', couleur: COULEURS_POSTES[1] },
    { cle: 'partDeplacementsPro', label: 'Déplacements pro.', couleur: COULEURS_POSTES[2] },
    { cle: 'partAlimentation', label: 'Alimentation', couleur: '#4E8FA3' },
    { cle: 'partPrescriptions', label: 'Prescriptions', couleur: '#8A6FB0' },
    { cle: 'partImmobilisations', label: 'Immobilisations', couleur: COULEURS_POSTES[3] },
    { cle: 'partSupport', label: 'Postes mutualisés', couleur: COULEURS_POSTES[4] }
  ];
  const parActe = !!etat.affichageParActe;
  const totalActesMSP = etat.praticiens.reduce((s, p) => s + p.nbActesAnnuel, 0) || 1;

  const donneesEmpilees = etat.praticiens.map(p => {
    const e = r.empreintesPraticiens.find(x => x.id === p.id);
    const diviseur = parActe ? (p.nbActesAnnuel || 1) : 1;
    return {
      label: nomsPraticiens[p.id],
      partLocal: e.partLocal / diviseur, partPatientele: e.partPatientele / diviseur,
      partDeplacementsPro: e.partDeplacementsPro / diviseur, partAlimentation: e.partAlimentation / diviseur,
      partPrescriptions: e.partPrescriptions / diviseur,
      partImmobilisations: e.partImmobilisations / diviseur, partSupport: e.partSupport / diviseur
    };
  });
  const diviseurAdmin = parActe ? totalActesMSP : 1;
  donneesEmpilees.push({
    label: 'Fonctions support (MSP)',
    partLocal: r.empreinteStaffAdmin.partLocal / diviseurAdmin, partPatientele: 0,
    partDeplacementsPro: r.empreinteStaffAdmin.partDeplacements / diviseurAdmin, partAlimentation: 0,
    partPrescriptions: 0,
    partImmobilisations: r.empreinteStaffAdmin.partImmobilisations / diviseurAdmin, partSupport: 0
  });

  return `
  <div class="resultats">
    ${r.structureIncomplete?.surfaceManquante || r.structureIncomplete?.actesManquants ? `
      <div class="alerte" style="margin-bottom:1rem;">
        ⚠️ ${r.structureIncomplete.surfaceManquante ? `La <strong>surface totale de la structure</strong> n'est pas renseignée (étape "Profil") — ` : ''}${r.structureIncomplete.actesManquants ? `<strong>aucun praticien n'a de nombre d'actes annuel renseigné</strong> — ` : ''}les fiches individuelles ci-dessous ne peuvent pas être réparties tant que ${r.structureIncomplete.surfaceManquante && r.structureIncomplete.actesManquants ? 'ces champs ne sont pas complétés' : 'ce champ n\u2019est pas complété'}. L'empreinte totale de la structure, elle, reste correcte.
      </div>` : ''}
    <div class="chiffres-cles">
      <div class="chiffre-cle">
        <span class="chiffre-cle-valeur">${fmt(r.empreinteTotale / 1000)}</span>
        <span class="chiffre-cle-unite">tCO2e / an</span>
        <span class="chiffre-cle-label">Empreinte totale de la MSP</span>
      </div>
      <div class="chiffre-cle">
        <span class="chiffre-cle-valeur">${r.ratioParActe != null ? r.ratioParActe.toFixed(1) : '—'}</span>
        <span class="chiffre-cle-unite">kgCO2e / acte</span>
        <span class="chiffre-cle-label">Ratio moyen par acte</span>
      </div>
    </div>

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
      ${dependance ? `
        <div class="chiffres-cles">
          <div class="chiffre-cle">
            <span class="chiffre-cle-valeur">${dependance.progressionVersObjectif2050.toFixed(0)}%</span>
            <span class="chiffre-cle-unite">du chemin vers l'objectif 2050</span>
            <span class="chiffre-cle-label">${dependance.progressionVersObjectif2050 >= 100 ? 'Objectif 2050 déjà atteint' : dependance.progressionVersObjectif2050 <= 0 ? 'Au niveau ou au-dessus de la moyenne nationale — tout reste à faire' : `Reste ${(100 - dependance.progressionVersObjectif2050).toFixed(0)}% du chemin à parcourir`}</span>
          </div>
        </div>` : '<p class="aide">Calculez le bilan pour voir cet indicateur.</p>'}
    </div>

    <h3 class="carte-titre">Répartition par poste (MSP entière)</h3>
    <p class="aide">Passez la souris sur une part du graphique pour voir le chiffre exact.</p>
    ${svgCamembertAnneau(donneesPostes)}

    <details class="details-resultats" data-details-key="resultats-detail-praticien">
      <summary><span>Voir le détail par praticien</span></summary>
      <p class="aide">Chaque praticien porte sa propre empreinte (local au prorata de sa surface, ses déplacements propres, son alimentation, ses immobilisations dédiées, sa part des postes mutualisés au prorata des actes réalisés en cabinet). Les fonctions support de la MSP (staff administratif) ont leur propre empreinte, distincte, pour cibler les bonnes actions au bon endroit. La somme de toutes ces empreintes reconstitue exactement l'empreinte totale de la MSP.</p>
      <div class="toggle-groupe">
        <button data-action="affichage-total" class="toggle-bouton ${!parActe ? 'actif' : ''}">Total (kgCO2e/an)</button>
        <button data-action="affichage-par-acte" class="toggle-bouton ${parActe ? 'actif' : ''}">Par séance (kgCO2e/acte)</button>
      </div>
      ${parActe ? '<p class="aide">Le staff admin n\'a pas d\'actes propres : sa ligne est ramenée au nombre total d\'actes de la MSP (contribution des fonctions support par séance réalisée).</p>' : ''}
      ${svgBarresEmpilees(donneesEmpilees, seriesEmpreinte, { unite: parActe ? 'kgCO2e/acte' : 'kgCO2e', formatteur: parActe ? fmtDecimal : fmt })}
    </details>

    <div class="carte" style="margin-top: 2rem">
      <h3 class="carte-titre">Télécharger le détail des calculs</h3>
      <p class="aide">Fichier Excel complet : résultats par poste, réventilation par praticien, et tous les facteurs d'émission utilisés avec leur source — de quoi comprendre et vérifier chaque chiffre.</p>
      <button data-action="exporter-excel" class="bouton-principal">Télécharger le détail (Excel)</button>
      <p id="export-statut" class="aide" style="margin-top: 0.8rem"></p>
    </div>

    ${rendreCarteAffiche(r, etat)}

    <div class="carte">
      <h3 class="carte-titre">Suivre l'évolution dans le temps</h3>
      <p class="aide">Chaque bilan calculé est conservé automatiquement sur cet appareil. Exportez une archive pour la garder en lieu sûr ou la reprendre sur un autre appareil/navigateur — l'import fusionne avec l'historique déjà présent, sans rien écraser.</p>
      <div class="ligne-double">
        <button data-action="exporter-archive" class="bouton-secondaire">Exporter l'archive</button>
        <label class="bouton-secondaire bouton-fichier">Importer une archive
          <input type="file" id="import-archive-fichier" accept="application/json" style="display:none">
        </label>
      </div>
      <p id="archive-statut" class="aide" style="margin-top: 0.6rem"></p>
      ${rendreHistorique()}
    </div>

    <div class="carte">
      <h3 class="carte-titre">Partager pour le tableau de bord comparatif (optionnel)</h3>
      <p class="aide">Un tableau de bord compare les résultats de plusieurs structures participantes. Le partage est entièrement volontaire — rien n'est envoyé sans votre action explicite ci-dessous.</p>
      <p class="aide" style="background: var(--couleur-fond); border-radius: var(--rayon-bouton); padding: 0.8rem; margin: 0 0 0.9rem;">En cliquant sur "Exporter et partager", vous acceptez que les données de ce fichier — l'empreinte carbone de votre structure, sa répartition par poste, et le détail par praticien sans aucun nom ni donnée personnelle identifiable au-delà du nom de votre structure — soient transmises à libetco2@gmail.com pour construire un tableau de bord comparatif entre structures participantes. Vous pouvez demander la suppression de ces données à tout moment en contactant cette même adresse. Aucune donnée n'est transmise sans cette action explicite de votre part.</p>
      <label style="display:flex; align-items:flex-start; gap:0.5rem; font-weight:500;">
        <input type="checkbox" id="consentement-dashboard" style="width:1.1rem;height:1.1rem;margin-top:0.15rem;flex-shrink:0;accent-color:var(--couleur-primaire)">
        <span>J'ai lu et j'accepte que ces données soient partagées dans les conditions décrites ci-dessus.</span>
      </label>
      <button data-action="exporter-dashboard" id="bouton-exporter-dashboard" class="bouton-principal" disabled style="margin-top: 0.9rem">Exporter et partager</button>
      <p id="dashboard-statut" class="aide" style="margin-top: 0.6rem"></p>
    </div>

    <div class="carte carte-invitation">
      <h3 class="carte-titre">Et maintenant ?</h3>
      <p class="aide">Ce bilan n'est utile que s'il débouche sur des actions concrètes. Découvrez les pistes d'action adaptées à chaque poste, avec leur potentiel de réduction chiffré pour votre structure.</p>
      <button data-action="aller-ecran" data-numero="7" class="bouton-principal bouton-large">Découvrir les pistes d'action →</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// ÉCRAN 7 — Solutions (catalogue d'actions de décarbonation, repris du socle
// individuel — ACTIONS/CATEGORIES_META — complété des actions propres à la
// MSP, ex. coordination du parcours de soins). Certains postes n'ont pas
// d'équivalent isolé dans le calcul MSP (numérique à part) : leur potentiel
// reste affiché à titre indicatif, non chiffré.
const TOUTES_ACTIONS = [...ACTIONS, ...ACTIONS_MSP_SUPPLEMENTAIRES];

function assurerActionsChoix(etat) {
  if (!etat.actionsChoix) etat.actionsChoix = {};
  for (const a of TOUTES_ACTIONS) {
    if (!etat.actionsChoix[a.id]) {
      etat.actionsChoix[a.id] = { active: false, valeur: a.unit === 'degres' ? (a.defaultDegres || 1) : (a.defaultPct ?? 50) };
    }
  }
}

function valeurPosteMSP(r, posteId) {
  if (!r) return null;
  switch (posteId) {
    case 'deplacements_pro': return r.parPoste.domicileTravail.usageTotal + r.parPoste.domicileTravail.fabricationVehiculeTotal;
    case 'deplacements_patientele': return r.parPoste.patientele.total;
    case 'local': return r.parPoste.local.total;
    case 'services': return r.parPoste.support.services;
    case 'fret': return r.parPoste.support.fret;
    case 'materiel': return r.parPoste.support.materielSecretariat;
    case 'alimentation': return r.parPoste.alimentation.total;
    default: return null; // numerique : non isolé dans l'outil MSP
  }
}

function reductionEstimee(action, choix, valeurPoste) {
  if (valeurPoste == null) return null;
  if (action.unit === 'degres') return valeurPoste * action.maxReductionParDegre * (choix.valeur || 0);
  return valeurPoste * action.maxReduction * ((choix.valeur ?? action.defaultPct) / 100);
}

function rendreSolutions(etat) {
  assurerActionsChoix(etat);
  const r = etat.dernierResultat;

  const groupes = {};
  for (const a of TOUTES_ACTIONS) {
    if (!groupes[a.poste]) groupes[a.poste] = [];
    groupes[a.poste].push(a);
  }

  let totalReduction = 0;
  const actionsCochees = [];
  for (const a of TOUTES_ACTIONS) {
    const choix = etat.actionsChoix[a.id];
    if (!choix.active) continue;
    actionsCochees.push(a);
    const red = reductionEstimee(a, choix, valeurPosteMSP(r, a.poste));
    if (red) totalReduction += red;
  }
  const pctEngagement = r && r.empreinteTotale > 0 ? Math.min((totalReduction / r.empreinteTotale) * 100, 30) : 0;
  const paliers = pctEngagement < 5 ? 'Pas encore engagé' : pctEngagement < 15 ? 'Trajectoire 1 an' : 'Trajectoire 3 ans et plus';

  return `
  <section class="ecran">
    <h2>7. Pistes d'action</h2>
    ${!r ? '<p class="alerte">Calculez d\'abord le bilan (écran "Résultats") pour voir l\'impact chiffré de chaque action.</p>' : ''}
    <p class="aide">Cochez les actions envisagées par la structure. Le poste numérique n'est pas isolé dans le calcul MSP (fondu dans les immobilisations) — son potentiel reste indicatif.</p>

    ${r ? `
    <div class="carte">
      <h3 class="carte-titre">Jauge d'engagement — trajectoire Accord de Paris</h3>
      <p class="aide">Situe le plan d'action coché par rapport à une trajectoire de réduction de -5%/an, plafonnée à 30% (au-delà, la structure doit surtout se concentrer sur le déploiement réel plutôt que sur l'ajout de nouvelles actions cochées).</p>
      ${svgJaugeDemiCercle(pctEngagement)}
      <div class="chiffres-cles">
        <div class="chiffre-cle">
          <span class="chiffre-cle-valeur">${fmt(totalReduction)}</span>
          <span class="chiffre-cle-unite">kgCO2e/an évités</span>
          <span class="chiffre-cle-label">Potentiel des actions cochées</span>
        </div>
        <div class="chiffre-cle">
          <span class="chiffre-cle-valeur">${pctEngagement.toFixed(1)}%</span>
          <span class="chiffre-cle-unite">de l'empreinte totale</span>
          <span class="chiffre-cle-label">${paliers}</span>
        </div>
      </div>
    </div>` : ''}

    <div class="carte">
      <h3 class="carte-titre">Document de suivi éditable</h3>
      <p class="aide">Reprend les actions cochées ci-dessous avec un objectif à 1 an, prêt à imprimer ou à modifier directement dans Word/LibreOffice — pour un point d'avancement en réunion, à remplir au fil du temps (dates, statuts, notes).</p>
      <button data-action="telecharger-plan-actions" class="bouton-principal" ${!r || actionsCochees.length === 0 ? 'disabled' : ''}>Télécharger le plan de décarbonation</button>
      ${actionsCochees.length === 0 ? '<p class="aide" style="margin-top:0.6rem">Cochez au moins une action ci-dessous pour activer le téléchargement.</p>' : ''}
    </div>

    ${Object.entries(groupes).map(([posteId, actions]) => rendreGroupeActions(etat, posteId, actions, r)).join('')}
    ${rendrePiedNavigation(etat)}
  </section>`;
}

function rendreGroupeActions(etat, posteId, actions, r) {
  const meta = CATEGORIES_META[posteId];
  const valeurPoste = valeurPosteMSP(r, posteId);
  return `
  <div class="carte">
    <h3 class="carte-titre" style="color:${meta.color}">${meta.label}</h3>
    ${valeurPoste == null ? '<p class="aide">Poste non isolé dans le calcul MSP — potentiel de réduction indicatif uniquement.</p>' : ''}
    ${actions.map(a => rendreActionCard(etat, a, valeurPoste)).join('')}
  </div>`;
}

function rendreActionCard(etat, action, valeurPoste) {
  const choix = etat.actionsChoix[action.id];
  const sourcee = action.source.startsWith('SOURCÉ');
  const reduction = choix.active ? reductionEstimee(action, choix, valeurPoste) : null;
  return `
  <div class="carte-action">
    <label class="action-entete">
      <input type="checkbox" data-path="actionsChoix.${action.id}.active" ${choix.active ? 'checked' : ''}>
      <span>${action.titre}</span>
    </label>
    <div class="action-badges">
      <span class="badge ${sourcee ? 'badge-source' : 'badge-estime'}">${sourcee ? 'Sourcé' : 'Estimé'}</span>
      <span class="badge badge-cout">${action.cost}</span>
    </div>
    ${choix.active ? `
      <div class="action-curseur">
        <label>${action.unit === 'degres' ? 'Nombre de degrés ajustés' : 'Part de déploiement (%)'}
          <input type="number" min="0" max="${action.unit === 'degres' ? 5 : 100}" data-path="actionsChoix.${action.id}.valeur" value="${choix.valeur}">
        </label>
        ${reduction != null ? `<p class="action-reduction">≈ ${fmt(reduction)} kgCO2e/an évités</p>` : '<p class="aide">Potentiel non chiffrable ici (poste non isolé dans l\'outil MSP).</p>'}
      </div>` : ''}
    <p class="aide">${action.source}</p>
  </div>`;
}

// ---------------------------------------------------------------------------
// ÉCOUTEURS D'ÉVÉNEMENTS
// Affiche un petit message flottant temporaire (3,5 s), pour prévenir d'une
// saisie visiblement erronée sans interrompre la saisie avec un alert()
// bloquant. Réutilisable pour d'autres validations similaires à l'avenir.
function afficherBulle(texte) {
  const ancienne = document.getElementById('bulle-avertissement');
  if (ancienne) ancienne.remove();
  const bulle = document.createElement('div');
  bulle.id = 'bulle-avertissement';
  bulle.textContent = texte;
  bulle.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:#1B2B26; color:#fff; padding:14px 22px; border-radius:10px; font-size:14px; max-width:min(90vw, 420px); text-align:center; box-shadow:0 8px 24px rgba(0,0,0,.25); z-index:9999; line-height:1.4;';
  document.body.appendChild(bulle);
  setTimeout(() => bulle.remove(), 3500);
}

function attacherEcouteurs(app) {
  // Sélectionne tout le contenu au focus pour les champs numériques et
  // texte : sans ça, taper dans un champ affichant déjà "0" par défaut
  // insère le nouveau chiffre à côté de l'ancien ("02" au lieu de "2").
  app.querySelectorAll('input[type="number"], input[type="text"], input[type="email"]').forEach(input => {
    input.addEventListener('focus', () => input.select());
  });

  app.querySelectorAll('[data-path]').forEach(input => {
    input.addEventListener('change', () => {
      let valeur = input.type === 'checkbox' ? input.checked
        : input.type === 'number' ? parseFloat(input.value) || 0
        : input.value;
      // Une année ne comporte que 52 semaines : au-delà, la saisie est
      // presque toujours une erreur de frappe (ou une confusion avec un
      // nombre de jours). On prévient avec une bulle plutôt que de laisser
      // passer silencieusement une valeur impossible, puis on ramène à 52.
      if (input.dataset.path.endsWith('.semainesTravailleesAn') && valeur > 52) {
        afficherBulle('👀 Wow, vous travaillez beaucoup sur une année ! Une année ne comporte que 52 semaines — on ramène la valeur à 52.');
        valeur = 52;
        input.value = 52;
      }
      majEtat(input.dataset.path, valeur);
    });
  });

  app.querySelectorAll('[data-path-mobilier]').forEach(input => {
    input.addEventListener('change', () => {
      const [ownerId, champ, index, clef] = input.dataset.pathMobilier.split('|');
      const etat = getEtat();
      const cible = ownerId === 'staffAdmin' ? etat.staffAdmin[champ] : etat.praticiens.find(p => p.id === ownerId)[champ];
      cible[+index][clef] = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
      forcerRafraichissement(etat);
    });
  });

  const inputImportArchive = app.querySelector('#import-archive-fichier');
  if (inputImportArchive) {
    inputImportArchive.addEventListener('change', () => {
      if (inputImportArchive.files?.[0]) importerArchiveDepuisFichier(inputImportArchive.files[0]);
    });
  }

  const consentementDashboard = app.querySelector('#consentement-dashboard');
  const boutonExporterDashboard = app.querySelector('#bouton-exporter-dashboard');
  if (consentementDashboard && boutonExporterDashboard) {
    consentementDashboard.addEventListener('change', () => {
      boutonExporterDashboard.disabled = !consentementDashboard.checked;
    });
  }

  const rechercheCommune = app.querySelector('#recherche-commune');
  if (rechercheCommune) {
    rechercheCommune.addEventListener('input', () => {
      const resultats = chercherCommunes(rechercheCommune.value, 8);
      const zone = app.querySelector('#resultats-commune');
      zone.innerHTML = resultats.map(c => `<div class="resultat-commune" data-code="${c.code}" data-nom="${c.nom}">${c.nom} (${c.dep})</div>`).join('');
    });
  }
  const zoneResultats = app.querySelector('#resultats-commune');
  if (zoneResultats) {
    zoneResultats.addEventListener('click', (ev) => {
      const item = ev.target.closest('.resultat-commune');
      if (!item) return;
      const etat = getEtat();
      etat.structureMSP.communeNom = item.dataset.nom;
      majEtat('structureMSP.commune', item.dataset.code);
    });
  }

  // Délégation d'événements plutôt qu'un écouteur par bouton : un écouteur
  // attaché individuellement à chaque bouton [data-action] est perdu s'il
  // est recréé pendant le clic lui-même (ex. taper une valeur puis cliquer
  // "Suivant" sans cliquer ailleurs avant : le "blur" du champ déclenche un
  // re-rendu complet AU MILIEU du clic, qui détruit le bouton visé). En
  // écoutant sur #app (élément stable, jamais recréé — seul son contenu
  // change), le clic est capturé même si sa cible exacte a été remplacée
  // entre le mousedown et le mouseup. Attaché une seule fois (voir plus bas,
  // hors de rendreEcran), jamais à chaque re-rendu.
  if (!app.dataset.ecouteurActionsAttache) {
    app.dataset.ecouteurActionsAttache = "1";
    app.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-action]');
      if (!el) return;
      const { action } = el.dataset;
      if (action === 'aller-ecran') { allerEcran(+el.dataset.numero); window.scrollTo(0, 0); }
      if (action === 'ajouter-praticien') ajouterPraticien();
      if (action === 'supprimer-praticien') supprimerPraticien(el.dataset.id);
      if (action === 'calculer') calculerEtEnregistrer();
      if (action === 'exporter-excel') exporterExcel(getEtat());
      if (action === 'exporter-affiche') exporterAffiche();
      if (action === 'telecharger-plan-actions') telechargerPlanActions();
      if (action === 'exporter-archive') exporterArchiveVersFichier();
      if (action === 'exporter-dashboard') exporterDashboard();
      if (action === 'affichage-total') { const e = getEtat(); e.affichageParActe = false; forcerRafraichissement(e); }
      if (action === 'affichage-par-acte') { const e = getEtat(); e.affichageParActe = true; forcerRafraichissement(e); }
      if (action === 'ajouter-materiel-dedie') ajouterLignePraticien(el.dataset.id, 'materielDedie', { type: '', valeurAchat: 0, dureeDetention: 5 });
      if (action === 'ajouter-mode') ajouterLigneChampPraticien(el.dataset.id, el.dataset.champ, { mode: 'velo_meca', part: 0 });
      if (action === 'ajouter-prescription-externe') ajouterLigneChampPraticien(el.dataset.id, el.dataset.champ, { profession: 'kinesitherapeute', nbActesAnnuel: 0 });
      if (action === 'supprimer-mode') supprimerLigneChampPraticien(el.dataset.id, el.dataset.champ, +el.dataset.index);
      if (action === 'ajouter-mode-transport') ajouterLignePraticien(el.dataset.id, 'modesDomicileTravail', { mode: 'velo_meca', part: 0 });
      if (action === 'ajouter-materiel-info') ajouterMaterielInfoPraticien(el.dataset.id);
      if (action === 'supprimer-ligne-praticien') supprimerLigneNestedPraticien(el.dataset.id, el.dataset.champ, +el.dataset.index);
      if (action === 'ajouter-materiel-info-admin') ajouterLigne('staffAdmin.numerique.autreMaterielInfo', { type: '', valeurAchat: 0, dureeDetention: 5 });
      if (action === 'ajouter-materiel-partage') ajouterLigne('postesMutualises.materielPartage', { type: '', valeurAchat: 0, dureeDetention: 5 });
      if (action === 'supprimer-ligne') supprimerLigne(el.dataset.chemin, +el.dataset.index);
      if (action === 'ajouter-mobilier') ajouterMobilier(el.dataset.owner, el.dataset.champ);
      if (action === 'supprimer-mobilier') supprimerMobilier(el.dataset.owner, el.dataset.champ, +el.dataset.index);
    });
  }
}

function forcerRafraichissement(etat) {
  majEtat('structureMSP.nom', etat.structureMSP.nom);
}

// ---------------------------------------------------------------------------
// INFOBULLES DE GRAPHIQUE — remplace les <title> SVG natifs, qui ne
// s'affichent jamais au toucher sur mobile (seulement au survol souris).
// Une seule bulle réutilisée pour tous les graphiques, positionnée près du
// doigt/pointeur, qui fonctionne à la fois en survol et au toucher.
let elementInfobulle = null;
function obtenirElementInfobulle() {
  if (!elementInfobulle) {
    elementInfobulle = document.createElement('div');
    elementInfobulle.className = 'infobulle-graphe';
    document.body.appendChild(elementInfobulle);
  }
  return elementInfobulle;
}

function positionnerInfobulle(bulle, clientX, clientY) {
  const marge = 12;
  let x = clientX + marge, y = clientY - 14;
  const largeurEcran = window.innerWidth, hauteurEcran = window.innerHeight;
  bulle.style.left = '0px'; bulle.style.top = '0px'; bulle.style.display = 'block';
  const rect = bulle.getBoundingClientRect();
  if (x + rect.width > largeurEcran - marge) x = clientX - rect.width - marge;
  x = Math.max(marge, Math.min(x, largeurEcran - rect.width - marge));
  if (y < marge) y = clientY + 20;
  if (y + rect.height > hauteurEcran - marge) y = hauteurEcran - rect.height - marge;
  bulle.style.left = x + 'px';
  bulle.style.top = y + 'px';
}

function attacherTooltipsGraphes(app) {
  const bulle = obtenirElementInfobulle();
  const masquer = () => { bulle.style.display = 'none'; };

  app.querySelectorAll('.segment-survolable').forEach(el => {
    el.addEventListener('mouseenter', (ev) => {
      bulle.textContent = el.dataset.tooltip;
      positionnerInfobulle(bulle, ev.clientX, ev.clientY);
    });
    el.addEventListener('mousemove', (ev) => positionnerInfobulle(bulle, ev.clientX, ev.clientY));
    el.addEventListener('mouseleave', masquer);
    el.addEventListener('touchstart', (ev) => {
      const t = ev.touches[0];
      bulle.textContent = el.dataset.tooltip;
      positionnerInfobulle(bulle, t.clientX, t.clientY);
      ev.stopPropagation();
    }, { passive: true });
  });

  // Masque l'infobulle si l'utilisateur touche ailleurs qu'un segment.
  if (!attacherTooltipsGraphes.ecouteurGlobalPose) {
    document.addEventListener('touchstart', (ev) => {
      if (!ev.target.closest?.('.segment-survolable')) masquer();
    }, { passive: true });
    attacherTooltipsGraphes.ecouteurGlobalPose = true;
  }
}

// Accès générique à un champ imbriqué d'un praticien via un chemin en
// notation pointée (ex. "tourneesDomicile.modes"), pour les listes qui ne
// sont pas directement à la racine du praticien.
function champPraticien(praticien, cheminPointe) {
  return cheminPointe.split('.').reduce((o, k) => o[k], praticien);
}

function ajouterLigneChampPraticien(praticienId, cheminPointe, item) {
  const etat = getEtat();
  const p = etat.praticiens.find(x => x.id === praticienId);
  champPraticien(p, cheminPointe).push(item);
  forcerRafraichissement(etat);
}

function supprimerLigneChampPraticien(praticienId, cheminPointe, index) {
  const etat = getEtat();
  const p = etat.praticiens.find(x => x.id === praticienId);
  champPraticien(p, cheminPointe).splice(index, 1);
  forcerRafraichissement(etat);
}

function ajouterMaterielInfoPraticien(praticienId) {
  const etat = getEtat();
  const p = etat.praticiens.find(x => x.id === praticienId);
  p.numerique.autreMaterielInfo.push({ type: '', valeurAchat: 0, dureeDetention: 5 });
  forcerRafraichissement(etat);
}

function supprimerLigneNestedPraticien(praticienId, champ, index) {
  const etat = getEtat();
  const p = etat.praticiens.find(x => x.id === praticienId);
  if (champ === 'numerique.autreMaterielInfo') p.numerique.autreMaterielInfo.splice(index, 1);
  else p[champ].splice(index, 1);
  forcerRafraichissement(etat);
}

function ajouterMobilier(ownerId, champ) {
  const etat = getEtat();
  const cible = ownerId === 'staffAdmin' ? etat.staffAdmin[champ] : etat.praticiens.find(p => p.id === ownerId)[champ];
  cible.push({ type: Object.keys(FACTEURS_MOBILIER_UNITE)[0], nombre: 1, dureeDetention: 10 });
  forcerRafraichissement(etat);
}

function supprimerMobilier(ownerId, champ, index) {
  const etat = getEtat();
  const cible = ownerId === 'staffAdmin' ? etat.staffAdmin[champ] : etat.praticiens.find(p => p.id === ownerId)[champ];
  cible.splice(index, 1);
  forcerRafraichissement(etat);
}

// ---------------------------------------------------------------------------
// EXPORT EXCEL — génère un classeur multi-feuilles au format SpreadsheetML
// (XML natif Excel, aucune librairie externe requise, fonctionne hors-ligne).
// Reprend le détail complet des calculs, de la réventilation et de tous les
// facteurs d'émission utilisés, pour que chaque chiffre soit vérifiable.
function xmlEchappe(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function celluleTexte(v) { return `<Cell><Data ss:Type="String">${xmlEchappe(v)}</Data></Cell>`; }
function celluleNombre(v) { const n = Number(v); return `<Cell><Data ss:Type="Number">${Number.isFinite(n) ? n : 0}</Data></Cell>`; }
function ligneExcel(cellules) { return `<Row>${cellules.join('')}</Row>`; }
function feuilleExcel(nom, lignes) {
  return `<Worksheet ss:Name="${xmlEchappe(nom.slice(0, 31))}"><Table>${lignes.join('')}</Table></Worksheet>`;
}

function exporterExcel(etat) {
  const zoneStatut = document.getElementById('export-statut');
  if (!etat.dernierResultat) {
    if (zoneStatut) { zoneStatut.textContent = 'Calculez d\'abord le bilan (bouton "Calculer le bilan" en haut de cet écran).'; zoneStatut.classList.add('aide-alerte'); }
    return;
  }
  const r = etat.dernierResultat;
  const nomsPraticiens = Object.fromEntries(etat.praticiens.map((p, i) => [p.id, `Praticien ${i + 1}`]));
  const feuilles = [];

  // --- Feuille 1 : Résumé ---
  feuilles.push(feuilleExcel('Résumé', [
    ligneExcel([celluleTexte('Lib&CO2 MSP — Détail des calculs'), celluleTexte('')]),
    ligneExcel([celluleTexte('Structure'), celluleTexte(etat.structureMSP.nom || '(non renseigné)')]),
    ligneExcel([celluleTexte('Commune (code INSEE)'), celluleTexte(etat.structureMSP.commune || '')]),
    ligneExcel([celluleTexte('Date d\'export'), celluleTexte(new Date().toLocaleDateString('fr-FR'))]),
    ligneExcel([celluleTexte(''), celluleTexte('')]),
    ligneExcel([celluleTexte('Empreinte totale MSP (kgCO2e/an)'), celluleNombre(r.empreinteTotale)]),
    ligneExcel([celluleTexte('Empreinte totale MSP (tCO2e/an)'), celluleNombre(r.empreinteTotale / 1000)]),
    ligneExcel([celluleTexte('Ratio moyen par acte (kgCO2e/acte)'), celluleNombre(r.ratioParActe ?? 0)]),
  ]));

  // --- Feuille 2 : Postes MSP (détail complet) ---
  const lignesPostes = [ligneExcel([celluleTexte('Poste'), celluleTexte('Sous-poste'), celluleTexte('kgCO2e/an')])];
  lignesPostes.push(ligneExcel([celluleTexte('Local'), celluleTexte('Énergie'), celluleNombre(r.parPoste.local.emissionsEnergie)]));
  lignesPostes.push(ligneExcel([celluleTexte('Local'), celluleTexte('Bâtiment (construction)'), celluleNombre(r.parPoste.local.emissionsBatiment)]));
  lignesPostes.push(ligneExcel([celluleTexte('Déplacements patientèle'), celluleTexte(''), celluleNombre(r.parPoste.patientele.total)]));
  lignesPostes.push(ligneExcel([celluleTexte('Déplacements professionnels'), celluleTexte('Domicile-travail — usage'), celluleNombre(r.parPoste.domicileTravail.domicileTravail.usage)]));
  lignesPostes.push(ligneExcel([celluleTexte('Déplacements professionnels'), celluleTexte('Domicile-travail — fabrication véhicule'), celluleNombre(r.parPoste.domicileTravail.domicileTravail.fabricationVehicule)]));
  lignesPostes.push(ligneExcel([celluleTexte('Déplacements professionnels'), celluleTexte('Tournées à domicile — usage'), celluleNombre(r.parPoste.domicileTravail.tournees.usage)]));
  lignesPostes.push(ligneExcel([celluleTexte('Déplacements professionnels'), celluleTexte('Tournées à domicile — fabrication véhicule'), celluleNombre(r.parPoste.domicileTravail.tournees.fabricationVehicule)]));
  lignesPostes.push(ligneExcel([celluleTexte('Déplacements professionnels'), celluleTexte('Congrès/formations — usage'), celluleNombre(r.parPoste.domicileTravail.deplacementsProAnnuels.usage)]));
  lignesPostes.push(ligneExcel([celluleTexte('Déplacements professionnels'), celluleTexte('Congrès/formations — fabrication véhicule'), celluleNombre(r.parPoste.domicileTravail.deplacementsProAnnuels.fabricationVehicule)]));
  lignesPostes.push(ligneExcel([celluleTexte('Alimentation professionnelle'), celluleTexte(''), celluleNombre(r.parPoste.alimentation.total)]));
  lignesPostes.push(ligneExcel([celluleTexte('Prescriptions'), celluleTexte('Médicaments'), celluleNombre(r.parPoste.prescriptions.detailParPraticien.reduce((s, d) => s + d.emissionsMedicaments, 0))]));
  lignesPostes.push(ligneExcel([celluleTexte('Prescriptions'), celluleTexte('Actes paramédicaux externes (estimation par ratio local)'), celluleNombre(r.parPoste.prescriptions.detailParPraticien.reduce((s, d) => s + d.emissionsActesExternes, 0))]));
  lignesPostes.push(ligneExcel([celluleTexte('Postes mutualisés'), celluleTexte('Matériel de secrétariat'), celluleNombre(r.parPoste.support.materielSecretariat)]));
  lignesPostes.push(ligneExcel([celluleTexte('Postes mutualisés'), celluleTexte('Services (compta/banque/assurance/sous-traitance)'), celluleNombre(r.parPoste.support.services)]));
  lignesPostes.push(ligneExcel([celluleTexte('Postes mutualisés'), celluleTexte('Fret'), celluleNombre(r.parPoste.support.fret)]));
  lignesPostes.push(ligneExcel([celluleTexte('Immobilisations'), celluleTexte('Numérique + matériel + mobilier (tous praticiens et staff admin)'), celluleNombre(r.parPoste.immobilisations)]));
  feuilles.push(feuilleExcel('Postes MSP', lignesPostes));

  // --- Feuille 3 : Empreinte par praticien ---
  const lignesEmpreinte = [ligneExcel([
    celluleTexte('Praticien'), celluleTexte('Local'), celluleTexte('Patientèle'),
    celluleTexte('Déplacements pro.'), celluleTexte('Alimentation'), celluleTexte('Prescriptions'), celluleTexte('Immobilisations'), celluleTexte('Postes mutualisés'), celluleTexte('Total kgCO2e/an')
  ])];
  for (const p of etat.praticiens) {
    const e = r.empreintesPraticiens.find(x => x.id === p.id);
    lignesEmpreinte.push(ligneExcel([
      celluleTexte(nomsPraticiens[p.id]), celluleNombre(e.partLocal), celluleNombre(e.partPatientele),
      celluleNombre(e.partDeplacementsPro), celluleNombre(e.partAlimentation), celluleNombre(e.partPrescriptions), celluleNombre(e.partImmobilisations), celluleNombre(e.partSupport), celluleNombre(e.total)
    ]));
  }
  lignesEmpreinte.push(ligneExcel([
    celluleTexte('Fonctions support (MSP)'), celluleNombre(r.empreinteStaffAdmin.partLocal), celluleNombre(0),
    celluleNombre(r.empreinteStaffAdmin.partDeplacements), celluleNombre(0), celluleNombre(0), celluleNombre(r.empreinteStaffAdmin.partImmobilisations), celluleNombre(0), celluleNombre(r.empreinteStaffAdmin.total)
  ]));
  feuilles.push(feuilleExcel('Empreinte par praticien', lignesEmpreinte));

  // --- Feuille 3bis : Détail des prescriptions ---
  const lignesPrescriptions = [ligneExcel([
    celluleTexte('Praticien'), celluleTexte('Médicaments prescrits (€)'), celluleTexte('Émissions médicaments (kgCO2e)'), celluleTexte('Émissions actes externes (kgCO2e)'), celluleTexte('Total prescriptions (kgCO2e)')
  ])];
  for (const p of etat.praticiens) {
    if (!PROFESSIONS_PRESCRIPTRICES.includes(p.professionAPL)) continue;
    const d = r.parPoste.prescriptions.detailParPraticien.find(x => x.id === p.id);
    lignesPrescriptions.push(ligneExcel([
      celluleTexte(nomsPraticiens[p.id]), celluleNombre(p.prescriptions.montantAnnuelMedicaments),
      celluleNombre(d?.emissionsMedicaments ?? 0), celluleNombre(d?.emissionsActesExternes ?? 0), celluleNombre(d?.total ?? 0)
    ]));
  }
  lignesPrescriptions.push(ligneExcel([celluleTexte(''), celluleTexte(''), celluleTexte(''), celluleTexte(''), celluleTexte('')]));
  lignesPrescriptions.push(ligneExcel([celluleTexte('Méthode'), celluleTexte('Médicaments : facteur SOURCÉ 0,5 kgCO2e/€ (Shift Project/ADEME Base Empreinte). Actes externes : ratio kgCO2e/acte ESTIMÉ, dérivé de la même profession au sein de cette MSP. Option A retenue : les actes prescrits réalisés par un collègue de la même MSP sont exclus (déjà comptés dans son propre bilan).'), celluleTexte(''), celluleTexte(''), celluleTexte('')]));
  feuilles.push(feuilleExcel('Prescriptions', lignesPrescriptions));

  // --- Feuille 4 : Clés de réventilation ---
  const lignesClefs = [ligneExcel([
    celluleTexte('Praticien'), celluleTexte('Surface dédiée (m²)'), celluleTexte('% surface totale'),
    celluleTexte('Actes annuels'), celluleTexte('Part au lieu fixe (%)'), celluleTexte('Actes en cabinet'), celluleTexte('% actes cabinet (clé postes mutualisés)'),
    celluleTexte('Coefficient rareté APL')
  ])];
  const surfaceTotale = etat.structureMSP.surfaceTotale || 1;
  const totalActesCabinet = etat.praticiens.reduce((s, p) => s + p.nbActesAnnuel * (p.partLieuFixe / 100), 0) || 1;
  for (const p of etat.praticiens) {
    const actesCabinet = p.nbActesAnnuel * (p.partLieuFixe / 100);
    const coeff = r.parPoste.patientele.detailParPraticien.find(x => x.id === p.id)?.coeffRarete ?? 1;
    lignesClefs.push(ligneExcel([
      celluleTexte(nomsPraticiens[p.id]), celluleNombre(p.surfaceDediee), celluleNombre((p.surfaceDediee / surfaceTotale) * 100),
      celluleNombre(p.nbActesAnnuel), celluleNombre(p.partLieuFixe), celluleNombre(actesCabinet), celluleNombre((actesCabinet / totalActesCabinet) * 100),
      celluleNombre(coeff)
    ]));
  }
  feuilles.push(feuilleExcel('Clés de réventilation', lignesClefs));

  // --- Feuille 5 : Facteurs — Transport ---
  const lignesTransport = [ligneExcel([celluleTexte('Mode'), celluleTexte('Usage (kgCO2e/km)'), celluleTexte('Fabrication (kgCO2e/km)'), celluleTexte('Total (kgCO2e/km)'), celluleTexte('Source')])];
  for (const [cle, f] of Object.entries(FE_TRANSPORT)) {
    const vFab = FACTEURS_VEHICULES_USAGE_FABRICATION[cle];
    lignesTransport.push(ligneExcel([
      celluleTexte(LABELS_MODES[cle] || cle),
      celluleNombre(vFab ? vFab.usage : f.value),
      celluleNombre(vFab ? vFab.fabrication : 0),
      celluleNombre(f.value),
      celluleTexte(f.source || '')
    ]));
  }
  feuilles.push(feuilleExcel('Facteurs - Transport', lignesTransport));

  // --- Feuille 6 : Facteurs — Énergie, local, bâtiment ---
  const lignesEnergie = [ligneExcel([celluleTexte('Élément'), celluleTexte('Valeur'), celluleTexte('Unité'), celluleTexte('Source')])];
  for (const [cle, f] of Object.entries(FE_ENERGIE)) {
    lignesEnergie.push(ligneExcel([celluleTexte(LABELS_ENERGIES[cle] || cle), celluleNombre(f.value), celluleTexte('kgCO2e/kWh'), celluleTexte(f.source || '')]));
  }
  lignesEnergie.push(ligneExcel([celluleTexte('Ratio local MSP — chauffage'), celluleNombre(RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art.chauffage), celluleTexte('kWh/m²/an'), celluleTexte('ADEME/CEREN, catégorie Commerces')]));
  lignesEnergie.push(ligneExcel([celluleTexte('Ratio local MSP — électricité'), celluleNombre(RATIOS_ENERGIE_PAR_ACTIVITE.artisanat_art.elec), celluleTexte('kWh/m²/an'), celluleTexte('ADEME/CEREN, catégorie Commerces')]));
  lignesEnergie.push(ligneExcel([celluleTexte('Bâtiment — construction (établissement de santé béton)'), celluleNombre(FACTEUR_BATIMENT_SANTE.kgCO2e_m2), celluleTexte('kgCO2e/m²'), celluleTexte('Base Carbone ADEME V23.10')]));
  lignesEnergie.push(ligneExcel([celluleTexte('Bâtiment — durée d\'amortissement'), celluleNombre(FACTEUR_BATIMENT_SANTE.dureeAmortissementAns), celluleTexte('années'), celluleTexte('Choix éditorial')]));
  lignesEnergie.push(ligneExcel([celluleTexte('Bâtiment — seuil rénovation lourde'), celluleNombre(FACTEUR_BATIMENT_SANTE.seuilRenovationLourde_eur_m2), celluleTexte('€/m²'), celluleTexte('Réglementation locaux non résidentiels')]));
  feuilles.push(feuilleExcel('Facteurs - Énergie', lignesEnergie));

  // --- Feuille 7 : Facteurs — Immobilisations ---
  const lignesImmo = [ligneExcel([celluleTexte('Élément'), celluleTexte('Valeur brute'), celluleTexte('Unité'), celluleTexte('Source')])];
  lignesImmo.push(ligneExcel([celluleTexte('Ordinateur fixe (fabrication)'), celluleNombre(FACTEURS_NUMERIQUE_BRUT.ordinateurFixe), celluleTexte('kgCO2e'), celluleTexte('ESTIMÉ (analogie)')]));
  lignesImmo.push(ligneExcel([celluleTexte('Ordinateur portable (fabrication)'), celluleNombre(FACTEURS_NUMERIQUE_BRUT.ordinateurPortable), celluleTexte('kgCO2e'), celluleTexte('SOURCÉ — ISLEAN/GreenIT')]));
  lignesImmo.push(ligneExcel([celluleTexte('Écran supplémentaire (fabrication)'), celluleNombre(FACTEURS_NUMERIQUE_BRUT.ecranSupplementaire), celluleTexte('kgCO2e'), celluleTexte('ESTIMÉ')]));
  lignesImmo.push(ligneExcel([celluleTexte('Équipement lourd standard / autre matériel info.'), celluleNombre(FE_GROS_MATERIEL_STANDARD), celluleTexte('kgCO2e/€'), celluleTexte('Base Carbone (repris du socle individuel)')]));
  lignesImmo.push(ligneExcel([celluleTexte('Équipement massif (>60kg)'), celluleNombre(FE_GROS_MATERIEL_MASSIF), celluleTexte('kgCO2e/€'), celluleTexte('Base Carbone (repris du socle individuel)')]));
  for (const [cle, v] of Object.entries(FACTEURS_MOBILIER_UNITE)) {
    lignesImmo.push(ligneExcel([celluleTexte('Mobilier — ' + (LABELS_MOBILIER[cle] || cle)), celluleNombre(v), celluleTexte('kgCO2e/unité'), celluleTexte('Base Carbone V23.10')]));
  }
  feuilles.push(feuilleExcel('Facteurs - Immobilisations', lignesImmo));

  // --- Feuille 8 : Facteurs — Monétaires et fret ---
  const lignesMonetaire = [ligneExcel([celluleTexte('Élément'), celluleTexte('Valeur'), celluleTexte('Unité')])];
  lignesMonetaire.push(ligneExcel([celluleTexte('Services administratifs (compta/banque/assurance)'), celluleNombre(FE_MONETAIRE.services_administratifs), celluleTexte('kgCO2e/€')]));
  lignesMonetaire.push(ligneExcel([celluleTexte('Prestations spécialisées (sous-traitance, documentation, licences)'), celluleNombre(FE_MONETAIRE.prestations_specialisees), celluleTexte('kgCO2e/€')]));
  lignesMonetaire.push(ligneExcel([celluleTexte('Biens et consommables (matériel secrétariat)'), celluleNombre(FE_MONETAIRE.biens_consommables), celluleTexte('kgCO2e/€')]));
  lignesMonetaire.push(ligneExcel([celluleTexte('Fret / colis'), celluleNombre(FE_FRET_COLIS), celluleTexte('kgCO2e/colis')]));
  lignesMonetaire.push(ligneExcel([celluleTexte('Repas standard'), celluleNombre(FE_REPAS.standard), celluleTexte('kgCO2e/repas')]));
  lignesMonetaire.push(ligneExcel([celluleTexte('Repas végétarien'), celluleNombre(FE_REPAS.vegetarien), celluleTexte('kgCO2e/repas')]));
  lignesMonetaire.push(ligneExcel([celluleTexte('Médicaments prescrits'), celluleNombre(FE_MEDICAMENTS_EUR), celluleTexte('kgCO2e/€')]));
  feuilles.push(feuilleExcel('Facteurs - Monétaires', lignesMonetaire));

  // --- Feuille 9 : APL — références nationales ---
  const lignesApl = [ligneExcel([celluleTexte('Profession'), celluleTexte('Référence nationale 2024'), celluleTexte('Unité')])];
  const labelsApl = { medecin_generaliste: 'Médecin généraliste (≤65 ans)', infirmier: 'Infirmier(ère)', sage_femme: 'Sage-femme', kinesitherapeute: 'Kinésithérapeute', chirurgien_dentiste: 'Chirurgien(ne)-dentiste' };
  APL_PROFESSIONS.forEach((prof, i) => {
    lignesApl.push(ligneExcel([celluleTexte(labelsApl[prof] || prof), celluleNombre(APL_REFERENCE_NATIONALE[i]), celluleTexte(prof === 'medecin_generaliste' ? 'consultations/hab' : 'ETP/100 000 hab')]));
  });
  lignesApl.push(ligneExcel([celluleTexte(''), celluleTexte(''), celluleTexte('')]));
  lignesApl.push(ligneExcel([celluleTexte('Source'), celluleTexte('DREES — data.drees.solidarites-sante.gouv.fr, millésime 2024'), celluleTexte('')]));
  feuilles.push(feuilleExcel('Facteurs - APL', lignesApl));

  const classeur = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${feuilles.join('\n')}
</Workbook>`;

  const dateDuJour = new Date().toISOString().slice(0, 10);
  const nomStructure = (etat.structureMSP.nom || 'msp').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const nomFichier = `libco2-msp-detail-calculs-${nomStructure || 'export'}-${dateDuJour}.xls`;

  const blob = new Blob([classeur], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);

  if (zoneStatut) {
    zoneStatut.classList.remove('aide-alerte');
    zoneStatut.textContent = `Fichier "${nomFichier}" téléchargé — ouvrable directement dans Excel, LibreOffice Calc ou Google Sheets.`;
  }
}

// ---------------------------------------------------------------------------
// AFFICHE (image PNG) — document de synthèse pour affichage salle d'attente.
// Généré en Canvas natif (comme le certificat du socle individuel), sans
// dépendance externe.
function chargerImage(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function genererCanvasAffiche(etat) {
  const r = etat.dernierResultat;
  if (!r) return null;
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch (e) { /* ignore */ } }

  const nomsPraticiensAffiche = Object.fromEntries(etat.praticiens.map((p, i) => [p.id, `Praticien ${i + 1}`]));
  const hauteurParPraticien = 92;
  const nbLignesPraticiens = etat.praticiens.length + 1; // +1 pour les fonctions support
  const L = 1000, H = 900 + nbLignesPraticiens * hauteurParPraticien + 80;

  const canvas = document.createElement('canvas');
  canvas.width = L; canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#F7F5F0';
  ctx.fillRect(0, 0, L, H);

  // Bandeau d'en-tête — la position du titre est calculée à partir de la
  // largeur RÉELLE du logo (le bug précédent supposait une largeur fixe de
  // 230px, trop étroite pour le logo réel d'environ 271px, ce qui faisait
  // chevaucher le titre sous le cadre du logo).
  ctx.fillStyle = '#0071C1';
  ctx.fillRect(0, 0, L, 150);
  const logoSrc = document.querySelector('.entete-logo')?.src;
  const logo = await chargerImage(logoSrc);
  let texteX = 60;
  if (logo) {
    const hLogo = 74, wLogo = logo.width * (hLogo / logo.height);
    const rx = 40, ry = 38, rw = wLogo + 28, rh = hLogo + 24;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(rx, ry, rw, rh, 10) : ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.drawImage(logo, rx + 14, ry + 12, wLogo, hLogo);
    texteX = rx + rw + 24; // juste après le cadre du logo, quelle que soit sa largeur réelle
  }
  ctx.fillStyle = 'white';
  ctx.textAlign = 'left';
  ctx.font = "600 30px Fraunces, Georgia, serif";
  ctx.fillText('Bilan carbone', texteX, 66);
  ctx.font = "400 18px Inter, sans-serif";
  ctx.fillText(etat.structureMSP.nom || 'Maison de santé pluriprofessionnelle', texteX, 98);
  ctx.font = "400 14px Inter, sans-serif";
  ctx.fillText(new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }), texteX, 124);

  // Chiffres clés MSP
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1B2B26';
  ctx.font = "700 88px 'JetBrains Mono', monospace";
  ctx.fillText(fmt(r.empreinteTotale / 1000), L / 2, 290);
  ctx.font = "600 22px Inter, sans-serif";
  ctx.fillText('tonnes de CO2e par an — empreinte totale de la MSP', L / 2, 325);
  ctx.font = "600 26px 'JetBrains Mono', monospace";
  ctx.fillStyle = '#0071C1';
  ctx.fillText(`${r.ratioParActe != null ? r.ratioParActe.toFixed(1) : '—'} kgCO2e par acte en moyenne`, L / 2, 365);
  ctx.textAlign = 'left';

  // Camembert — répartition par poste (MSP entière)
  const PALETTE_POSTES = {
    local: '#0071C1', patientele: '#2E673E', deplacements: '#C98A2C',
    alimentation: '#4E8FA3', prescriptions: '#8A6FB0', support: '#B85C5C', immobilisations: '#8FA05F'
  };
  const donneesPostesAffiche = [
    { label: 'Local', valeur: r.parPoste.local.total, couleur: PALETTE_POSTES.local },
    { label: 'Patientèle', valeur: r.parPoste.patientele.total, couleur: PALETTE_POSTES.patientele },
    { label: 'Déplacements pro.', valeur: r.parPoste.domicileTravail.usageTotal + r.parPoste.domicileTravail.fabricationVehiculeTotal, couleur: PALETTE_POSTES.deplacements },
    { label: 'Alimentation', valeur: r.parPoste.alimentation.total, couleur: PALETTE_POSTES.alimentation },
    { label: 'Prescriptions', valeur: r.parPoste.prescriptions.total, couleur: PALETTE_POSTES.prescriptions },
    { label: 'Postes mutualisés', valeur: r.parPoste.support.total, couleur: PALETTE_POSTES.support },
    { label: 'Immobilisations', valeur: r.parPoste.immobilisations, couleur: PALETTE_POSTES.immobilisations }
  ].filter(d => d.valeur > 0);
  const totalPostesAffiche = donneesPostesAffiche.reduce((s, d) => s + d.valeur, 0) || 1;

  ctx.font = "600 24px Fraunces, Georgia, serif";
  ctx.fillStyle = '#1B2B26';
  ctx.fillText('Répartition par poste (MSP entière)', 60, 435);

  const cx = 240, cy = 590, rad = 150;
  let angleCourant = -Math.PI / 2;
  donneesPostesAffiche.forEach(d => {
    const angle = (d.valeur / totalPostesAffiche) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, angleCourant, angleCourant + angle);
    ctx.closePath();
    ctx.fillStyle = d.couleur;
    ctx.fill();
    angleCourant += angle;
  });

  let ly = 470;
  donneesPostesAffiche.forEach(d => {
    ctx.fillStyle = d.couleur;
    ctx.fillRect(510, ly - 15, 18, 18);
    ctx.fillStyle = '#3E4A45';
    ctx.font = "400 16px Inter, sans-serif";
    ctx.fillText(`${d.label} — ${Math.round((d.valeur / totalPostesAffiche) * 100)}%`, 538, ly);
    ly += 30;
  });

  // Empreinte par praticien — total, ratio par acte, ET répartition par
  // poste propre à chaque praticien (mini barre empilée), pour que chacun
  // comprenne d'où vient sa propre empreinte, pas seulement son total.
  let py = 850;
  ctx.font = "600 24px Fraunces, Georgia, serif";
  ctx.fillStyle = '#1B2B26';
  ctx.fillText('Empreinte par praticien', 60, py);
  py += 30;
  ctx.font = "400 14px Inter, sans-serif";
  ctx.fillStyle = '#8A9490';
  ctx.fillText('Chaque barre représente la répartition par poste de ce praticien (mêmes couleurs que ci-dessus).', 60, py);
  py += 40;

  const largeurBarreMax = 880;

  const dessinerLignePraticien = (nom, segments, total, ratioParActe) => {
    ctx.font = "600 17px Inter, sans-serif";
    ctx.fillStyle = '#1B2B26';
    ctx.fillText(nom, 60, py);
    ctx.textAlign = 'right';
    ctx.font = "600 15px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#0071C1';
    ctx.fillText(`${fmt(total)} kgCO2e/an${ratioParActe != null ? '  ·  ' + ratioParActe.toFixed(1) + ' kgCO2e/acte' : ''}`, 60 + largeurBarreMax, py);
    ctx.textAlign = 'left';

    const totalSeg = segments.reduce((s, seg) => s + seg.valeur, 0) || 1;
    let xCursor = 60;
    const yBarre = py + 14;
    for (const seg of segments) {
      if (seg.valeur <= 0) continue;
      const w = (seg.valeur / totalSeg) * largeurBarreMax;
      ctx.fillStyle = seg.couleur;
      ctx.fillRect(xCursor, yBarre, Math.max(w, 1), 18);
      xCursor += w;
    }
    py += hauteurParPraticien;
  };

  for (const p of etat.praticiens) {
    const e = r.empreintesPraticiens.find(x => x.id === p.id);
    const segments = [
      { valeur: e.partLocal, couleur: PALETTE_POSTES.local },
      { valeur: e.partPatientele, couleur: PALETTE_POSTES.patientele },
      { valeur: e.partDeplacementsPro, couleur: PALETTE_POSTES.deplacements },
      { valeur: e.partAlimentation, couleur: PALETTE_POSTES.alimentation },
      { valeur: e.partPrescriptions || 0, couleur: PALETTE_POSTES.prescriptions },
      { valeur: e.partImmobilisations, couleur: PALETTE_POSTES.immobilisations },
      { valeur: e.partSupport, couleur: PALETTE_POSTES.support }
    ];
    const ratio = p.nbActesAnnuel > 0 ? e.total / p.nbActesAnnuel : null;
    dessinerLignePraticien(nomsPraticiensAffiche[p.id], segments, e.total, ratio);
  }

  const segmentsAdmin = [
    { valeur: r.empreinteStaffAdmin.partLocal, couleur: PALETTE_POSTES.local },
    { valeur: r.empreinteStaffAdmin.partDeplacements, couleur: PALETTE_POSTES.deplacements },
    { valeur: r.empreinteStaffAdmin.partImmobilisations, couleur: PALETTE_POSTES.immobilisations }
  ];
  dessinerLignePraticien('Fonctions support (MSP)', segmentsAdmin, r.empreinteStaffAdmin.total, null);

  // Pied de page
  ctx.font = "400 13px Inter, sans-serif";
  ctx.fillStyle = '#8A9490';
  ctx.fillText('Estimation d\'ordre de grandeur — méthodologie inspirée de kinéCO2 (Lib&CO2, Carbone 4). Généré par Lib&CO2 MSP.', 60, H - 40);

  return canvas;
}

// ---------------------------------------------------------------------------
// PLAN DE DÉCARBONATION (document éditable, format RTF) — reprend les
// actions cochées avec un objectif à 1 an, pensé comme support de réunion
// d'avancement réutilisable (dates, statuts et notes à remplir directement
// dans Word/LibreOffice, sans repasser par l'outil). RTF plutôt que .docx
// natif : format Word éditable généré en texte brut, sans bibliothèque
// externe requise (le .docx est une archive ZIP, trop complexe à produire
// de façon fiable sans dépendance) — ouverture et édition identiques pour
// l'utilisateur final.
function rtfEchappe(texte) {
  return String(texte ?? '').replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

// Convertit tout caractère non-ASCII (accents, tirets typographiques...) en
// échappement Unicode RTF (\uNNNN?), appliqué en toute fin sur le document
// ENTIER (texte fixe du modèle + valeurs dynamiques confondus) — les mots de
// contrôle RTF (\rtf1, \cellx1600...) sont toujours en ASCII pur, donc cette
// passe globale ne peut jamais les corrompre, et garantit qu'aucun texte
// accentué tapé directement dans le modèle n'est oublié (contrairement à un
// échappement au cas par cas, propice à l'oubli sur les textes fixes).
function rtfVersUnicode(texteRTFComplet) {
  return texteRTFComplet.split('').map(c => {
    const code = c.codePointAt(0);
    return code > 127 ? `\\u${code}?` : c;
  }).join('');
}

function genererDocumentPlanActions(etat, actionsCochees, totalReduction) {
  const r = etat.dernierResultat;
  const nomStructure = etat.structureMSP.nom || 'la structure';
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const empreinteActuelle = r.empreinteTotale;
  const objectifMoins5pct = empreinteActuelle * 0.95;
  const objectifPotentielActions = Math.max(empreinteActuelle - totalReduction, 0);
  const largeurCol = [1600, 4200, 2200, 2200, 1800, 4200]; // twips cumulés par colonne

  let cellx = 0;
  const bordCols = largeurCol.map(l => { cellx += l; return cellx; });
  const ligneEntete = `{\\trowd\\trgaph108\\trleft0 ${bordCols.map(b => `\\cellx${b}`).join('')}
${['#', 'Action', 'Poste', 'Réduction visée (kgCO2e/an)', 'Date de début', 'Statut / notes'].map(t => `\\intbl\\b ${rtfEchappe(t)}\\b0\\cell`).join(' ')} \\row}`;

  const lignesActions = actionsCochees.map((a, i) => {
    const choix = etat.actionsChoix[a.id];
    const red = reductionEstimee(a, choix, valeurPosteMSP(r, a.poste));
    return `{\\trowd\\trgaph108\\trleft0 ${bordCols.map(b => `\\cellx${b}`).join('')}
\\intbl ${i + 1}\\cell \\intbl ${rtfEchappe(a.titre)}\\cell \\intbl ${rtfEchappe(CATEGORIES_META[a.poste]?.label || a.poste)}\\cell \\intbl ${red != null ? Math.round(red) : '\u2014'}\\cell \\intbl \\cell \\intbl \\cell \\row}`;
  }).join('\n');

  return rtfVersUnicode(`{\\rtf1\\ansi\\ansicpg1252\\deff0
{\\fonttbl{\\f0 Calibri;}}
\\f0\\fs22
{\\fs36\\b Plan de décarbonation — ${rtfEchappe(nomStructure)}\\b0\\fs22\\par}
{\\fs18\\i Généré le ${rtfEchappe(dateDuJour)} avec Lib&CO2 MSP — à relire et compléter en réunion.\\i0\\fs22\\par}
\\par
{\\fs28\\b Situation actuelle\\b0\\fs22\\par}
Empreinte totale : \\b ${fmt(empreinteActuelle / 1000)} tCO2e/an\\b0  (soit ${r.ratioParActe != null ? r.ratioParActe.toFixed(1) : '\u2014'} kgCO2e/acte en moyenne).\\par
\\par
{\\fs28\\b Objectif à 1 an\\b0\\fs22\\par}
Deux repères pour fixer un objectif chiffré à la structure :\\par
{\\pntext\\bullet\\tab}Trajectoire de référence (-5%/an, feuille de route nationale de décarbonation du système de santé) : \\b ${fmt(objectifMoins5pct / 1000)} tCO2e/an\\b0\\par
{\\pntext\\bullet\\tab}Potentiel cumulé des actions cochées ci-dessous, si toutes déployées à l'échéance retenue : \\b ${fmt(objectifPotentielActions / 1000)} tCO2e/an\\b0  (\u2212${fmt(totalReduction)} kgCO2e/an au total).\\par
\\par
{\\fs28\\b Actions retenues (${actionsCochees.length})\\b0\\fs22\\par}
${ligneEntete}
${lignesActions}
\\par
{\\fs28\\b Notes de réunion / prochaines étapes\\b0\\fs22\\par}
Date de la réunion : \\underline\\tab\\tab\\tab\\tab\\tab\\underline0\\par
\\par
\\underline                                                                                              \\underline0\\par
\\par
\\underline                                                                                              \\underline0\\par
\\par
\\underline                                                                                              \\underline0\\par
\\par
{\\fs16\\i Document généré à partir d'un bilan d'ordre de grandeur — ne constitue pas un audit carbone réglementaire.\\i0\\par}
}`);
}

function telechargerPlanActions() {
  const etat = getEtat();
  const r = etat.dernierResultat;
  if (!r) return;
  const actionsCochees = TOUTES_ACTIONS.filter(a => etat.actionsChoix?.[a.id]?.active);
  if (actionsCochees.length === 0) return;

  let totalReduction = 0;
  for (const a of actionsCochees) {
    const red = reductionEstimee(a, etat.actionsChoix[a.id], valeurPosteMSP(r, a.poste));
    if (red) totalReduction += red;
  }

  const rtf = genererDocumentPlanActions(etat, actionsCochees, totalReduction);
  const blob = new Blob([rtf], { type: 'application/rtf' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  const dateDuJour = new Date().toISOString().slice(0, 10);
  const nomStructure = (etat.structureMSP.nom || 'msp').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  lien.href = url;
  lien.download = `plan-decarbonation-${nomStructure || 'export'}-${dateDuJour}.rtf`;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

async function exporterAffiche() {
  const zoneStatut = document.getElementById('affiche-statut');
  const etat = getEtat();
  if (!etat.dernierResultat) {
    if (zoneStatut) { zoneStatut.textContent = 'Calculez d\'abord le bilan (bouton "Calculer le bilan" en haut de cet écran).'; zoneStatut.classList.add('aide-alerte'); }
    return;
  }
  if (zoneStatut) { zoneStatut.classList.remove('aide-alerte'); zoneStatut.textContent = 'Génération de l\'affiche en cours...'; }
  const canvas = await genererCanvasAffiche(etat);
  if (!canvas) return;
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    const dateDuJour = new Date().toISOString().slice(0, 10);
    lien.href = url;
    lien.download = `libco2-msp-affiche-${dateDuJour}.png`;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
    if (zoneStatut) zoneStatut.textContent = 'Image téléchargée — prête à imprimer ou à afficher.';
  }, 'image/png');
}

// ---------------------------------------------------------------------------
// ARCHIVE — export/import de l'historique des bilans, pour suivre
// l'évolution de la MSP dans le temps.
function telechargerJSON(objet, nomFichier) {
  const blob = new Blob([JSON.stringify(objet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
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
const TEXTE_CONSENTEMENT_DASHBOARD = "En cliquant sur \"Exporter et partager\", vous acceptez que les données de ce fichier (empreinte carbone de votre structure, répartition par poste, détail par praticien sans aucun nom ni donnée personnelle identifiable au-delà du nom de la structure) soient transmises à libetco2@gmail.com pour construire un tableau de bord comparatif entre structures participantes. Vous pouvez en demander la suppression à tout moment en contactant cette même adresse.";

function exporterDashboard() {
  const zoneStatut = document.getElementById('dashboard-statut');
  const etat = getEtat();
  const r = etat.dernierResultat;
  if (!r) {
    if (zoneStatut) { zoneStatut.classList.add('aide-alerte'); zoneStatut.textContent = 'Calculez d\'abord le bilan (bouton "Calculer le bilan" en haut de cet écran).'; }
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
      immobilisations: r.parPoste.immobilisations
    },
    praticiens: etat.praticiens.map(p => {
      const e = r.empreintesPraticiens.find(x => x.id === p.id);
      return {
        id: nomsPraticiensAnonymes[p.id],
        profession: p.professionAPL,
        total_kgCO2e_an: e.total,
        repartitionParPoste_kgCO2e: {
          local: e.partLocal, patientele: e.partPatientele, deplacementsPro: e.partDeplacementsPro,
          alimentation: e.partAlimentation, prescriptions: e.partPrescriptions,
          postesMutualises: e.partSupport, immobilisations: e.partImmobilisations
        }
      };
    }),
    fonctionsSupport: {
      total_kgCO2e_an: r.empreinteStaffAdmin.total,
      repartitionParPoste_kgCO2e: {
        local: r.empreinteStaffAdmin.partLocal, deplacementsPro: r.empreinteStaffAdmin.partDeplacements,
        immobilisations: r.empreinteStaffAdmin.partImmobilisations
      }
    }
  };

  const dateDuJour = new Date().toISOString().slice(0, 10);
  const nomStructure = (etat.structureMSP.nom || 'msp').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  telechargerJSON(export_, `libco2-msp-dashboard-${nomStructure || 'export'}-${dateDuJour}.json`);

  if (zoneStatut) {
    zoneStatut.classList.remove('aide-alerte');
    zoneStatut.textContent = 'Fichier téléchargé — envoyez-le par e-mail à l\'adresse indiquée dans le texte ci-dessus pour qu\'il soit intégré au tableau de bord.';
  }
}

function exporterArchiveVersFichier() {
  const archive = exporterArchive();
  const dateDuJour = new Date().toISOString().slice(0, 10);
  telechargerJSON(archive, `libco2-msp-archive-${dateDuJour}.json`);
  const zoneStatut = document.getElementById('archive-statut');
  if (zoneStatut) { zoneStatut.classList.remove('aide-alerte'); zoneStatut.textContent = `Archive téléchargée (${archive.bilans.length} bilan(s)).`; }
}

function importerArchiveDepuisFichier(fichier) {
  const zoneStatut = document.getElementById('archive-statut');
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const archive = JSON.parse(lecteur.result);
      const resultat = importerArchive(archive);
      if (zoneStatut) {
        zoneStatut.classList.remove('aide-alerte');
        zoneStatut.textContent = `${resultat.importes} bilan(s) importé(s)${resultat.ignores ? `, ${resultat.ignores} déjà présent(s) ignoré(s)` : ''}.`;
      }
      rendreEcran(getEtat());
    } catch (erreur) {
      if (zoneStatut) { zoneStatut.classList.add('aide-alerte'); zoneStatut.textContent = `Échec de l'import : ${erreur.message}`; }
    }
  };
  lecteur.readAsText(fichier);
}
