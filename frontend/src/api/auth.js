import axios from 'axios';
import { API_URL } from '../config';

// POST /api/auth/login — `options` axios facultatives (ex. timeout, voir AuthContext)
export function login(email, motDePasse, options) {
  return axios.post(`${API_URL}/api/auth/login`, { email, motDePasse }, options);
}

// POST /api/auth/refresh — renouvelle le token avant son expiration (24h côté
// serveur) ; s'appuie sur axios.defaults.headers.common['Authorization'],
// déjà posé par AuthContext.
export function refreshToken() {
  return axios.post(`${API_URL}/api/auth/refresh`);
}
