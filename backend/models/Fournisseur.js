const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const fournisseurSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  telephone: { type: String },
  email: { type: String },
  adresse: { type: String },
  produits: [{ type: String, ref: 'Produit' }],
  dateAjout: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Fournisseur', fournisseurSchema);