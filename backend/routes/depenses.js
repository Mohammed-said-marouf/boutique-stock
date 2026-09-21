const express = require('express');
const router = express.Router();
const Depense = require('../models/Depense');
const { verifierToken, autoriser } = require('../middleware/auth');
const { resoudreCaisse, filtreLecture } = require('../utils/tresorerie');

// GET - Lister les dépenses (vendeur : les siennes ; admin : tout son Compte)
router.get('/', verifierToken, async (req, res) => {
  try {
    const filtre = filtreLecture(req);
    if (req.query.caisseId) filtre.caisseId = req.query.caisseId;
    const depenses = await Depense.find(filtre).sort({ date: -1 }).limit(300);
    res.json(depenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer une dépense (vendeur, admin, superadmin)
router.post('/', verifierToken, autoriser('superadmin', 'admin', 'vendeur'), async (req, res) => {
  try {
    const montant = Number(req.body.montant);
    const motif = (req.body.motif || '').trim();
    if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });
    if (!motif) return res.status(400).json({ message: 'Le motif est requis.' });

    const r = await resoudreCaisse(req);
    if (r.erreur) return res.status(r.statut).json({ message: r.erreur });

    const depense = await new Depense({
      montant,
      motif,
      note: req.body.note || '',
      boutiqueId: r.comptoir.boutiqueId,
      comptoirId: r.comptoir._id,
      caisseId: r.caisse._id,
      auteur: req.user.id,
      nomAuteur: req.user.nom || '',
      roleAuteur: req.user.role,
    }).save();
    res.status(201).json(depense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Corriger une dépense (admin/superadmin) : montant, motif, note
router.put('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const depense = await Depense.findById(req.params.id);
    if (!depense) return res.status(404).json({ message: 'Dépense introuvable.' });
    if (req.user.role === 'admin' && depense.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    if (req.body.montant !== undefined) {
      const montant = Number(req.body.montant);
      if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });
      depense.montant = montant;
    }
    if (req.body.motif !== undefined) {
      const motif = String(req.body.motif).trim();
      if (!motif) return res.status(400).json({ message: 'Le motif est requis.' });
      depense.motif = motif;
    }
    if (req.body.note !== undefined) depense.note = req.body.note;
    await depense.save();
    res.json(depense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer une dépense (admin/superadmin)
router.delete('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const depense = await Depense.findById(req.params.id);
    if (!depense) return res.status(404).json({ message: 'Dépense introuvable.' });
    if (req.user.role === 'admin' && depense.boutiqueId !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    await Depense.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Dépense supprimée' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
