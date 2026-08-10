const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Parametre = require('../models/Parametre');
const { verifierToken, autoriser } = require('../middleware/auth');
const { envoyerEmailTest } = require('../services/emailService');

// GET - Statut de maintenance, accessible SANS authentification (utile
// pour afficher un message adapté sur l'écran de connexion si besoin).
router.get('/statut', async (req, res) => {
  try {
    const parametre = await Parametre.findOne({ cle: 'modeMaintenance' });
    console.log(`[maintenance-route] STATUT lu à ${new Date().toISOString()} — valeur brute: ${JSON.stringify(parametre?.valeur)}, _id: ${parametre?._id}`);
    res.json({ enMaintenance: !!(parametre && parametre.valeur === true) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Active le mode maintenance (superadmin uniquement)
router.post('/activer', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    console.log(`[maintenance-route] ACTIVER appelé par ${req.user?.id} (${req.user?.role}) à ${new Date().toISOString()}`);
    await Parametre.findOneAndUpdate({ cle: 'modeMaintenance' }, { valeur: true }, { upsert: true });
    res.json({ enMaintenance: true, message: '🔴 Mode maintenance activé.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Désactive le mode maintenance (superadmin uniquement)
router.post('/desactiver', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    console.log(`[maintenance-route] DESACTIVER appelé par ${req.user?.id} (${req.user?.role}) à ${new Date().toISOString()}`);
    await Parametre.findOneAndUpdate({ cle: 'modeMaintenance' }, { valeur: false }, { upsert: true });
    res.json({ enMaintenance: false, message: '🟢 Mode maintenance désactivé.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - "Vider le cache" : aucun système de cache (Redis, mémoire) n'est
// actuellement en place dans l'application — ce bouton est donc un
// placeholder honnête, prêt à être branché le jour où un vrai mécanisme
// de cache sera ajouté, plutôt que de faire semblant d'agir sur rien.
router.post('/vider-cache', verifierToken, autoriser('superadmin'), async (req, res) => {
  res.json({ message: 'ℹ️ Aucun système de cache actif pour le moment — rien à vider.' });
});

// POST - "Optimiser la base de données" : diagnostic simple (taille des
// collections, nombre de documents), SANS aucune modification des
// données — une vraie opération d'optimisation (réindexation, compactage)
// est plus risquée et n'est pas déclenchée automatiquement ici.
router.post('/optimiser-bd', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const statsBd = await mongoose.connection.db.stats();
    const collections = await mongoose.connection.db.listCollections().toArray();
    const detailsCollections = [];
    for (const c of collections) {
      const statsCollection = await mongoose.connection.db.collection(c.name).stats();
      detailsCollections.push({
        collection: c.name,
        documents: statsCollection.count,
        tailleKo: Math.round(statsCollection.size / 1024),
      });
    }
    res.json({
      message: '📊 Diagnostic terminé — aucune modification effectuée.',
      tailleTotaleKo: Math.round(statsBd.dataSize / 1024),
      collections: detailsCollections,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - "Tester les emails" : envoie un vrai email de test via le service existant.
router.post('/tester-email', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    await envoyerEmailTest(req.user);
    res.json({ message: '📧 Email de test envoyé avec succès.' });
  } catch (err) {
    res.status(500).json({ message: "Échec de l'envoi : " + err.message });
  }
});

// POST - "Redémarrer les services" : symbolique pour l'instant, ne
// redémarre pas réellement le processus (nécessiterait une intégration à
// l'API de l'hébergeur, ex: Render — plus risquée à mettre en place sans
// tests approfondis en conditions réelles).
router.post('/redemarrer', verifierToken, autoriser('superadmin'), async (req, res) => {
  res.json({ message: 'ℹ️ Redémarrage réel non implémenté pour le moment — action enregistrée (symbolique).' });
});

module.exports = router;