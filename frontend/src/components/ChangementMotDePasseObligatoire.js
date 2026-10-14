import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { changerMotDePasse } from '../api/users';

// Écran bloquant affiché à la connexion après une réinitialisation de mot de
// passe par le super admin : l'utilisateur doit choisir son propre mot de
// passe avant d'utiliser l'appli. On ne lui redemande PAS le mot de passe
// temporaire ici : il vient déjà de s'en servir pour se connecter (son token
// le prouve), le lui faire retaper n'était qu'un point d'échec de plus (ex:
// caractère mal transmis par la personne qui lui a communiqué). Voir
// PUT /api/users/me/motdepasse (routes/users.js), qui saute la vérification
// de l'ancien mot de passe précisément dans ce cas.
const champ = { width: '100%', padding: '11px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', outline: 'none' };
const etiquette = { fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' };

export default function ChangementMotDePasseObligatoire() {
  const { user, logout, mettreAJourUtilisateur } = useAuth();
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const valider = async () => {
    if (nouveau.length < 6) { setErreur('Le nouveau mot de passe doit contenir au moins 6 caractères.'); return; }
    if (nouveau !== confirmation) { setErreur('Les deux mots de passe ne correspondent pas.'); return; }

    setEnvoi(true);
    setErreur('');
    try {
      const { ok, status, data } = await changerMotDePasse(undefined, nouveau);
      if (!ok) { setErreur(data?.message || `Erreur ${status}`); return; }
      mettreAJourUtilisateur({ doitChangerMotDePasse: false });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflowY: 'auto'
    }}>
      <div style={{ background: 'white', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: '20px' }}>🔑 Choisissez votre mot de passe</h2>
        <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
          Bonjour {user?.nom}. Votre mot de passe vient d'être réinitialisé : choisissez un nouveau mot de passe que vous seul connaissez.
        </p>

        <label style={etiquette}>Nouveau mot de passe</label>
        <input type="password" autoFocus value={nouveau} onChange={e => setNouveau(e.target.value)} placeholder="6 caractères minimum" style={{ ...champ, marginBottom: '12px' }} />

        <label style={etiquette}>Confirmer le nouveau mot de passe</label>
        <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') valider(); }} style={champ} />

        {erreur && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '12px' }}>⚠️ {erreur}</div>}

        <button onClick={valider} disabled={envoi} style={{
          width: '100%', marginTop: '18px', padding: '12px', background: envoi ? '#93c5fd' : '#2563eb', color: 'white',
          border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: envoi ? 'not-allowed' : 'pointer'
        }}>{envoi ? '...' : 'Enregistrer mon mot de passe'}</button>
        <button onClick={logout} style={{ width: '100%', marginTop: '8px', padding: '10px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
