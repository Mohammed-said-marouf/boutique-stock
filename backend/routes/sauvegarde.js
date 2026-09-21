const express = require('express');
const router = express.Router();
const Boutique = require('../models/Boutique');
const Comptoir = require('../models/Comptoir');
const Caisse = require('../models/Caisse');
const Magasin = require('../models/Magasin');
const Produit = require('../models/Produit');
const Client = require('../models/Client');
const Fournisseur = require('../models/Fournisseur');
const Vente = require('../models/Vente');
const MouvementStock = require('../models/MouvementStock');
const Depense = require('../models/Depense');
const Versement = require('../models/Versement');
const { verifierToken, autoriser } = require('../middleware/auth');

// Sauvegarde / restauration des données d'un Compte ("Boutique" côté Mongoose,
// voir models/Caisse.js pour le vocabulaire).
//  - Admin   : exporte tout son Compte, et peut le restaurer.
//  - Vendeur : exporte uniquement ses propres ventes, dépenses et versements
//              (pas de restauration : elle permettrait de réécrire ses propres
//              chiffres ; ses données restent de toute façon sur le serveur).
// Les comptes utilisateurs (mots de passe hachés) ne sont volontairement PAS
// exportés : un fichier de sauvegarde ne doit contenir aucun secret.

const FORMAT = 'boutique-stock-sauvegarde';
const VERSION = 1;

