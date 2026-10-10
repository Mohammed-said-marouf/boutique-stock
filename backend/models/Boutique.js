const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const boutiqueSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  proprietaire: { type: String, ref: 'User' },
  adresse: String,
  telephone: String,
  email: String,
  // Numéro d'Identifiant Unique (DGI, Cameroun) — affiché sur les factures
  // (voir VendeurLayout.js/AdminLayout.js, genererFacturePdfA4/voirFacture).
  // Facultatif : une boutique qui n'en a pas (ou ne l'a pas encore renseigné)
  // n'affiche simplement pas la ligne sur ses factures.
  niu: { type: String, default: '' },
  logo: { type: String, default: null },
  abonnement: { type: String, enum: ['gratuit', 'standard', 'premium'], default: 'gratuit' },
  // Fin de la licence en cours (voir models/Licence.js). null = sans échéance
  // (plan gratuit, ou abonnement attribué à la main avant les licences).
  // À l'échéance, la boutique repasse au plan gratuit (services/abonnements.js).
  abonnementExpireLe: { type: Date, default: null },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Boutique', boutiqueSchema);