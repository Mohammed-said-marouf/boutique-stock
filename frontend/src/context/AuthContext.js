import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

import { API_URL } from '../config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

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
        const res = await axios.post(`${API_URL}/api/auth/refresh`);
        const { token, user: utilisateurFrais } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(utilisateurFrais));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(utilisateurFrais);
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

  const login = async (email, motDePasse) => {
   const res = await axios.post(`${API_URL}/api/auth/login`, { email, motDePasse });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

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