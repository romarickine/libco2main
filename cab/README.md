# Lib&CO2

Calculateur d'ordre de grandeur des émissions de gaz à effet de serre pour les
professionnels libéraux (santé, juridique, conseil, architecture, artisanat
d'art…). Inspiré de la méthodologie **kinéCO2** (Lib&CO2,
Carbone 4), généralisée à l'ensemble des professions libérales.

**Statut : version bêta-test.** Les résultats donnés sont des ordres de
grandeur destinés à éclairer des décisions, pas un Bilan d'Émissions de Gaz à
Effet de Serre réglementaire (BEGES). L'outil vise à démocratiser une
première approche du BEGES auprès du plus grand nombre de professionnels
libéraux, à coût quasi nul, pour prioriser une démarche de décarbonation.

## Lancer le site

Aucune installation n'est nécessaire (pas de `npm install`, pas de build) :
le site est en HTML/CSS/JavaScript natif, avec des modules ES6.

Les navigateurs bloquent le chargement de modules ES6 (`import`/`export`)
depuis un fichier local (`file://`) : il faut servir les fichiers via un
petit serveur HTTP local. Par exemple, depuis la racine du projet :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/index.html
```

ou avec Node.js (`npx serve` ou toute alternative équivalente).

**Aucune dépendance réseau, y compris pour les polices** : la charte utilise
des polices système natives (voir `css/variables.css`), pas de Google Fonts
ni aucun autre CDN. Ce choix évite aussi le problème RGPD documenté des
polices Google (transmission de l'IP du visiteur à Google sans consentement,
jugée non conforme par un tribunal allemand en 2022). Les graphiques
(répartition, évolution) sont dessinés en Canvas natif par
`js/graphiques.js`. Une fois chargé, le site ne fait strictement aucune
requête vers un service extérieur.

## Structure du projet

```
libco2/
├── index.html                     # Structure de la page uniquement
├── css/
│   ├── variables.css              # Couleurs, typographies, espacements (charte Lib&CO2, contrastes WCAG AA)
│   └── style.css                  # Styles de tous les composants
├── js/
│   ├── main.js                    # Point d'entrée : état global, orchestration des écrans
│   ├── ui.js                      # Rendu de toutes les vues (DOM), aucun calcul
│   ├── calcul.js                  # Calcul pur du bilan d'émissions et des actions
│   ├── stockage.js                # Sauvegarde/lecture des bilans (localStorage)
│   ├── evolution.js               # Construction de la vue "évolution dans le temps"
│   ├── graphiques.js              # Génération des graphiques (Canvas natif, sans dépendance) et de la jauge
│   ├── certificat.js              # Génération et téléchargement du certificat PNG
│   └── data/
│       ├── facteurs-emission.js   # Tous les facteurs d'émission, familles de métiers, actions
│       └── zonage-insee.js        # Report modal patientèle + ~35 000 communes (zonage INSEE 2010)
├── assets/
│   └── logo/logo-libco2.png       # Logo fourni par l'utilisateur
└── README.md                      # Ce fichier
```

Chaque fichier a une seule responsabilité : `calcul.js` ne touche jamais au
DOM, `ui.js` ne calcule jamais rien lui-même, `stockage.js` est le seul
fichier à parler à `localStorage`. Si vous cherchez où se trouve une donnée
ou une logique, ce découpage devrait vous y amener directement.

## Où modifier les facteurs d'émission

Tout se trouve dans **`js/data/facteurs-emission.js`**. Chaque valeur est
commentée avec une étiquette :

- **`SOURCÉ`** : la valeur est tracée jusqu'au rapport kinéCO2 ou à une
  source externe identifiée — la source est citée en commentaire.
- **`ESTIMÉ`** : pas de source directe trouvée ; le raisonnement utilisé pour
  arriver au chiffre est explicité en commentaire (calcul, analogie, ordre de
  grandeur usuel) plutôt que de prétendre à une source qui n'existe pas.

Avant de changer une valeur, mettez à jour le commentaire de sourcing associé
en conséquence — c'est ce qui permet à la prochaine personne de savoir si le
nouveau chiffre est fiable ou encore à vérifier.

Le zonage géographique (communes → zone de mobilité) est dans
`js/data/zonage-insee.js` : c'est un fichier volumineux (~35 000 communes,
zonage INSEE 2010) car les données sont intégrées une fois pour toutes plutôt
que d'être interrogées via une API — voir le commentaire en tête du fichier
pour la méthode de classification et ses limites connues.

## Ajouter un nouveau métier

Dans `js/data/facteurs-emission.js`, ajouter un objet au tableau `FAMILLES` :

```js
{
  id: "mon_metier",                 // identifiant unique, sans espace
  label: "Nom affiché de la famille",
  icon: "mon_metier",                // voir ICONES dans ui.js pour ajouter le glyphe correspondant
  metiers: ["Métier précis 1", "Métier précis 2"],
  lieuLabel: "cabinet",              // "cabinet" / "bureau" / "atelier" / "agence"...
  lieuArticleMon: "mon cabinet", lieuArticleLe: "le cabinet",
  publicLabel: "clientèle", publicSingulier: "client",
  acteLabel: "rendez-vous",          // pluriel, utilisé dans les questions
  uniteActe: "rendez-vous",          // singulier, utilisé dans les résultats
  motifDeplacement: "autres_motifs_personnels", // motif EMP2019 le plus proche (voir MOTIFS_MODE_SHARE dans zonage-insee.js) — ajuste la répartition entre modes de transport de la patientèle/clientèle
  consommables: [ { id: "...", label: "...", factor: FE_MONETAIRE.biens_consommables } ], // ou .services_administratifs / .prestations_specialisees / .juridique_conseil_gestion / .informatique_conseil selon le poste
  grosMateriel: [ { id: "...", label: "...", factor: FE_GROS_MATERIEL_STANDARD } ],
}
```

Aucune autre modification n'est nécessaire : l'assistant (`ui.js`) et le
calcul (`calcul.js`) lisent `FAMILLES` dynamiquement.

## Ajouter un nouveau poste d'émission

1. Ajouter le facteur d'émission dans `js/data/facteurs-emission.js` (avec
   son étiquette SOURCÉ/ESTIMÉ).
2. Ajouter une fonction de calcul dédiée dans `js/calcul.js` (voir les
   fonctions existantes comme `calculNumerique` pour le modèle à suivre),
   et l'intégrer dans `calculerBilan`.
3. Ajouter le poste à `CATEGORIES_META` (pour qu'il apparaisse dans le
   graphique de répartition).
4. Ajouter le champ de saisie correspondant dans l'étape concernée de
   `js/ui.js`.
5. Si le poste doit avoir des actions de décarbonation associées, les
   ajouter au tableau `ACTIONS`.

### Cas particulier : postes optionnels, propres à un métier précis

Deux postes ne s'appliquent qu'à certains praticiens et suivent un modèle
légèrement différent, à réutiliser pour un cas similaire :

- **`medicaments`** — chiffre d'affaires médicaments/parapharmacie, affiché
  uniquement quand `data.profil.metierId === "Pharmacien(ne) titulaire
  d'officine"` (voir `renderStepMateriel` dans `js/ui.js`, et
  `calculMedicaments` dans `js/calcul.js`).
