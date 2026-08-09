/**
 * Route "mouvements-stock" du serveur local — équivalent de backend/routes/mouvements.js.
 * Chaque mouvement (entrée/sortie) met aussi à jour le stock du produit concerné.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../local-db/db');

const maintenant = () => new Date().toISOString();

function ajouterAOutbox(collection, operation, recordId, payload) {
  db.prepare(`
    INSERT INTO sync_outbox (collection, operation, record_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(collection, operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  const produit = db.prepare('SELECT id, nom FROM produits WHERE id = ?').get(ligne.produit);
  return {
    _id: ligne.id,
    produit: produit ? { _id: produit.id, nom: produit.nom } : ligne.produit,
    boutiqueId: ligne.boutique_id,
    type: ligne.type,
    quantite: ligne.quantite,
    stockRestant: ligne.stock_restant,
    note: ligne.note,
    createdAt: ligne.created_at,
  };
}

// GET - Lister les mouvements (filtrable par boutiqueId)
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM mouvements_stock WHERE is_deleted = 0';
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

// POST - Créer un mouvement de stock (entrée ou sortie)
router.post('/', (req, res) => {
  const transaction = db.transaction((body) => {
    const { produit, boutiqueId, type, quantite, note } = body;

    if (!produit || !boutiqueId || !type || quantite === undefined) {
      throw new Error('produit, boutiqueId, type et quantite sont requis.');
    }

    const produitExistant = db.prepare('SELECT * FROM produits WHERE id = ? AND is_deleted = 0').get(produit);
    if (!produitExistant) throw new Error('Produit introuvable.');

    const nouveauStock = type === 'entree'
      ? produitExistant.quantite + Number(quantite)
      : produitExistant.quantite - Number(quantite);

    const maintenantIso = maintenant();
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO mouvements_stock (id, produit, boutique_id, type, quantite, stock_restant, note, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @produit, @boutiqueId, @type, @quantite, @stockRestant, @note, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, produit, boutiqueId, type,
      quantite: Number(quantite),
      stockRestant: nouveauStock,
      note: note || '',
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    db.prepare('UPDATE produits SET quantite = ?, updated_at = ?, is_dirty = 1 WHERE id = ?')
      .run(nouveauStock, maintenantIso, produit);

    // Payload rempli avec les données du mouvement (avant : envoyé à `null`,
    // ce qui provoquait un body vide côté push et une erreur HTTP 400
    // sur le backend en ligne, faute de produit/boutiqueId/type/quantite).
    ajouterAOutbox('mouvements_stock', 'create', id, {
      produit,
      boutiqueId,
      type,
      quantite: Number(quantite),
      note: note || '',
    });

    // Idem pour la mise à jour du stock produit associée : payload rempli
    // au lieu de `null`, pour quand cette collection sera prise en charge
    // dans sync/push.js.
    ajouterAOutbox('produits', 'update', produit, {
      quantite: nouveauStock,
    });

    return id;
  });

  try {
    const id = transaction(req.body);
    const ligne = db.prepare('SELECT * FROM mouvements_stock WHERE id = ?').get(id);
    res.status(201).json(versFormatApi(ligne));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;