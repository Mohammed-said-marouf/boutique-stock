const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const mouvementStockSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  produit: { type: String, ref: 'Produit', required: true },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  // 'inventaire' : correction de stock appliquée à la validation d'une
  // session d'inventaire (voir routes/inventaires.js). Sa quantite est
  // SIGNÉE (+ surplus trouvé, − manquant), contrairement aux autres types.
  type: { type: String, enum: ['entree', 'sortie', 'transfert', 'inventaire'], required: true },
  // Le magasin concerné par ce mouvement. Pour 'entree'/'sortie' : le
  // magasin dont le stock change. Pour 'transfert' : le magasin SOURCE
  // (la destination est comptoirDestination ci-dessous). Pour 'inventaire' :
  // le magasin inventorié (null si c'est une boutique, voir comptoirId).
  magasinId: { type: String, ref: 'Magasin', default: null },
  // Rempli uniquement pour type='inventaire' sur une boutique.
  comptoirId: { type: String, ref: 'Comptoir', default: null },
  inventaireId: { type: String, ref: 'Inventaire', default: null },
  quantite: { type: Number, required: true },
  stockRestant: { type: Number, required: true }, // stock de CE magasin (ou de cette boutique, pour un inventaire) après ce mouvement
  // Rempli uniquement pour type='transfert' : la boutique (Comptoir) qui a
  // reçu le stock.
  comptoirDestination: { type: String, ref: 'Comptoir', default: null },
  // Ancien système (stock par caisse) : uniquement renseigné sur l'historique
  // antérieur, conservé pour que ces anciens transferts restent lisibles.
  caisseDestination: { type: String, ref: 'Caisse', default: null },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('MouvementStock', mouvementStockSchema);