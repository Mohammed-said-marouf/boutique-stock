const express = require('express');
const router = express.Router();
const Fournisseur = require('../models/Fournisseur');

// GET - Lister tous les fournisseurs
router.get('/', async (req, res) => {
  try {
    const fournisseurs = await Fournisseur.find();
    res.json(fournisseurs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Ajouter un fournisseur
router.post('/', async (req, res) => {
  const fournisseur = new Fournisseur(req.body);
  try {
    const newFournisseur = await fournisseur.save();
    res.status(201).json(newFournisseur);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un fournisseur
router.put('/:id', async (req, res) => {
  try {
    const fournisseur = await Fournisseur.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(fournisseur);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un fournisseur
router.delete('/:id', async (req, res) => {
  try {
    await Fournisseur.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Fournisseur supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;