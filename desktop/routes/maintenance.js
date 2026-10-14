/**
 * Route "maintenance" du serveur local — RELAIS TRANSPARENT vers l'API en
 * ligne, PAS de miroir local (même principe que routes/inventaires.js et
 * routes/licences.js).
 *
 * Fonctionnalité réservée au super admin (statut de maintenance, vider le
 * cache, optimiser la base, tester l'e-mail, redémarrer...) — peu probable
 * depuis un poste desktop de boutique, mais la même absence de route locale
 * y causerait la même panne silencieuse (page 404 HTML par défaut
 * d'Express, .json() cassé côté frontend). Corrigée par cohérence.
 *
 * Nécessite donc d'être en ligne. Même limite connue que les deux autres
 * relais : utilise le token de la session de SYNCHRO du poste
 * (token-store.js), pas une identité résolue par requête.
 */

const express = require('express');
const router = express.Router();
const { estEnLigne, API_EN_LIGNE } = require('../sync/connectivite');
const { lireSession } = require('../sync/token-store');

router.all('*', async (req, res) => {
  try {
    const enLigne = await estEnLigne();
    if (!enLigne) {
      return res.status(503).json({ message: 'Cette action nécessite une connexion internet.' });
    }

    const session = lireSession();
    const headers = { 'Content-Type': 'application/json' };
    // GET /statut est public côté backend (pas de verifierToken) — relayé
    // même sans session de synchro connue ; les autres routes l'exigent.
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;

    const url = `${API_EN_LIGNE}/api/maintenance${req.url}`;
    const options = { method: req.method, headers };
    if (!['GET', 'HEAD'].includes(req.method)) {
      options.body = JSON.stringify(req.body || {});
    }

    const reponse = await fetch(url, options);
    const donnees = await reponse.json().catch(() => null);
    res.status(reponse.status).json(donnees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
