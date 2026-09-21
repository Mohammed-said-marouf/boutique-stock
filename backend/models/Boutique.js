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
  // Fin de la licence en cours (voir models/Licence.js). null = sans échéance
  // (plan gratuit, ou abonnement attribué à la main avant les licences).
  // À l'échéance, la boutique repasse au plan gratuit (services/abonnements.js).
  abonnementExpireLe: { type: Date, default: null },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Boutique', boutiqueSchema);