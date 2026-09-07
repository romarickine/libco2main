# Lib&CO2 MSP — Paquet de déploiement GitHub Pages (structure multi-fichiers)

Organisation identique à l'outil Lib&CO2 CAB : un fichier = une responsabilité, plutôt qu'un unique fichier HTML géant.

## Arborescence

```
├── index.html                              Point d'entrée, charge tout le reste
├── css/
│   ├── variables.css                       Charte graphique (couleurs, typo)
│   └── style-msp.css                       Styles de tous les composants
├── js/
│   ├── main-msp.js                         État global, orchestration des écrans
│   ├── ui-msp.js                           Rendu de toutes les vues, aucun calcul
│   ├── calcul-msp.js                       Calcul pur du bilan d'émissions
│   ├── stockage-msp.js                     Sauvegarde/lecture (localStorage)
│   └── data/
│       ├── facteurs-emission.js            Facteurs du socle individuel
│       ├── facteurs-emission-msp.js        Facteurs et ajouts spécifiques MSP
│       ├── zonage-insee.js                 ~35 000 communes, zonage INSEE
│       ├── resolve-commune-msp.js          Résolution commune → zone
│       └── apl-msp.js                      Indicateur APL, coefficients de rareté
├── assets/
│   └── logo-libco2.png                     Logo
└── LibCO2-MSP-Notice-methodologique.docx   Notice méthodologique (liée en pied de page)
```

## ⚠️ Point essentiel — ne pas ouvrir en local par double-clic

Contrairement à une ancienne version en fichier unique, `index.html` charge les fichiers `.js` comme de **vrais modules ES6** (`<script type="module">`). Les navigateurs bloquent ce type de chargement quand le fichier est ouvert directement depuis le disque (`file://...`) — **rien ne s'affichera**, sans message d'erreur visible pour un utilisateur non technique.

- **Sur GitHub Pages** (servi en `https://`) : fonctionne normalement, aucune manipulation supplémentaire.
- **Pour prévisualiser en local avant mise en ligne** : lancer un petit serveur local depuis ce dossier, par exemple avec Python déjà installé sur la plupart des machines :
  ```
  python3 -m http.server 8000
  ```
  puis ouvrir `http://localhost:8000` dans le navigateur.

## Marche à suivre pour la mise en ligne

1. Crée un nouveau dépôt GitHub (ou réutilise un dépôt existant dédié à cet outil).
2. Dépose **tout le contenu de ce dossier** à la racine du dépôt, en conservant l'arborescence exacte (les sous-dossiers `css/`, `js/`, `js/data/`, `assets/` doivent rester tels quels). **GitHub Desktop est recommandé plutôt que l'upload web**, qui a déjà posé des soucis de structure de fichiers sur le projet Lib&CO2 CAB.
3. Dans les paramètres du dépôt (Settings → Pages), active GitHub Pages sur la branche principale (`main`), dossier racine (`/`).
4. Le site sera accessible à une adresse du type `https://<ton-compte>.github.io/<nom-du-depot>/`.

## À chaque mise à jour de l'outil

Remplace uniquement les fichiers qui ont changé (souvent `js/ui-msp.js` ou `js/calcul-msp.js`), en conservant les mêmes noms et emplacements — aucune autre manipulation nécessaire.
