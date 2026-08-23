const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Un Magasin = une réserve physique (entrepôt, arrière-boutique...) rattachée
// au Compte propriétaire. Un même Magasin peut alimenter n'importe quelle
// Boutique de ce Compte (contrairement aux Caisses, qui appartiennent à une
// seule Boutique). Le stock de chaque produit dans CE magasin est stocké sur
// le produit lui-même, dans Produit.stockMagasins.
const magasinSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  // "Boutique" est le nom historique du modèle Mongoose pour ce que
  // l'interface appelle désormais "Compte" (le compte du propriétaire) —
  // non renommé en base pour ne pas casser les données déjà en production.
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  adresse: { type: String, default: '' },
  actif: { type: Boolean, default: true },
  dateCreation: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Magasin', magasinSchema);