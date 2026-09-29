import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_EN_LIGNE } from '../config';
import { useAuth } from '../context/AuthContext';

// Mode maintenance (activé par le Super Admin, voir backend/routes/maintenance.js).
// Le serveur refuse déjà les requêtes et la connexion des non-superadmins,
// mais les pages ignorent la plupart des erreurs en silence : sans cet
// écran, l'appli restait affichée comme si de rien n'était. Le statut est
// lu sur le serveur EN LIGNE (même depuis le desktop, dont le serveur local
// ne connaît pas la maintenance) toutes les 30 s, et aussitôt qu'une requête
// reçoit la réponse "maintenance". Hors-ligne, le statut est inconnu : le
// desktop continue alors de fonctionner normalement.

const INTERVALLE = 30000;

function useModeMaintenance() {
  const [enMaintenance, setEnMaintenance] = useState(false);
  useEffect(() => {
    let arrete = false;
    const lire = async () => {
      const controleur = new AbortController();
      const delai = setTimeout(() => controleur.abort(), 15000);
      try {
        const res = await fetch(`${API_EN_LIGNE}/api/maintenance/statut`, { signal: controleur.signal });
        const data = await res.json();
        if (!arrete) setEnMaintenance(!!data.enMaintenance);
      } catch {
        if (!arrete) setEnMaintenance(false); // hors-ligne : statut inconnu, on n'empêche pas de travailler
      } finally {
        clearTimeout(delai);
      }
    };
    // Toute réponse "maintenance" d'une requête axios déclenche une relecture immédiate
    const intercepteur = axios.interceptors.response.use(undefined, (err) => {
      if (err?.response?.status === 503 && err.response.data?.maintenance) lire();
      return Promise.reject(err);
    });
    lire();
    const minuteur = setInterval(lire, INTERVALLE);
    window.addEventListener('focus', lire);
    return () => {
      arrete = true;
      clearInterval(minuteur);
      window.removeEventListener('focus', lire);
      axios.interceptors.response.eject(intercepteur);
    };
  }, []);
  return enMaintenance;
}

export default function BarriereMaintenance({ children }) {
  const { user, logout } = useAuth();
  const enMaintenance = useModeMaintenance();

  if (!enMaintenance || user?.role === 'superadmin') {
    return (
      <>
        {enMaintenance && !user && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: '#dc2626', color: 'white',
            padding: '8px 16px', fontSize: '13px', fontWeight: 600, textAlign: 'center'
          }}>
            🔧 Application en maintenance — seul le Super Admin peut se connecter pour le moment.
          </div>
        )}
        {children}
      </>
    );
  }

  // Utilisateur connecté (admin/vendeur) pendant la maintenance : tout est bloqué
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      background: 'linear-gradient(160deg, #0f1423 0%, #141e37 55%, #0a0f19 100%)', fontFamily: 'Segoe UI, sans-serif', boxSizing: 'border-box'
    }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px 28px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.45)' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🔧</div>
        <h1 style={{ margin: '0 0 10px', fontSize: '22px', color: '#0f172a' }}>Application en maintenance</h1>
        <p style={{ margin: '0 0 22px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
          Une opération de maintenance est en cours. L'application sera de nouveau disponible dans quelques instants ;
          cette page se débloquera d'elle-même.
        </p>
        <button onClick={logout} style={{
          padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: '8px',
          fontSize: '14px', fontWeight: 600, color: '#475569', cursor: 'pointer'
        }}>Se déconnecter</button>
      </div>
    </div>
  );
}
