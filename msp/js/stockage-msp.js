// Seul module autorisé à parler à localStorage (même règle que le socle individuel).
const CLE_BILANS = 'libco2msp_bilans_v1';
const CLE_BROUILLON = 'libco2msp_brouillon_v1';

export function sauvegarderBrouillon(data) {
  try {
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({ data, sauvegardeLe: new Date().toISOString() }));
    return true;
  } catch (e) {
    console.error('Échec de sauvegarde du brouillon MSP', e);
    return false;
  }
}

export function chargerBrouillon() {
  try {
    const brut = localStorage.getItem(CLE_BROUILLON);
    return brut ? JSON.parse(brut) : null;
  } catch (e) {
    console.error('Échec de lecture du brouillon MSP', e);
    return null;
  }
}

export function effacerBrouillon() {
  localStorage.removeItem(CLE_BROUILLON);
}

export function enregistrerBilan(bilan) {
  const bilans = listerBilans();
  bilans.push({ ...bilan, id: crypto.randomUUID(), horodatage: new Date().toISOString() });
  try {
    localStorage.setItem(CLE_BILANS, JSON.stringify(bilans));
    return true;
  } catch (e) {
    console.error('Échec d\'enregistrement du bilan MSP', e);
    return false;
  }
}

// Variante utilisée par l'import d'archive : conserve l'id et l'horodatage
// d'origine du bilan importé (plutôt que d'en générer de nouveaux comme
// enregistrerBilan), pour préserver la vraie date historique du calcul.
export function enregistrerBilanBrut(bilan) {
  const bilans = listerBilans();
  bilans.push(bilan);
  try {
    localStorage.setItem(CLE_BILANS, JSON.stringify(bilans));
    return true;
  } catch (e) {
    console.error('Échec d\'enregistrement (import) du bilan MSP', e);
    return false;
  }
}

export function listerBilans() {
  try {
    const brut = localStorage.getItem(CLE_BILANS);
    return brut ? JSON.parse(brut) : [];
  } catch (e) {
    console.error('Échec de lecture des bilans MSP', e);
    return [];
  }
}

export function supprimerBilan(id) {
  const bilans = listerBilans().filter(b => b.id !== id);
  localStorage.setItem(CLE_BILANS, JSON.stringify(bilans));
}
