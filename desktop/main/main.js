/**
 * Point d'entrée de l'application desktop Electron — Boutique Stock.
 *
 * Rôle de ce fichier :
 *  1. Initialiser la base SQLite locale (via local-db/db.js).
 *  2. Démarrer le serveur Express interne (local-server.js), sur http://localhost:4000.
 *  3. Ouvrir une fenêtre Electron qui charge l'interface (pour l'instant,
 *     une page de test simple — le vrai frontend React sera branché
 *     dans une étape ultérieure).
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Initialise la base SQLite dès le démarrage (crée le fichier si besoin, applique le schéma).
const db = require('../local-db/db');

// Démarre le serveur Express local.
const demarrerServeurLocal = require('../server/local-server');

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

  fenetrePrincipale.loadFile(path.join(__dirname, 'page-test.html'));

  fenetrePrincipale.on('closed', () => {
    fenetrePrincipale = null;
  });
}

app.whenReady().then(() => {
  console.log('✅ Application Electron démarrée.');

  serveurLocal = demarrerServeurLocal();

  creerFenetre();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (serveurLocal) serveurLocal.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});