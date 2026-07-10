const mongoose = require('mongoose');

const iconeSchema = new mongoose.Schema({
  cle: { type: String, required: true, unique: true }, // Ex: "dashboard", "produits", "ventes"
  valeur: { type: String, required: true }, // L'emoji ou icône : "📊", "📦", "💰"
  categorie: { type: String, required: true }, // "menu", "actions", "statuts"
  description: String
}, { timestamps: true });

module.exports = mongoose.model('Icone', iconeSchema);