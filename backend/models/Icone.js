const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const iconeSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  cle: { type: String, required: true, unique: true }, // Ex: "dashboard", "produits", "ventes"
  valeur: { type: String, required: true }, // L'emoji ou icône : "📊", "📦", "💰"
  categorie: { type: String, required: true }, // "menu", "actions", "statuts"
  description: String
}, { timestamps: true });

module.exports = mongoose.model('Icone', iconeSchema);