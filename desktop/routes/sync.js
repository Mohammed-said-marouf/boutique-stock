/**
 * Route "sync" du serveur local — expose l'état de connectivité, la
 * connexion desktop, le push (local -> en ligne) et le pull (en ligne ->
 * local).
 */

const express = require('express');
const router = express.Router();
const { estEnLigne, API_EN_LIGNE } = require('../sync/connectivite');
const { enregistrerSession, lireSession, effacerSession } = require('../sync/token-store');
const { pousserOutbox } = require('../sync/push');
const { tirerTout } = require('../sync/pull');
const db = require('../local-db/db');

// GET - Vérifie si le serveur en ligne est joignable
router.get('/statut', async (req, res) => {
  const enLigne = await estEnLigne();
  const session = lireSession();
  res.json({
    enLigne,
    message: enLigne
      ? '✅ Connexion au serveur en ligne établie.'
      : '📡 Hors-ligne — le serveur en ligne n\'est pas joignable.',
    sessionActive: !!session,
    utilisateur: session?.user || null,
  });
});

// POST - Connexion : relaie les identifiants vers l'API en ligne, stocke le token reçu
router.post('/login', async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    if (!email || !motDePasse) {
      return res.status(400).json({ message: 'email et motDePasse sont requis.' });
    }

    const reponse = await fetch(`${API_EN_LIGNE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, motDePasse }),
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
      return res.status(reponse.status).json(donnees);
    }

    enregistrerSession(donnees); // { token, user }
    res.json(donnees);
  } catch (err) {
    res.status(503).json({ message: 'Impossible de joindre le serveur en ligne pour la connexion. ' + err.message });
  }
});

// GET - Consulter la session actuellement stockée (sans exposer le token en clair pour info seulement)
router.get('/session', (req, res) => {
  const session = lireSession();
  if (!session) return res.json({ connecte: false });
  res.json({
    connecte: true,
    user: session.user,
    enregistreLe: session.enregistreLe,
  });
});

// POST - Déconnexion locale (efface le token stocké)
router.post('/deconnexion', (req, res) => {
  effacerSession();
  res.json({ message: 'Session locale effacée.' });
});

// POST - Déclenche la synchronisation (push) de la file d'attente vers l'API en ligne
router.post('/push', async (req, res) => {
  try {
    const resultat = await pousserOutbox();
    res.json(resultat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Déclenche la récupération (pull) des données en ligne vers le local
router.post('/pull', async (req, res) => {
  try {
    const resultat = await tirerTout();
    res.json(resultat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - Diagnostic : liste le contenu de la file d'attente de synchronisation
router.get('/outbox', (req, res) => {
  try {
    const lignes = db.prepare('SELECT * FROM sync_outbox ORDER BY created_at DESC').all();
    res.json({
      total: lignes.length,
      en_attente: lignes.filter(l => l.synced === 0).length,
      deja_synchronise: lignes.filter(l => l.synced === 1).length,
      entrees: lignes,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE - Supprime une entrée précise de l'outbox (ex: donnée de test
// invalide qui ne pourra jamais réussir). À utiliser avec précaution — la
// suppression est définitive, l'entrée ne sera plus jamais rejouée.
router.delete('/outbox/:id', (req, res) => {
  try {
    const resultat = db.prepare('DELETE FROM sync_outbox WHERE id = ?').run(req.params.id);
    res.json({ supprimee: resultat.changes > 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;