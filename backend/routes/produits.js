const express = require('express');
const router = express.Router();
const Produit = require('../models/Produit');

// GET - Lister tous les produits
router.get('/', async (req, res) => {
  try {
    const produits = await Produit.find().populate('fournisseur');
    res.json(produits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - Produits avec stock bas
router.get('/alertes', async (req, res) => {
  try {
    const produits = await Produit.find({
      $expr: { $lte: ['$quantite', '$seuilAlerte'] }
    });
    res.json(produits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Ajouter un produit
router.post('/', async (req, res) => {
  const produit = new Produit(req.body);
  try {
    const newProduit = await produit.save();
    res.status(201).json(newProduit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un produit
router.put('/:id', async (req, res) => {
  try {
    const produit = await Produit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(produit);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un produit
router.delete('/:id', async (req, res) => {
  try {
    await Produit.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Produit supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;