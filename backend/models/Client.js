const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const clientSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  telephone: { type: String },
  email: { type: String },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  achats: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);