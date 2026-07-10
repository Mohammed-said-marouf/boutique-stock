const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    const user = await User.findOne({ email }).populate('boutiqueId');
    if (!user || !await user.verifierMotDePasse(motDePasse))
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    if (!user.actif)
      return res.status(403).json({ message: 'Compte désactivé' });

    const token = jwt.sign(
      { id: user._id, role: user.role, boutiqueId: user.boutiqueId?._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user._id, nom: user.nom, email: user.email, role: user.role, boutique: user.boutiqueId }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Créer le superadmin (à appeler une seule fois)
router.post('/init-superadmin', async (req, res) => {
  try {
    const existant = await User.findOne({ role: 'superadmin' });
    if (existant) return res.status(400).json({ message: 'Superadmin déjà créé' });
    const superadmin = new User({
      nom: 'Super Admin',
      email: 'superadmin@boutique.com',
      motDePasse: 'superadmin123',
      role: 'superadmin'
    });
    await superadmin.save();
    res.json({ message: '✅ Superadmin créé', email: 'superadmin@boutique.com', motDePasse: 'superadmin123' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;