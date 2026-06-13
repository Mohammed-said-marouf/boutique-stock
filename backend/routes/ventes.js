const express = require('express');
const router = express.Router();
const Vente = require('../models/Vente');
const Produit = require('../models/Produit');

// GET - Lister toutes les ventes
router.get('/', async (req, res) => {
  try {
    const ventes = await Vente.find().populate('produits.produit');
    res.json(ventes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer une vente
router.post('/', async (req, res) => {
  try {
    // Réduire le stock de chaque produit vendu
    for (const item of req.body.produits) {
      await Produit.findByIdAndUpdate(item.produit, {
        $inc: { quantite: -item.quantite }
      });
    }
    const vente = new Vente(req.body);
    const newVente = await vente.save();
    res.status(201).json(newVente);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET - Statistiques des ventes
router.get('/stats', async (req, res) => {
  try {
    const totalVentes = await Vente.countDocuments();
    const chiffreAffaires = await Vente.aggregate([
      { $group: { _id: null, total: { $sum: '$montantTotal' } } }
    ]);
    res.json({
      totalVentes,
      chiffreAffaires: chiffreAffaires[0]?.total || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;