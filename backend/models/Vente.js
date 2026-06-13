const mongoose = require('mongoose');

const venteSchema = new mongoose.Schema({
  produits: [{
    produit: { type: mongoose.Schema.Types.ObjectId, ref: 'Produit', required: true },
    quantite: { type: Number, required: true },
    prixUnitaire: { type: Number, required: true }
  }],
  montantTotal: { type: Number, required: true },
  typeVente: { type: String, enum: ['en_ligne', 'presentiel'], required: true },
  dateVente: { type: Date, default: Date.now },
  notes: { type: String }
});

module.exports = mongoose.model('Vente', venteSchema);