// GET /export
router.get('/export', verifierToken, autoriser('admin', 'vendeur'), async (req, res) => {
  try {
    const { boutiqueId } = req.user;
    if (!boutiqueId) return res.status(400).json({ message: "Aucun compte n'est rattaché à cet utilisateur." });

    const compte = await Boutique.findById(boutiqueId).lean();
    let donnees;

    if (req.user.role === 'vendeur') {
      donnees = {
        ventes: await Vente.find({ boutiqueId, vendeur: req.user.id }).lean(),
        depenses: await Depense.find({ boutiqueId, auteur: req.user.id }).lean(),
        versements: await Versement.find({ boutiqueId, auteur: req.user.id }).lean(),
      };
    } else {
      const comptoirs = await Comptoir.find({ boutiqueId }).lean();
      const produits = await Produit.find({ boutiqueId }).lean();
      const idsFournisseurs = [...new Set(produits.map(p => p.fournisseur).filter(Boolean))];
      donnees = {
        comptoirs,
        caisses: await Caisse.find({ comptoirId: { $in: comptoirs.map(c => c._id) } }).lean(),
        magasins: await Magasin.find({ boutiqueId }).lean(),
        fournisseurs: await Fournisseur.find({ _id: { $in: idsFournisseurs } }).lean(),
        produits,
        clients: await Client.find({ boutiqueId }).lean(),
        ventes: await Vente.find({ boutiqueId }).lean(),
        mouvements: await MouvementStock.find({ boutiqueId }).lean(),
        depenses: await Depense.find({ boutiqueId }).lean(),
        versements: await Versement.find({ boutiqueId }).lean(),
      };
    }

    const compteurs = Object.fromEntries(Object.entries(donnees).map(([k, v]) => [k, v.length]));
    res.json({
      format: FORMAT,
      version: VERSION,
      exporteLe: new Date().toISOString(),
      role: req.user.role,
      boutiqueId,
      nomCompte: compte?.nom || '',
      compteurs,
      donnees,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ordre de restauration : les parents avant les enfants.
// - scope : filtre garantissant qu'on ne remplace QUE des documents de ce
//   Compte (un _id existant dans un autre Compte ne peut jamais être écrasé).
// - forcer : champs de rattachement imposés, jamais lus depuis le fichier.
function planRestauration(boutiqueId, idsComptoirs) {
  const parCompte = { scope: { boutiqueId }, forcer: { boutiqueId } };
  return [
    { cle: 'comptoirs', Modele: Comptoir, ...parCompte },
    { cle: 'magasins', Modele: Magasin, ...parCompte },
    {
      cle: 'caisses', Modele: Caisse,
      scope: { comptoirId: { $in: [...idsComptoirs] } },
      // une caisse ne peut être rattachée qu'à une boutique de CE compte
      verifier: d => idsComptoirs.has(d.comptoirId),
    },
    // Fournisseurs : pas de propriétaire dans le modèle, donc on n'ajoute que
    // les absents, sans jamais modifier un fournisseur existant.
    { cle: 'fournisseurs', Modele: Fournisseur, insererSeulement: true },
    { cle: 'produits', Modele: Produit, ...parCompte },
    { cle: 'clients', Modele: Client, ...parCompte },
    { cle: 'ventes', Modele: Vente, ...parCompte },
    { cle: 'mouvements', Modele: MouvementStock, ...parCompte },
    { cle: 'depenses', Modele: Depense, ...parCompte },
    { cle: 'versements', Modele: Versement, ...parCompte },
  ];
}

// POST /restaurer - Fusionne un fichier de sauvegarde dans le Compte : les
// documents du fichier sont recréés ou remplacés (même _id), rien n'est
// supprimé. Admin uniquement.
router.post('/restaurer', verifierToken, autoriser('admin'), async (req, res) => {
  try {
    const fichier = req.body;
    if (!fichier || fichier.format !== FORMAT || !fichier.donnees) {
      return res.status(400).json({ message: "Ce fichier n'est pas une sauvegarde Boutique Stock." });
    }
    if (fichier.version > VERSION) {
      return res.status(400).json({ message: "Sauvegarde créée par une version plus récente de l'application." });
    }
    if (fichier.role !== 'admin') {
      return res.status(400).json({ message: "Seule une sauvegarde complète d'administrateur peut être restaurée." });
    }
    const { boutiqueId } = req.user;
    if (fichier.boutiqueId !== boutiqueId) {
      return res.status(403).json({ message: "Cette sauvegarde appartient à un autre compte." });
    }

    // Les boutiques (comptoirs) valides : celles déjà en base pour ce compte
    // + celles restaurées depuis le fichier (rattachées de force à ce compte).
    const idsComptoirs = new Set((await Comptoir.find({ boutiqueId }, '_id').lean()).map(c => c._id));
    (fichier.donnees.comptoirs || []).forEach(c => { if (c && typeof c._id === 'string') idsComptoirs.add(c._id); });

    const bilan = {};
    for (const etape of planRestauration(boutiqueId, idsComptoirs)) {
      const docs = Array.isArray(fichier.donnees[etape.cle]) ? fichier.donnees[etape.cle] : [];
      const b = { crees: 0, misAJour: 0, ignores: 0 };

      for (const brut of docs) {
        if (!brut || typeof brut._id !== 'string' || (etape.verifier && !etape.verifier(brut))) { b.ignores++; continue; }
        try {
          // Passe par le schéma Mongoose : validation + conversion des dates
          // ISO du fichier JSON, et écarte les champs inconnus.
          const doc = new etape.Modele({ ...brut, ...(etape.forcer || {}) });
          await doc.validate();
          const obj = doc.toObject();

          if (etape.insererSeulement) {
            const r = await etape.Modele.collection.updateOne({ _id: obj._id }, { $setOnInsert: obj }, { upsert: true });
            if (r.upsertedCount) b.crees++; else b.ignores++;
          } else {
            const r = await etape.Modele.collection.replaceOne({ _id: obj._id, ...etape.scope }, obj, { upsert: true });
            if (r.upsertedCount) b.crees++; else b.misAJour++;
          }
        } catch (e) {
          // document invalide, ou _id déjà pris par un autre compte (E11000)
          b.ignores++;
        }
      }
      bilan[etape.cle] = b;
    }

    res.json({ message: '✅ Sauvegarde restaurée', bilan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
