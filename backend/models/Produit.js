const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const produitSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  description: { type: String },
  prix: { type: Number, required: true },
  // Stock au MAGASIN (réserve, pas directement vendable). Les entrées de
  // stock (approvisionnement fournisseur) créditent ce champ. Pour rendre
  // un produit vendable, il faut le transférer vers un comptoir via
  // POST /api/produits/:id/transferer, qui déplace du stock d'ici vers
  // l'entrée correspondante dans stockComptoirs ci-dessous.
  quantite: { type: Number, required: true, default: 0 },
  // Stock par comptoir (point de vente). C'est CE stock qui est décompté à
  // la vente (caisse classique ou scan QR) — jamais le stock Magasin
  // directement, voir routes/ventes.js.
  stockComptoirs: [{
    comptoir: { type: String, ref: 'Comptoir' },
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