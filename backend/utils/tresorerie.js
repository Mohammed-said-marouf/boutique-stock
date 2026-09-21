const Caisse = require('../models/Caisse');
const Comptoir = require('../models/Comptoir');

// Résout la caisse sur laquelle une dépense/un versement est enregistré, et
// vérifie qu'elle appartient bien au Compte de l'utilisateur (sauf superadmin).
// Un vendeur utilise TOUJOURS sa caisse assignée (lue dans son token, jamais
// dans le body, comme pour les ventes) ; un admin/superadmin la précise.
// Retourne { caisse, comptoir } ou { erreur, statut }.
async function resoudreCaisse(req) {
  const caisseId = req.user.role === 'vendeur' ? req.user.caisseId : req.body.caisseId;
  if (!caisseId) {
    return {
      statut: 400,
      erreur: req.user.role === 'vendeur'
        ? "Aucune caisse ne vous est assignée — demandez à l'admin de vous en attribuer une."
        : 'caisseId requis : choisissez la caisse.',
    };
  }
  const caisse = await Caisse.findById(caisseId);
  if (!caisse) return { statut: 404, erreur: 'Caisse introuvable.' };
  const comptoir = await Comptoir.findById(caisse.comptoirId);
  if (!comptoir) return { statut: 404, erreur: 'Boutique introuvable.' };
  if (req.user.role !== 'superadmin' && comptoir.boutiqueId !== req.user.boutiqueId) {
    return { statut: 403, erreur: 'Accès refusé.' };
  }
  return { caisse, comptoir };
}

// Filtre de lecture : un vendeur ne voit que ses propres lignes, un admin
// toutes celles de son Compte, un superadmin tout.
function filtreLecture(req) {
  if (req.user.role === 'vendeur') return { boutiqueId: req.user.boutiqueId, auteur: req.user.id };
  if (req.user.role === 'admin') return { boutiqueId: req.user.boutiqueId };
  return {};
}

module.exports = { resoudreCaisse, filtreLecture };
