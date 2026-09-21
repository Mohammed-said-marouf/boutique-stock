/**
 * Les versements enregistrés AVANT l'introduction de l'approbation par l'admin
 * n'ont pas de champ "statut". Ils étaient déjà comptés dans le solde des
 * caisses : on les marque donc "valide", pour qu'ils le restent (sinon ils
 * seraient traités comme "en attente" et sortiraient des soldes).
 *
 * Exécutée au démarrage du serveur (voir server.js), idempotente.
 */
async function migrerVersementsValides() {
  const Versement = require('../models/Versement');
  const r = await Versement.collection.updateMany(
    { statut: { $exists: false } },
    { $set: { statut: 'valide' } }
  );
  if (r.modifiedCount > 0) {
    console.log(`✅ Migration versements : ${r.modifiedCount} versement(s) existant(s) marqué(s) comme validés.`);
  }
}

module.exports = { migrerVersementsValides };
