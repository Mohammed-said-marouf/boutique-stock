import axios from 'axios';
import { API_BASE, authHeaders } from './client';
import { modeLocalActif } from '../local/mode';
import * as ventesLocales from '../local/services/ventes';
import { declencherSynchronisation } from '../local/sync/scheduler';

// Dans l'APK, un vendeur lit et écrit dans la base du téléphone (voir
// local/mode.js) ; ailleurs, appels directs au serveur.

// GET /api/ventes/stats — statistiques du jour/mois. debutJour/debutMois sont
// calculés côté appelant (fuseau horaire de l'appareil, pas du serveur — voir
// backend/routes/ventes.js).
export function statsVentes(debutJour, debutMois) {
  if (modeLocalActif()) return ventesLocales.statsVentes(debutJour, debutMois);
  return axios.get(`${API_BASE}/api/ventes/stats`, { ...authHeaders(), params: { debutJour, debutMois } });
}

// GET /api/ventes — liste des ventes (vendeur : les siennes ; admin : tout son Compte)
export function listerVentes() {
  if (modeLocalActif()) return ventesLocales.listerVentes();
  return axios.get(`${API_BASE}/api/ventes`, authHeaders());
}

// POST /api/ventes — enregistrer une vente
export async function creerVente(venteData) {
  if (modeLocalActif()) {
    const res = await ventesLocales.creerVente(venteData);
    declencherSynchronisation(); // l'envoyer au serveur sans attendre le prochain cycle
    return res;
  }
  return axios.post(`${API_BASE}/api/ventes`, venteData, authHeaders());
}
