/**
 * Point d'entrée de l'application desktop Electron — Boutique Stock.
 *
 * Rôle de ce fichier :
 *  1. Initialiser la base SQLite locale (via local-db/db.js).
 *  2. Démarrer le serveur Express interne (local-server.js), sur http://localhost:4000.
 *  3. Démarrer la synchronisation automatique (push + pull au démarrage, puis périodique).
 *  4. Ouvrir une fenêtre Electron qui charge le frontend React.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Initialise la base SQLite dès le démarrage (crée le fichier si besoin, applique le schéma).
const db = require('../local-db/db');

// Démarre le serveur Express local.
const demarrerServeurLocal = require('../server/local-server');

// Synchronisation automatique (push + pull au démarrage, puis périodique).
const { demarrerSynchronisationAutomatique, arreterSynchronisationAutomatique } = require('../sync/scheduler');

let fenetrePrincipale;
let serveurLocal;

function creerFenetre() {
  fenetrePrincipale = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Boutique Stock (Desktop)',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Chargée via http://localhost:4000 (le serveur local lui-même sert le
  // build React, voir local-server.js) plutôt que via file:// : sous
  // file://, un chemin absolu comme "/logo512.png" utilisé tel quel dans le
  // code React se résout contre la racine du DISQUE et reste cassé — même
  // origine http que le reste de l'API, cohérent avec la version web.
  fenetrePrincipale.loadURL('http://localhost:4000');

  fenetrePrincipale.on('closed', () => {
    fenetrePrincipale = null;
  });
}

app.whenReady().then(() => {
  console.log('✅ Application Electron démarrée.');

  serveurLocal = demarrerServeurLocal();
  demarrerSynchronisationAutomatique();

  // La fenêtre charge http://localhost:4000 (voir creerFenetre) : elle ne
  // doit s'ouvrir qu'une fois ce serveur réellement à l'écoute, sinon la
  // toute première requête arrive avant que le port soit prêt.
  if (serveurLocal.listening) {
    creerFenetre();
  } else {
    serveurLocal.once('listening', creerFenetre);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  arreterSynchronisationAutomatique();
  if (serveurLocal) serveurLocal.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});