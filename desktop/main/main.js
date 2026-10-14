/**
 * Point d'entrée de l'application desktop Electron — Boutique Stock.
 *
 * Rôle de ce fichier :
 *  1. Initialiser la base SQLite locale (via local-db/db.js).
 *  2. Démarrer le serveur Express interne (local-server.js), sur http://localhost:4000.
 *  3. Démarrer la synchronisation automatique (push + pull au démarrage, puis périodique).
 *  4. Ouvrir une fenêtre Electron qui charge le frontend React.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Rendu sans carte graphique : sur les PC de boutique aux pilotes graphiques
// anciens ou génériques, l'accélération matérielle de Chromium faisait figer
// la machine (pilote d'affichage bloqué, curseur qui disparaît). Une appli
// de caisse n'a pas besoin du GPU. Doit être appelé avant "ready".
app.disableHardwareAcceleration();

// Une seule instance à la fois : un double-clic répété pendant un démarrage
// lent lançait plusieurs copies (Electron + SQLite + synchro chacune), qui
// saturaient les petites machines, la deuxième ne pouvant de toute façon pas
// ouvrir le port 4000. La copie en trop se ferme et réaffiche la première.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}
app.on('second-instance', () => {
  if (!fenetrePrincipale) return;
  if (fenetrePrincipale.isMinimized()) fenetrePrincipale.restore();
  fenetrePrincipale.focus();
});

// Initialise la base SQLite dès le démarrage (crée le fichier si besoin, applique le schéma).
const db = require('../local-db/db');

// Démarre le serveur Express local.
const demarrerServeurLocal = require('../server/local-server');

// Synchronisation automatique (push + pull au démarrage, puis périodique).
const { demarrerSynchronisationAutomatique, arreterSynchronisationAutomatique } = require('../sync/scheduler');

let fenetrePrincipale;
let serveurLocal;

// Vrai uniquement au tout premier chargement de page depuis le lancement de
// l'application : le preload s'en sert pour effacer la session précédente
// et forcer une nouvelle connexion à chaque ouverture (voir preload.js).
let premierChargement = true;
ipcMain.on('premier-chargement-fenetre', (event) => {
  event.returnValue = premierChargement;
  premierChargement = false;
});

// Secret réservé à la fenêtre de l'application (voir secret-poste.js).
ipcMain.on('secret-poste', (event) => {
  event.returnValue = require('./secret-poste');
});

function creerFenetre() {
  fenetrePrincipale = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Boutique Stock',
    // Logo sans texte : le logo complet (logo.png, avec « StockBoutique by
    // M.SAÏD ») devient illisible réduit à la taille d'une icône de fenêtre.
    icon: path.join(__dirname, 'icone.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
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
  // Sans ce gestionnaire, un port 4000 déjà pris (autre logiciel) laissait
  // l'appli tourner en arrière-plan sans jamais ouvrir de fenêtre.
  serveurLocal.on('error', (err) => {
    dialog.showErrorBox(
      'Boutique Stock',
      err.code === 'EADDRINUSE'
        ? "Le port 4000 est déjà utilisé par un autre programme sur ce PC. Fermez-le (ou redémarrez l'ordinateur), puis relancez Boutique Stock."
        : 'Impossible de démarrer le serveur local : ' + err.message
    );
    app.quit();
  });
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