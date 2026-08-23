const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const mouvementStockSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  produit: { type: String, ref: 'Produit', required: true },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  type: { type: String, enum: ['entree', 'sortie', 'transfert'], required: true },
  // Le magasin concerné par ce mouvement. Pour 'entree'/'sortie' : le
  // magasin dont le stock change. Pour 'transfert' : le magasin SOURCE
  // (la destination est caisseDestination ci-dessous).
  magasinId: { type: String, ref: 'Magasin', default: null },
  quantite: { type: Number, required: true },
  stockRestant: { type: Number, required: true }, // stock de CE magasin après ce mouvement
  // Rempli uniquement pour type='transfert' : la caisse qui a reçu le stock.
  caisseDestination: { type: String, ref: 'Caisse', default: null },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('MouvementStock', mouvementStockSchema);