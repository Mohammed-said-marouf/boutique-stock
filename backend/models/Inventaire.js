const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Une ligne = un produit à compter dans cette session. quantiteTheorique est
// figée au moment de l'OUVERTURE de la session (référence affichée pendant
// le comptage), calculée selon Inventaire.referenceType — voir plus bas ;
// referenceDate indique de quand date cette référence (null = pas de
// référence trouvée, repli sur le stock actuel). quantiteReelle est saisie
// par l'admin (null = pas encore compté). Voir routes/inventaires.js pour
// comment l'écart est appliqué au stock à la validation.
const ligneInventaireSchema = new mongoose.Schema({
  produit: { type: String, ref: 'Produit', required: true },
  nom: { type: String, required: true },   // figés au moment de l'ouverture :
  ref: { type: String, default: '' },      // un produit renommé/supprimé après
  quantiteTheorique: { type: Number, required: true }, // coup reste lisible dans l'historique
  referenceDate: { type: Date, default: null },
  quantiteReelle: { type: Number, default: null },
  compteLe: { type: Date, default: null },
}, { _id: false });

// Une session d'inventaire = le comptage physique du stock d'UNE cible
// (un Magasin ou une Boutique/Comptoir) à un instant donné, pour un Compte.
// À la validation, le stock de chaque produit compté est mis à jour pour
// correspondre exactement à la quantité réelle saisie (pas un simple
// journal : ça corrige le stock, voir PUT /:id/valider).
const inventaireSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  boutiqueId: { type: String, ref: 'Boutique', required: true },
  cibleType: { type: String, enum: ['magasin', 'comptoir'], required: true },
  cibleId: { type: String, required: true },  // Magasin._id ou Comptoir._id selon cibleType
  cibleNom: { type: String, required: true }, // figé, pour l'historique même si la cible est renommée/supprimée
  // Quel théorique comparer au compte réel, choisi par l'admin à l'ouverture :
  //  - stock_initial : ce qui avait été corrigé au dernier inventaire validé
  //    sur cette même cible (ou le stock actuel s'il n'y en a jamais eu)
  //  - dernier_approvisionnement : le stock juste après la dernière entrée de
  //    stock (mouvement 'entree') de chaque produit — magasin uniquement, une
  //    boutique ne reçoit que des transferts, jamais d'entrée directe
  referenceType: { type: String, enum: ['stock_initial', 'dernier_approvisionnement'], required: true },
  statut: { type: String, enum: ['en_cours', 'valide', 'annule'], default: 'en_cours' },
  lignes: [ligneInventaireSchema],
  creePar: { type: String, ref: 'User', default: null },
  nomCreePar: { type: String, default: '' },
  valideLe: { type: Date, default: null },
  valideParId: { type: String, ref: 'User', default: null },
  nomValidePar: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Inventaire', inventaireSchema);
