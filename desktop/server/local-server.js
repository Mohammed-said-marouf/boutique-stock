/**
 * Serveur Express local — tourne à l'intérieur de l'application Electron,
 * sur http://localhost:4000. C'est ce serveur que le frontend React
 * interrogera (à la place de l'API Render), qu'on soit en ligne ou hors-ligne.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const https = require('https');
const { app: electronApp } = require('electron');
const db = require('../local-db/db');
const { obtenirCertificat } = require('./certificat');

const PORT = 4000;       // HTTP — utilisé par l'app Electron elle-même (localhost)
const PORT_HTTPS = 4443; // HTTPS — utilisé par le scanner sur le téléphone (accès caméra)

// Trouve l'adresse IPv4 locale (Wi-Fi/Ethernet) de ce poste sur le réseau
// de la boutique — c'est cette adresse que le téléphone du vendeur doit
// utiliser pour atteindre ce serveur (localhost ne fonctionnerait que
// depuis cette machine elle-même).
function trouverAdresseIpLocale() {
  const interfaces = os.networkInterfaces();
  for (const nom of Object.keys(interfaces)) {
    for (const intf of interfaces[nom] || []) {
      if (intf.family === 'IPv4' && !intf.internal) return intf.address;
    }
  }
  return null;
}

function demarrerServeurLocal() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Sert les images uploadées localement (produits, etc.) en statique, à
  // l'URL /uploads/... — c'est ce que le frontend appelle via
  // resoudreImage() pour tout chemin qui ne commence pas par "http".
  app.use('/uploads', express.static(path.join(electronApp.getPath('userData'), 'uploads')));

  // Page de scan QR autonome (HTML/JS simple, sans build React), destinée
  // à être ouverte depuis le navigateur du téléphone d'un vendeur connecté
  // au même Wi-Fi que ce poste. Fonctionne même sans connexion internet —
  // tout ce dont elle a besoin (y compris la librairie de scan caméra) est
  // servi localement par ce serveur, rien n'est chargé depuis un CDN.
  app.use('/scanner', express.static(path.join(__dirname, 'public-scanner')));

  // Renvoie l'adresse à donner au téléphone du vendeur pour rejoindre le
  // scanner (affichée/QR-codée côté admin, voir AdminParametres.js). Le
  // scanner est en HTTPS (port 4443) : les navigateurs mobiles bloquent
  // l'accès caméra sur une origine http:// non sécurisée.
  app.get('/api/reseau-info', (req, res) => {
    const ip = trouverAdresseIpLocale();
    res.json({
      ip,
      port: PORT_HTTPS,
      url: ip ? `https://${ip}:${PORT_HTTPS}/scanner` : null,
      certificatUrl: ip ? `http://${ip}:${PORT}/certificat.crt` : null,
      message: ip ? null : "Impossible de détecter une adresse réseau locale — vérifiez que ce poste est bien connecté au Wi-Fi/Ethernet de la boutique.",
    });
  });

  // Sert le certificat auto-signé en téléchargement direct — volontairement
  // en http:// (pas besoin d'avoir déjà confiance en HTTPS pour l'obtenir).
  // Le vendeur doit l'installer une seule fois sur son téléphone pour que
  // le navigateur autorise ensuite l'accès caméra sur le scanner HTTPS.
  app.get('/certificat.crt', (req, res) => {
    const ip = trouverAdresseIpLocale();
    if (!ip) return res.status(503).json({ message: 'Adresse réseau locale introuvable.' });
    obtenirCertificat(electronApp.getPath('userData'), ip)
      .then(({ cert }) => {
        res.setHeader('Content-Type', 'application/x-x509-ca-cert');
        res.setHeader('Content-Disposition', 'attachment; filename="boutique-stock.crt"');
        res.send(cert);
      })
      .catch(err => res.status(500).json({ message: 'Erreur génération certificat : ' + err.message }));
  });

  // Identifie l'utilisateur connecté (à partir du token) sur chaque
  // requête, pour permettre aux routes de filtrer leurs résultats par
  // boutique — sans jamais bloquer (voir middleware/identifierUtilisateur.js).
  app.use(require('../middleware/identifierUtilisateur'));

  // Route de test : confirme que le serveur tourne et que la base répond.
  app.get('/api/health', (req, res) => {
    try {
      const nombreDeTables = db
        .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table'")
        .get().total;

      res.json({
        statut: 'ok',
        message: 'Serveur local Boutique Stock opérationnel.',
        base_de_donnees: {
          connectee: true,
          nombre_de_tables: nombreDeTables,
        },
      });
    } catch (err) {
      res.status(500).json({ statut: 'erreur', message: err.message });
    }
  });

  // Routes métier
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/produits', require('../routes/produits'));
  app.use('/api/ventes', require('../routes/ventes'));
  app.use('/api/boutiques', require('../routes/boutiques'));
  app.use('/api/clients', require('../routes/clients'));
  app.use('/api/fournisseurs', require('../routes/fournisseurs'));
  app.use('/api/users', require('../routes/users'));
  app.use('/api/mouvements-stock', require('../routes/mouvements-stock'));
  app.use('/api/logs', require('../routes/logs'));
  app.use('/api/icones', require('../routes/icones'));
  app.use('/api/sync', require('../routes/sync'));

  const serveur = app.listen(PORT, () => {
    console.log(`✅ Serveur local démarré sur http://localhost:${PORT}`);
  });

  // Démarrage du HTTPS séparément et de façon non-bloquante : si la
  // génération du certificat échoue pour une raison quelconque (permissions,
  // pas d'IP détectée...), le reste de l'application continue de fonctionner
  // normalement — seul le scan caméra depuis un téléphone sera indisponible.
  (async () => {
    try {
      const ip = trouverAdresseIpLocale();
      if (!ip) {
        console.warn('⚠️ Aucune adresse IP locale détectée — scanner HTTPS non démarré.');
        return;
      }
      const { cert, key } = await obtenirCertificat(electronApp.getPath('userData'), ip);
      https.createServer({ key, cert }, app).listen(PORT_HTTPS, () => {
        console.log(`✅ Scanner HTTPS démarré sur https://${ip}:${PORT_HTTPS}/scanner`);
      });
    } catch (err) {
      console.warn('⚠️ Impossible de démarrer le scanner HTTPS :', err.message);
    }
  })();

  return serveur;
}

module.exports = demarrerServeurLocal;