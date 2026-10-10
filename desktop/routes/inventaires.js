/**
 * Route "inventaires" du serveur local — RELAIS TRANSPARENT vers l'API en
 * ligne, PAS de miroir local (contrairement à produits.js, ventes.js...).
 *
 * Pourquoi un simple relais et pas une vraie implémentation SQLite comme le
 * reste : le comptage/réconciliation de stock (backend/routes/inventaires.js,
 * ~270 lignes) a une logique fine — session de comptage verrouillée par
 * cible, ajustement du stock à la validation, calcul du "stock attendu"
 * depuis les mouvements... La réimplémenter en local risquerait de diverger
 * silencieusement du backend. Avant ce fichier, AUCUNE route locale
 * n'existait pour /api/inventaires : la requête retombait sur la page 404
 * HTML par défaut d'Express, dont le <!DOCTYPE...> cassait le .json() du
 * frontend ("Unexpected token '<'... is not valid JSON") — d'où le bouton
 * "Inventaire" visiblement cassé sur desktop.
 *
 * Nécessite donc d'être en ligne. Limite connue (partagée avec
 * rafraichirSessionSyncEnArrierePlan côté auth.js) : relaie avec le token de
 * la session de SYNCHRO de ce poste (token-store.js), pas avec une identité
 * résolue par requête — sur un poste partagé par plusieurs comptes, ce
 * relais agit comme LE dernier compte à s'être connecté, pas forcément
 * l'appelant actuel. Acceptable ici : les inventaires sont une action
 * ponctuelle et délibérée (pas un flux automatique en arrière-plan), et ce
 * compromis est déjà celui du reste du moteur de synchro desktop.
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
        message: "Les inventaires nécessitent une connexion internet — fonctionnalité non disponible hors-ligne pour l'instant.",
      });
    }

    const session = lireSession();
    if (!session?.token) {
      return res.status(401).json({
        message: 'Connectez-vous au moins une fois en ligne avant d\'utiliser les inventaires.',
      });
    }

    const url = `${API_EN_LIGNE}/api/inventaires${req.url}`;
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
