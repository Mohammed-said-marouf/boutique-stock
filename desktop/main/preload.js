/**
 * Preload de la fenêtre principale.
 *
 * Exécuté avant le code React à chaque chargement de page. Au PREMIER
 * chargement suivant le lancement de l'application, on efface la session
 * (token + user) conservée dans le localStorage : sans ça, l'application
 * restait connectée au dernier compte même après avoir été fermée, alors
 * qu'on veut une nouvelle connexion à chaque ouverture (poste partagé entre
 * plusieurs vendeurs). Les rechargements suivants (F5, etc.) gardent la
 * session. La synchro, elle, a son propre token (session-sync.json) et
 * n'est pas concernée.
 */

const { ipcRenderer, contextBridge } = require('electron');

// Secret du poste, exposé à la page pour les routes protégées du serveur
// local (sauvegarde/import complet du poste — voir main/secret-poste.js).
// Sa présence sert aussi au frontend à savoir qu'il tourne dans le desktop.
contextBridge.exposeInMainWorld('bsDesktop', {
  secretPoste: ipcRenderer.sendSync('secret-poste'),
});

if (ipcRenderer.sendSync('premier-chargement-fenetre')) {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    // stockage indisponible : rien à effacer
  }
}
