const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const mouvementStockSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  produit: { type: String, ref: 'Produit', required: true },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  type: { type: String, enum: ['entree', 'sortie', 'transfert'], required: true },
  quantite: { type: Number, required: true },
  stockRestant: { type: Number, required: true }, // stock Magasin restant après ce mouvement
  // Rempli uniquement pour type='transfert' : le comptoir qui a reçu le stock.
  comptoirDestination: { type: String, ref: 'Comptoir', default: null },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('MouvementStock', mouvementStockSchema);