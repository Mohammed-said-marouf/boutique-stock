const express = require('express');
const router = express.Router();
const Produit = require('../models/Produit');
const { verifierToken, autoriser } = require('../middleware/auth');

// GET - Lister tous les produits (accessible à tous les rôles connectés)
router.get('/', verifierToken, async (req, res) => {
  try {
    let filtre = {};
    // Admin et vendeur ne voient que les produits de leur boutique
    if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const produits = await Produit.find(filtre).populate('fournisseur').populate('stockComptoirs.comptoir', 'nom actif');
    res.json(produits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - Produits avec stock bas
router.get('/alertes', verifierToken, async (req, res) => {
  try {
    let filtre = { $expr: { $lte: ['$quantite', '$seuilAlerte'] } };
    if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const produits = await Produit.find(filtre);
    res.json(produits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const upload = require('../middleware/upload');

// POST - Ajouter un produit avec photo
router.post('/', verifierToken, autoriser('superadmin', 'admin'), upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.user.role === 'admin') data.boutiqueId = req.user.boutiqueId;
    if (req.file) data.image = req.file.path; // URL Cloudinary complète
    const produit = new Produit(data);
    const newProduit = await produit.save();
    res.status(201).json(newProduit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un produit avec photo
router.put('/:id', verifierToken, autoriser('superadmin', 'admin'), upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = req.file.path; // URL Cloudinary complète
    const produit = await Produit.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(produit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un produit (admin et superadmin seulement)
router.delete('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    await Produit.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Produit supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Transférer du stock du Magasin vers un Comptoir (admin/superadmin
// uniquement — seul l'admin décide de ce qui part en vente). Crée aussi un
// mouvement de stock de type "transfert" pour garder l'historique.
router.post('/:id/transferer', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const { comptoirId, quantite } = req.body;
    const qte = Number(quantite);
    if (!comptoirId || !qte || qte <= 0) {
      return res.status(400).json({ message: 'comptoirId et quantite (> 0) sont requis.' });
    }

    const produit = await Produit.findById(req.params.id);
    if (!produit) return res.status(404).json({ message: 'Produit introuvable.' });

    if (req.user.role === 'admin' && produit.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    if (produit.quantite < qte) {
      return res.status(400).json({ message: `Stock Magasin insuffisant (disponible : ${produit.quantite}).` });
    }

    produit.quantite -= qte;
    const entree = produit.stockComptoirs.find(sc => sc.comptoir === comptoirId);
    if (entree) {
      entree.quantite += qte;
    } else {
      produit.stockComptoirs.push({ comptoir: comptoirId, quantite: qte });
    }
    await produit.save();

    const MouvementStock = require('../models/MouvementStock');
    await new MouvementStock({
      produit: produit._id,
      boutiqueId: produit.boutiqueId,
      type: 'transfert',
      quantite: qte,
      stockRestant: produit.quantite,
      comptoirDestination: comptoirId,
      note: req.body.note || '',
    }).save();

    await produit.populate('stockComptoirs.comptoir', 'nom actif');
    res.json(produit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET - Stats produits pour admin
router.get('/stats', verifierToken, async (req, res) => {
  try {
    let filtre = {};
    if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const total = await Produit.countDocuments(filtre);
    const rupture = await Produit.countDocuments({ ...filtre, quantite: 0 });
    const faible = await Produit.countDocuments({
      ...filtre,
      quantite: { $gt: 0 },
      $expr: { $lte: ['$quantite', '$seuilAlerte'] }
    });
    const alertes = await Produit.find({
      ...filtre,
      $expr: { $lte: ['$quantite', '$seuilAlerte'] }
    }).limit(5).select('nom quantite seuilAlerte');

    res.json({ total, rupture, faible, alertes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;