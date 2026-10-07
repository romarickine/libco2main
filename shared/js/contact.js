/**
 * contact.js — liens de prise de contact pré-remplis (e-mail)
 * ---------------------------------------------------------------------------
 * Les outils proposent, sans insister, de prendre contact pour un
 * accompagnement. Le lien ouvre la messagerie de l'usager avec un objet et
 * une trame de message : rien ne transite par le site, l'usager relit et
 * envoie lui-même (ou n'envoie rien).
 *
 * Utilisé par : cab/js/ui/ecran-resultats.js, msp/js/ui/ecran-resultats.js,
 * iso/js/ui.js. La page d'accueil et le blog ont les mêmes liens écrits en dur
 * (pages sans script).
 */
export const ADRESSE_CONTACT = "libetco2@gmail.com";

export const OFFRES = {
  diagnostic: {
    titre: "Diagnostic accompagné et plan d'action",
    objet: "Lib&CO2 — diagnostic carbone accompagné",
    trame: ["Bonjour,", "", "Je souhaiterais échanger sur un diagnostic carbone accompagné pour notre structure.", "", "Structure (type, nombre de professionnels) :", "Ville :", "Ce que nous attendons :", "", "Merci,"],
  },
  institution: {
    titre: "Accompagnement d'institutions et de réseaux",
    objet: "Lib&CO2 — accompagnement d'un réseau de structures",
    trame: ["Bonjour,", "", "Nous aimerions étudier un accompagnement à la décarbonation pour notre réseau.", "", "Organisme (URPS, ARS, CPTS, collectivité…) :", "Nombre de structures concernées :", "Calendrier envisagé :", "", "Merci,"],
  },
  formation: {
    titre: "Formation ou atelier",
    objet: "Lib&CO2 — formation / atelier décarbonation",
    trame: ["Bonjour,", "", "Je souhaiterais organiser une formation ou un atelier sur la décarbonation.", "", "Public (nombre de personnes, professions) :", "Format souhaité (présentiel, distanciel, durée) :", "Période :", "", "Merci,"],
  },
  cartes: {
    titre: "Cartes du sans-voiture sur mesure",
    objet: "Lib&CO2 — cartes du sans-voiture imprimées",
    trame: ["Bonjour,", "", "Je suis intéressé(e) par des cartes du sans-voiture imprimées.", "", "Adresse(s) à cartographier :", "Format souhaité (A2, A1, A0, support rigide…) :", "Nombre d'exemplaires et adresse de livraison :", "", "Merci,"],
  },
};

/**
 * Lien mailto pré-rempli pour une offre.
 * @param {keyof OFFRES} cle
 * @param {string[]} [contexte]  Lignes ajoutées en fin de message (ex. résultat du bilan).
 * @returns {string}
 */
export function lienContact(cle, contexte = []) {
  const o = OFFRES[cle];
  const corps = [...o.trame, ...(contexte.length ? ["", ...contexte] : [])].join("\n");
  return `mailto:${ADRESSE_CONTACT}?subject=${encodeURIComponent(o.objet)}&body=${encodeURIComponent(corps)}`;
}
