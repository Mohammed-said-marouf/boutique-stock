const mongoose = require('mongoose');

const produitSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: { type: String },
  prix: { type: Number, required: true },
  quantite: { type: Number, required: true, default: 0 },
  categorie: { type: String, required: true },
  fournisseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Fournisseur' },
  boutiqueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Boutique', default: null },
  seuilAlerte: { type: Number, default: 5 },
  ref: { type: String },
  image: { type: String },
  dateAjout: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Produit', produitSchema);