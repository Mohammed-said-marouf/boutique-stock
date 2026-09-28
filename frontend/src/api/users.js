import { API_URL } from '../config';
import { appelJson } from './client';

// PUT /api/users/me/photo — multipart (FormData) : reste sur fetch brut, pas
// appelJson (qui force Content-Type: application/json).
export async function changerMaPhoto(fichier) {
  const formData = new FormData();
  formData.append('photo', fichier);
  const res = await fetch(`${API_URL}/api/users/me/photo`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: formData,
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// PUT /api/users/me/motdepasse — changement de mot de passe obligatoire
export const changerMotDePasse = (ancienMotDePasse, nouveauMotDePasse) =>
  appelJson('PUT', '/api/users/me/motdepasse', { ancienMotDePasse, nouveauMotDePasse });
