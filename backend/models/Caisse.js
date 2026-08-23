const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Une Caisse = un point de vente concret au sein d'une Boutique (ex: "Caisse 1",
// "Caisse rapide"). Une Boutique peut en avoir plusieurs. Le stock vendable de
// chaque produit à CETTE caisse est stocké sur le produit lui-même, dans
// Produit.stockCaisses (voir models/Produit.js) — ce modèle ne décrit que la
// caisse en tant que telle.
const caisseSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  // "Comptoir" est le nom historique du modèle Mongoose pour ce que
  // l'interface appelle désormais "Boutique" (point de vente physique) —
  // non renommé en base pour ne pas casser les données déjà en production.
  comptoirId: { type: String, ref: 'Comptoir', required: true },
  actif: { type: Boolean, default: true },
  dateCreation: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Caisse', caisseSchema);