- **`prescriptions`** — dépenses de médicaments et d'actes prescrits,
  affiché pour toute la famille santé, activé par une case à cocher
  (`data.prescriptions.active`). Ce poste est **volontairement exclu** du
  total "hors prescriptions" affiché en résultats (`totalKgHorsPrescriptions`
  / `totalTHorsPrescriptions` dans `calculerBilan`), pour permettre une
  comparaison à périmètre équivalent entre praticiens prescripteurs et non
  prescripteurs (ex. médecin vs kinésithérapeute). Si vous ajoutez un
  nouveau poste optionnel similaire, pensez à l'exclure du même total s'il
  fausserait ce type de comparaison.

## Sauvegarde et suivi dans le temps

**Mécanisme choisi : `localStorage` du navigateur** (voir `js/stockage.js`
pour la justification complète et le format de données exact). En résumé :

- Chaque bilan enregistré est horodaté et stocké sous la clé
  `libco2_bilans_v1` (tableau JSON).
- Une saisie en cours (non terminée) est sauvegardée automatiquement sous la
  clé `libco2_brouillon_v1`, et proposée au rechargement de la page.
- **Limite connue** : les données restent sur l'appareil/navigateur où elles
  ont été saisies (pas de compte, pas de synchronisation multi-appareil).

**Migration vers un compte utilisateur / stockage serveur** : seul
`js/stockage.js` a besoin d'être réécrit (remplacer les appels
`localStorage` par des appels à une API). Les fichiers `main.js`, `ui.js` et
`evolution.js` consomment uniquement les fonctions exportées par
`stockage.js` (`enregistrerBilan`, `listerBilans`, `supprimerBilan`,
`sauvegarderBrouillon`, `lireBrouillon`) et n'ont pas besoin de changer.

## Limites connues (transparence)

- **Mise à jour août 2026** : les ratios monétaires (`FE_MONETAIRE`), le
  gros matériel hors santé, l'ordinateur fixe, l'écran, le bus, les
  deux-roues, le gaz et le fioul sont désormais SOURCÉS sur l'ADEME Base
  Carbone V23.6 (fichier officiel consulté directement, y compris certaines
  fiches au statut "Archivé" faute de mieux, signalé au cas par cas). Reste
  `ESTIMÉ`, sans équivalent ADEME transposable identifié : les trois
  niveaux d'usage numérique (`usage_an`, faible/moyen/fort) — voir le
  commentaire dans `facteurs-emission.js`.
- Le zonage commune → zone de mobilité approxime trois catégories du zonage
  INSEE qui n'ont pas d'équivalent direct dans la méthodologie kinéCO2 (voir
  le commentaire en tête de `zonage-insee.js`).
- Le motif de déplacement de la patientèle/clientèle (EMP 2019) ne permet pas
  d'isoler la santé des autres démarches personnelles dans les données SDES
  publiées (vérifié explicitement : "démarches administratives" y est un
  sous-motif de "autres motifs personnels", non publié isolément) : les
  familles santé et juridique partagent donc le même motif proxy, faute de
  donnée plus précise disponible.
- Le poste "Prescriptions" (médicaments et actes prescrits) repose sur une
  première approche volontairement simple (dépense globale déclarée par le
  praticien), non validée par un professionnel de santé — à affiner si
  l'outil est déployé à plus grande échelle sur ce poste précis.
- Pas de compte utilisateur : l'historique des bilans est local au
  navigateur utilisé.
