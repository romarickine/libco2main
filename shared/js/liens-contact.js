// SPDX-License-Identifier: EUPL-1.2
// Copyright (c) 2026 Lib&CO2 SASU — La carte du sans-voiture, licence EUPL 1.2 (voir iso/LICENCE.md).
// Complète les liens de contact statiques (attribut data-offre) avec la trame
// de message pré-remplie de contact.js. Sans script, le lien garde son objet
// d'e-mail simple : la page reste utilisable.
import { lienContact, OFFRES } from "./contact.js";

for (const a of document.querySelectorAll("a[data-offre]")) {
  if (OFFRES[a.dataset.offre]) a.href = lienContact(a.dataset.offre);
}
