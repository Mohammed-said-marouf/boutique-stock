/**
 * Serveur Express local — tourne à l'intérieur de l'application Electron,
 * sur http://localhost:4000. C'est ce serveur que le frontend React
 * interrogera (à la place de l'API Render), qu'on soit en ligne ou hors-ligne.
 */

const express = require('express');
const cors = require('cors');
const db = require('../local-db/db');

const PORT = 4000;

function demarrerServeurLocal() {
  const app = express();

  app.use(cors());
  app.use(express.json());

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

  return serveur;
}

module.exports = demarrerServeurLocal;