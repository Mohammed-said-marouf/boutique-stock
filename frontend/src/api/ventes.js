import axios from 'axios';
import { API_BASE, authHeaders } from './client';

// GET /api/ventes/stats — statistiques du jour/mois. debutJour/debutMois sont
// calculés côté appelant (fuseau horaire de l'appareil, pas du serveur — voir
// backend/routes/ventes.js).
export function statsVentes(debutJour, debutMois) {
  return axios.get(`${API_BASE}/api/ventes/stats`, { ...authHeaders(), params: { debutJour, debutMois } });
}

// GET /api/ventes — liste des ventes (vendeur : les siennes ; admin : tout son Compte)
export function listerVentes() {
  return axios.get(`${API_BASE}/api/ventes`, authHeaders());
}

// POST /api/ventes — enregistrer une vente
export function creerVente(venteData) {
  return axios.post(`${API_BASE}/api/ventes`, venteData, authHeaders());
}
