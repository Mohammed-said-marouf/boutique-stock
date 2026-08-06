const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const logSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  type: { type: String, required: true }, // ex: 'connexion', 'connexion_echouee', 'boutique_creee', 'boutique_activee', 'boutique_desactivee', 'utilisateur_cree', 'vente_creee', 'produit_ajoute'
  message: { type: String, required: true }, // détail lisible, ex: "FAC-250002 — 85 000 FCFA"
  utilisateur: { type: String, ref: 'User', default: null },
  nomUtilisateur: { type: String, default: 'Inconnu' }, // dénormalisé pour affichage rapide sans populate
  niveau: { type: String, enum: ['info', 'success', 'error'], default: 'info' },
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);