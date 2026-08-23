const express = require('express');
const router = express.Router();
const Comptoir = require('../models/Comptoir');
const Caisse = require('../models/Caisse');
const Produit = require('../models/Produit');
const { verifierToken, autoriser } = require('../middleware/auth');

// GET - Lister les comptoirs de la boutique de l'utilisateur connecté
// (superadmin voit tout, comme sur les autres routes).
router.get('/', verifierToken, async (req, res) => {
  try {
    const filtre = {};
    if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const comptoirs = await Comptoir.find(filtre).sort({ dateCreation: 1 });
    res.json(comptoirs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un comptoir (admin/superadmin uniquement)
router.post('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const boutiqueId = req.user.role === 'superadmin'
      ? (req.body.boutiqueId || req.user.boutiqueId)
      : req.user.boutiqueId;

    if (!boutiqueId) {
      return res.status(400).json({ message: 'boutiqueId requis.' });
    }

    const comptoir = new Comptoir({ nom: req.body.nom, boutiqueId });
    const nouveauComptoir = await comptoir.save();
    res.status(201).json(nouveauComptoir);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un comptoir (renommer, activer/désactiver)
router.put('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const comptoir = await Comptoir.findById(req.params.id);
    if (!comptoir) return res.status(404).json({ message: 'Comptoir introuvable.' });
    if (req.user.role === 'admin' && comptoir.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    if (req.body.nom !== undefined) comptoir.nom = req.body.nom;
    if (req.body.actif !== undefined) comptoir.actif = req.body.actif;
    await comptoir.save();
    res.json(comptoir);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un comptoir — refusé s'il reste du stock dessus, pour
// éviter de perdre la trace de marchandise physiquement encore là-bas.
router.delete('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const comptoir = await Comptoir.findById(req.params.id);
    if (!comptoir) return res.status(404).json({ message: 'Comptoir introuvable.' });
    if (req.user.role === 'admin' && comptoir.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    const caissesDuComptoir = await Caisse.find({ comptoirId: req.params.id }, '_id');
    const produitAvecStock = await Produit.findOne({
      'stockCaisses': { $elemMatch: { caisse: { $in: caissesDuComptoir.map(c => c._id) }, quantite: { $gt: 0 } } }
    });
    if (produitAvecStock) {
      return res.status(400).json({
        message: `Impossible de supprimer : il reste du stock sur une caisse de cette boutique (ex: "${produitAvecStock.nom}"). Transférez-le d'abord ailleurs.`
      });
    }

    await Comptoir.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Comptoir supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;