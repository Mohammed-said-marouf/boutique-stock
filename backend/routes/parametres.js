const express = require('express');
const router = express.Router();
const { verifierToken, autoriser } = require('../middleware/auth');
const { lireConfigGenerale, validerConfigGenerale, enregistrerConfigGenerale } = require('../utils/configGenerale');

// GET - Configuration générale (nom de l'application, email de contact,
// devise, fuseau horaire). Publique : l'écran de connexion en a besoin
// (nom, email de contact) avant toute authentification, et elle ne
// contient rien de sensible. Accessible aussi pendant la maintenance (voir
// middleware/maintenance.js).
router.get('/config', async (req, res) => {
  try {
    res.json(await lireConfigGenerale());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT - Modifier la configuration générale (super admin uniquement)
router.put('/config', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const { config, erreur } = validerConfigGenerale(req.body || {});
    if (erreur) return res.status(400).json({ message: erreur });
    res.json(await enregistrerConfigGenerale(config));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
