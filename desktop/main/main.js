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

// En développement, le build React se trouve dans le dossier frère
// frontend/build (../../frontend/build depuis main/). Une fois l'application
// empaquetée en .exe, cette structure de dossiers n'existe plus à cet
// emplacement relatif — electron-builder copie plutôt ce dossier dans
// resources/frontend-build (voir "extraResources" dans package.json),
// accessible via process.resourcesPath.
function cheminIndexFrontend() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend-build', 'index.html');
  }
  return path.join(__dirname, '..', '..', 'frontend', 'build', 'index.html');
}

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

  fenetrePrincipale.loadFile(cheminIndexFrontend());

  fenetrePrincipale.on('closed', () => {
    fenetrePrincipale = null;
  });
}

app.whenReady().then(() => {
  console.log('✅ Application Electron démarrée.');

  serveurLocal = demarrerServeurLocal();
  demarrerSynchronisationAutomatique();

  creerFenetre();

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