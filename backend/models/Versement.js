const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Un versement = remise d'espèces par un vendeur à l'admin. Il n'est pris en
// compte dans le solde de la Caisse (voir routes/tresorerie.js) qu'une fois
// APPROUVÉ par l'admin : le vendeur le déclare ("en_attente"), l'admin
// confirme qu'il a bien reçu l'argent ("valide") ou le rejette ("refuse").
const versementSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  montant: { type: Number, required: true, min: 0.01 },
  note: { type: String, default: '' },
  statut: { type: String, enum: ['en_attente', 'valide', 'refuse'], default: 'en_attente' },
  // Renseignés quand l'admin approuve ou refuse
  decidePar: { type: String, ref: 'User', default: null },
  nomDecidePar: { type: String, default: '' },
  dateDecision: { type: Date, default: null },
  motifRefus: { type: String, default: '' },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  comptoirId: { type: String, ref: 'Comptoir', required: true },
  caisseId: { type: String, ref: 'Caisse', required: true },
  auteur: { type: String, ref: 'User', required: true },
  nomAuteur: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Versement', versementSchema);
