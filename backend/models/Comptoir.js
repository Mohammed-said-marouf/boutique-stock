const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Un Comptoir = un point de vente physique au sein d'une boutique (ex: "Caisse 1",
// "Comptoir Entrée", "Stand Marché"). Une boutique peut en avoir plusieurs.
// Le stock de chaque produit à CE comptoir est stocké sur le produit lui-même,
// dans Produit.stockComptoirs (voir models/Produit.js), pas ici — ce modèle ne
// décrit que le comptoir en tant que tel.
const comptoirSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  actif: { type: Boolean, default: true },
  dateCreation: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Comptoir', comptoirSchema);