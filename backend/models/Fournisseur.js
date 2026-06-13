const mongoose = require('mongoose');

const fournisseurSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  telephone: { type: String },
  email: { type: String },
  adresse: { type: String },
  produits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Produit' }],
  dateAjout: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Fournisseur', fournisseurSchema);