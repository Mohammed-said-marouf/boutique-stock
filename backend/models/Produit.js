const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const produitSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  description: { type: String },
  prix: { type: Number, required: true },
  quantite: { type: Number, required: true, default: 0 },
  categorie: { type: String, required: true },
  fournisseur: { type: String, ref: 'Fournisseur' },
  boutiqueId: { type: String, ref: 'Boutique', default: null },
  seuilAlerte: { type: Number, default: 5 },
  ref: { type: String },
  image: { type: String },
  dateAjout: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Produit', produitSchema);