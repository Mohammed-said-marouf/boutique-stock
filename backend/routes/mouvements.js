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

// POST - Enregistrer un mouvement (entrée ou sortie) sur le stock MAGASIN et
// mettre à jour produit.quantite. Pour déplacer du stock vers un comptoir,
// voir POST /api/produits/:id/transferer (crée un mouvement type "transfert").
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

    // Un admin reste cantonné à sa propre boutique (sécurité inchangée).
    // Un superadmin n'a pas de boutiqueId propre (il n'est rattaché à
    // aucune boutique) : on accepte donc la valeur envoyée dans le body —
    // utile notamment pour la synchronisation desktop, où le compte
    // connecté peut être un superadmin poussant des mouvements pour des
    // boutiques variées.
    const boutiqueId = req.user.role === 'superadmin'
      ? (req.body.boutiqueId || req.user.boutiqueId)
      : req.user.boutiqueId;

    const mouvement = new MouvementStock({
      produit: produitId,
      boutiqueId,
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