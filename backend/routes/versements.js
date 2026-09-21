const express = require('express');
const router = express.Router();
const Versement = require('../models/Versement');
const User = require('../models/User');
const { verifierToken, autoriser } = require('../middleware/auth');
const { resoudreCaisse, filtreLecture } = require('../utils/tresorerie');
const { envoyerNotificationVersement } = require('../services/emailService');

// Circuit d'un versement : le vendeur le déclare ("en_attente"), puis l'admin
// confirme l'avoir reçu ("valide") ou le rejette ("refuse"). Seuls les
// versements validés réduisent le solde de la caisse (routes/tresorerie.js).

// Filtre limitant un admin aux versements de son Compte (superadmin : tout)
const filtreCompte = (req) => (req.user.role === 'superadmin' ? {} : { boutiqueId: req.user.boutiqueId });

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

// GET /en-attente/nombre - Nombre de versements à approuver (pastille de
// notification dans le menu de l'admin)
router.get('/en-attente/nombre', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const nombre = await Versement.countDocuments({ ...filtreCompte(req), statut: 'en_attente' });
    res.json({ nombre });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Déclarer un versement (vendeur uniquement : c'est lui qui remet
// l'argent de sa caisse). Il est créé "en_attente" et les admins du compte
// sont prévenus.
router.post('/', verifierToken, autoriser('vendeur'), async (req, res) => {
  try {
    const montant = Number(req.body.montant);
    if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });

    const r = await resoudreCaisse(req);
    if (r.erreur) return res.status(r.statut).json({ message: r.erreur });

    // Le statut n'est jamais lu depuis le body : un vendeur ne peut pas
    // s'auto-valider un versement.
    const versement = await new Versement({
      montant,
      note: req.body.note || '',
      statut: 'en_attente',
      boutiqueId: r.comptoir.boutiqueId,
      comptoirId: r.comptoir._id,
      caisseId: r.caisse._id,
      auteur: req.user.id,
      nomAuteur: req.user.nom || '',
    }).save();

    // Notification e-mail aux admins (sans attendre, sans jamais échouer)
    User.find({ role: 'admin', boutiqueId: r.comptoir.boutiqueId, actif: true }, 'email').lean()
      .then(admins => envoyerNotificationVersement(admins.map(a => a.email).filter(Boolean), {
        montant, nomAuteur: req.user.nom, nomCaisse: r.caisse.nom,
      }))
      .catch(() => {});

    res.status(201).json(versement);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Décision de l'admin sur un versement en attente. Le filtre sur le statut
// rend l'opération atomique : impossible de traiter deux fois le même
// versement, même si deux admins cliquent en même temps.
async function decider(req, res, modifications) {
  try {
    const versement = await Versement.findOneAndUpdate(
      { _id: req.params.id, statut: 'en_attente', ...filtreCompte(req) },
      {
        $set: {
          ...modifications,
          decidePar: req.user.id,
          nomDecidePar: req.user.nom || '',
          dateDecision: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    if (!versement) {
      return res.status(409).json({ message: 'Versement introuvable ou déjà traité.' });
    }
    res.json(versement);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// PUT - Approuver un versement : l'admin confirme avoir reçu l'argent
router.put('/:id/valider', verifierToken, autoriser('superadmin', 'admin'), (req, res) =>
  decider(req, res, { statut: 'valide' }));

// PUT - Refuser un versement (motif facultatif)
router.put('/:id/refuser', verifierToken, autoriser('superadmin', 'admin'), (req, res) =>
  decider(req, res, { statut: 'refuse', motifRefus: String(req.body.motif || '').slice(0, 300) }));

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
