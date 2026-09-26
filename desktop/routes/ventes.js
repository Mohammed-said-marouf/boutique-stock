/**
 * Route "ventes" du serveur local — équivalent de backend/routes/ventes.js,
 * mais lit et écrit dans SQLite au lieu de MongoDB.
 *
 * Gère aussi, comme la version en ligne :
 *  - le décrément du stock des produits vendus,
 *  - la création/mise à jour automatique de la fiche client,
 *  - les statistiques (jour/mois/total).
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

// Récupère une vente complète (avec ses lignes de produits) au format attendu par le frontend.
function chargerVenteComplete(venteId) {
  const vente = db.prepare('SELECT * FROM ventes WHERE id = ? AND is_deleted = 0').get(venteId);
  if (!vente) return null;

  const lignes = db.prepare(`
    SELECT vp.quantite, vp.prix_unitaire, p.id AS produit_id, p.nom, p.categorie, p.prix, p.image
    FROM vente_produits vp
    LEFT JOIN produits p ON p.id = vp.produit_id
    WHERE vp.vente_id = ?
  `).all(venteId);

  return {
    _id: vente.id,
    produits: lignes.map(l => ({
      produit: l.produit_id ? { _id: l.produit_id, nom: l.nom, categorie: l.categorie, prix: l.prix, image: l.image } : null,
      quantite: l.quantite,
      prixUnitaire: l.prix_unitaire,
    })),
    montantTotal: vente.montant_total,
    typeVente: vente.type_vente,
    vendeur: vente.vendeur,
    nomVendeur: vente.nom_vendeur,
    clientNom: vente.client_nom,
    numFacture: vente.num_facture,
    boutiqueId: vente.boutique_id,
    dateVente: vente.date_vente,
    notes: vente.notes,
  };
}

// GET - Lister toutes les ventes
router.get('/', (req, res) => {
  try {
    // Un admin ou un vendeur ne voit que les ventes de sa propre boutique
    // (priorité au token, comme le fait le backend en ligne). Si aucun
    // token identifiable (ex: nos scripts de test), on retombe sur le
    // filtre optionnel ?boutiqueId= déjà existant.
    const boutiqueFiltre = (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId)
      ? req.user.boutiqueId
      : req.query.boutiqueId;

    let sql = 'SELECT id FROM ventes WHERE is_deleted = 0';
    const params = [];
    if (boutiqueFiltre) {
      sql += ' AND boutique_id = ?';
      params.push(boutiqueFiltre);
    }
    sql += ' ORDER BY date_vente DESC';

    const ids = db.prepare(sql).all(...params).map(r => r.id);
    const ventes = ids.map(chargerVenteComplete);

    res.json(ventes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Enregistrer une vente
router.post('/', (req, res) => {
  const transaction = db.transaction((body, boutiqueId) => {
    const { produits, montantTotal, typeVente, vendeur, nomVendeur, clientNom, comptoirId, notes } = body;

    if (!Array.isArray(produits) || produits.length === 0 || montantTotal === undefined) {
      throw Object.assign(new Error('produits (tableau) et montantTotal sont requis.'), { statut: 400 });
    }
    if (!comptoirId) {
      throw Object.assign(new Error('comptoirId requis : choisissez le comptoir de vente.'), { statut: 400 });
    }

    // Validation préalable : chaque produit doit avoir assez de stock à CE
    // comptoir, avant de committer quoi que ce soit (transaction unique de
    // toute façon, mais on préfère un message d'erreur clair par produit).
    for (const item of produits) {
      const ligneStock = db.prepare('SELECT quantite FROM stock_comptoirs WHERE produit_id = ? AND comptoir_id = ?').get(item.produit, comptoirId);
      const dispo = ligneStock ? ligneStock.quantite : 0;
      if (dispo < item.quantite) {
        const produitInfo = db.prepare('SELECT nom FROM produits WHERE id = ?').get(item.produit);
        throw Object.assign(new Error(`Stock insuffisant à ce comptoir pour "${produitInfo?.nom || item.produit}" (disponible : ${dispo}).`), { statut: 400 });
      }
    }

    const venteId = crypto.randomUUID();
    const numFacture = 'FAC-' + Date.now().toString().slice(-6);
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO ventes (id, montant_total, type_vente, vendeur, nom_vendeur, client_nom, num_facture, boutique_id, comptoir_id, date_vente, notes, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @montantTotal, @typeVente, @vendeur, @nomVendeur, @clientNom, @numFacture, @boutiqueId, @comptoirId, @dateVente, @notes, @createdAt, @updatedAt, 1, 0)
    `).run({
      id: venteId,
      montantTotal,
      typeVente: typeVente || 'presentiel',
      vendeur: vendeur || null,
      nomVendeur: nomVendeur || null,
      clientNom: clientNom || 'Client anonyme',
      numFacture,
      boutiqueId: boutiqueId || null,
      comptoirId,
      dateVente: maintenantIso,
      notes: notes || null,
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    // Lignes de produits + décrément du stock DU COMPTOIR (pas du Magasin —
    // le Magasin n'est qu'une réserve, jamais vendu directement).
    const insererLigne = db.prepare(`
      INSERT INTO vente_produits (id, vente_id, produit_id, quantite, prix_unitaire)
      VALUES (?, ?, ?, ?, ?)
    `);
    const decrementerStockComptoir = db.prepare(`
      UPDATE stock_comptoirs SET quantite = quantite - ?, updated_at = ? WHERE produit_id = ? AND comptoir_id = ?
    `);

    for (const item of produits) {
      insererLigne.run(crypto.randomUUID(), venteId, item.produit, item.quantite, item.prixUnitaire);
      decrementerStockComptoir.run(item.quantite, maintenantIso, item.produit, comptoirId);
      ajouterAOutbox('produits', 'update', item.produit, null);
    }

    // Création/mise à jour automatique de la fiche client
    const nomClient = (clientNom || '').trim();
    if (nomClient && nomClient.toLowerCase() !== 'client anonyme' && boutiqueId) {
      const clientExistant = db.prepare('SELECT * FROM clients WHERE nom = ? AND boutique_id = ?').get(nomClient, boutiqueId);
      if (clientExistant) {
        db.prepare(`
          UPDATE clients SET achats = achats + 1, total = total + ?, updated_at = ?, is_dirty = 1 WHERE id = ?
        `).run(montantTotal, maintenantIso, clientExistant.id);
        ajouterAOutbox('clients', 'update', clientExistant.id, null);
      } else {
        const clientId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO clients (id, nom, boutique_id, achats, total, created_at, updated_at, is_dirty, is_deleted)
          VALUES (?, ?, ?, 1, ?, ?, ?, 1, 0)
        `).run(clientId, nomClient, boutiqueId, montantTotal, maintenantIso, maintenantIso);
        ajouterAOutbox('clients', 'create', clientId, null);
      }
    }

    ajouterAOutbox('ventes', 'create', venteId, chargerVenteComplete(venteId));

    return venteId;
  });

  try {
    // boutiqueId vient TOUJOURS du token pour un admin/vendeur (jamais du
    // corps envoyé par le client) — même règle que le backend en ligne
    // (routes/ventes.js : "const boutiqueId = req.user.boutiqueId || null").
    // Avant ce correctif, il était lu depuis req.body, resté vide pour les
    // ventes du vendeur : elles n'apparaissaient plus dans "Ventes du
    // jour"/le total, qui filtrent par boutique_id.
    const boutiqueId = (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId)
      ? req.user.boutiqueId
      : (req.body.boutiqueId || null);
    const venteId = transaction(req.body, boutiqueId);
    res.status(201).json(chargerVenteComplete(venteId));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET - Statistiques (jour / mois / total), filtrable par boutiqueId
router.get('/stats', (req, res) => {
  try {
    // Même logique que GET / : priorité au token pour un admin/vendeur,
    // sinon on retombe sur le filtre optionnel ?boutiqueId= déjà existant.
    const boutiqueId = (req.user && (req.user.role === 'admin' || req.user.role === 'vendeur') && req.user.boutiqueId)
      ? req.user.boutiqueId
      : req.query.boutiqueId;

    const filtreBoutique = boutiqueId ? 'AND boutique_id = @boutiqueId' : '';

    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const params = { boutiqueId, debutJour: debutJour.toISOString(), debutMois: debutMois.toISOString() };

    const totalVentes = db.prepare(`SELECT COUNT(*) AS n FROM ventes WHERE is_deleted = 0 ${filtreBoutique}`).get(params).n;
    const chiffreAffaires = db.prepare(`SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes WHERE is_deleted = 0 ${filtreBoutique}`).get(params).total;

    const ventesJour = db.prepare(`SELECT COUNT(*) AS n FROM ventes WHERE is_deleted = 0 AND date_vente >= @debutJour ${filtreBoutique}`).get(params).n;
    const caJour = db.prepare(`SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes WHERE is_deleted = 0 AND date_vente >= @debutJour ${filtreBoutique}`).get(params).total;

    const ventesMois = db.prepare(`SELECT COUNT(*) AS n FROM ventes WHERE is_deleted = 0 AND date_vente >= @debutMois ${filtreBoutique}`).get(params).n;
    const caMois = db.prepare(`SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes WHERE is_deleted = 0 AND date_vente >= @debutMois ${filtreBoutique}`).get(params).total;

    res.json({ totalVentes, chiffreAffaires, ventesJour, caJour, ventesMois, caMois });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;