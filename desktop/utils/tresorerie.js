/**
 * Équivalent local de backend/utils/tresorerie.js — mêmes règles, sur SQLite.
 */

const db = require('../local-db/db');

// Résout la caisse sur laquelle une dépense/un versement est enregistré, et
// vérifie qu'elle appartient bien au Compte de l'utilisateur (sauf superadmin).
// Un vendeur utilise TOUJOURS sa caisse assignée (lue dans son token, jamais
// dans le body, comme pour les ventes) ; un admin/superadmin la précise.
// Retourne { caisse, comptoir } ou { erreur, statut }.
function resoudreCaisse(req, body) {
  const caisseId = req.user?.role === 'vendeur' ? req.user.caisseId : body.caisseId;
  if (!caisseId) {
    return {
      statut: 400,
      erreur: req.user?.role === 'vendeur'
        ? "Aucune caisse ne vous est assignée — demandez à l'admin de vous en attribuer une."
        : 'caisseId requis : choisissez la caisse.',
    };
  }
  const caisse = db.prepare('SELECT * FROM caisses WHERE id = ? AND is_deleted = 0').get(caisseId);
  if (!caisse) return { statut: 404, erreur: 'Caisse introuvable.' };
  const comptoir = db.prepare('SELECT * FROM comptoirs WHERE id = ? AND is_deleted = 0').get(caisse.comptoir_id);
  if (!comptoir) return { statut: 404, erreur: 'Boutique introuvable.' };
  if (req.user && req.user.role !== 'superadmin' && comptoir.boutique_id !== req.user.boutiqueId) {
    return { statut: 403, erreur: 'Accès refusé.' };
  }
  return { caisse, comptoir };
}

// Filtre de lecture : un vendeur ne voit que ses propres lignes, un admin
// toutes celles de son Compte, un superadmin tout.
function filtreLecture(req) {
  const clauses = [];
  const params = {};
  if (req.user?.role === 'vendeur') {
    clauses.push('boutique_id = @boutiqueId', 'auteur = @auteur');
    params.boutiqueId = req.user.boutiqueId;
    params.auteur = req.user.id;
  } else if (req.user?.role === 'admin') {
    clauses.push('boutique_id = @boutiqueId');
    params.boutiqueId = req.user.boutiqueId;
  }
  return { clauses, params };
}

module.exports = { resoudreCaisse, filtreLecture };
