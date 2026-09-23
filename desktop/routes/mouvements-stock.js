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
    // Même logique que ventes.js / produits.js : priorité au token pour
    // un admin/vendeur, sinon on retombe sur le filtre optionnel
    // ?boutiqueId= déjà existant.
    const boutiqueFiltre = (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId)
      ? req.user.boutiqueId
      : req.query.boutiqueId;

    let sql = 'SELECT * FROM mouvements_stock WHERE is_deleted = 0';
    const params = [];
    if (boutiqueFiltre) {
      sql += ' AND boutique_id = ?';
      params.push(boutiqueFiltre);
    }
    sql += ' ORDER BY created_at DESC';

    const lignes = db.prepare(sql).all(...params);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un mouvement de stock (entrée ou sortie) sur le stock d'UN
// MAGASIN précis (un Compte peut en avoir plusieurs) — même contrat que le
// backend en ligne (backend/routes/mouvements.js).
router.post('/', (req, res) => {
  const transaction = db.transaction((body) => {
    const { produit, magasinId, boutiqueId, type, quantite, note } = body;

    if (!produit || !magasinId || !boutiqueId || !type || quantite === undefined) {
      throw new Error('produit, magasinId, boutiqueId, type et quantite sont requis.');
    }

    const produitExistant = db.prepare('SELECT * FROM produits WHERE id = ? AND is_deleted = 0').get(produit);
    if (!produitExistant) throw new Error('Produit introuvable.');

    const qte = Number(quantite);
    const ligneMagasin = db.prepare('SELECT quantite FROM stock_magasins WHERE produit_id = ? AND magasin_id = ?').get(produit, magasinId);
    const stockActuelMagasin = ligneMagasin ? ligneMagasin.quantite : 0;
    const nouveauStockMagasin = type === 'entree' ? stockActuelMagasin + qte : stockActuelMagasin - qte;
    if (nouveauStockMagasin < 0) throw new Error('Stock insuffisant dans ce magasin pour cette sortie.');

    const maintenantIso = maintenant();
    const id = crypto.randomUUID();

    if (ligneMagasin) {
      db.prepare('UPDATE stock_magasins SET quantite = ?, updated_at = ? WHERE produit_id = ? AND magasin_id = ?')
        .run(nouveauStockMagasin, maintenantIso, produit, magasinId);
    } else {
      db.prepare('INSERT INTO stock_magasins (produit_id, magasin_id, quantite, updated_at) VALUES (?, ?, ?, ?)')
        .run(produit, magasinId, nouveauStockMagasin, maintenantIso);
    }

    const totalMagasins = db.prepare('SELECT COALESCE(SUM(quantite),0) AS total FROM stock_magasins WHERE produit_id = ?').get(produit).total;

    db.prepare(`
      INSERT INTO mouvements_stock (id, produit, boutique_id, type, quantite, stock_restant, magasin_id, note, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @produit, @boutiqueId, @type, @quantite, @stockRestant, @magasinId, @note, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, produit, boutiqueId, type, magasinId,
      quantite: qte,
      stockRestant: nouveauStockMagasin,
      note: note || '',
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    db.prepare('UPDATE produits SET quantite = ?, updated_at = ?, is_dirty = 1 WHERE id = ?')
      .run(totalMagasins, maintenantIso, produit);

    // Un seul outbox pour ce mouvement, qui sera rejoué contre la VRAIE
    // route /api/mouvements-stock en ligne (voir sync/push.js) — celle-ci
    // recalcule elle-même produit.quantite à partir de stockMagasins côté
    // serveur. On ne pousse PAS en plus une mise à jour brute du produit
    // avec son total local : ça écraserait le total en ligne (qui peut
    // inclure d'autres magasins inconnus ici) au lieu de le recalculer
    // correctement à partir du mouvement lui-même.
    ajouterAOutbox('mouvements_stock', 'create', id, {
      produit,
      boutiqueId,
      magasinId,
      type,
      quantite: qte,
      note: note || '',
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