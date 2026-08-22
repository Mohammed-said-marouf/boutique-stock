/**
 * Synchronisation automatique — déclenche un cycle push puis pull au
 * démarrage de l'application, puis périodiquement en arrière-plan, sans
 * action manuelle de l'utilisateur.
 *
 * Gestion du token expiré : si le push échoue à cause d'un token invalide
 * (JWT expiré après 24h, cf. journal de session), on ne boucle pas
 * indéfiniment sur l'erreur — on marque un état "reconnexion nécessaire",
 * consultable via GET /api/sync/auto-statut, pour qu'une future interface
 * puisse en informer l'utilisateur et proposer de se reconnecter.
 */

const { pousserOutbox } = require('./push');
const { tirerTout } = require('./pull');
const { estEnLigne } = require('./connectivite');

const INTERVALLE_MS = 5 * 60 * 1000; // 5 minutes entre deux cycles automatiques
const DELAI_INITIAL_MS = 8000; // laisse le temps au serveur local de bien démarrer

let intervalleId = null;

let etat = {
  enCours: false,
  derniereSync: null,
  dernierResultatPush: null,
  dernierResultatPull: null,
  necessiteReconnexion: false,
  message: 'Synchronisation automatique pas encore lancée.',
};

// Cherche, dans le détail du résultat du push, une erreur qui ressemble à
// un token expiré/invalide (JWT expiré après 24h, session révoquée, etc.).
function detecterBesoinReconnexion(resultatPush) {
  if (!resultatPush || !Array.isArray(resultatPush.details)) return false;
  return resultatPush.details.some(d =>
    typeof d.erreur === 'string' && /token invalide|jwt expired|401/i.test(d.erreur)
  );
}

async function executerCycleSynchronisation() {
  if (etat.enCours) return; // évite deux cycles qui se chevauchent
  etat.enCours = true;

  try {
    const enLigne = await estEnLigne();
    if (!enLigne) {
      etat.message = '📡 Hors-ligne — synchronisation automatique ignorée pour ce cycle.';
      return;
    }

    const resultatPush = await pousserOutbox();
    etat.dernierResultatPush = resultatPush;

    if (resultatPush.statut === 'non_connecte') {
      etat.necessiteReconnexion = true;
      etat.message = '🔒 Aucune session active — reconnexion nécessaire pour synchroniser.';
      return;
    }

    if (detecterBesoinReconnexion(resultatPush)) {
      etat.necessiteReconnexion = true;
      etat.message = '🔒 Session expirée — reconnexion nécessaire pour poursuivre la synchronisation.';
      return;
    }

    etat.necessiteReconnexion = false;

    const resultatPull = await tirerTout();
    etat.dernierResultatPull = resultatPull;

    etat.derniereSync = new Date().toISOString();
    etat.message = '✅ Synchronisation automatique terminée.';
  } catch (err) {
    etat.message = '❌ Erreur pendant la synchronisation automatique : ' + err.message;
  } finally {
    etat.enCours = false;
  }
}

function demarrerSynchronisationAutomatique() {
  setTimeout(() => {
    executerCycleSynchronisation();
    intervalleId = setInterval(executerCycleSynchronisation, INTERVALLE_MS);
  }, DELAI_INITIAL_MS);
}

function arreterSynchronisationAutomatique() {
  if (intervalleId) {
    clearInterval(intervalleId);
    intervalleId = null;
  }
}

function obtenirEtat() {
  return etat;
}

module.exports = {
  demarrerSynchronisationAutomatique,
  arreterSynchronisationAutomatique,
  obtenirEtat,
  executerCycleSynchronisation, // exposé pour un futur bouton "synchroniser maintenant"
};