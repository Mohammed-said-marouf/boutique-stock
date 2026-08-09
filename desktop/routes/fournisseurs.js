/**
 * Route "fournisseurs" du serveur local — équivalent de backend/routes/fournisseurs.js.
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
  `).run('fournisseurs', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  const produitsLies = db.prepare('SELECT produit_id FROM fournisseur_produits WHERE fournisseur_id = ?').all(ligne.id);
  return {
    _id: ligne.id,
    nom: ligne.nom,
    telephone: ligne.telephone,
    email: ligne.email,
    adresse: ligne.adresse,
    produits: produitsLies.map(p => p.produit_id),
    dateAjout: ligne.date_ajout,
  };
}

// GET - Lister tous les fournisseurs
router.get('/', (req, res) => {
  try {
    const lignes = db.prepare('SELECT * FROM fournisseurs WHERE is_deleted = 0 ORDER BY date_ajout DESC').all();
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un fournisseur
router.post('/', (req, res) => {
  try {
    const { nom, telephone, email, adresse } = req.body;
    if (!nom) return res.status(400).json({ message: 'nom est requis.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO fournisseurs (id, nom, telephone, email, adresse, date_ajout, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @telephone, @email, @adresse, @dateAjout, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, nom,
      telephone: telephone || null,
      email: email || null,
      adresse: adresse || null,
      dateAjout: maintenantIso,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM fournisseurs WHERE id = ?').get(id);
    const cree = versFormatApi(ligne);
    ajouterAOutbox('create', id, cree);

    res.status(201).json(cree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un fournisseur (suppression douce)
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM fournisseurs WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Fournisseur introuvable.' });

    db.prepare('UPDATE fournisseurs SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);

    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: 'Fournisseur supprimé.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;