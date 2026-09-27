/**
 * Route "depenses" du serveur local — équivalent de backend/routes/depenses.js.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../local-db/db');
const { resoudreCaisse, filtreLecture } = require('../utils/tresorerie');

const maintenant = () => new Date().toISOString();

function ajouterAOutbox(operation, recordId, payload) {
  db.prepare(`
    INSERT INTO sync_outbox (collection, operation, record_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('depenses', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    montant: ligne.montant,
    motif: ligne.motif,
    note: ligne.note || '',
    boutiqueId: ligne.boutique_id,
    comptoirId: ligne.comptoir_id,
    caisseId: ligne.caisse_id,
    auteur: ligne.auteur,
    nomAuteur: ligne.nom_auteur || '',
    roleAuteur: ligne.role_auteur || '',
    date: ligne.date,
  };
}

// GET - Lister les dépenses (vendeur : les siennes ; admin : tout son Compte)
router.get('/', (req, res) => {
  try {
    const { clauses, params } = filtreLecture(req);
    if (req.query.caisseId) { clauses.push('caisse_id = @caisseId'); params.caisseId = req.query.caisseId; }
    let sql = 'SELECT * FROM depenses WHERE is_deleted = 0';
    if (clauses.length) sql += ' AND ' + clauses.join(' AND ');
    sql += ' ORDER BY date DESC LIMIT 300';
    const lignes = db.prepare(sql).all(params);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer une dépense (vendeur, admin, superadmin)
router.post('/', (req, res) => {
  try {
    const montant = Number(req.body.montant);
    const motif = (req.body.motif || '').trim();
    if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });
    if (!motif) return res.status(400).json({ message: 'Le motif est requis.' });

    const r = resoudreCaisse(req, req.body);
    if (r.erreur) return res.status(r.statut).json({ message: r.erreur });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO depenses (id, montant, motif, note, boutique_id, comptoir_id, caisse_id, auteur, nom_auteur, role_auteur, date, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @montant, @motif, @note, @boutiqueId, @comptoirId, @caisseId, @auteur, @nomAuteur, @roleAuteur, @date, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, montant, motif,
      note: req.body.note || '',
      boutiqueId: r.comptoir.boutique_id,
      comptoirId: r.comptoir.id,
      caisseId: r.caisse.id,
      auteur: req.user?.id || null,
      nomAuteur: req.user?.nom || '',
      roleAuteur: req.user?.role || '',
      date: maintenantIso,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM depenses WHERE id = ?').get(id);
    const depenseCreee = versFormatApi(ligne);
    ajouterAOutbox('create', id, depenseCreee);
    res.status(201).json(depenseCreee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Corriger une dépense (admin/superadmin) : montant, motif, note
router.put('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM depenses WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Dépense introuvable.' });
    if (req.user?.role === 'admin' && existant.boutique_id !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    let montant = existant.montant;
    if (req.body.montant !== undefined) {
      montant = Number(req.body.montant);
      if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });
    }
    let motif = existant.motif;
    if (req.body.motif !== undefined) {
      motif = String(req.body.motif).trim();
      if (!motif) return res.status(400).json({ message: 'Le motif est requis.' });
    }

    db.prepare(`
      UPDATE depenses SET montant = @montant, motif = @motif, note = @note, updated_at = @updatedAt, is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id, montant, motif,
      note: req.body.note !== undefined ? req.body.note : existant.note,
      updatedAt: maintenant(),
    });

    const ligne = db.prepare('SELECT * FROM depenses WHERE id = ?').get(req.params.id);
    const depenseModifiee = versFormatApi(ligne);
    ajouterAOutbox('update', req.params.id, depenseModifiee);
    res.json(depenseModifiee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer une dépense (admin/superadmin)
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM depenses WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Dépense introuvable.' });
    if (req.user?.role === 'admin' && existant.boutique_id !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    db.prepare('UPDATE depenses SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);
    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: '✅ Dépense supprimée' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
