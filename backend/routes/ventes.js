const express = require('express');
const router = express.Router();
const Vente = require('../models/Vente');
const Produit = require('../models/Produit');
const Client = require('../models/Client');
const { verifierToken, autoriser } = require('../middleware/auth');

// GET - Lister toutes les ventes
router.get('/', verifierToken, async (req, res) => {
  try {
    let filtre = {};
    if (req.user.role === 'vendeur' || req.user.role === 'admin') {
      filtre.boutiqueId = req.user.boutiqueId;
    }
    const ventes = await Vente.find(filtre)
      .populate('produits.produit')
      .populate('vendeur', 'nom email')
      .sort({ dateVente: -1 });
    res.json(ventes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer une vente
router.post('/', verifierToken, async (req, res) => {
  try {
    const { comptoirId, produits: lignes } = req.body;
    if (!comptoirId) {
      return res.status(400).json({ message: 'comptoirId requis : choisissez le comptoir de vente.' });
    }
    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ message: 'Le panier est vide.' });
    }

    // Validation préalable : on vérifie que CHAQUE produit a bien assez de
    // stock à ce comptoir avant de committer quoi que ce soit — pour ne
    // jamais laisser une vente à moitié appliquée.
    const produitsCharges = await Promise.all(lignes.map(item => Produit.findById(item.produit)));
    for (let i = 0; i < lignes.length; i++) {
      const produit = produitsCharges[i];
      if (!produit) return res.status(404).json({ message: `Produit introuvable (id: ${lignes[i].produit}).` });
      const entree = (produit.stockComptoirs || []).find(sc => sc.comptoir === comptoirId);
      const dispo = entree ? entree.quantite : 0;
      if (dispo < lignes[i].quantite) {
        return res.status(400).json({ message: `Stock insuffisant à ce comptoir pour "${produit.nom}" (disponible : ${dispo}).` });
      }
    }

    for (const item of lignes) {
      await Produit.updateOne(
        { _id: item.produit, 'stockComptoirs.comptoir': comptoirId },
        { $inc: { 'stockComptoirs.$.quantite': -item.quantite } }
      );
    }
    const numFacture = 'FAC-' + Date.now().toString().slice(-6);
    const boutiqueId = req.user.boutiqueId || null;

    const vente = new Vente({
      ...req.body,
      numFacture,
      boutiqueId
    });
    const newVente = await vente.save();

    const nomClient = (req.body.clientNom || '').trim();
    if (nomClient && nomClient.toLowerCase() !== 'client anonyme' && boutiqueId) {
      await Client.findOneAndUpdate(
        { nom: nomClient, boutiqueId },
        {
          $inc: { achats: 1, total: req.body.montantTotal || 0 },
          $setOnInsert: { nom: nomClient, boutiqueId }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    res.status(201).json(newVente);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET - Stats pour vendeur/admin (leur boutique)
router.get('/stats', verifierToken, async (req, res) => {
  try {
    let filtre = {};
    if (req.user.role === 'vendeur' || req.user.role === 'admin') {
      filtre.boutiqueId = req.user.boutiqueId;
    }

    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const totalVentes = await Vente.countDocuments(filtre);
    const chiffreAffaires = await Vente.aggregate([
      { $match: filtre },
      { $group: { _id: null, total: { $sum: '$montantTotal' } } }
    ]);
    const ventesJour = await Vente.countDocuments({ ...filtre, dateVente: { $gte: aujourdhui } });
    const caJour = await Vente.aggregate([
      { $match: { ...filtre, dateVente: { $gte: aujourdhui } } },
      { $group: { _id: null, total: { $sum: '$montantTotal' } } }
    ]);

    const debutMois = new Date();
    debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    const ventesMois = await Vente.countDocuments({ ...filtre, dateVente: { $gte: debutMois } });
    const caMois = await Vente.aggregate([
      { $match: { ...filtre, dateVente: { $gte: debutMois } } },
      { $group: { _id: null, total: { $sum: '$montantTotal' } } }
    ]);

    res.json({
      totalVentes,
      chiffreAffaires: chiffreAffaires[0]?.total || 0,
      ventesJour,
      caJour: caJour[0]?.total || 0,
      ventesMois,
      caMois: caMois[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - Stats globales pour SuperAdmin
router.get('/stats-globales', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const Boutique = require('../models/Boutique');
    const User = require('../models/User');

    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    const debutMois = new Date();
    debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);

    const [
      totalBoutiques,
      boutiquesActives,
      totalUsers,
      usersActifs,
      totalVentes,
      caTotal,
      ventesMois,
      caMois,
      alertesStock,
    ] = await Promise.all([
      Boutique.countDocuments(),
      Boutique.countDocuments({ actif: true }),
      User.countDocuments({ role: { $ne: 'superadmin' } }),
      User.countDocuments({ actif: true, role: { $ne: 'superadmin' } }),
      Vente.countDocuments(),
      Vente.aggregate([{ $group: { _id: null, total: { $sum: '$montantTotal' } } }]),
      Vente.countDocuments({ dateVente: { $gte: debutMois } }),
      Vente.aggregate([
        { $match: { dateVente: { $gte: debutMois } } },
        { $group: { _id: null, total: { $sum: '$montantTotal' } } }
      ]),
      Produit.countDocuments({ $expr: { $lte: ['$quantite', '$seuilAlerte'] } }),
    ]);

    res.json({
      totalBoutiques,
      boutiquesActives,
      totalUsers,
      usersActifs,
      totalVentes,
      caTotal: caTotal[0]?.total || 0,
      ventesMois,
      caMois: caMois[0]?.total || 0,
      alertesStock,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;