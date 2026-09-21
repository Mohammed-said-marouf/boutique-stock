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
    const { produits: lignes } = req.body;

    // Un vendeur vend TOUJOURS depuis sa caisse assignée (fixée par l'admin,
    // lue depuis son propre token — jamais depuis une valeur envoyée par le
    // client, pour qu'un vendeur ne puisse pas vendre "au nom" d'une autre
    // caisse). Un admin/superadmin, non fixé à une caisse, doit la préciser.
    // Le stock décompté est celui de la BOUTIQUE de cette caisse (partagé par
    // toutes ses caisses) ; la caisse est conservée sur la vente pour la
    // traçabilité.
    const caisseId = req.user.role === 'vendeur' ? req.user.caisseId : (req.body.caisseId || req.user.caisseId);
    if (!caisseId) {
      return res.status(400).json({
        message: req.user.role === 'vendeur'
          ? "Aucune caisse ne vous est assignée — demandez à l'admin de vous en attribuer une."
          : 'caisseId requis : choisissez la caisse de vente.'
      });
    }
    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ message: 'Le panier est vide.' });
    }

    const Caisse = require('../models/Caisse');
    const caisse = await Caisse.findById(caisseId);
    if (!caisse) return res.status(400).json({ message: 'Caisse introuvable.' });
    const comptoirId = caisse.comptoirId;

    // Validation préalable : on vérifie que CHAQUE produit a bien assez de
    // stock dans cette boutique avant de committer quoi que ce soit — pour ne
    // jamais laisser une vente à moitié appliquée.
    const produitsCharges = await Promise.all(lignes.map(item => Produit.findById(item.produit)));
    for (let i = 0; i < lignes.length; i++) {
      const produit = produitsCharges[i];
      if (!produit) return res.status(404).json({ message: `Produit introuvable (id: ${lignes[i].produit}).` });
      const entree = (produit.stockComptoirs || []).find(sc => sc.comptoir === comptoirId);
      const dispo = entree ? entree.quantite : 0;
      if (dispo < lignes[i].quantite) {
        return res.status(400).json({ message: `Stock insuffisant dans cette boutique pour "${produit.nom}" (disponible : ${dispo}).` });
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

    // comptoirId (la Boutique) dénormalisé depuis la caisse, pour pouvoir
    // filtrer les ventes par Boutique sans jointure supplémentaire.
    const vente = new Vente({
      ...req.body,
      caisseId,
      comptoirId,
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

// GET - Stats globales pour SuperAdmin : boutiques, utilisateurs et licences.
// Volontairement AUCUNE donnée de vente ni de chiffre d'affaires : le super
// admin gère les boutiques, leurs licences et leurs comptes, pas leur activité.
router.get('/stats-globales', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const Boutique = require('../models/Boutique');
    const User = require('../models/User');

    const maintenant = new Date();
    const dans15Jours = new Date(maintenant.getTime() + 15 * 24 * 3600 * 1000);

    const [
      totalBoutiques,
      boutiquesActives,
      totalUsers,
      usersActifs,
      abonnementsPayants,
      abonnementsExpirant,
    ] = await Promise.all([
      Boutique.countDocuments(),
      Boutique.countDocuments({ actif: true }),
      User.countDocuments({ role: { $ne: 'superadmin' } }),
      User.countDocuments({ actif: true, role: { $ne: 'superadmin' } }),
      Boutique.countDocuments({ abonnement: { $ne: 'gratuit' } }),
      Boutique.countDocuments({ abonnement: { $ne: 'gratuit' }, abonnementExpireLe: { $ne: null, $gt: maintenant, $lte: dans15Jours } }),
    ]);

    res.json({
      totalBoutiques,
      boutiquesActives,
      totalUsers,
      usersActifs,
      abonnementsPayants,
      abonnementsExpirant,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;