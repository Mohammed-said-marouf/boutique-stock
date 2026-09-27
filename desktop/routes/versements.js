/**
 * Route "versements" du serveur local — équivalent de backend/routes/versements.js
 * (sans la notification par email, non pertinente hors-ligne).
 *
 * Circuit d'un versement : le vendeur le déclare ("en_attente"), puis l'admin
 * confirme l'avoir reçu ("valide") ou le rejette ("refuse"). Seuls les
 * versements validés réduisent le solde de la caisse (routes/tresorerie.js).
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
  `).run('versements', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    montant: ligne.montant,
    note: ligne.note || '',
    statut: ligne.statut,
    decidePar: ligne.decide_par,
    nomDecidePar: ligne.nom_decide_par || '',
    dateDecision: ligne.date_decision,
    motifRefus: ligne.motif_refus || '',
    boutiqueId: ligne.boutique_id,
    comptoirId: ligne.comptoir_id,
    caisseId: ligne.caisse_id,
    auteur: ligne.auteur,
    nomAuteur: ligne.nom_auteur || '',
    date: ligne.date,
  };
}

// GET - Lister les versements (vendeur : les siens ; admin : tout son Compte)
router.get('/', (req, res) => {
  try {
    const { clauses, params } = filtreLecture(req);
    if (req.query.caisseId) { clauses.push('caisse_id = @caisseId'); params.caisseId = req.query.caisseId; }
    let sql = 'SELECT * FROM versements WHERE is_deleted = 0';
    if (clauses.length) sql += ' AND ' + clauses.join(' AND ');
    sql += ' ORDER BY date DESC LIMIT 300';
    const lignes = db.prepare(sql).all(params);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /en-attente/nombre - Nombre de versements à approuver
router.get('/en-attente/nombre', (req, res) => {
  try {
    let sql = "SELECT COUNT(*) AS n FROM versements WHERE is_deleted = 0 AND statut = 'en_attente'";
    const params = {};
    if (req.user?.role !== 'superadmin') {
      sql += ' AND boutique_id = @boutiqueId';
      params.boutiqueId = req.user?.boutiqueId;
    }
    res.json({ nombre: db.prepare(sql).get(params).n });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Déclarer un versement (vendeur uniquement)
router.post('/', (req, res) => {
  try {
    if (req.user?.role !== 'vendeur') return res.status(403).json({ message: 'Accès refusé.' });
    const montant = Number(req.body.montant);
    if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });

    const r = resoudreCaisse(req, req.body);
    if (r.erreur) return res.status(r.statut).json({ message: r.erreur });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    // Le statut n'est jamais lu depuis le body : un vendeur ne peut pas
    // s'auto-valider un versement.
    db.prepare(`
      INSERT INTO versements (id, montant, note, statut, boutique_id, comptoir_id, caisse_id, auteur, nom_auteur, date, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @montant, @note, 'en_attente', @boutiqueId, @comptoirId, @caisseId, @auteur, @nomAuteur, @date, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, montant,
      note: req.body.note || '',
      boutiqueId: r.comptoir.boutique_id,
      comptoirId: r.comptoir.id,
      caisseId: r.caisse.id,
      auteur: req.user?.id || null,
      nomAuteur: req.user?.nom || '',
      date: maintenantIso,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM versements WHERE id = ?').get(id);
    const versementCree = versFormatApi(ligne);
    ajouterAOutbox('create', id, versementCree);
    res.status(201).json(versementCree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Décision de l'admin sur un versement en attente.
function decider(req, res, statut, motifRefus) {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    let sql = "SELECT * FROM versements WHERE id = ? AND is_deleted = 0 AND statut = 'en_attente'";
    const existant = db.prepare(sql).get(req.params.id);
    if (!existant) return res.status(409).json({ message: 'Versement introuvable ou déjà traité.' });
    if (req.user.role !== 'superadmin' && existant.boutique_id !== req.user.boutiqueId) {
      return res.status(409).json({ message: 'Versement introuvable ou déjà traité.' });
    }

    const maintenantIso = maintenant();
    db.prepare(`
      UPDATE versements SET statut = @statut, motif_refus = @motifRefus, decide_par = @decidePar,
        nom_decide_par = @nomDecidePar, date_decision = @dateDecision, updated_at = @updatedAt, is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id, statut,
      motifRefus: motifRefus || '',
      decidePar: req.user.id,
      nomDecidePar: req.user.nom || '',
      dateDecision: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM versements WHERE id = ?').get(req.params.id);
    const versementDecide = versFormatApi(ligne);
    // Poussé via une entrée dédiée : la route en ligne correspondante
    // (PUT /:id/valider ou /refuser) n'attend pas un objet versement complet.
    db.prepare(`
      INSERT INTO sync_outbox (collection, operation, record_id, payload, created_at)
      VALUES ('decisions_versement', 'update', ?, ?, ?)
    `).run(req.params.id, JSON.stringify({ statut, motifRefus: motifRefus || '' }), maintenantIso);

    res.json(versementDecide);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

// PUT - Approuver un versement
router.put('/:id/valider', (req, res) => decider(req, res, 'valide'));

// PUT - Refuser un versement (motif facultatif)
router.put('/:id/refuser', (req, res) => decider(req, res, 'refuse', String(req.body.motif || '').slice(0, 300)));

// PUT - Corriger un versement (admin/superadmin) : montant, note
router.put('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM versements WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Versement introuvable.' });
    if (req.user?.role === 'admin' && existant.boutique_id !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    let montant = existant.montant;
    if (req.body.montant !== undefined) {
      montant = Number(req.body.montant);
      if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide.' });
    }

    db.prepare(`
      UPDATE versements SET montant = @montant, note = @note, updated_at = @updatedAt, is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id, montant,
      note: req.body.note !== undefined ? req.body.note : existant.note,
      updatedAt: maintenant(),
    });

    const ligne = db.prepare('SELECT * FROM versements WHERE id = ?').get(req.params.id);
    const versementModifie = versFormatApi(ligne);
    ajouterAOutbox('update', req.params.id, versementModifie);
    res.json(versementModifie);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un versement (admin/superadmin)
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM versements WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Versement introuvable.' });
    if (req.user?.role === 'admin' && existant.boutique_id !== req.user.boutiqueId) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    db.prepare('UPDATE versements SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);
    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: '✅ Versement supprimé' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
