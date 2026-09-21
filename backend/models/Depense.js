const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Une dépense payée avec l'argent d'une Caisse (achat de fournitures,
// transport, etc.). Elle réduit le solde d'espèces de cette caisse — voir
// routes/tresorerie.js. Saisie par un vendeur (sur sa caisse assignée) ou par
// un admin (qui choisit la caisse).
const depenseSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  montant: { type: Number, required: true, min: 0.01 },
  motif: { type: String, required: true, trim: true },
  note: { type: String, default: '' },
  // "Boutique" est le nom historique du modèle Mongoose pour le Compte, et
  // "Comptoir" celui de la Boutique (point de vente) — voir models/Caisse.js.
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  comptoirId: { type: String, ref: 'Comptoir', required: true },
  caisseId: { type: String, ref: 'Caisse', required: true },
  auteur: { type: String, ref: 'User', required: true },
  nomAuteur: { type: String, default: '' },
  roleAuteur: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Depense', depenseSchema);
