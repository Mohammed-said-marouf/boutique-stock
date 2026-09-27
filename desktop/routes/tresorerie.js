/**
 * Route "tresorerie" du serveur local — équivalent de backend/routes/tresorerie.js.
 */

const express = require('express');
const router = express.Router();
const db = require('../local-db/db');

// GET /soldes - Solde d'espèces de chaque caisse visible par l'utilisateur :
//   solde = ventes en espèces - dépenses - versements APPROUVÉS par l'admin
// (vendeur : sa caisse ; admin : les caisses de son Compte ; superadmin : toutes).
// Les ventes "en_ligne" ne passent pas par la caisse et sont exclues.
router.get('/soldes', (req, res) => {
  try {
    let caisses;
    if (req.user?.role === 'vendeur') {
      caisses = req.user.caisseId
        ? db.prepare('SELECT * FROM caisses WHERE id = ? AND is_deleted = 0').all(req.user.caisseId)
        : [];
    } else if (req.user?.role === 'admin') {
      caisses = db.prepare(`
        SELECT ca.* FROM caisses ca
        JOIN comptoirs co ON co.id = ca.comptoir_id
        WHERE ca.is_deleted = 0 AND co.boutique_id = ?
      `).all(req.user.boutiqueId);
    } else {
      caisses = db.prepare('SELECT * FROM caisses WHERE is_deleted = 0').all();
    }

    const nomComptoir = new Map(
      db.prepare('SELECT id, nom FROM comptoirs').all().map(c => [c.id, c.nom])
    );

    const totalVentes = db.prepare(`
      SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes
      WHERE is_deleted = 0 AND caisse_id = ? AND type_vente != 'en_ligne'
    `);
    const totalDepenses = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) AS total FROM depenses WHERE is_deleted = 0 AND caisse_id = ?
    `);
    const totalVersements = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) AS total FROM versements
      WHERE is_deleted = 0 AND caisse_id = ? AND statut = 'valide'
    `);
    const totalVersementsEnAttente = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) AS total FROM versements
      WHERE is_deleted = 0 AND caisse_id = ? AND statut = 'en_attente'
    `);

    res.json(caisses.map(c => {
      const v = totalVentes.get(c.id).total;
      const d = totalDepenses.get(c.id).total;
      const ver = totalVersements.get(c.id).total;
      return {
        caisseId: c.id,
        nom: c.nom,
        comptoirId: c.comptoir_id,
        boutiqueNom: nomComptoir.get(c.comptoir_id) || '',
        ventes: v,
        depenses: d,
        versements: ver,
        versementsEnAttente: totalVersementsEnAttente.get(c.id).total,
        solde: v - d - ver,
      };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
