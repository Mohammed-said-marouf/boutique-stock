/**
 * Route "users" du serveur local — équivalent de backend/routes/users.js.
 * Le mot de passe est haché avec bcryptjs avant stockage, jamais renvoyé en clair.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../local-db/db');

const maintenant = () => new Date().toISOString();

function ajouterAOutbox(operation, recordId, payload) {
  db.prepare(`
    INSERT INTO sync_outbox (collection, operation, record_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('users', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

// Ne renvoie jamais le mot de passe haché au frontend.
function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    email: ligne.email,
    role: ligne.role,
    boutiqueId: ligne.boutique_id,
    actif: !!ligne.actif,
    createdAt: ligne.created_at,
    updatedAt: ligne.updated_at,
  };
}

// GET - Lister les utilisateurs (filtrable par boutiqueId)
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM users WHERE is_deleted = 0';
    const params = [];
    // Un admin ne voit que les vendeurs de sa propre boutique — comme le
    // fait déjà le backend en ligne. Un superadmin (ou un appel sans
    // token identifiable) voit tout, avec le filtre optionnel existant.
    if (req.user && req.user.role === 'admin' && req.user.boutiqueId) {
      sql += ' AND boutique_id = ? AND role = ?';
      params.push(req.user.boutiqueId, 'vendeur');
    } else if (req.query.boutiqueId) {
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

// POST - Créer un utilisateur
router.post('/', async (req, res) => {
  try {
    const { nom, email, motDePasse, role, boutiqueId } = req.body;
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ message: 'nom, email et motDePasse sont requis.' });
    }

    const existant = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existant) return res.status(400).json({ message: 'Cet email est déjà utilisé.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();
    const motDePasseHache = await bcrypt.hash(motDePasse, 10);

    db.prepare(`
      INSERT INTO users (id, nom, email, mot_de_passe, role, boutique_id, actif, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @email, @motDePasse, @role, @boutiqueId, 1, @createdAt, @updatedAt, 1, 0)
    `).run({
      id, nom, email,
      motDePasse: motDePasseHache,
      role: role || 'vendeur',
      boutiqueId: boutiqueId || null,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    const cree = versFormatApi(ligne);
    // Note : le mot de passe haché n'est jamais mis dans l'outbox en clair,
    // mais le hash lui-même peut être poussé tel quel (il ne révèle pas le mot de passe).
    ajouterAOutbox('create', id, { ...cree, motDePasse: motDePasseHache });

    res.status(201).json(cree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Activer/désactiver un utilisateur
router.put('/:id/statut', (req, res) => {
  try {
    const { actif } = req.body;
    const existant = db.prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    db.prepare('UPDATE users SET actif = ?, updated_at = ?, is_dirty = 1 WHERE id = ?')
      .run(actif ? 1 : 0, maintenant(), req.params.id);

    const ligne = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    ajouterAOutbox('update', req.params.id, null);

    res.json(versFormatApi(ligne));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un utilisateur (suppression douce)
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    db.prepare('UPDATE users SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);

    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: 'Utilisateur supprimé.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;