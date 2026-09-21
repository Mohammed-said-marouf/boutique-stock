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