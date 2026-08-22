/**
 * Route "boutiques" du serveur local — équivalent de backend/routes/boutiques.js.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../local-db/db');
const { estEnLigne, API_EN_LIGNE } = require('../sync/connectivite');

const maintenant = () => new Date().toISOString();

function ajouterAOutbox(operation, recordId, payload) {
  db.prepare(`
    INSERT INTO sync_outbox (collection, operation, record_id, payload, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('boutiques', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    proprietaire: ligne.proprietaire,
    adresse: ligne.adresse,
    telephone: ligne.telephone,
    email: ligne.email,
    logo: ligne.logo,
    abonnement: ligne.abonnement,
    actif: !!ligne.actif,
    createdAt: ligne.created_at,
    updatedAt: ligne.updated_at,
  };
}

// GET - Lister toutes les boutiques
router.get('/', (req, res) => {
  try {
    const lignes = db.prepare('SELECT * FROM boutiques WHERE is_deleted = 0 ORDER BY created_at DESC').all();
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Inscription libre (comme sur le web) : crée une TOUTE NOUVELLE
// boutique + son compte admin. Contrairement à la connexion (qui peut
// fonctionner hors-ligne une fois le compte déjà connu localement), créer
// une nouvelle boutique n'a de sens que si elle existe réellement sur le
// serveur central — donc on relaie directement vers l'API en ligne, sans
// rien recréer en local. Une fois inscrit, l'utilisateur pourra se
// connecter normalement (auth.js créera alors le compte en local).
router.post('/inscription', async (req, res) => {
  try {
    const enLigne = await estEnLigne();
    if (!enLigne) {
      return res.status(503).json({
        message: 'Une connexion internet est nécessaire pour créer une nouvelle boutique.',
      });
    }

    const reponse = await fetch(`${API_EN_LIGNE}/api/boutiques/inscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const donnees = await reponse.json();
    res.status(reponse.status).json(donnees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - Une boutique par id
router.get('/:id', (req, res) => {
  try {
    const ligne = db.prepare('SELECT * FROM boutiques WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!ligne) return res.status(404).json({ message: 'Boutique introuvable.' });
    res.json(versFormatApi(ligne));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer une boutique
router.post('/', (req, res) => {
  try {
    const { nom, proprietaire, adresse, telephone, email, logo, abonnement } = req.body;
    if (!nom) return res.status(400).json({ message: 'nom est requis.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO boutiques (id, nom, proprietaire, adresse, telephone, email, logo, abonnement, actif, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @proprietaire, @adresse, @telephone, @email, @logo, @abonnement, 1, @createdAt, @updatedAt, 1, 0)
    `).run({
      id,
      nom,
      proprietaire: proprietaire || null,
      adresse: adresse || null,
      telephone: telephone || null,
      email: email || null,
      logo: logo || null,
      abonnement: abonnement || 'gratuit',
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM boutiques WHERE id = ?').get(id);
    const creee = versFormatApi(ligne);
    ajouterAOutbox('create', id, creee);

    res.status(201).json(creee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier une boutique
router.put('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM boutiques WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Boutique introuvable.' });

    const { nom, adresse, telephone, email, logo, abonnement, actif } = req.body;
    const maintenantIso = maintenant();

    db.prepare(`
      UPDATE boutiques SET
        nom = @nom, adresse = @adresse, telephone = @telephone, email = @email,
        logo = @logo, abonnement = @abonnement, actif = @actif,
        updated_at = @updatedAt, is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id,
      nom: nom ?? existant.nom,
      adresse: adresse ?? existant.adresse,
      telephone: telephone ?? existant.telephone,
      email: email ?? existant.email,
      logo: logo ?? existant.logo,
      abonnement: abonnement ?? existant.abonnement,
      actif: actif !== undefined ? (actif ? 1 : 0) : existant.actif,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM boutiques WHERE id = ?').get(req.params.id);
    const modifiee = versFormatApi(ligne);
    ajouterAOutbox('update', req.params.id, modifiee);

    res.json(modifiee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;