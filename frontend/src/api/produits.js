import axios from 'axios';
import { API_BASE, authHeaders } from './client';

// GET /api/produits — catalogue (stock Magasin + stock par Boutique)
export function listerProduits() {
  return axios.get(`${API_BASE}/api/produits`, authHeaders());
}

// GET /api/produits/alertes-boutiques — produits au seuil d'alerte (ou en
// dessous) dans le stock des boutiques visibles par l'utilisateur
export function alertesStockBoutiques() {
  return axios.get(`${API_BASE}/api/produits/alertes-boutiques`, authHeaders());
}
