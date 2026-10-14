import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

import { login as loginApi, refreshToken } from '../api/auth';
import { estApk } from '../local/mode';
import { memoriserCompte, mettreAJourSessionMemorisee, connexionHorsLigne } from '../local/services/auth';
import {
  demarrerSynchronisationAutomatique, arreterSynchronisationAutomatique, executerCycleSynchronisation,
} from '../local/sync/scheduler';

const AuthContext = createContext();

// Dans l'APK, un vendeur travaille sur la base du téléphone (local/mode.js) :
// sa session doit survivre à l'expiration du token (24h) tant qu'il est
// hors-ligne — c'est la synchro qui demande une reconnexion dès que le
// serveur est joignable et refuse le token (événement bs-reconnexion-requise).
const vendeurApk = (u) => estApk() && u?.role === 'vendeur';

// Le premier login en ligne d'un vendeur sur le téléphone doit remplir la
// base locale avant d'ouvrir l'écran de vente — sans bloquer plus de 20 s
// (la synchro continue alors en arrière-plan).
const premiereSynchro = () => Promise.race([
  executerCycleSynchronisation(),
  new Promise(resolve => setTimeout(resolve, 20000)),
]);

// Date d'expiration (ms) d'un token JWT du serveur en ligne, ou null si le
// token n'en a pas (token local du desktop, qui n'expire jamais) ou est illisible.
function expirationToken(token) {
  try {
    const charge = token.split('.')[1];
    if (!charge) return null;
    const { exp } = JSON.parse(atob(charge.replace(/-/g, '+').replace(/_/g, '/')));
    return exp ? exp * 1000 : null;
  } catch {
    return null;
  }
}
const tokenExpire = (token) => {
  const exp = token && expirationToken(token);
  return !!exp && exp <= Date.now();
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    // Un token expiré (appli fermée plus de 24h : le renouvellement
    // ci-dessous ne tourne que tant qu'elle est ouverte) ne doit pas
    // restaurer la session : l'utilisateur semblait connecté, mais toutes
    // ses actions échouaient avec "Token invalide".
    const utilisateurStocke = userData ? JSON.parse(userData) : null;
    if (token && utilisateurStocke && (!tokenExpire(token) || vendeurApk(utilisateurStocke))) {
      setUser(utilisateurStocke);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else if (token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  // Session expirée en cours d'utilisation (ex : ordinateur en veille ou
  // hors-ligne au moment du renouvellement) : retour à l'écran de connexion
  // plutôt qu'une appli qui semble marcher mais refuse tout.
  useEffect(() => {
    if (!user || vendeurApk(user)) return undefined;
    const fermerSiExpire = () => {
      if (tokenExpire(localStorage.getItem('token'))) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      }
    };
    const minuteur = setInterval(fermerSiExpire, 60 * 1000);
    window.addEventListener('focus', fermerSiExpire);
    return () => { clearInterval(minuteur); window.removeEventListener('focus', fermerSiExpire); };
  }, [user]);

  // Le token expire au bout de 24h côté serveur. Sans ça, un vendeur qui
  // reste connecté à l'appli (web ou mobile) plus longtemps voit soudain
  // toutes ses requêtes échouer avec "Token invalide" en pleine vente, sans
  // comprendre pourquoi, jusqu'à se déconnecter/reconnecter manuellement.
  // On le renouvelle donc régulièrement en arrière-plan tant qu'il est
  // encore valide (même mécanisme que la synchro desktop, voir
  // desktop/sync/scheduler.js).
  useEffect(() => {
    if (!user) return;
    const rafraichirToken = async () => {
      try {
        const res = await refreshToken();
        const { token, user: utilisateurFrais } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(utilisateurFrais));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(utilisateurFrais);
        if (estApk()) mettreAJourSessionMemorisee(token, utilisateurFrais).catch(() => {});
      } catch {
        // Hors-ligne, ou token déjà expiré (session restaurée très ancienne) :
        // rien à faire ici, une vraie reconnexion sera nécessaire dans ce cas.
      }
    };
    rafraichirToken(); // tout de suite : une session restaurée au démarrage peut déjà être ancienne
    const intervalle = setInterval(rafraichirToken, 30 * 60 * 1000); // toutes les 30 minutes
    return () => clearInterval(intervalle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Synchro automatique de la base du téléphone, tant qu'un vendeur y est connecté.
  useEffect(() => {
    if (!vendeurApk(user)) return undefined;
    demarrerSynchronisationAutomatique();
    return () => arreterSynchronisationAutomatique();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const ouvrirSession = (token, utilisateur) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(utilisateur));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(utilisateur);
  };

  const login = async (email, motDePasse) => {
    if (!estApk()) {
      const res = await loginApi(email, motDePasse);
      const { token, user } = res.data;
      ouvrirSession(token, user);
      return user;
    }

    // APK : en ligne d'abord (le serveur Render gratuit peut mettre ~50 s à
    // se réveiller) ; hors-ligne seulement si le serveur ne répond pas du
    // tout — un refus (mauvais mot de passe, compte désactivé, maintenance)
    // reste un refus.
    let res;
    try {
      res = navigator.onLine === false ? null : await loginApi(email, motDePasse, { timeout: 60000 });
    } catch (err) {
      if (err.response) throw err;
    }
    if (!res) {
      const session = await connexionHorsLigne(email, motDePasse);
      ouvrirSession(session.token, session.user);
      return session.user;
    }

    const { token, user } = res.data;
    try {
      await memoriserCompte(email, motDePasse, token, user);
    } catch {
      // Base locale indisponible : la connexion en ligne reste valable,
      // seule la connexion hors-ligne ultérieure ne sera pas possible.
    }
    ouvrirSession(token, user);
    if (vendeurApk(user)) await premiereSynchro();
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // Token refusé par le serveur alors qu'il est joignable (expiré après une
  // longue période hors-ligne) : retour à l'écran de connexion, une
  // connexion en ligne redonnera un token valide (voir sync/scheduler.js).
  useEffect(() => {
    window.addEventListener('bs-reconnexion-requise', logout);
    return () => window.removeEventListener('bs-reconnexion-requise', logout);
  }, []);

  // Met à jour des champs de l'utilisateur connecté (ex: après avoir changé son
  // mot de passe temporaire) et les garde dans le stockage local.
  const mettreAJourUtilisateur = (modifications) => {
    setUser(prev => {
      if (!prev) return prev;
      const suivant = { ...prev, ...modifications };
      localStorage.setItem('user', JSON.stringify(suivant));
      return suivant;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, mettreAJourUtilisateur }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);