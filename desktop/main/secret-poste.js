/**
 * Secret aléatoire, régénéré à chaque lancement de l'application, que seule
 * la fenêtre Electron connaît (transmis par le preload). Il protège les
 * routes sensibles du serveur local (sauvegarde/import complet du poste,
 * voir routes/poste.js) : ce serveur est joignable depuis le réseau de la
 * boutique (scanner du téléphone) et accepte toutes les origines (cors), il
 * ne faut donc pas qu'un autre appareil du Wi-Fi ou une page web ouverte sur
 * ce PC puisse exporter les comptes ou remplacer la base.
 */

const crypto = require('crypto');

module.exports = crypto.randomBytes(32).toString('hex');
