const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const produitSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  description: { type: String },
  prix: { type: Number, required: true },
  // "quantite" reste le TOTAL du stock Magasin, tenu à jour automatiquement
  // = somme de stockMagasins[].quantite (recalculé à chaque écriture qui
  // touche stockMagasins — voir routes/produits.js et routes/mouvements.js).
  // Conservé pour ne pas casser tout le code existant qui l'affiche
  // (dashboards, alertes, colonne "Stock"...). La répartition réelle par
  // magasin est dans stockMagasins ci-dessous.
  quantite: { type: Number, required: true, default: 0 },
  // Stock par MAGASIN (réserve). Un même produit peut être réparti sur
  // plusieurs magasins d'un même Compte. Pour rendre du stock vendable, il
  // faut le transférer d'un magasin vers une caisse via
  // POST /api/produits/:id/transferer.
  stockMagasins: [{
    magasin: { type: String, ref: 'Magasin' },
    quantite: { type: Number, default: 0 },
  }],
  // Stock par CAISSE (point de vente concret, au sein d'une Boutique). C'est
  // CE stock qui est décompté à la vente (caisse classique ou scan QR) —
  // jamais le stock Magasin directement, voir routes/ventes.js.
  stockCaisses: [{
    caisse: { type: String, ref: 'Caisse' },
    quantite: { type: Number, default: 0 },
  }],
  categorie: { type: String, required: true },
  fournisseur: { type: String, ref: 'Fournisseur' },
  boutiqueId: { type: String, ref: 'Boutique', default: null },
  seuilAlerte: { type: Number, default: 5 },
  ref: { type: String },
  image: { type: String },
  dateAjout: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Produit', produitSchema);