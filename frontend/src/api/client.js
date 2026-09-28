import { API_URL } from '../config';

// Couche d'abstraction API — étape 0 d'un chantier plus large (rendre l'APK
// Android capable de fonctionner hors-ligne comme la version desktop). Pour
// l'instant, ces fonctions font EXACTEMENT ce que faisaient les appels
// fetch/axios directs qu'elles remplacent — aucun changement de comportement.
// Une future étape fera router ces mêmes fonctions vers une base locale
// (SQLite embarqué) quand l'app tourne dans l'APK.

export const API_BASE = `${API_URL}`;

// En-têtes avec le token JWT, pour les appels axios (style historique de
// VendeurLayout.js/AdminLayout.js).
export function authHeaders() {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
}

// Appel générique basé sur fetch (style historique de Tresorerie.js et
// Sauvegarde.js : ne lève jamais d'exception liée au statut HTTP, renvoie
// toujours {ok, status, data} — à l'appelant de vérifier `ok`).
export async function appelJson(methode, chemin, corps) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* corps vide ou non JSON */ }
  return { ok: res.ok, status: res.status, data };
}
