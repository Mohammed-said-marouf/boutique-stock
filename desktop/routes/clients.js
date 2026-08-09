/**
 * Route "clients" du serveur local — équivalent de backend/routes/clients.js.
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
  `).run('clients', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    telephone: ligne.telephone,
    email: ligne.email,
    boutiqueId: ligne.boutique_id,
    achats: ligne.achats,
    total: ligne.total,
    createdAt: ligne.created_at,
    updatedAt: ligne.updated_at,
  };
}

// GET - Lister les clients (filtrable par boutiqueId)
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM clients WHERE is_deleted = 0';
    const params = [];
    if (req.query.boutiqueId) {
      sql += ' AND boutique_id = ?';
      params.push(req.query.boutiqueId);
    }
    sql += ' ORDER BY created_at DESC';

    const lignes = db.prepare(sql).all(...params);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un client
router.post('/', (req, res) => {
  try {
    const { nom, telephone, email, boutiqueId } = req.body;
    if (!nom || !boutiqueId) {
      return res.status(400).json({ message: 'nom et boutiqueId sont requis.' });
    }

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO clients (id, nom, telephone, email, boutique_id, achats, total, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @telephone, @email, @boutiqueId, 0, 0, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, nom,
      telephone: telephone || null,
      email: email || null,
      boutiqueId,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    const cree = versFormatApi(ligne);
    ajouterAOutbox('create', id, cree);

    res.status(201).json(cree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;