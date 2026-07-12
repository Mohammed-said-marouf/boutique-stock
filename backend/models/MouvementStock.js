const mongoose = require('mongoose');

const mouvementStockSchema = new mongoose.Schema({
  produit: { type: mongoose.Schema.Types.ObjectId, ref: 'Produit', required: true },
  boutiqueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Boutique', required: true },
  type: { type: String, enum: ['entree', 'sortie'], required: true },
  quantite: { type: Number, required: true },
  stockRestant: { type: Number, required: true },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('MouvementStock', mouvementStockSchema);