// Les icônes personnalisées sont stockées en base64 (data:image/...) et
// téléchargées à CHAQUE ouverture de l'appli (voir routes/icones.js). Elles
// s'affichent pourtant à 14-36 px : on les réduit donc à TAILLE_MAX px (assez
// pour un écran 3x), ce qui les fait passer de ~30 Ko à quelques Ko chacune.

const TAILLE_MAX = 72;

/**
 * Retourne l'icône réduite (data URL PNG), ou la valeur d'origine si ce n'est
 * pas une image raster (emoji, URL, SVG...), si elle est déjà légère, ou si la
 * réduction échoue / ne fait pas gagner de place.
 */
async function optimiserIcone(valeur, taille = TAILLE_MAX) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i.exec(valeur || '');
  if (!m) return valeur;
  try {
    const sharp = require('sharp');
    const sortie = await sharp(Buffer.from(m[2], 'base64'))
      .resize({ width: taille, height: taille, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();
    const nouveau = 'data:image/png;base64,' + sortie.toString('base64');
    return nouveau.length < valeur.length ? nouveau : valeur;
  } catch (err) {
    console.log('⚠️ Optimisation d\'icône impossible :', err.message);
    return valeur;
  }
}

module.exports = { optimiserIcone };
