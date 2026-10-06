// Script de la page les-autres-enjeux.html (sorti de la page pour la CSP stricte : aucun script en ligne).
// Chargé avec defer : le document est déjà analysé quand il s'exécute.
const ENJEUX = [
  { icone: "💧", titre: "Épuisement des ressources en eau", resume: "La consommation d'eau, pondérée par sa rareté locale.", detail: "Consommer un litre d'eau n'a pas le même impact selon qu'on se trouve dans une région où l'eau est abondante ou en situation de stress hydrique. Cette catégorie tient compte de cette rareté relative, propre à chaque territoire." },
  { icone: "🛢️", titre: "Épuisement des ressources fossiles", resume: "Charbon, gaz, pétrole, uranium : des stocks non renouvelables.", detail: "Distinct du changement climatique : il ne s'agit pas ici des émissions liées à la combustion, mais de l'épuisement physique des stocks disponibles de ces ressources énergétiques non renouvelables." },
  { icone: "⛏️", titre: "Épuisement des ressources minérales", resume: "Cuivre, terres rares, sable : des matériaux de plus en plus rares.", detail: "De nombreuses technologies (numérique, électrification) dépendent de métaux et minéraux dont les gisements accessibles s'amenuisent. Cette catégorie mesure la contribution d'une activité à cet épuisement." },
  { icone: "🌳", titre: "Usage des sols et biodiversité", resume: "L'artificialisation et l'usage des terres, moteurs de l'érosion de la biodiversité.", detail: "Les terres sont une ressource finie, partagée entre milieux naturels, agricoles et urbains. La façon dont une activité occupe ou transforme ces sols influence directement les habitats et la biodiversité qui en dépend." },
  { icone: "🧪", titre: "Écotoxicité et toxicité humaine", resume: "L'impact des substances chimiques sur les écosystèmes et la santé.", detail: "Certains produits ou procédés relâchent des substances toxiques pour les organismes vivants (écotoxicité) ou pour la santé humaine. Ces indicateurs restent aujourd'hui parmi les moins consolidés scientifiquement, mais leur suivi progresse." },
  { icone: "🌫️", titre: "Qualité de l'air (particules, ozone)", resume: "Les émissions qui dégradent l'air que l'on respire au quotidien.", detail: "Au-delà du CO2, certaines activités émettent des particules fines ou des précurseurs d'ozone troposphérique (smog), avec des conséquences directes sur les maladies respiratoires — un enjeu de santé publique à part entière." },
  { icone: "🌧️", titre: "Acidification et eutrophisation", resume: "Des déséquilibres chimiques des sols, cours d'eau et océans.", detail: "Certains rejets (azote, soufre, phosphore) perturbent l'équilibre chimique des milieux naturels : acidification des sols et des eaux, ou eutrophisation (prolifération d'algues liée à un excès de nutriments dans l'eau)." },
];

const grille = document.getElementById("grille-enjeux");
grille.innerHTML = ENJEUX.map((e, i) => `
  <div class="pe-carte" data-i="${i}">
    <div class="icone">${e.icone}</div>
    <div class="titre">${e.titre}</div>
    <div class="resume">${e.resume}</div>
    <div class="detail">${e.detail}</div>
    <div class="voir-plus">En savoir plus ▾</div>
  </div>
`).join("");

grille.querySelectorAll(".pe-carte").forEach((carte) => {
  carte.addEventListener("click", () => {
    const estOuverte = carte.classList.contains("ouverte");
    carte.classList.toggle("ouverte");
    carte.querySelector(".voir-plus").textContent = estOuverte ? "En savoir plus ▾" : "Réduire ▴";
  });
});
