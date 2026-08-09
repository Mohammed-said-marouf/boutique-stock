/**
 * Route "icones" du serveur local — équivalent de backend/routes/icones.js.
 * Recherche par la clé texte "cle" (pas par id), comme corrigé côté backend.
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
  `).run('icones', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    cle: ligne.cle,
    valeur: ligne.valeur,
    categorie: ligne.categorie,
    description: ligne.description,
  };
}

// GET - Lister toutes les icônes
router.get('/', (req, res) => {
  try {
    const lignes = db.prepare('SELECT * FROM icones WHERE is_deleted = 0').all();
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT - Modifier une icône par sa clé texte (ex: "dashboard", "produits"...)
router.put('/:cle', (req, res) => {
  try {
    const { valeur } = req.body;
    if (!valeur) return res.status(400).json({ message: 'valeur est requise.' });

    const existante = db.prepare('SELECT * FROM icones WHERE cle = ?').get(req.params.cle);
    if (!existante) return res.status(404).json({ message: 'Icône introuvable.' });

    db.prepare('UPDATE icones SET valeur = ?, updated_at = ?, is_dirty = 1 WHERE cle = ?')
      .run(valeur, maintenant(), req.params.cle);

    const ligne = db.prepare('SELECT * FROM icones WHERE cle = ?').get(req.params.cle);
    ajouterAOutbox('update', ligne.id, versFormatApi(ligne));

    res.json(versFormatApi(ligne));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST - Créer une icône (utilisé surtout par le script d'initialisation)
router.post('/', (req, res) => {
  try {
    const { cle, valeur, categorie, description } = req.body;
    if (!cle || !valeur || !categorie) {
      return res.status(400).json({ message: 'cle, valeur et categorie sont requis.' });
    }

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO icones (id, cle, valeur, categorie, description, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @cle, @valeur, @categorie, @description, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, cle, valeur, categorie,
      description: description || null,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM icones WHERE id = ?').get(id);
    const cree = versFormatApi(ligne);
    ajouterAOutbox('create', id, cree);

    res.status(201).json(cree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;