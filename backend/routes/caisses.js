const express = require('express');
const router = express.Router();
const Caisse = require('../models/Caisse');
const Comptoir = require('../models/Comptoir');
const Produit = require('../models/Produit');
const { verifierToken, autoriser } = require('../middleware/auth');

// Vérifie que le comptoir (Boutique) appartient bien à la boutique (Compte)
// de l'utilisateur courant — sauf superadmin, qui voit tout.
async function comptoirAccessible(comptoirId, user) {
  const comptoir = await Comptoir.findById(comptoirId);
  if (!comptoir) return null;
  if (user.role !== 'superadmin' && comptoir.boutiqueId !== user.boutiqueId) return null;
  return comptoir;
}

// GET - Lister les caisses (filtrable par ?comptoirId=, sinon toutes les
// caisses des boutiques du Compte de l'utilisateur)
router.get('/', verifierToken, async (req, res) => {
  try {
    let filtre = {};
    if (req.query.comptoirId) {
      filtre.comptoirId = req.query.comptoirId;
    } else if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      const comptoirsDuCompte = await Comptoir.find({ boutiqueId: req.user.boutiqueId }, '_id');
      filtre.comptoirId = { $in: comptoirsDuCompte.map(c => c._id) };
    }
    const caisses = await Caisse.find(filtre).sort({ dateCreation: 1 });
    res.json(caisses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer une caisse dans une boutique (admin/superadmin uniquement)
router.post('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    if (!req.body.comptoirId) return res.status(400).json({ message: 'comptoirId requis.' });
    const comptoir = await comptoirAccessible(req.body.comptoirId, req.user);
    if (!comptoir) return res.status(404).json({ message: 'Boutique introuvable.' });
    if (!req.body.nom) return res.status(400).json({ message: 'nom requis.' });

    const caisse = new Caisse({ nom: req.body.nom, comptoirId: req.body.comptoirId });
    const nouvelleCaisse = await caisse.save();
    res.status(201).json(nouvelleCaisse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier une caisse (renommer, activer/désactiver)
router.put('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const caisse = await Caisse.findById(req.params.id);
    if (!caisse) return res.status(404).json({ message: 'Caisse introuvable.' });
    if (!(await comptoirAccessible(caisse.comptoirId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    if (req.body.nom !== undefined) caisse.nom = req.body.nom;
    if (req.body.actif !== undefined) caisse.actif = req.body.actif;
    await caisse.save();
    res.json(caisse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer une caisse — refusé s'il reste du stock dessus
router.delete('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const caisse = await Caisse.findById(req.params.id);
    if (!caisse) return res.status(404).json({ message: 'Caisse introuvable.' });
    if (!(await comptoirAccessible(caisse.comptoirId, req.user))) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    const produitAvecStock = await Produit.findOne({
      stockCaisses: { $elemMatch: { caisse: req.params.id, quantite: { $gt: 0 } } }
    });
    if (produitAvecStock) {
      return res.status(400).json({
        message: `Impossible de supprimer : il reste du stock sur cette caisse (ex: "${produitAvecStock.nom}"). Transférez-le d'abord ailleurs.`
      });
    }

    await Caisse.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Caisse supprimée' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;