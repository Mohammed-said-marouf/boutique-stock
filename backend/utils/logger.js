const Log = require('../models/Log');

/**
 * Enregistre une entrée dans le journal d'activités.
 * N'interrompt jamais la requête appelante en cas d'échec (juste un log console).
 */
async function enregistrerLog({ type, message, utilisateur = null, nomUtilisateur = 'Inconnu', niveau = 'info' }) {
  try {
    await Log.create({ type, message, utilisateur, nomUtilisateur, niveau });
  } catch (err) {
    console.error('Erreur enregistrement log:', err.message);
  }
}

module.exports = enregistrerLog;