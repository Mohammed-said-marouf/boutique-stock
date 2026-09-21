const express = require('express');
const router = express.Router();
const Versement = require('../models/Versement');
const { verifierToken, autoriser } = require('../middleware/auth');
const { resoudreCaisse, filtreLecture } = require('../utils/tresorerie');

// GET - Lister les versements (vendeur : les siens ; admin : tout son Compte)
router.get('/', verifierToken, async (req, res) => {
  try {
    const filtre = filtreLecture(req);
    if (req.query.caisseId) filtre.caisseId = req.query.caisseId;
    const versements = await Versement.find(filtre).sort({ date: -1 }).limit(300);
    res.json(versements);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer un versement (vendeur uniquement : c'est lui qui remet
// l'argent de sa caisse)
router.post('/', verifierToken, autoriser('vendeur'), async (req, res) => {
  try {
    const montant = Number(req.body.montant);
    if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });

    const r = await resoudreCaisse(req);
    if (r.erreur) return res.status(r.statut).json({ message: r.erreur });

    const versement = await new Versement({
      montant,
      note: req.body.note || '',
      boutiqueId: r.comptoir.boutiqueId,
      comptoirId: r.comptoir._id,
      caisseId: r.caisse._id,
      auteur: req.user.id,
      nomAuteur: req.user.nom || '',
    }).save();
    res.status(201).json(versement);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Corriger un versement (admin/superadmin) : montant, note
router.put('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const versement = await Versement.findById(req.params.id);
    if (!versement) return res.status(404).json({ message: 'Versement introuvable.' });
    if (req.user.role === 'admin' && versement.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    if (req.body.montant !== undefined) {
      const montant = Number(req.body.montant);
      if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });
      versement.montant = montant;
    }
    if (req.body.note !== undefined) versement.note = req.body.note;
    await versement.save();
    res.json(versement);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un versement (admin/superadmin)
router.delete('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const versement = await Versement.findById(req.params.id);
    if (!versement) return res.status(404).json({ message: 'Versement introuvable.' });
    if (req.user.role === 'admin' && versement.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    await Versement.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Versement supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
