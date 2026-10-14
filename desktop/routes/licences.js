/**
 * Route "licences" du serveur local — RELAIS TRANSPARENT vers l'API en
 * ligne, PAS de miroir local (même principe que routes/inventaires.js).
 *
 * Les licences (clés d'abonnement) vivent exclusivement en ligne (super
 * admin, backend/routes/licences.js) — mais POST /activer, elle, est
 * utilisée par un ADMIN depuis Paramètres → Ma boutique (voir
 * frontend/src/components/Licence.js, LicenceBoutique) : un admin sur
 * desktop qui active une licence doit pouvoir le faire. Avant ce fichier,
 * aucune route locale n'existait : la requête échouait silencieusement
 * ("Activation impossible.", message générique de secours du composant,
 * le vrai message d'erreur venant du JSON.parse raté de la page 404 HTML
 * par défaut d'Express).
 *
 * Nécessite donc d'être en ligne. Même limite connue que inventaires.js :
 * relaie avec le token de la session de SYNCHRO du poste (token-store.js),
 * pas une identité résolue par requête.
 */

const express = require('express');
const router = express.Router();
const { estEnLigne, API_EN_LIGNE } = require('../sync/connectivite');
const { lireSession } = require('../sync/token-store');

router.all('*', async (req, res) => {
  try {
    const enLigne = await estEnLigne();
    if (!enLigne) {
      return res.status(503).json({
        message: "L'activation d'une licence nécessite une connexion internet.",
      });
    }

    const session = lireSession();
    if (!session?.token) {
      return res.status(401).json({
        message: 'Connectez-vous au moins une fois en ligne avant d\'activer une licence.',
      });
    }

    const url = `${API_EN_LIGNE}/api/licences${req.url}`;
    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    };
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
