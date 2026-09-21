const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Un versement = remise d'espèces par un vendeur (à l'admin ou à la banque).
// Il réduit le solde d'espèces de sa Caisse — voir routes/tresorerie.js.
const versementSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  montant: { type: Number, required: true, min: 0.01 },
  note: { type: String, default: '' },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  comptoirId: { type: String, ref: 'Comptoir', required: true },
  caisseId: { type: String, ref: 'Caisse', required: true },
  auteur: { type: String, ref: 'User', required: true },
  nomAuteur: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Versement', versementSchema);
