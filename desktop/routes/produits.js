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
const { genererReference } = require('../local-db/reference');

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

// Le magasin dans lequel atterrit un stock initial saisi sans magasinId
// explicite — même repli que le backend en ligne (routes/produits.js).
function trouverPremierMagasinActif(boutiqueId) {
  if (!boutiqueId) return null;
  const ligne = db.prepare(`
    SELECT id FROM magasins WHERE boutique_id = ? AND actif = 1 AND is_deleted = 0
    ORDER BY created_at ASC LIMIT 1
  `).get(boutiqueId);
  return ligne ? ligne.id : null;
}

// "quantite" sur produits est toujours la somme de stock_magasins pour ce
// produit — jamais modifiée directement ailleurs (voir commentaire schema.sql).
function recalculerQuantiteProduit(produitId) {
  return db.prepare('SELECT COALESCE(SUM(quantite),0) AS total FROM stock_magasins WHERE produit_id = ?').get(produitId).total;
}

// Transforme une ligne SQLite (snake_case) vers le format attendu par le frontend (camelCase),
// identique à ce que renvoyait l'API MongoDB.
function versFormatApi(ligne) {
  if (!ligne) return null;
  const stockMagasins = db.prepare(`
    SELECT sm.magasin_id, sm.quantite, m.nom AS magasin_nom, m.actif AS magasin_actif
    FROM stock_magasins sm
    JOIN magasins m ON m.id = sm.magasin_id
    WHERE sm.produit_id = ?
  `).all(ligne.id);

  const stockComptoirs = db.prepare(`
    SELECT sc.comptoir_id, sc.quantite, c.nom AS comptoir_nom, c.actif AS comptoir_actif
    FROM stock_comptoirs sc
    JOIN comptoirs c ON c.id = sc.comptoir_id
    WHERE sc.produit_id = ?
  `).all(ligne.id);

  return {
    _id: ligne.id,
    nom: ligne.nom,
    description: ligne.description,
    prix: ligne.prix,
    quantite: ligne.quantite,
    // Stock par magasin et par comptoir, au même format que renvoyé par le
    // backend en ligne (populé avec juste _id/nom) — voir AdminLayout.js /
    // VendeurLayout.js (frontend) qui lisent cette structure.
    stockMagasins: stockMagasins.map(sm => ({
      magasin: { _id: sm.magasin_id, nom: sm.magasin_nom, actif: !!sm.magasin_actif },
      quantite: sm.quantite,
    })),
    stockComptoirs: stockComptoirs.map(sc => ({
      comptoir: { _id: sc.comptoir_id, nom: sc.comptoir_nom, actif: !!sc.comptoir_actif },
      quantite: sc.quantite,
    })),
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

// GET - Statistiques (total / rupture / stock faible), filtrable par
// boutiqueId — même contrat que le backend en ligne. Enregistrée AVANT
// GET /:id : sinon Express matcherait "stats" comme un id de produit.
router.get('/stats', (req, res) => {
  try {
    const boutiqueId = (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId)
      ? req.user.boutiqueId
      : req.query.boutiqueId;

    const filtreBoutique = boutiqueId ? 'AND boutique_id = @boutiqueId' : '';
    const params = { boutiqueId };

    const total = db.prepare(`SELECT COUNT(*) AS n FROM produits WHERE is_deleted = 0 ${filtreBoutique}`).get(params).n;
    const rupture = db.prepare(`SELECT COUNT(*) AS n FROM produits WHERE is_deleted = 0 AND quantite = 0 ${filtreBoutique}`).get(params).n;
    const faible = db.prepare(`SELECT COUNT(*) AS n FROM produits WHERE is_deleted = 0 AND quantite > 0 AND quantite <= seuil_alerte ${filtreBoutique}`).get(params).n;
    const alertes = db.prepare(`
      SELECT nom, quantite, seuil_alerte AS seuilAlerte FROM produits
      WHERE is_deleted = 0 AND quantite <= seuil_alerte ${filtreBoutique}
      LIMIT 5
    `).all(params);

    res.json({ total, rupture, faible, alertes });
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
  const transaction = db.transaction((body, fichier) => {
    const { nom, description, prix, quantite, categorie, fournisseur, boutiqueId, seuilAlerte, magasinId } = body;

    if (!nom || prix === undefined || prix === '' || !categorie) {
      throw Object.assign(new Error('nom, prix et categorie sont requis.'), { statut: 400 });
    }

    const id = crypto.randomUUID();
    const maintenantIso = maintenant();
    const cheminImage = fichier ? `/uploads/produits/${fichier.filename}` : null;
    // La référence est TOUJOURS générée localement, jamais laissée au choix
    // du client — voir local-db/reference.js.
    const ref = genererReference(db, nom, boutiqueId || null);

    db.prepare(`
      INSERT INTO produits (id, nom, description, prix, quantite, categorie, fournisseur, boutique_id, seuil_alerte, ref, image, date_ajout, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @description, @prix, 0, @categorie, @fournisseur, @boutiqueId, @seuilAlerte, @ref, @image, @dateAjout, @createdAt, @updatedAt, 1, 0)
    `).run({
      id,
      nom,
      description: description || null,
      prix: Number(prix),
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

    // Le stock initial saisi doit atterrir dans UN magasin précis (un Compte
    // peut en avoir plusieurs) — même repli que le backend en ligne : à
    // défaut de magasinId fourni, le premier magasin actif du Compte.
    const quantiteInitiale = quantite !== undefined && quantite !== '' ? Number(quantite) : 0;
    if (quantiteInitiale > 0) {
      const magasinCible = magasinId || trouverPremierMagasinActif(boutiqueId || null);
      if (magasinCible) {
        db.prepare('INSERT INTO stock_magasins (produit_id, magasin_id, quantite, updated_at) VALUES (?, ?, ?, ?)')
          .run(id, magasinCible, quantiteInitiale, maintenantIso);
        db.prepare('UPDATE produits SET quantite = ? WHERE id = ?').run(quantiteInitiale, id);
      }
    }

    return id;
  });

  try {
    const id = transaction(req.body, req.file);
    const ligne = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
    const produitCree = versFormatApi(ligne);

    ajouterAOutbox('create', id, produitCree);

    res.status(201).json(produitCree);
  } catch (err) {
    res.status(err.statut || 400).json({ message: err.message });
  }
});

// POST - Transférer du stock d'UN magasin précis vers un Comptoir. Crée
// aussi un mouvement de stock de type "transfert" pour garder l'historique.
// Même contrat que le backend en ligne (magasinId, comptoirId, quantite).
router.post('/:id/transferer', (req, res) => {
  const transaction = db.transaction(({ produitId, magasinId, comptoirId, quantite, note }) => {
    const produit = db.prepare('SELECT * FROM produits WHERE id = ? AND is_deleted = 0').get(produitId);
    if (!produit) throw Object.assign(new Error('Produit introuvable.'), { statut: 404 });

    const magasin = db.prepare('SELECT * FROM magasins WHERE id = ? AND is_deleted = 0').get(magasinId);
    if (!magasin) throw Object.assign(new Error('Magasin introuvable.'), { statut: 404 });

    const comptoir = db.prepare('SELECT * FROM comptoirs WHERE id = ? AND is_deleted = 0').get(comptoirId);
    if (!comptoir) throw Object.assign(new Error('Comptoir introuvable.'), { statut: 404 });

    const ligneMagasin = db.prepare('SELECT quantite FROM stock_magasins WHERE produit_id = ? AND magasin_id = ?').get(produitId, magasinId);
    const dispoMagasin = ligneMagasin ? ligneMagasin.quantite : 0;
    if (dispoMagasin < quantite) {
      throw Object.assign(new Error(`Stock insuffisant dans ce magasin (disponible : ${dispoMagasin}).`), { statut: 400 });
    }

    const maintenantIso = maintenant();
    const nouveauStockMagasin = dispoMagasin - quantite;

    db.prepare('UPDATE stock_magasins SET quantite = ?, updated_at = ? WHERE produit_id = ? AND magasin_id = ?')
      .run(nouveauStockMagasin, maintenantIso, produitId, magasinId);

    const ligneComptoir = db.prepare('SELECT * FROM stock_comptoirs WHERE produit_id = ? AND comptoir_id = ?').get(produitId, comptoirId);
    if (ligneComptoir) {
      db.prepare('UPDATE stock_comptoirs SET quantite = quantite + ?, updated_at = ? WHERE produit_id = ? AND comptoir_id = ?')
        .run(quantite, maintenantIso, produitId, comptoirId);
    } else {
      db.prepare('INSERT INTO stock_comptoirs (produit_id, comptoir_id, quantite, updated_at) VALUES (?, ?, ?, ?)')
        .run(produitId, comptoirId, quantite, maintenantIso);
    }

    const totalMagasins = recalculerQuantiteProduit(produitId);
    db.prepare('UPDATE produits SET quantite = ?, updated_at = ?, is_dirty = 1 WHERE id = ?')
      .run(totalMagasins, maintenantIso, produitId);

    const mouvementId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO mouvements_stock (id, produit, boutique_id, type, quantite, stock_restant, magasin_id, comptoir_destination, note, created_at, updated_at, is_dirty, is_deleted)
      VALUES (?, ?, ?, 'transfert', ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `).run(mouvementId, produitId, produit.boutique_id, quantite, nouveauStockMagasin, magasinId, comptoirId, note || '', maintenantIso, maintenantIso);

    // Poussé via une entrée dédiée ("transferts") plutôt qu'une mise à jour
    // générique du produit : elle sera rejouée contre la VRAIE route
    // /api/produits/:id/transferer en ligne (voir sync/push.js), qui
    // recalcule elle-même stockMagasins/stockComptoirs/quantite côté
    // serveur — plus sûr qu'un écrasement brut avec les totaux locaux.
    db.prepare(`
      INSERT INTO sync_outbox (collection, operation, record_id, payload, created_at)
      VALUES ('transferts', 'create', ?, ?, ?)
    `).run(produitId, JSON.stringify({ produitId, magasinId, comptoirId, quantite, note: note || '' }), maintenantIso);

    const produitMisAJour = db.prepare('SELECT * FROM produits WHERE id = ?').get(produitId);
    return versFormatApi(produitMisAJour);
  });

  try {
    const { magasinId, comptoirId, quantite } = req.body;
    const qte = Number(quantite);
    if (!magasinId || !comptoirId || !qte || qte <= 0) {
      return res.status(400).json({ message: 'magasinId, comptoirId et quantite (> 0) sont requis.' });
    }
    const resultat = transaction({ produitId: req.params.id, magasinId, comptoirId, quantite: qte, note: req.body.note });
    res.json(resultat);
  } catch (err) {
    res.status(err.statut || 400).json({ message: err.message });
  }
});

// POST - Import en masse (reçoit un tableau JSON déjà analysé côté
// frontend, pas le fichier lui-même — même contrat que le backend en
// ligne). Chaque ligne est tentée indépendamment.
router.post('/import', (req, res) => {
  try {
    const lignes = Array.isArray(req.body.produits) ? req.body.produits : [];
    if (lignes.length === 0) return res.status(400).json({ message: 'Aucune ligne à importer.' });

    const boutiqueId = (req.user && req.user.role === 'admin') ? req.user.boutiqueId : (req.body.boutiqueId || (req.user && req.user.boutiqueId));
    const magasinParDefaut = trouverPremierMagasinActif(boutiqueId);

    const succes = [];
    const echecs = [];
    const maintenantIso = maintenant();

    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      try {
        if (!l.nom || !l.categorie || l.prix === undefined || l.prix === '' || isNaN(Number(l.prix))) {
          throw new Error('nom, categorie et prix sont requis.');
        }
        const id = crypto.randomUUID();
        const ref = genererReference(db, l.nom, boutiqueId);
        const quantiteInitiale = Number(l.quantite) || 0;
        db.prepare(`
          INSERT INTO produits (id, nom, description, prix, quantite, categorie, boutique_id, seuil_alerte, ref, date_ajout, created_at, updated_at, is_dirty, is_deleted)
          VALUES (@id, @nom, @description, @prix, 0, @categorie, @boutiqueId, @seuilAlerte, @ref, @dateAjout, @createdAt, @updatedAt, 1, 0)
        `).run({
          id,
          nom: l.nom,
          description: l.description || null,
          prix: Number(l.prix),
          categorie: l.categorie,
          boutiqueId,
          seuilAlerte: l.seuilAlerte !== undefined && l.seuilAlerte !== '' ? Number(l.seuilAlerte) : 5,
          ref,
          dateAjout: maintenantIso,
          createdAt: maintenantIso,
          updatedAt: maintenantIso,
        });
        if (quantiteInitiale > 0 && magasinParDefaut) {
          db.prepare('INSERT INTO stock_magasins (produit_id, magasin_id, quantite, updated_at) VALUES (?, ?, ?, ?)')
            .run(id, magasinParDefaut, quantiteInitiale, maintenantIso);
          db.prepare('UPDATE produits SET quantite = ? WHERE id = ?').run(quantiteInitiale, id);
        }
        const ligneCreee = db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
        ajouterAOutbox('create', id, versFormatApi(ligneCreee));
        succes.push({ ligne: i + 1, nom: l.nom });
      } catch (err) {
        echecs.push({ ligne: i + 1, nom: l?.nom || '(sans nom)', erreur: err.message });
      }
    }

    res.status(200).json({ nbSucces: succes.length, nbEchecs: echecs.length, succes, echecs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT - Modifier un produit (multipart/form-data, champ fichier "image" optionnel —
// si absent, l'image existante est conservée). Ne touche JAMAIS "quantite"
// (voir versFormatApi/recalculerQuantiteProduit) — seuls la création avec
// stock initial, un transfert ou un mouvement le modifient.
router.put('/:id', upload.single('image'), (req, res) => {
  try {
    const existant = db.prepare('SELECT * FROM produits WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existant) return res.status(404).json({ message: 'Produit introuvable.' });

    const { nom, description, prix, categorie, fournisseur, boutiqueId, seuilAlerte, ref } = req.body;
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