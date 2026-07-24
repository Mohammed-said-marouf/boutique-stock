const express = require('express');
const router = express.Router();
const Boutique = require('../models/Boutique');
const User = require('../models/User');
const { verifierToken, autoriser } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Liste toutes les boutiques (superadmin)
router.get('/', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const boutiques = await Boutique.find().populate('proprietaire', 'nom email');
    res.json(boutiques);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Récupérer une boutique (superadmin, ou admin/vendeur de sa propre boutique)
router.get('/:id', verifierToken, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin' && req.user.boutiqueId?.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    const boutique = await Boutique.findById(req.params.id);
    if (!boutique) return res.status(404).json({ message: 'Boutique introuvable' });
    res.json(boutique);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Créer une boutique (superadmin)
router.post('/', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const boutique = new Boutique(req.body);
    await boutique.save();
    res.status(201).json(boutique);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Modifier une boutique — superadmin (toutes) ou admin (uniquement la sienne)
// Accepte multipart/form-data avec un champ optionnel "logo" (image)
router.put('/:id', verifierToken, autoriser('superadmin', 'admin'), upload.single('logo'), async (req, res) => {
  try {
    if (req.user.role === 'admin' && req.user.boutiqueId?.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que votre propre boutique' });
    }

    const data = { ...req.body };
    if (req.file) data.logo = req.file.path; // URL Cloudinary complète

    const boutique = await Boutique.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!boutique) return res.status(404).json({ message: 'Boutique introuvable' });
    res.json(boutique);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Supprimer une boutique
router.delete('/:id', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    await Boutique.findByIdAndDelete(req.params.id);
    res.json({ message: 'Boutique supprimée' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST - Créer une boutique COMPLÈTE avec son compte admin
router.post('/creer-complete', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const { nomBoutique, adresse, telephoneBoutique, abonnement, nomAdmin, emailAdmin, motDePasseAdmin } = req.body;

    // Vérifier que l'email n'existe pas déjà
    const existant = await User.findOne({ email: emailAdmin });
    if (existant) return res.status(400).json({ message: 'Cet email est déjà utilisé' });

    // 1. Créer la boutique
    const boutique = new Boutique({
      nom: nomBoutique,
      adresse,
      telephone: telephoneBoutique,
      email: emailAdmin,
      abonnement: abonnement || 'gratuit',
      actif: true
    });
    await boutique.save();

    // 2. Créer le compte admin lié à cette boutique
    const admin = new User({
      nom: nomAdmin,
      email: emailAdmin,
      motDePasse: motDePasseAdmin,
      role: 'admin',
      boutiqueId: boutique._id
    });
    await admin.save();

    // 3. Lier le propriétaire à la boutique
    boutique.proprietaire = admin._id;
    await boutique.save();

    res.status(201).json({
      message: '✅ Boutique et compte admin créés',
      boutique,
      admin: { nom: admin.nom, email: admin.email }
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;