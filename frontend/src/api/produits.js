import axios from 'axios';
import { API_BASE, authHeaders } from './client';

// GET /api/produits — catalogue (stock Magasin + stock par Boutique)
export function listerProduits() {
  return axios.get(`${API_BASE}/api/produits`, authHeaders());
}
