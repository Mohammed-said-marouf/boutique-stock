const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const { verifierToken } = require('../middleware/auth');

// GET - Liste des clients de la boutique de l'utilisateur connecté
router.get('/', verifierToken, async (req, res) => {
  try {
    const filtre = {};
    if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const clients = await Client.find(filtre).sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Ajouter un client (rattaché automatiquement à la boutique de l'utilisateur)
router.post('/', verifierToken, async (req, res) => {
  try {
    if (!req.user.boutiqueId) {
      return res.status(400).json({ message: "Aucune boutique associée à ce compte." });
    }
    const client = new Client({
      nom: req.body.nom,
      telephone: req.body.telephone,
      email: req.body.email,
      boutiqueId: req.user.boutiqueId,
    });
    const nouveauClient = await client.save();
    res.status(201).json(nouveauClient);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un client
router.put('/:id', verifierToken, async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un client
router.delete('/:id', verifierToken, async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Client supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;