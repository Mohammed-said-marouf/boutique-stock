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

module.exports = router;