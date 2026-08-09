/**
 * Stockage local du token JWT obtenu lors de la connexion en ligne.
 * Le token est écrit dans un fichier JSON, dans le même dossier de données
 * utilisateur que la base SQLite — il survit donc aux redémarrages de l'app.
 *
 * Ce token est nécessaire pour authentifier les requêtes de synchronisation
 * (push/pull) envoyées à l'API en ligne, qui exige un Bearer token valide.
 */

const path = require('path');
const fs = require('fs');

let dossierDonnees;
try {
  const { app } = require('electron');
  dossierDonnees = app.getPath('userData');
} catch (e) {
  dossierDonnees = path.join(__dirname, '../local-db/.local-data');
}

const cheminFichierToken = path.join(dossierDonnees, 'session-sync.json');

function enregistrerSession({ token, user }) {
  const donnees = { token, user, enregistreLe: new Date().toISOString() };
  fs.writeFileSync(cheminFichierToken, JSON.stringify(donnees, null, 2), 'utf-8');
}

function lireSession() {
  try {
    if (!fs.existsSync(cheminFichierToken)) return null;
    const contenu = fs.readFileSync(cheminFichierToken, 'utf-8');
    return JSON.parse(contenu);
  } catch (e) {
    return null;
  }
}

function effacerSession() {
  try {
    if (fs.existsSync(cheminFichierToken)) fs.unlinkSync(cheminFichierToken);
  } catch (e) {
    // rien à faire si le fichier n'existe pas
  }
}

module.exports = { enregistrerSession, lireSession, effacerSession };