/**
 * Route "boutiques" du serveur local — équivalent de backend/routes/boutiques.js.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { app: electronApp } = require('electron');
const db = require('../local-db/db');
const { estEnLigne, API_EN_LIGNE } = require('../sync/connectivite');

const maintenant = () => new Date().toISOString();

// Stockage du logo sur le disque local (dossier userData d'Electron), comme
// pour les images de produits (routes/produits.js) — PUT /:id est appelé en
// multipart/form-data pour changer le logo (AdminLayout.js, enregistrerLogo),
// et en JSON classique pour le reste des infos (enregistrerBoutique) :
// multer ignore les requêtes non-multipart et laisse passer le req.body déjà
// parsé par express.json(), donc une seule route gère les deux cas.
const DOSSIER_UPLOADS = path.join(electronApp.getPath('userData'), 'uploads', 'boutiques');
fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true });

const stockage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOSSIER_UPLOADS),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '';
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});
const upload = multer({ storage: stockage });

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
    niu: ligne.niu || '',
    activite: ligne.activite || '',
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
    const { nom, proprietaire, adresse, telephone, email, logo, niu, activite, abonnement } = req.body;
    if (!nom) return res.status(400).json({ message: 'nom est requis.' });

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO boutiques (id, nom, proprietaire, adresse, telephone, email, logo, niu, activite, abonnement, actif, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @proprietaire, @adresse, @telephone, @email, @logo, @niu, @activite, @abonnement, 1, @createdAt, @updatedAt, 1, 0)
    `).run({
      id,
      nom,
      proprietaire: proprietaire || null,
      adresse: adresse || null,
      telephone: telephone || null,
      email: email || null,
      logo: logo || null,
      niu: niu || '',
      activite: activite || '',
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

// PUT - Modifier une boutique (multipart/form-data, champ fichier "logo"
// optionnel — si absent, le logo existant est conservé)
router.put('/:id', upload.single('logo'), (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM boutiques WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Boutique introuvable.' });

    const { nom, adresse, telephone, email, niu, activite, abonnement, actif } = req.body;
    const maintenantIso = maintenant();

    let cheminLogo = existant.logo;
    if (req.file) {
      cheminLogo = `/uploads/boutiques/${req.file.filename}`;
      // Nettoyage : supprime l'ancien fichier logo local s'il y en avait un,
      // pour ne pas accumuler des fichiers orphelins sur le disque (même
      // logique que pour les images de produits — voir routes/produits.js).
      if (existant.logo && existant.logo.startsWith('/uploads/')) {
        const ancienChemin = path.join(electronApp.getPath('userData'), existant.logo);
        fs.unlink(ancienChemin, () => {}); // best-effort, on ignore l'erreur si le fichier n'existe déjà plus
      }
    }

    db.prepare(`
      UPDATE boutiques SET
        nom = @nom, adresse = @adresse, telephone = @telephone, email = @email,
        logo = @logo, niu = @niu, activite = @activite, abonnement = @abonnement, actif = @actif,
        updated_at = @updatedAt, is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id,
      nom: nom ?? existant.nom,
      adresse: adresse ?? existant.adresse,
      telephone: telephone ?? existant.telephone,
      email: email ?? existant.email,
      logo: cheminLogo,
      niu: niu ?? existant.niu,
      activite: activite ?? existant.activite,
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