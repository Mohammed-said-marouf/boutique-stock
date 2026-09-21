const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Une licence = une clé, générée par le super admin pour UNE boutique (le
// "Compte" côté Mongoose, modèle Boutique), qui donne droit à un abonnement
// payant pour une durée. L'admin de la boutique la saisit dans l'appli pour
// activer l'abonnement (voir routes/licences.js). Une clé ne sert qu'une fois.
const licenceSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  cle: { type: String, required: true, unique: true }, // ex: BS-STD-7K2M-9QXA-4TNB
  abonnement: { type: String, enum: ['standard', 'premium'], required: true },
  dureeMois: { type: Number, enum: [1, 3, 6, 12], required: true },
  // La clé n'est utilisable que par la boutique pour laquelle elle a été générée
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  statut: { type: String, enum: ['disponible', 'activee', 'revoquee'], default: 'disponible' },
  creePar: { type: String, ref: 'User', default: null },
  nomCreePar: { type: String, default: '' },
  // Renseignés à l'activation
  activeePar: { type: String, ref: 'User', default: null },
  nomActiveePar: { type: String, default: '' },
  dateActivation: { type: Date, default: null },
  dateExpiration: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Licence', licenceSchema);
