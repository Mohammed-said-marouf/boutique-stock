/**
 * Bloque l'accès à l'application quand le mode maintenance est actif,
 * sauf pour le superadmin (qui garde toujours l'accès) et les routes
 * /api/auth (pour permettre la connexion) et /api/maintenance
 * (pour consulter/changer le statut). La connexion elle-même refuse les
 * non-superadmins pendant la maintenance (voir routes/auth.js) — sinon un
 * admin ou un vendeur se connectait normalement et voyait l'appli comme si
 * de rien n'était, les erreurs 503 étant ignorées en silence par les pages.
 *
 * Placé tôt dans server.js, avant le montage des routes métier.
 */

const jwt = require('jsonwebtoken');
const Parametre = require('../models/Parametre');

const MESSAGE_MAINTENANCE = '🔧 Application en maintenance. Seul le Super Admin peut y accéder pour le moment.';

async function estEnMaintenance() {
  const parametre = await Parametre.findOne({ cle: 'modeMaintenance' });
  return !!(parametre && parametre.valeur === true);
}

async function verifierMaintenance(req, res, next) {
  try {
    // /api/parametres/config : lecture publique (nom, devise...) utilisée
    // par l'écran de connexion — le super admin doit pouvoir s'y connecter.
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/maintenance') || req.path === '/api/parametres/config' && req.method === 'GET') {
      return next();
    }

    if (!(await estEnMaintenance())) return next();

    // Tente de décoder le token pour vérifier si l'appelant est superadmin
    // — le superadmin garde toujours l'accès, même en mode maintenance.
    const token = req.headers.authorization?.split(' ')[1];
    let role = null;
    if (token) {
      try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        role = decode.role;
      } catch {
        // Token invalide : traité comme non authentifié ci-dessous.
      }
    }

    if (role === 'superadmin') return next();

    return res.status(503).json({ message: MESSAGE_MAINTENANCE, maintenance: true });
  } catch (err) {
    console.log('[maintenance] ERREUR dans le middleware, requête laissée passer :', err.message);
    next();
  }
}

module.exports = verifierMaintenance;
module.exports.estEnMaintenance = estEnMaintenance;
module.exports.MESSAGE_MAINTENANCE = MESSAGE_MAINTENANCE;
