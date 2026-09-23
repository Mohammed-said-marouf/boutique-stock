const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const enregistrerLog = require('../utils/logger');
const { verifierToken } = require('../middleware/auth');
const router = express.Router();

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    const user = await User.findOne({ email }).populate('boutiqueId');

    if (!user || !await user.verifierMotDePasse(motDePasse)) {
      await enregistrerLog({
        type: 'connexion_echouee',
        message: `Tentative avec l'email ${email}`,
        nomUtilisateur: email,
        niveau: 'error'
      });
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (!user.actif) {
      await enregistrerLog({
        type: 'connexion_echouee',
        message: `Compte désactivé (${user.nom})`,
        utilisateur: user._id,
        nomUtilisateur: user.nom,
        niveau: 'error'
      });
      return res.status(403).json({ message: 'Compte désactivé' });
    }

    const token = jwt.sign(
      { id: user._id, nom: user.nom, role: user.role, boutiqueId: user.boutiqueId?._id, caisseId: user.caisseId || null },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await enregistrerLog({
      type: 'connexion',
      message: user.boutiqueId?.nom || user.role,
      utilisateur: user._id,
      nomUtilisateur: user.nom,
      niveau: 'info'
    });

    let caisseInfo = null;
    if (user.caisseId) {
      const Caisse = require('../models/Caisse');
      caisseInfo = await Caisse.findById(user.caisseId);
    }

    res.json({
      token,
      user: { id: user._id, nom: user.nom, email: user.email, role: user.role, boutique: user.boutiqueId, caisseId: user.caisseId || null, caisse: caisseInfo, doitChangerMotDePasse: !!user.doitChangerMotDePasse, photo: user.photo || null }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Renouvelle un token encore valide (avant son expiration à 24h) sans
// redemander le mot de passe — utilisé par la synchro desktop pour ne
// jamais laisser son token expirer tant que l'appli est ouverte et en
// ligne au moins une fois par 24h (voir desktop/sync/scheduler.js).
// Un token déjà expiré ne peut PAS être renouvelé ici (verifierToken le
// rejette) : il faut alors une vraie reconnexion avec email/mot de passe.
router.post('/refresh', verifierToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('boutiqueId');
    if (!user || !user.actif) {
      return res.status(401).json({ message: 'Compte introuvable ou désactivé.' });
    }

    const token = jwt.sign(
      { id: user._id, nom: user.nom, role: user.role, boutiqueId: user.boutiqueId?._id, caisseId: user.caisseId || null },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    let caisseInfo = null;
    if (user.caisseId) {
      const Caisse = require('../models/Caisse');
      caisseInfo = await Caisse.findById(user.caisseId);
    }

    res.json({
      token,
      user: { id: user._id, nom: user.nom, email: user.email, role: user.role, boutique: user.boutiqueId, caisseId: user.caisseId || null, caisse: caisseInfo, doitChangerMotDePasse: !!user.doitChangerMotDePasse, photo: user.photo || null }
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