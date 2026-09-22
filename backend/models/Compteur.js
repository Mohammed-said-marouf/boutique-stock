const mongoose = require('mongoose');

// Compteur générique (pattern "counter document") pour générer des séquences
// numériques sans collision, même en cas de créations simultanées — un
// findOneAndUpdate avec $inc est atomique au niveau d'un document MongoDB,
// contrairement à "lire le max existant puis +1" qui peut dupliquer sous
// forte concurrence. Utilisé pour l'instant par les références de produits
// (voir utils/reference.js).
const compteurSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // clé de la séquence, ex: "ref:<boutiqueId>:<prefixe>"
  valeur: { type: Number, default: 0 },
});

module.exports = mongoose.model('Compteur', compteurSchema);
