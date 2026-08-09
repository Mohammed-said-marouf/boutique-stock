/**
 * Détection de connectivité — vérifie si le serveur en ligne (Render) est joignable.
 *
 * On ne se contente pas de vérifier la connexion internet générale (qui peut être
 * active alors que le serveur Render est down) : on teste directement l'endpoint
 * de l'API en ligne. C'est plus fiable pour décider si on peut synchroniser.
 */

const API_EN_LIGNE = 'https://boutique-stock-api.onrender.com';
const TIMEOUT_MS = 45000; // 45 secondes — le plan gratuit Render peut mettre jusqu'à ~50s à se réveiller après une période d'inactivité

/**
 * Retourne true si le serveur en ligne répond, false sinon.
 * Ne lève jamais d'exception : toute erreur réseau est interprétée comme "hors-ligne".
 */
async function estEnLigne() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // On tape une route légère et rapide de l'API existante.
    // Si votre backend n'a pas de route "/", adaptez avec une route connue,
    // par exemple "/api/produits" — l'important est juste d'obtenir une réponse HTTP,
    // peu importe le code de statut (même une 401 prouve que le serveur est joignable).
    const reponse = await fetch(`${API_EN_LIGNE}/`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true; // le serveur a répondu, qu'importe le code HTTP exact
  } catch (err) {
    return false; // timeout, DNS injoignable, pas d'internet, serveur down...
  }
}

module.exports = { estEnLigne, API_EN_LIGNE };