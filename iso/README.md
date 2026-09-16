# La carte du sans-voiture

Où marcher, pédaler ou rouler en vélo électrique est plus rapide que la
voiture — un outil [Lib&CO2](https://libco2.fr), gratuit et open source.

**Statut : prêt, non déployé.** Ce dossier est la version partitionnée
(structure web standard), prête à être mise en ligne sur libco2.fr, mais
n'a pas encore été publiée.

## Lancer le site en local

Aucune installation n'est nécessaire (pas de `npm install`, pas de build) :
le site est en HTML/CSS/JavaScript natif, avec des modules ES6.

Les navigateurs bloquent le chargement de modules ES6 (`import`/`export`)
depuis un fichier local (`file://`) : il faut servir les fichiers via un
petit serveur HTTP local. Par exemple, depuis ce dossier :

```
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/
```

ou avec Node.js (`npx serve` ou toute alternative équivalente).

Seules deux ressources externes sont chargées : Leaflet (carte interactive,
via cdnjs) et les tuiles/API de l'IGN (Géoplateforme, `data.geopf.fr`) —
aucun compte, aucune clé requise. Aucune police externe (Google Fonts ou
autre) : la charte utilise des polices système natives, comme le reste du
site Lib&CO2.

## Structure du projet

```
la-carte-du-sans-voiture/
├── index.html                 # Structure de la page uniquement
├── css/
│   ├── variables.css          # Couleurs, typographies (charte Lib&CO2)
│   └── style.css              # Styles de tous les composants
├── js/
│   ├── main.js                 # Point d'entrée : démarre l'interface
│   ├── ui.js                   # Carte Leaflet, formulaire, câblage des événements (DOM)
│   ├── config.js                # Constantes figées (délais, rayon réseau, etc.)
│   ├── colors.js                 # Lecture des couleurs de zone depuis le CSS
│   ├── isochrones.js               # Orchestration du calcul (réseau + Dijkstra + polygones)
│   ├── dijkstra.js                  # Algorithme de plus court chemin
│   ├── graph.js                      # Construction du graphe routier BD TOPO®
│   ├── speed-models.js                # Modèles de vitesse (Tobler, Parkin-Rotheram, physique vélo/VAE)
│   ├── hexgrid.js                      # Grille hexagonale, traçage de contour, trous de polygone
│   ├── ign-api.js                       # Accès réseau IGN (WFS, altimétrie, géocodage)
│   └── export-image.js                   # Export de la carte en image JPEG HD
└── README.md                  # Ce fichier
```

Chaque fichier a une seule responsabilité, à la façon des autres outils
Lib&CO2 : `isochrones.js` orchestre mais ne touche jamais au DOM, `ui.js`
gère tout le DOM mais ne fait aucun calcul, `export-image.js` reçoit le
résultat du calcul en paramètre plutôt que de lire un état global.

## Sourcing et méthode

Toute la méthodologie (sources de données, modèles de vitesse, hypothèses
assumées) est documentée **dans l'application elle-même** — bouton
"ℹ️ Méthodologie & hypothèses" en haut à droite — plutôt que dupliquée ici.

## Limites connues

- Pas de compte utilisateur, pas de sauvegarde : chaque calcul est
  indépendant, rien n'est stocké.
- L'export image dépend de l'autorisation CORS du serveur de tuiles IGN ;
  en cas d'échec, l'interface le signale explicitement et suggère une
  capture d'écran en secours.
- Non testé en conditions réelles (serveur HTTP + navigateur) dans cet
  environnement — voir la note ci-dessous.

## Note sur les tests

Cette version partitionnée a été vérifiée statiquement : syntaxe de chaque
module JS, correspondance entre chaque `import` et l'`export` visé,
correspondance entre les identifiants DOM utilisés en JS et ceux présents
dans `index.html`, équilibre des balises HTML et des accolades CSS. Elle
n'a en revanche **pas été exécutée dans un vrai navigateur** (contrairement
au fichier HTML autonome, testé en conditions réelles) — avant mise en
ligne, un test manuel (ou Playwright) est recommandé pour confirmer que le
parcours complet fonctionne une fois servi en HTTP.
