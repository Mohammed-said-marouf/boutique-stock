/**
 * Bloque l'accès à l'application quand le mode maintenance est actif,
 * sauf pour le superadmin (qui garde toujours l'accès) et les routes
 * /api/auth (pour permettre la connexion) et /api/maintenance
 * (pour consulter/changer le statut).
 *
 * Placé tôt dans server.js, avant le montage des routes métier.
 */

const jwt = require('jsonwebtoken');
const Parametre = require('../models/Parametre');

async function verifierMaintenance(req, res, next) {
  try {
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/maintenance')) {
      return next();
    }

    const parametre = await Parametre.findOne({ cle: 'modeMaintenance' });
    const enMaintenance = !!(parametre && parametre.valeur === true);

    // --- DIAGNOSTIC TEMPORAIRE ---
    console.log(`[maintenance] ${req.method} ${req.path} — parametre trouvé: ${!!parametre}, valeur brute: ${JSON.stringify(parametre?.valeur)}, enMaintenance: ${enMaintenance}`);
    // --- FIN DIAGNOSTIC ---

    if (!enMaintenance) return next();

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

    // --- DIAGNOSTIC TEMPORAIRE ---
    console.log(`[maintenance] token présent: ${!!token}, role décodé: ${role}`);
    // --- FIN DIAGNOSTIC ---

    if (role === 'superadmin') return next();

    return res.status(503).json({
      message: '🔧 Application en maintenance. Seul le Super Admin peut y accéder pour le moment.',
    });
  } catch (err) {
    // --- DIAGNOSTIC TEMPORAIRE ---
    console.log('[maintenance] ERREUR dans le middleware, requête laissée passer :', err.message);
    // --- FIN DIAGNOSTIC ---
    next();
  }
}

module.exports = verifierMaintenance;