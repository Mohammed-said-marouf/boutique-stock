const express = require('express');
const router = express.Router();
const Magasin = require('../models/Magasin');
const Produit = require('../models/Produit');
const { verifierToken, autoriser } = require('../middleware/auth');

// GET - Lister les magasins du Compte de l'utilisateur connecté
router.get('/', verifierToken, async (req, res) => {
  try {
    const filtre = {};
    if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const magasins = await Magasin.find(filtre).sort({ dateCreation: 1 });
    res.json(magasins);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un magasin (admin/superadmin uniquement)
router.post('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const boutiqueId = req.user.role === 'superadmin'
      ? (req.body.boutiqueId || req.user.boutiqueId)
      : req.user.boutiqueId;

    if (!boutiqueId) return res.status(400).json({ message: 'boutiqueId requis.' });
    if (!req.body.nom) return res.status(400).json({ message: 'nom requis.' });

    const magasin = new Magasin({ nom: req.body.nom, boutiqueId, adresse: req.body.adresse || '' });
    const nouveauMagasin = await magasin.save();
    res.status(201).json(nouveauMagasin);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un magasin
router.put('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const magasin = await Magasin.findById(req.params.id);
    if (!magasin) return res.status(404).json({ message: 'Magasin introuvable.' });
    if (req.user.role === 'admin' && magasin.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    if (req.body.nom !== undefined) magasin.nom = req.body.nom;
    if (req.body.adresse !== undefined) magasin.adresse = req.body.adresse;
    if (req.body.actif !== undefined) magasin.actif = req.body.actif;
    await magasin.save();
    res.json(magasin);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un magasin — refusé s'il reste du stock dessus
router.delete('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const magasin = await Magasin.findById(req.params.id);
    if (!magasin) return res.status(404).json({ message: 'Magasin introuvable.' });
    if (req.user.role === 'admin' && magasin.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    const produitAvecStock = await Produit.findOne({
      stockMagasins: { $elemMatch: { magasin: req.params.id, quantite: { $gt: 0 } } }
    });
    if (produitAvecStock) {
      return res.status(400).json({
        message: `Impossible de supprimer : il reste du stock dans ce magasin (ex: "${produitAvecStock.nom}"). Transférez-le ou réaffectez-le d'abord.`
      });
    }

    await Magasin.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Magasin supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;