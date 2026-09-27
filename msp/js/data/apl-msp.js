/**
 * apl-msp.js — accessibilité potentielle localisée (APL) aux soins, par commune
 * ---------------------------------------------------------------------------
 * SOURCÉ : DREES, APL millésime 2024 (data.drees.solidarites-sante.gouv.fr,
 * jeu de données 530_l-accessibilite-potentielle-localisee-apl). Moyennes
 * nationales recalculées par pondération : écart < 0,1 % avec les valeurs
 * officielles publiées. Médecin généraliste : colonne « ≤ 65 ans », cohérente
 * avec la moyenne nationale officielle (3,3).
 *
 * Sert à pondérer les déplacements de la patientèle : dans une commune où
 * une profession est rare, les patients viennent de plus loin
 * (coefficientRarete). Les valeurs par commune (~1,2 Mo) sont dans
 * apl-par-commune.js, chargé à la demande par chargerApl().
 *
 * Utilisé par : calcul-msp.js.
 */

export const APL_PROFESSIONS = ["medecin_generaliste", "infirmier", "sage_femme", "kinesitherapeute", "chirurgien_dentiste"];

// Valeur de reference nationale 2024, dans le meme ordre que APL_PROFESSIONS
export const APL_REFERENCE_NATIONALE = [3.259, 154.823, 22.197, 123.232, 61.46];


// Valeurs par commune : fichier séparé (~1,2 Mo), chargé à la demande avant
// le premier calcul (voir chargerApl), plutôt qu'au démarrage de l'outil.
let aplParCommune = null;

/**
 * Charge (une seule fois) les valeurs d'APL par commune.
 * @returns {Promise<void>}
 */
export async function chargerApl() {
  if (!aplParCommune) ({ APL_PAR_COMMUNE: aplParCommune } = await import("./apl-par-commune.js"));
}


/**
 * Calcule le coefficient de rarete territoriale d'une profession dans une commune donnee.
 * coefficient > 1 = profession rare localement -> patients parcourent plus de distance
 * coefficient = 1 = profession non couverte par l'APL (neutralise, pas d'ajustement)
 *
 * POINT OUVERT (a valider) : certaines communes ont un APL exactement egal a 0 (offre
 * localement inexistante pour cette profession) - 732 a 2029 communes selon la profession,
 * soit jusqu'a 5.8% des cas pour les chirurgiens-dentistes. Un APL de 0 est un signal fort
 * (zone tres sous-dotee) mais la division devient infinie. En attendant un arbitrage,
 * ce cas est neutralise (coefficient = 1) comme une donnee manquante, ce qui SOUS-ESTIME
 * la distance patientele dans les zones les plus sous-dotees plutot que de la surestimer
 * arbitrairement.
 */
export function coefficientRarete(profession, codeCommuneInsee) {
  const idx = APL_PROFESSIONS.indexOf(profession);
  if (idx === -1) return 1; // profession hors des 5 couvertes par l'APL
  if (!aplParCommune) throw new Error("Données APL non chargées : attendre chargerDonneesCalcul() avant le calcul.");
  const valeurs = aplParCommune[codeCommuneInsee];
  if (!valeurs || valeurs[idx] == null || valeurs[idx] === 0) return 1; // donnee absente ou APL=0, neutralise (voir note ci-dessus)
  return APL_REFERENCE_NATIONALE[idx] / valeurs[idx];
}
