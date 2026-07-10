const mongoose = require('mongoose');

const boutiqueSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  proprietaire: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adresse: String,
  telephone: String,
  email: String,
  abonnement: { type: String, enum: ['gratuit', 'standard', 'premium'], default: 'gratuit' },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Boutique', boutiqueSchema);