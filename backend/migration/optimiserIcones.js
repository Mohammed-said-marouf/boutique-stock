/**
 * Allège les icônes déjà en base (images base64 de 10 à 45 Ko, affichées à
 * 14-36 px). Exécutée au démarrage du serveur (voir server.js), idempotente :
 * une icône déjà légère n'est plus touchée.
 *
 * Non destructif : l'image d'origine est conservée dans Icone.valeurOriginale
 * (champ jamais renvoyé par l'API), pour pouvoir revenir en arrière.
 */
const SEUIL_CARACTERES = 12000; // en dessous, l'icône est déjà légère

async function optimiserIcones() {
  const Icone = require('../models/Icone');
  const { optimiserIcone } = require('../utils/optimiserIcone');

  const icones = await Icone.collection.find({}).toArray();
  let nb = 0;
  let gagne = 0;

  for (const icone of icones) {
    const ancienne = icone.valeur || '';
    if (!ancienne.startsWith('data:image') || ancienne.length <= SEUIL_CARACTERES) continue;

    const nouvelle = await optimiserIcone(ancienne);
    if (nouvelle === ancienne) continue;

    // on garde l'original une seule fois (jamais écrasé par un passage suivant)
    await Icone.collection.updateOne({ _id: icone._id, valeurOriginale: { $exists: false } }, { $set: { valeurOriginale: ancienne } });
    await Icone.collection.updateOne({ _id: icone._id }, { $set: { valeur: nouvelle } });
    nb++;
    gagne += ancienne.length - nouvelle.length;
  }

  if (nb > 0) {
    console.log(`✅ Icônes allégées : ${nb} icône(s), ${Math.round(gagne / 1024)} Ko en moins à chaque chargement.`);
  }
}

module.exports = { optimiserIcones };
