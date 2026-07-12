const express = require('express');
const router = express.Router();
const MouvementStock = require('../models/MouvementStock');
const Produit = require('../models/Produit');
const { verifierToken, autoriser } = require('../middleware/auth');

// GET - Historique des mouvements de la boutique de l'utilisateur connecté
router.get('/', verifierToken, async (req, res) => {
  try {
    const filtre = {};
    if (req.user.role === 'admin' || req.user.role === 'vendeur') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const mouvements = await MouvementStock.find(filtre)
      .populate('produit', 'nom')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(mouvements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer un mouvement (entrée ou sortie) et mettre à jour le stock du produit
router.post('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const { produit: produitId, type, quantite, note } = req.body;
    if (!produitId || !type || !quantite) {
      return res.status(400).json({ message: 'Produit, type et quantité sont requis.' });
    }

    const produit = await Produit.findById(produitId);
    if (!produit) return res.status(404).json({ message: 'Produit introuvable.' });

    const qte = Number(quantite);
    const nouveauStock = type === 'entree' ? produit.quantite + qte : produit.quantite - qte;
    if (nouveauStock < 0) {
      return res.status(400).json({ message: 'Stock insuffisant pour cette sortie.' });
    }

    produit.quantite = nouveauStock;
    await produit.save();

    const mouvement = new MouvementStock({
      produit: produitId,
      boutiqueId: req.user.boutiqueId,
      type,
      quantite: qte,
      stockRestant: nouveauStock,
      note: note || '',
    });
    const nouveauMouvement = await mouvement.save();
    await nouveauMouvement.populate('produit', 'nom');

    res.status(201).json(nouveauMouvement);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;