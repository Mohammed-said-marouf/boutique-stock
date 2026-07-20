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

// Récupérer mon propre profil
router.get('/me', verifierToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-motDePasse').populate('boutiqueId');
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Modifier mes propres infos (nom, email) — n'importe quel rôle connecté
router.put('/me', verifierToken, async (req, res) => {
  try {
    const { nom, email } = req.body;
    const donnees = {};
    if (nom) donnees.nom = nom;
    if (email) donnees.email = email;

    if (email) {
      const existant = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existant) return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre compte' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, donnees, { new: true })
      .select('-motDePasse').populate('boutiqueId');
    res.json(user);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Changer mon propre mot de passe
router.put('/me/motdepasse', verifierToken, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({ message: 'Ancien et nouveau mot de passe requis' });
    }
    if (nouveauMotDePasse.length < 6) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const correct = await user.verifierMotDePasse(ancienMotDePasse);
    if (!correct) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

    user.motDePasse = nouveauMotDePasse;
    await user.save();
    res.json({ message: '✅ Mot de passe mis à jour' });
  } catch (err) { res.status(400).json({ message: err.message }); }
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