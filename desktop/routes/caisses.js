/**
 * Route "caisses" du serveur local — équivalent de backend/routes/caisses.js,
 * mais lit et écrit dans SQLite au lieu de MongoDB. Chaque écriture est aussi
 * enregistrée dans sync_outbox pour remonter vers le serveur en ligne.
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
  `).run('caisses', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    comptoirId: ligne.comptoir_id,
    actif: !!ligne.actif,
    dateCreation: ligne.created_at,
  };
}

// GET - Lister les caisses (filtrable par ?comptoirId=, sinon toutes les
// caisses des boutiques du Compte de l'utilisateur)
router.get('/', (req, res) => {
  try {
    let sql = `
      SELECT ca.* FROM caisses ca
      JOIN comptoirs co ON co.id = ca.comptoir_id
      WHERE ca.is_deleted = 0
    `;
    const params = [];
    if (req.query.comptoirId) {
      sql += ' AND ca.comptoir_id = ?';
      params.push(req.query.comptoirId);
    } else if (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId) {
      sql += ' AND co.boutique_id = ?';
      params.push(req.user.boutiqueId);
    }
    sql += ' ORDER BY ca.created_at ASC';
    const lignes = db.prepare(sql).all(...params);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer une caisse dans une boutique
router.post('/', (req, res) => {
  try {
    if (!req.body.comptoirId) return res.status(400).json({ message: 'comptoirId requis.' });
    if (!req.body.nom) return res.status(400).json({ message: 'nom requis.' });

    const comptoir = db.prepare('SELECT id FROM comptoirs WHERE id = ? AND is_deleted = 0').get(req.body.comptoirId);
    if (!comptoir) return res.status(404).json({ message: 'Boutique introuvable.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO caisses (id, nom, comptoir_id, actif, created_at, updated_at, is_dirty, is_deleted)
      VALUES (?, ?, ?, 1, ?, ?, 1, 0)
    `).run(id, req.body.nom, req.body.comptoirId, maintenantIso, maintenantIso);

    const ligne = db.prepare('SELECT * FROM caisses WHERE id = ?').get(id);
    const caisseCreee = versFormatApi(ligne);
    ajouterAOutbox('create', id, caisseCreee);
    res.status(201).json(caisseCreee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier une caisse (renommer, activer/désactiver)
router.put('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM caisses WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Caisse introuvable.' });

    db.prepare(`
      UPDATE caisses SET
        nom = @nom,
        actif = @actif,
        updated_at = @updatedAt,
        is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id,
      nom: req.body.nom ?? existant.nom,
      actif: req.body.actif !== undefined ? (req.body.actif ? 1 : 0) : existant.actif,
      updatedAt: maintenant(),
    });

    const ligne = db.prepare('SELECT * FROM caisses WHERE id = ?').get(req.params.id);
    const caisseModifiee = versFormatApi(ligne);
    ajouterAOutbox('update', req.params.id, caisseModifiee);
    res.json(caisseModifiee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer une caisse (elle ne porte aucun stock)
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM caisses WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Caisse introuvable.' });

    db.prepare('UPDATE caisses SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);
    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: '✅ Caisse supprimée' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
