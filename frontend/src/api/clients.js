import axios from 'axios';
import { API_BASE, authHeaders } from './client';
import { modeLocalActif } from '../local/mode';
import * as clientsLocaux from '../local/services/clients';
import { declencherSynchronisation } from '../local/sync/scheduler';

// GET /api/clients — liste des clients (vendeur : les siens ; admin : tout son Compte)
export function listerClients() {
  if (modeLocalActif()) return clientsLocaux.listerClients();
  return axios.get(`${API_BASE}/api/clients`, authHeaders());
}

// POST /api/clients — créer un client
export async function creerClient(donnees) {
  if (modeLocalActif()) {
    const res = await clientsLocaux.creerClient(donnees);
    declencherSynchronisation();
    return res;
  }
  return axios.post(`${API_BASE}/api/clients`, donnees, authHeaders());
}
