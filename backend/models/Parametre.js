const mongoose = require('mongoose');

const parametreSchema = new mongoose.Schema({
  cle: { type: String, required: true, unique: true },
  valeur: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.model('Parametre', parametreSchema);