const express = require('express');
const router = express.Router();
const Boutique = require('../models/Boutique');
const User = require('../models/User');
const { verifierToken, autoriser } = require('../middleware/auth');
const upload = require('../middleware/upload');
const enregistrerLog = require('../utils/logger');
const { supprimerCompteEtDonnees } = require('../utils/supprimerCompte');

// Même règle que le modèle User (voir models/User.js) — vérifiée ICI, en
// plus, AVANT de créer quoi que ce soit : sans ça, un email invalide ferait
// échouer la création du User admin APRÈS que la Boutique ait déjà été
// enregistrée (deux étapes distinctes), laissant une boutique orpheline
// sans propriétaire.
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    // Un admin ne modifie que les infos de sa boutique : jamais son abonnement
    // (il passe par une licence, voir routes/licences.js), son statut ou son
    // propriétaire — sinon il pourrait se donner le plan premium lui-même.
    if (req.user.role === 'admin') {
      for (const champ of ['abonnement', 'abonnementExpireLe', 'actif', 'proprietaire']) delete data[champ];
    }
    if (req.file) data.logo = req.file.path; // URL Cloudinary complète

    const boutique = await Boutique.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!boutique) return res.status(404).json({ message: 'Boutique introuvable' });

    if (typeof req.body.actif === 'boolean') {
      await enregistrerLog({
        type: boutique.actif ? 'boutique_activee' : 'boutique_desactivee',
        message: boutique.nom,
        utilisateur: req.user.id,
        nomUtilisateur: req.user.nom || 'Admin',
        niveau: boutique.actif ? 'success' : 'error'
      });
    }

    res.json(boutique);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Supprimer une boutique (Compte) et TOUTES ses données : utilisateurs,
// boutiques/caisses, magasins, produits, clients, ventes, mouvements,
// dépenses, versements, licences. Irréversible — voir utils/supprimerCompte.js.
router.delete('/:id', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const boutique = await Boutique.findById(req.params.id);
    if (!boutique) return res.status(404).json({ message: 'Boutique introuvable.' });

    const bilan = await supprimerCompteEtDonnees(req.params.id);

    await enregistrerLog({
      type: 'boutique_supprimee',
      message: `${boutique.nom} : ${bilan.utilisateurs} utilisateur(s), ${bilan.produits} produit(s), ${bilan.ventes} vente(s) supprimé(s)`,
      utilisateur: req.user.id,
      nomUtilisateur: req.user.nom || 'Super Admin',
      niveau: 'error',
    });

    res.json({ message: '✅ Boutique et toutes ses données supprimées', bilan });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST - Inscription libre (public, sans authentification) : un futur admin
// crée directement sa boutique + son propre compte, sans passer par le superadmin.
// Démarre automatiquement sur le plan gratuit.
router.post('/inscription', async (req, res) => {
  try {
    const { nomBoutique, adresse, telephoneBoutique, nomAdmin, emailAdmin, motDePasseAdmin } = req.body;

    if (!nomBoutique || !nomAdmin || !emailAdmin || !motDePasseAdmin) {
      return res.status(400).json({ message: 'Veuillez remplir tous les champs obligatoires.' });
    }
    if (motDePasseAdmin.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }
    if (!EMAIL_VALIDE.test(emailAdmin)) {
      return res.status(400).json({ message: "Format d'email invalide." });
    }

    const existant = await User.findOne({ email: emailAdmin });
    if (existant) return res.status(400).json({ message: 'Cet email est déjà utilisé.' });

    // 1. Créer la boutique (plan gratuit par défaut, active immédiatement)
    const boutique = new Boutique({
      nom: nomBoutique,
      adresse,
      telephone: telephoneBoutique,
      email: emailAdmin,
      abonnement: 'gratuit',
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

    await enregistrerLog({
      type: 'boutique_creee',
      message: `${boutique.nom} (inscription libre)`,
      utilisateur: admin._id,
      nomUtilisateur: admin.nom,
      niveau: 'success'
    });

    res.status(201).json({ message: '✅ Compte créé avec succès, vous pouvez maintenant vous connecter.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST - Créer une boutique COMPLÈTE avec son compte admin (superadmin)
router.post('/creer-complete', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const { nomBoutique, adresse, telephoneBoutique, abonnement, nomAdmin, emailAdmin, motDePasseAdmin } = req.body;

    if (!EMAIL_VALIDE.test(emailAdmin || '')) {
      return res.status(400).json({ message: "Format d'email invalide." });
    }

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

    await enregistrerLog({
      type: 'boutique_creee',
      message: boutique.nom,
      utilisateur: req.user.id,
      nomUtilisateur: req.user.nom || 'Super Admin',
      niveau: 'success'
    });

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