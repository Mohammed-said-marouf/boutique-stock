const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { verifierToken, autoriser } = require('../middleware/auth');

// GET - Lister les logs les plus récents (superadmin seulement)
router.get('/', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 }).limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un log (tout utilisateur authentifié, ex: synchronisation desktop)
router.post('/', verifierToken, async (req, res) => {
  try {
    const { type, message, niveau } = req.body;

    if (!type || !message) {
      return res.status(400).json({ message: 'type et message sont requis.' });
    }

    const log = await Log.create({
      type,
      message,
      niveau: niveau || 'info',
      utilisateur: req.user?.id || req.user?._id || null,
      nomUtilisateur: req.user?.nom || 'Inconnu',
    });

    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;