/**
 * Initialisation de la base de données locale SQLite pour la version desktop
 * (Electron) de Boutique Stock.
 *
 * Le fichier .sqlite est stocké dans le dossier de données utilisateur du système
 * (ex: %APPDATA%/boutique-stock/ sur Windows), donc il persiste entre les mises à jour
 * de l'application et n'est jamais versionné avec le code.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// `app` n'est disponible que dans le processus principal Electron.
// On prévoit un repli pour pouvoir aussi lancer ce module hors Electron (tests, scripts).
let dossierDonnees;
try {
  const { app } = require('electron');
  dossierDonnees = app.getPath('userData');
} catch (e) {
  dossierDonnees = path.join(__dirname, '.local-data');
}

if (!fs.existsSync(dossierDonnees)) {
  fs.mkdirSync(dossierDonnees, { recursive: true });
}

const cheminBase = path.join(dossierDonnees, 'boutique-stock-local.sqlite');
const db = new Database(cheminBase);

db.pragma('journal_mode = WAL'); // meilleures performances en écriture concurrente
db.pragma('foreign_keys = ON');

// Applique le schéma (idempotent grâce aux "IF NOT EXISTS")
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

console.log(`✅ Base SQLite locale initialisée : ${cheminBase}`);

module.exports = db;