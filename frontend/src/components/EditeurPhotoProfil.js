import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { API_URL } from '../config';

// Bloc "changer sa photo de profil", réutilisé dans les pages de profil de
// l'admin, du vendeur et du super admin. Envoie vers PUT /api/users/me/photo
// (routes/users.js) et met à jour la session sans recharger la page.
export default function EditeurPhotoProfil({ fond = '#2563eb', taille = 64 }) {
  const { user, mettreAJourUtilisateur } = useAuth();
  const champFichier = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const choisir = () => champFichier.current && champFichier.current.click();

  const changer = async (e) => {
    const fichier = e.target.files && e.target.files[0];
    e.target.value = ''; // permet de re-choisir le même fichier
    if (!fichier) return;

    setEnvoi(true);
    setErreur('');
    try {
      const formData = new FormData();
      formData.append('photo', fichier);
      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.message || 'Erreur'); return; }
      mettreAJourUtilisateur({ photo: data.photo });
    } catch (err) {
      setErreur('Erreur réseau : ' + err.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
      <Avatar nom={user?.nom} photo={user?.photo} size={taille} fond={fond} style={{ fontSize: Math.round(taille * 0.42) }} />
      <div>
        <input ref={champFichier} type="file" accept="image/png,image/jpeg,image/webp" onChange={changer} style={{ display: 'none' }} />
        <button onClick={choisir} disabled={envoi} style={{
          padding: '8px 16px', background: envoi ? '#f1f5f9' : 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
          cursor: envoi ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', color: '#334155'
        }}>{envoi ? 'Envoi...' : '📷 Changer ma photo'}</button>
        {erreur && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>⚠️ {erreur}</div>}
      </div>
    </div>
  );
}
