// ==========================================================================
// Fond de carte IGN (WMTS) avec nouveaux essais des tuiles en échec
// ==========================================================================
// Leaflet 1.9.4 ne redemande jamais une tuile qui échoue (erreur du serveur,
// coupure, réponse qui n'arrive pas) : la case reste vide tant que
// l'utilisateur ne déplace pas la carte. Des utilisateurs ont signalé des
// morceaux de carte non chargés (04/11/2026). Ici, chaque tuile a un délai
// maximal et plusieurs essais espacés ; si certaines manquent encore, un
// message propose de recharger le fond de carte.
//
// Faits sourcés :
// - le service WMTS de la Géoplateforme n'est soumis à aucune limite de débit
//   par IP (cartes.gouv.fr, « Limites d'usage des API », page modifiée le
//   7 août 2026, lue le 04/11/2026) : les nouveaux essais ne risquent pas de
//   bloquer l'adresse IP (pas de refus 429 sur ce service) ;
// - jeu de tuiles « PM_0_19 », niveaux 0 à 19, pour les deux couches utilisées
//   (GetCapabilities du WMTS, lu le 04/11/2026) ;
// - temps de réponse relevés le 04/11/2026 depuis un navigateur : 60 à 280 ms
//   par tuile.
// Valeurs choisies [Estimé] : délai de 10 s (plus de 30 fois le temps de
// réponse relevé), 3 essais, attente d'environ 1 s puis 2 s entre deux essais.
// ==========================================================================
const DELAI_TUILE_MS = 10000;
const ESSAIS_TUILE = 3;
const ATTENTE_BASE_MS = 1000;

/**
 * Couche de tuiles Leaflet dont chaque tuile est redemandée en cas d'échec.
 * Événements en plus de ceux de Leaflet : aucun ; l'échec définitif d'une
 * tuile passe par l'événement Leaflet « tileerror », sa réussite par « tileload ».
 */
export function creerCoucheTuiles(L) {
  return L.TileLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement("img");
      tile.alt = "";
      if (this.options.crossOrigin || this.options.crossOrigin === "") {
        tile.crossOrigin = this.options.crossOrigin === true ? "" : this.options.crossOrigin;
      }
      if (typeof this.options.referrerPolicy === "string") tile.referrerPolicy = this.options.referrerPolicy;
      const url = this.getTileUrl(coords);
      const cle = this._tileCoordsToKey(coords);
      let essai = 0;
      let fini = false;
      let minuterie = null;
      // La tuile est-elle toujours affichée ? (Leaflet retire les tuiles
      // sorties de l'écran ou d'un autre niveau de zoom : on cesse alors.)
      const toujoursUtile = () => this._map && this._tiles[cle] && this._tiles[cle].el === tile;
      const terminer = (erreur) => {
        if (fini) return;
        fini = true;
        clearTimeout(minuterie);
        done(erreur, tile);
      };
      const lancer = () => {
        if (fini) return;
        if (essai > 0 && !toujoursUtile()) {
          fini = true;
          return;
        }
        clearTimeout(minuterie);
        minuterie = setTimeout(echec, DELAI_TUILE_MS);
        // Paramètre ignoré par le serveur (vérifié le 04/11/2026 : même image),
        // qui oblige le navigateur à refaire la requête.
        tile.src = essai === 0 ? url : url + "&essai=" + essai;
      };
      const echec = () => {
        if (fini) return;
        clearTimeout(minuterie);
        essai++;
        if (essai >= ESSAIS_TUILE) {
          terminer(new Error("Tuile du fond de carte non chargée après " + ESSAIS_TUILE + " essais"));
          return;
        }
        // Attente croissante, avec une part aléatoire pour ne pas relancer
        // toutes les tuiles en échec au même instant.
        setTimeout(lancer, ATTENTE_BASE_MS * essai * (0.5 + Math.random()));
      };
      tile.addEventListener("load", () => {
        // Leaflet remplace l'image d'une tuile retirée par une image vide :
        // ce chargement-là n'est pas une réussite de la tuile.
        if (tile.src.startsWith("data:")) return;
        terminer(null);
      });
      tile.addEventListener("error", () => {
        if (tile.src.startsWith("data:") || !tile.src) return;
        echec();
      });
      lancer();
      return tile;
    },
  });
}

/**
 * Message affiché sur la carte quand des tuiles manquent encore après tous
 * les essais, avec un bouton qui redemande le fond de carte. Disparaît dès
 * qu'il ne manque plus aucune tuile à l'écran.
 * @param {object} L  Leaflet
 * @param {object} map  Carte Leaflet
 * @param {object[]} couches  Couches de fond (une seule affichée à la fois)
 */
export function surveillerFondDeCarte(L, map, couches) {
  const manquantes = new Set();
  const Controle = L.Control.extend({
    options: { position: "bottomleft" },
    onAdd() {
      const div = L.DomUtil.create("div", "fond-carte-alerte");
      div.setAttribute("role", "status");
      const texte = L.DomUtil.create("span", "", div);
      texte.textContent = "Une partie du fond de carte n’a pas pu être chargée (service de l’IGN). ";
      const bouton = L.DomUtil.create("button", "", div);
      bouton.type = "button";
      bouton.textContent = "Recharger le fond de carte";
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(bouton, "click", () => {
        manquantes.clear();
        majAffichage();
        for (const c of couches) if (map.hasLayer(c)) c.redraw();
      });
      return div;
    },
  });
  const controle = new Controle();
  let affiche = false;
  const majAffichage = () => {
    if (manquantes.size > 0 && !affiche) {
      controle.addTo(map);
      affiche = true;
    } else if (manquantes.size === 0 && affiche) {
      controle.remove();
      affiche = false;
    }
  };
  for (const couche of couches) {
    const cle = (e) => L.stamp(couche) + ":" + couche._tileCoordsToKey(e.coords);
    couche.on("tileerror", (e) => {
      manquantes.add(cle(e));
      majAffichage();
    });
    couche.on("tileload tileunload", (e) => {
      if (manquantes.delete(cle(e))) majAffichage();
    });
    couche.on("remove", () => {
      for (const k of [...manquantes]) if (k.startsWith(L.stamp(couche) + ":")) manquantes.delete(k);
      majAffichage();
    });
  }
}

/**
 * Leaflet ne recalcule la taille de la carte que lorsque la FENÊTRE change de
 * taille ; si seul le cadre de la carte change (mise en page, panneau,
 * bascule formulaire/carte sur téléphone), une bande reste sans tuiles.
 * Un ResizeObserver signale ces changements à Leaflet (invalidateSize).
 */
export function suivreTailleCarte(map) {
  if (typeof ResizeObserver === "undefined") return;
  let attente = null;
  new ResizeObserver(() => {
    cancelAnimationFrame(attente);
    attente = requestAnimationFrame(() => map.invalidateSize());
  }).observe(map.getContainer());
}
