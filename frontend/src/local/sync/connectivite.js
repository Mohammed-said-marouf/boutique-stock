// Détection de connectivité — vérifie si le serveur en ligne (Render) est
// joignable. Port quasi-verbatim de desktop/sync/connectivite.js (fetch et
// AbortController sont disponibles dans la WebView Android comme dans le
// process Electron, aucune adaptation nécessaire).
//
// Amélioration possible, non faite ici pour ne pas élargir la surface de
// dépendances tant que le plugin SQLite n'est pas confirmé compatible par la
// CI (voir plan, Phase 1) : compléter avec @capacitor/network pour un
// court-circuit instantané ("l'OS dit qu'il n'y a pas de réseau") avant
// d'attendre les 45s de timeout ci-dessous.

import { API_URL as API_EN_LIGNE } from '../../config';

const TIMEOUT_MS = 45000; // le plan gratuit Render peut mettre jusqu'à ~50s à se réveiller après une période d'inactivité

// Retourne true si le serveur en ligne répond, false sinon. Ne lève jamais
// d'exception : toute erreur réseau est interprétée comme "hors-ligne".
export async function estEnLigne() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Peu importe le code HTTP renvoyé — obtenir une réponse prouve déjà que
    // le serveur est joignable (même une 401 le prouve).
    await fetch(`${API_EN_LIGNE}/`, { method: 'GET', signal: controller.signal });

    clearTimeout(timeoutId);
    return true;
  } catch (err) {
    return false; // timeout, DNS injoignable, pas d'internet, serveur down...
  }
}

export { API_EN_LIGNE };
