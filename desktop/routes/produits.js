/**
 * Route "produits" du serveur local — équivalent de backend/routes/produits.js,
 * mais lit et écrit dans la base SQLite locale au lieu de MongoDB, et stocke
 * les images sur le disque local (dossier userData d'Electron) au lieu de
 * Cloudinary.
 *
 * Chaque écriture (création, modification, suppression) est aussi enregistrée
 * dans la table sync_outbox : c'est la file d'attente qui sera rejouée vers
 * le serveur en ligne dès que la connexion sera rétablie (Phase 3).
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { app: electronApp } = require('electron');
const db = require('../local-db/db');

const maintenant = () => new Date().toISOString();

// Dossier de stockage des images, à l'intérieur du dossier de données
// utilisateur d'Electron (même emplacement que la base SQLite locale).
const DOSSIER_UPLOADS = path.join(electronApp.getPath('userData'), 'uploads', 'produits');
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
  `).run('produits', operation, recordId, payload ? JSON.stringify(payload) : null, maintenant());
}

// Transforme une ligne SQLite (snake_case) vers le format attendu par le frontend (camelCase),
// identique à ce que renvoyait l'API MongoDB.
function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    description: ligne.description,
    prix: ligne.prix,
    quantite: ligne.quantite,
    categorie: ligne.categorie,
    fournisseur: ligne.fournisseur,
    boutiqueId: ligne.boutique_id,
    seuilAlerte: ligne.seuil_alerte,
    ref: ligne.ref,
    // "image" est un chemin relatif du type /uploads/produits/xxx.png,
    // servi statiquement par local-server.js — le frontend (resoudreImage)
    // le préfixe automatiquement avec API_URL, exactement comme il le fait
    // déjà pour les chemins relatifs renvoyés par le backend en ligne.
    image: ligne.image,
    dateAjout: ligne.date_ajout,
  };
}

// GET - Lister tous les produits (non supprimés)
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM produits WHERE is_deleted = 0';
    const params = [];
    // Un admin ou un vendeur ne voit que les produits de sa propre
    // boutique — comme le fait déjà le backend en ligne. Un superadmin
    // (ou un appel sans token identifiable, ex: nos scripts de test) voit
    // tout, sans filtre.
    if (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId) {
      sql += ' AND boutique_id = ?';
      params.push(req.user.boutiqueId);
    }
    sql += ' ORDER BY date_ajout DESC';
    const lignes = db.prepare(sql).all(...params);
    res.json(lignes.map(versFormatApi));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET - Un seul produit par id
router.get('/:id', (req, res) => {
  try {
    const ligne = db.prepare('SELECT * FROM produits WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!ligne) return res.status(404).json({ message: 'Produit introuvable.' });
    res.json(versFormatApi(ligne));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Créer un produit (multipart/form-data, champ fichier "image" optionnel)
router.post('/', upload.single('image'), (req, res) => {
  try {
    const { nom, description, prix, quantite, categorie, fournisseur, boutiqueId, seuilAlerte, ref } = req.body;

    if (!nom || prix === undefined || prix === '' || !categorie) {
      return res.status(400).json({ message: 'nom, prix et categorie sont requis.' });
    }

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();
    const cheminImage = req.file ? `/uploads/produits/${req.file.filename}` : null;

    db.prepare(`
      INSERT INTO produits (id, nom, description, prix, quantite, categorie, fournisseur, boutique_id, seuil_alerte, ref, image, date_ajout, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @description, @prix, @quantite, @categorie, @fournisseur, @boutiqueId, @seuilAlerte, @ref, @image, @dateAjout, @createdAt, @updatedAt, 1, 0)
    `).run({
      id,
      nom,
      description: description || null,
      prix: Number(prix),
      quantite: quantite !== undefined && quantite !== '' ? Number(quantite) : 0,
      categorie,
      fournisseur: fournisseur || null,
      boutiqueId: boutiqueId || null,
      seuilAlerte: seuilAlerte !== undefined && seuilAlerte !== '' ? Number(seuilAlerte) : 5,
      ref: ref || null,
      image: cheminImage,
      dateAjout: maintenantIso,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
    const produitCree = versFormatApi(ligne);

    ajouterAOutbox('create', id, produitCree);

    res.status(201).json(produitCree);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Modifier un produit (multipart/form-data, champ fichier "image" optionnel —
// si absent, l'image existante est conservée)
router.put('/:id', upload.single('image'), (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM produits WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Produit introuvable.' });

    const { nom, description, prix, quantite, categorie, fournisseur, boutiqueId, seuilAlerte, ref } = req.body;
    const maintenantIso = maintenant();

    let cheminImage = existant.image;
    if (req.file) {
      cheminImage = `/uploads/produits/${req.file.filename}`;
      // Nettoyage : supprime l'ancien fichier image local s'il y en avait un,
      // pour ne pas accumuler des fichiers orphelins sur le disque.
      if (existant.image && existant.image.startsWith('/uploads/')) {
        const ancienChemin = path.join(electronApp.getPath('userData'), existant.image);
        fs.unlink(ancienChemin, () => {}); // best-effort, on ignore l'erreur si le fichier n'existe déjà plus
      }
    }

    db.prepare(`
      UPDATE produits SET
        nom = @nom,
        description = @description,
        prix = @prix,
        quantite = @quantite,
        categorie = @categorie,
        fournisseur = @fournisseur,
        boutique_id = @boutiqueId,
        seuil_alerte = @seuilAlerte,
        ref = @ref,
        image = @image,
        updated_at = @updatedAt,
        is_dirty = 1
      WHERE id = @id
    `).run({
      id: req.params.id,
      nom: nom ?? existant.nom,
      description: description ?? existant.description,
      prix: prix !== undefined && prix !== '' ? Number(prix) : existant.prix,
      quantite: quantite !== undefined && quantite !== '' ? Number(quantite) : existant.quantite,
      categorie: categorie ?? existant.categorie,
      fournisseur: fournisseur ?? existant.fournisseur,
      boutiqueId: boutiqueId ?? existant.boutique_id,
      seuilAlerte: seuilAlerte !== undefined && seuilAlerte !== '' ? Number(seuilAlerte) : existant.seuil_alerte,
      ref: ref ?? existant.ref,
      image: cheminImage,
      updatedAt: maintenantIso,
    });

    const ligne = db.prepare('SELECT * FROM produits WHERE id = ?').get(req.params.id);
    const produitModifie = versFormatApi(ligne);

    ajouterAOutbox('update', req.params.id, produitModifie);

    res.json(produitModifie);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE - Supprimer un produit (suppression douce, marquée pour synchro)
router.delete('/:id', (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM produits WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Produit introuvable.' });

    db.prepare('UPDATE produits SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?')
      .run(maintenant(), req.params.id);

    ajouterAOutbox('delete', req.params.id, null);

    res.json({ message: 'Produit supprimé.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;