// Synchronisation automatique — déclenche un cycle push puis pull au
// démarrage de l'appli, puis périodiquement en arrière-plan. Port de
// desktop/sync/scheduler.js, adapté à l'identité unique de l'appareil mobile
// (voir ci-dessous) plutôt qu'à une session de synchro partagée.
//
// Non fait ici, à ajouter en Phase 4/5 :
//  - pause/reprise sur @capacitor/app (appStateChange) : Android peut
//    throttle/tuer les timers JS en arrière-plan, contrairement à Electron
//    qui ne passe jamais en arrière-plan — pas de dépendance ajoutée tant
//    que le spike SQLite (Phase 1) n'est pas confirmé par la CI, pour ne pas
//    élargir la surface de risque en même temps.
//  - AuthContext.js (déjà en place, Phase 0) doit, à chaque login/refresh
//    réussi EN LIGNE, aussi appeler enregistrerSession(userId, {...}) ici
//    (token-store.js) pour que push.js puisse résoudre le token de CET
//    utilisateur même après qu'un autre se soit connecté sur cet appareil.

import { pousserOutbox } from './push';
import { tirerTout } from './pull';
import { estEnLigne } from './connectivite';
import { identiteActuelle } from '../identite';

const INTERVALLE_MS = 5 * 60 * 1000; // 5 minutes entre deux cycles automatiques
const DELAI_INITIAL_MS = 8000; // laisse le temps à l'appli de finir son démarrage

let intervalleId = null;

let etat = {
  enCours: false,
  derniereSync: null,
  dernierResultatPush: null,
  dernierResultatPull: null,
  necessiteReconnexion: false,
  message: 'Synchronisation automatique pas encore lancée.',
};

// Cherche, dans le détail du résultat du push, une erreur qui ressemble à un
// token expiré/invalide (JWT expiré après 24h, session révoquée, etc.).
function detecterBesoinReconnexion(resultatPush) {
  if (!resultatPush || !Array.isArray(resultatPush.details)) return false;
  return resultatPush.details.some(d =>
    typeof d.erreur === 'string' && /token invalide|jwt expired|401/i.test(d.erreur)
  );
}

export async function executerCycleSynchronisation() {
  if (etat.enCours) return; // évite deux cycles qui se chevauchent
  etat.enCours = true;

  try {
    const enLigne = await estEnLigne();
    if (!enLigne) {
      etat.message = '📡 Hors-ligne — synchronisation automatique ignorée pour ce cycle.';
      return;
    }

    if (!identiteActuelle()) {
      etat.message = 'Aucun utilisateur connecté sur cet appareil — synchronisation ignorée.';
      return;
    }

    // Contrairement au desktop, pas de rafraîchissement de token dédié au
    // scheduler ici : AuthContext.js (Phase 0) le fait déjà toutes les 30
    // minutes tant que l'appli est en ligne, pour le seul utilisateur
    // possible sur un téléphone — le sien.
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

export function demarrerSynchronisationAutomatique() {
  setTimeout(() => {
    executerCycleSynchronisation();
    intervalleId = setInterval(executerCycleSynchronisation, INTERVALLE_MS);
  }, DELAI_INITIAL_MS);
}

export function arreterSynchronisationAutomatique() {
  if (intervalleId) {
    clearInterval(intervalleId);
    intervalleId = null;
  }
}

export function obtenirEtat() {
  return etat;
}
