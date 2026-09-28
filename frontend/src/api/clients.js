import axios from 'axios';
import { API_BASE, authHeaders } from './client';

// GET /api/clients — liste des clients (vendeur : les siens ; admin : tout son Compte)
export function listerClients() {
  return axios.get(`${API_BASE}/api/clients`, authHeaders());
}

// POST /api/clients — créer un client
export function creerClient(donnees) {
  return axios.post(`${API_BASE}/api/clients`, donnees, authHeaders());
}
