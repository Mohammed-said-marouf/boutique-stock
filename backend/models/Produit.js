const mongoose = require('mongoose');

const produitSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  description: { type: String },
  prix: { type: Number, required: true },
  quantite: { type: Number, required: true, default: 0 },
  categorie: { type: String, required: true },
  fournisseur: { type: mongoose.Schema.Types.ObjectId, ref: 'Fournisseur' },
  seuilAlerte: { type: Number, default: 5 }, // alerte si quantite < seuilAlerte
  image: { type: String },
  dateAjout: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Produit', produitSchema);