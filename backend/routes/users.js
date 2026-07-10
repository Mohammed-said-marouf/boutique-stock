const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifierToken, autoriser } = require('../middleware/auth');

// Liste tous les utilisateurs (superadmin) ou vendeurs de sa boutique (admin)
router.get('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const filtre = req.user.role === 'admin'
      ? { boutiqueId: req.user.boutiqueId, role: 'vendeur' }
      : {};
    const users = await User.find(filtre).select('-motDePasse').populate('boutiqueId', 'nom');
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Créer un utilisateur
router.post('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      req.body.role = 'vendeur';
      req.body.boutiqueId = req.user.boutiqueId;
    }
    const user = new User(req.body);
    await user.save();
    const { motDePasse, ...userSansMotDePasse } = user.toObject();
    res.status(201).json(userSansMotDePasse);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Activer/désactiver un utilisateur
router.put('/:id/statut', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { actif: req.body.actif }, { new: true }
    ).select('-motDePasse');
    res.json(user);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Supprimer un utilisateur
router.delete('/:id', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;