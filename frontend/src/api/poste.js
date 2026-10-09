import { API_BASE } from './client';

// Sauvegarde COMPLÈTE du poste desktop (copie de la base locale, comptes
// compris) — voir desktop/routes/poste.js. Disponible uniquement dans
// l'application desktop : c'est son preload qui fournit le secret exigé par
// ces routes (window.bsDesktop).

export const posteDesktopDisponible = () => !!window.bsDesktop?.secretPoste;

const enteteSecret = () => ({ 'X-Poste-Secret': window.bsDesktop?.secretPoste || '' });

async function lireErreur(res) {
  try { return (await res.json()).message; } catch { return null; }
}

// Renvoie { ok, blob, nomFichier } ou { ok: false, message }
export async function exporterPoste() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/api/poste/export`, {
    headers: { ...enteteSecret(), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, message: (await lireErreur(res)) || `Sauvegarde impossible (erreur ${res.status}).` };
  const nom = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
  return { ok: true, blob: await res.blob(), nomFichier: nom ? nom[1] : 'sauvegarde-poste.bsdb' };
}

// Envoie le fichier ; en cas de succès l'application redémarre d'elle-même.
// Renvoie { ok, bilan } ou { ok: false, message }
export async function importerPoste(fichier) {
  const res = await fetch(`${API_BASE}/api/poste/importer`, {
    method: 'POST',
    headers: { ...enteteSecret(), 'Content-Type': 'application/octet-stream' },
    body: fichier,
  });
  let data = null;
  try { data = await res.json(); } catch { /* corps non JSON */ }
  if (!res.ok) return { ok: false, message: data?.message || `Import impossible (erreur ${res.status}).` };
  return { ok: true, bilan: data?.bilan };
}
