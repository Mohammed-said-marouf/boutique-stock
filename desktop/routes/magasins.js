/**
 * Route "magasins" du serveur local — équivalent de backend/routes/magasins.js,
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
  `).run('magasins', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    boutiqueId: ligne.boutique_id,
    adresse: ligne.adresse || '',
    actif: !!ligne.actif,
    dateCreation: ligne.created_at,
  };
}

// GET - Lister les magasins du Compte de l'utilisateur connecté
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM magasins WHERE is_deleted = 0';
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

// POST - Créer un magasin
router.post('/', (req, res) => {
  try {
    const boutiqueId = (req.user && req.user.role === 'admin') ? req.user.boutiqueId : (req.body.boutiqueId || (req.user && req.user.boutiqueId));
    if (!boutiqueId) return res.status(400).json({ message: 'boutiqueId requis.' });
    if (!req.body.nom) return res.status(400).json({ message: 'nom requis.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO magasins (id, nom, boutique_id, adresse, actif, created_at, updated_at, is_dirty, is_deleted)
      VALUES (?, ?, ?, ?, 1, ?, ?, 1, 0)
    `).run(id, req.body.nom, boutiqueId, req.body.adresse || '', maintenantIso, maintenantIso);

    const ligne = db.prepare('SELECT * FROM magasins WHERE id = ?').get(id);
    const magasinCree = versFormatApi(ligne);
    ajouterAOutbox('create', id, magasinCree);
    res.status(201).json(magasinCree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un magasin (renommer, adresse, activer/désactiver)
router.put('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM magasins WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Magasin introuvable.' });

    db.prepare(`
      UPDATE magasins SET
        nom = @nom,
        adresse = @adresse,
        actif = @actif,
        updated_at = @updatedAt,
        is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id,
      nom: req.body.nom ?? existant.nom,
      adresse: req.body.adresse ?? existant.adresse,
      actif: req.body.actif !== undefined ? (req.body.actif ? 1 : 0) : existant.actif,
      updatedAt: maintenant(),
    });

    const ligne = db.prepare('SELECT * FROM magasins WHERE id = ?').get(req.params.id);
    const magasinModifie = versFormatApi(ligne);
    ajouterAOutbox('update', req.params.id, magasinModifie);
    res.json(magasinModifie);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un magasin — refusé s'il reste du stock dessus
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM magasins WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Magasin introuvable.' });

    const stockRestant = db.prepare(`
      SELECT p.nom FROM stock_magasins sm
      JOIN produits p ON p.id = sm.produit_id
      WHERE sm.magasin_id = ? AND sm.quantite > 0
      LIMIT 1
    `).get(req.params.id);

    if (stockRestant) {
      return res.status(400).json({
        message: `Impossible de supprimer : il reste du stock dans ce magasin (ex: "${stockRestant.nom}"). Transférez-le ou réaffectez-le d'abord.`
      });
    }

    db.prepare('UPDATE magasins SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);
    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: '✅ Magasin supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
