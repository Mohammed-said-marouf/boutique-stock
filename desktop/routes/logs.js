/**
 * Route "logs" du serveur local — équivalent de backend/routes/logs.js.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../local-db/db');

const maintenant = () => new Date().toISOString();

function ajouterAOutbox(operation, recordId, payload) {
  db.prepare(`
    INSERT INTO sync_outbox (collection, operation, record_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('logs', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    type: ligne.type,
    message: ligne.message,
    utilisateur: ligne.utilisateur,
    nomUtilisateur: ligne.nom_utilisateur,
    niveau: ligne.niveau,
    createdAt: ligne.created_at,
  };
}

// GET - Lister les logs (les plus récents en premier)
router.get('/', (req, res) => {
  try {
    const limite = req.query.limite ? Number(req.query.limite) : 200;
    const lignes = db.prepare('SELECT * FROM logs WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ?').all(limite);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer un log (utilisé en interne par les autres routes, mais exposé aussi via l'API)
router.post('/', (req, res) => {
  try {
    const { type, message, utilisateur, nomUtilisateur, niveau } = req.body;
    if (!type || !message) return res.status(400).json({ message: 'type et message sont requis.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO logs (id, type, message, utilisateur, nom_utilisateur, niveau, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @type, @message, @utilisateur, @nomUtilisateur, @niveau, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, type, message,
      utilisateur: utilisateur || null,
      nomUtilisateur: nomUtilisateur || 'Inconnu',
      niveau: niveau || 'info',
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
    const cree = versFormatApi(ligne);
    ajouterAOutbox('create', id, cree);

    res.status(201).json(cree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Fonction utilitaire exportée, pour que les autres routes du serveur local
// (produits, ventes...) puissent enregistrer un log directement, sans passer par HTTP.
function enregistrerLog({ type, message, utilisateur, nomUtilisateur, niveau }) {
  const id = crypto.randomUUID();
  const maintenantIso = maintenant();
  db.prepare(`
    INSERT INTO logs (id, type, message, utilisateur, nom_utilisateur, niveau, created_at, updated_at, is_dirty, is_deleted)
    VALUES (@id, @type, @message, @utilisateur, @nomUtilisateur, @niveau, @createdAt, @updatedAt, 1, 0)
  `).run({
    id, type, message,
    utilisateur: utilisateur || null,
    nomUtilisateur: nomUtilisateur || 'Inconnu',
    niveau: niveau || 'info',
    createdAt: maintenantIso,
    updatedAt: maintenantIso,
  });
  ajouterAOutbox('create', id, null);
}

module.exports = router;
module.exports.enregistrerLog = enregistrerLog;