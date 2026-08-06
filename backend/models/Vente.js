const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const venteSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  produits: [{
    produit: { type: String, ref: 'Produit', required: true },
    quantite: { type: Number, required: true },
    prixUnitaire: { type: Number, required: true }
  }],
  montantTotal: { type: Number, required: true },
  typeVente: { type: String, enum: ['en_ligne', 'presentiel'], default: 'presentiel' },
  vendeur: { type: String, ref: 'User' },
  nomVendeur: { type: String },
  clientNom: { type: String, default: 'Client anonyme' },
  numFacture: { type: String },
  boutiqueId: { type: String, ref: 'Boutique', default: null },
  dateVente: { type: Date, default: Date.now },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Vente', venteSchema);