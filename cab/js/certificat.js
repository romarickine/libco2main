/**
 * certificat.js
 * ----------------------------------------------------------------------
 * Génère et télécharge le certificat récapitulatif (image PNG dessinée
 * sur un <canvas> caché). Contient le nom du cabinet, le métier et son
 * contexte, la date du bilan, les deux indicateurs clés, et la mention de
 * la source des données.
 * ----------------------------------------------------------------------
 */

const LOGO_URL = "assets/logo/logo-libco2.png";

function dessinerCertificat(ctx, W, H, logo, { famille, profil, results, nomCabinet }) {
  const modeLabel = profil.mode === "seul" ? "seul(e)" : profil.mode === "employeur" ? "avec salarié(s)" : "à plusieurs";
  const microDescriptif = `${profil.metierId} — ${famille.lieuLabel} ${modeLabel}${profil.villeLabel ? `, à ${profil.villeLabel}` : ""}`;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#F7F5F0";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#2E673E"; ctx.lineWidth = 6; ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = "#C98A2C"; ctx.lineWidth = 1.5; ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.textAlign = "center";

  let y = 56;
  if (logo) {
    const logoW = 168, logoH = logoW * (logo.height / logo.width);
    ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
    y += logoH + 18;
  } else {
    ctx.font = "bold 32px Georgia, serif"; ctx.fillStyle = "#2E673E";
    ctx.fillText("Lib&CO2", W / 2, y + 26);
    y += 46;
  }

  ctx.font = "14px Georgia, serif"; ctx.fillStyle = "#5C8A7A";
  ctx.fillText("Certificat d'estimation carbone", W / 2, y);
  y += 30;

  if (nomCabinet && nomCabinet.trim()) {
    ctx.font = "bold 22px Georgia, serif"; ctx.fillStyle = "#1B2B26";
    ctx.fillText(nomCabinet.trim(), W / 2, y);
    y += 28;
  }

  ctx.font = "bold 15px Georgia, serif"; ctx.fillStyle = "#2E673E";
  ctx.fillText(microDescriptif, W / 2, y);
  y += 22;

  ctx.font = "12px Georgia, serif"; ctx.fillStyle = "#8A9490";
  ctx.fillText(`Bilan réalisé le ${new Date().toLocaleDateString("fr-FR")}`, W / 2, y);
  y += 26;

  ctx.strokeStyle = "#E4E0D6"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(W - 70, y); ctx.stroke();
  y += 44;

  const colLeftX = W * 0.28, colRightX = W * 0.72;
  ctx.font = "13px Georgia, serif"; ctx.fillStyle = "#1B2B26";
  ctx.fillText(`Impact par ${famille.uniteActe}`, colLeftX, y);
  ctx.fillText("Empreinte annuelle totale", colRightX, y);
  y += 46;
  ctx.font = "bold 38px Georgia, serif"; ctx.fillStyle = "#2E673E";
  ctx.fillText(`${results.parActe.toFixed(1)}`, colLeftX, y);
  ctx.font = "bold 38px Georgia, serif"; ctx.fillStyle = "#C98A2C";
  ctx.fillText(`${results.totalT.toFixed(2)}`, colRightX, y);
  y += 26;
  ctx.font = "13px Georgia, serif"; ctx.fillStyle = "#8A9490";
  ctx.fillText("kgCO2e", colLeftX, y);
  ctx.fillText("tCO2e / an", colRightX, y);

  ctx.strokeStyle = "#E4E0D6"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2, y - 100); ctx.lineTo(W / 2, y + 14); ctx.stroke();

  ctx.font = "13px Georgia, serif"; ctx.fillStyle = "#8A9490";
  ctx.fillText("Source des données : calculateur Lib&CO2", W / 2, H - 46);
  ctx.font = "italic 10.5px Georgia, serif";
  ctx.fillText("Ordre de grandeur indicatif (POC) — méthodologie inspirée de kinéCO2 (Carbone 4) — sources ADEME Base Empreinte", W / 2, H - 26);
}

// Génère le certificat et déclenche son téléchargement en PNG.
// Entrée : canvas (élément <canvas> caché dédié), contexte { famille, profil, results, nomCabinet }
// Sortie : Promise résolue à "ok" ou rejetée en cas d'échec (le code appelant
//          (ui.js) doit afficher un message adapté dans les deux cas).
export function exporterCertificat(canvas, contexte) {
  return new Promise((resolve, reject) => {
    try {
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      const telecharger = () => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("toBlob a échoué")); return; }
          const url = URL.createObjectURL(blob);
          const lien = document.createElement("a");
          lien.href = url;
          lien.download = "certificat-libco2.png";
          document.body.appendChild(lien);
          lien.click();
          document.body.removeChild(lien);
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          resolve("ok");
        }, "image/png");
      };
      const logo = new Image();
      logo.onload = () => { dessinerCertificat(ctx, W, H, logo, contexte); telecharger(); };
      logo.onerror = () => { dessinerCertificat(ctx, W, H, null, contexte); telecharger(); };
      logo.src = LOGO_URL;
    } catch (e) {
      reject(e);
    }
  });
}
