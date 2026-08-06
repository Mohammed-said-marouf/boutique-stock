const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const boutiqueSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  proprietaire: { type: String, ref: 'User' },
  adresse: String,
  telephone: String,
  email: String,
  logo: { type: String, default: null },
  abonnement: { type: String, enum: ['gratuit', 'standard', 'premium'], default: 'gratuit' },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Boutique', boutiqueSchema);