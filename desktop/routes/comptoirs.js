/**
 * Route "comptoirs" du serveur local — équivalent de backend/routes/comptoirs.js,
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
  `).run('comptoirs', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    boutiqueId: ligne.boutique_id,
    actif: !!ligne.actif,
    dateCreation: ligne.created_at,
  };
}

// GET - Lister les comptoirs de la boutique de l'utilisateur connecté
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM comptoirs WHERE is_deleted = 0';
    const params = [];
    if (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId) {
      sql += ' AND boutique_id = ?';
      params.push(req.user.boutiqueId);
    }
    sql += ' ORDER BY created_at ASC';
    const lignes = db.prepare(sql).all(...params);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un comptoir
router.post('/', (req, res) => {
  try {
    const boutiqueId = (req.user && req.user.role === 'admin') ? req.user.boutiqueId : (req.body.boutiqueId || (req.user && req.user.boutiqueId));
    if (!boutiqueId) return res.status(400).json({ message: 'boutiqueId requis.' });
    if (!req.body.nom) return res.status(400).json({ message: 'nom requis.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO comptoirs (id, nom, boutique_id, actif, created_at, updated_at, is_dirty, is_deleted)
      VALUES (?, ?, ?, 1, ?, ?, 1, 0)
    `).run(id, req.body.nom, boutiqueId, maintenantIso, maintenantIso);

    const ligne = db.prepare('SELECT * FROM comptoirs WHERE id = ?').get(id);
    const comptoirCree = versFormatApi(ligne);
    ajouterAOutbox('create', id, comptoirCree);
    res.status(201).json(comptoirCree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un comptoir (renommer, activer/désactiver)
router.put('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM comptoirs WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Comptoir introuvable.' });

    db.prepare(`
      UPDATE comptoirs SET
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

    const ligne = db.prepare('SELECT * FROM comptoirs WHERE id = ?').get(req.params.id);
    const comptoirModifie = versFormatApi(ligne);
    ajouterAOutbox('update', req.params.id, comptoirModifie);
    res.json(comptoirModifie);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un comptoir — refusé s'il reste du stock dessus
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM comptoirs WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Comptoir introuvable.' });

    const stockRestant = db.prepare(`
      SELECT p.nom FROM stock_comptoirs sc
      JOIN produits p ON p.id = sc.produit_id
      WHERE sc.comptoir_id = ? AND sc.quantite > 0
      LIMIT 1
    `).get(req.params.id);

    if (stockRestant) {
      return res.status(400).json({
        message: `Impossible de supprimer : il reste du stock sur ce comptoir (ex: "${stockRestant.nom}"). Transférez-le d'abord ailleurs.`
      });
    }

    db.prepare('UPDATE comptoirs SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);
    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: '✅ Comptoir supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;