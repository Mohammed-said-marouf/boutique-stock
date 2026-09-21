import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { API_URL } from '../config';

// Licence d'abonnement côté boutique (admin) :
//  - LicenceBoutique : plan en cours, échéance, et saisie d'une clé de licence
//    fournie par le super admin (POST /api/licences/activer).
//  - BandeauLicence : bandeau d'alerte quand l'abonnement expire bientôt.
// À l'échéance la boutique repasse au plan gratuit (rien n'est bloqué).

const JOURS_ALERTE = 7;
const JOUR = 24 * 3600 * 1000;

const couleursPlan = {
  premium: ['#ede9fe', '#7c3aed'],
  standard: ['#dbeafe', '#2563eb'],
  gratuit: ['#dcfce7', '#16a34a'],
};

const dateFr = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

async function appel(methode, chemin, corps) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* corps vide */ }
  return { ok: res.ok, data };
}

// Abonnement à jour de la boutique (le stockage local de la session peut être périmé)
function useBoutique(boutiqueId) {
  const [boutique, setBoutique] = useState(null);
  const charger = async () => {
    if (!boutiqueId) return;
    try {
      const { ok, data } = await appel('GET', `/api/boutiques/${boutiqueId}`);
      if (ok) setBoutique(data);
    } catch { /* réseau instable : on n'affiche simplement rien */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [boutiqueId]);
  return [boutique, charger];
}

const joursRestants = (boutique) => {
  if (!boutique || boutique.abonnement === 'gratuit' || !boutique.abonnementExpireLe) return null;
  return Math.ceil((new Date(boutique.abonnementExpireLe).getTime() - Date.now()) / JOUR);
};

export function BandeauLicence({ boutiqueId, versParametres }) {
  const [boutique] = useBoutique(boutiqueId);
  const jours = joursRestants(boutique);
  if (jours === null || jours > JOURS_ALERTE) return null;
  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '10px 16px',
      borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '16px'
    }}>
      ⏳ Votre abonnement {boutique.abonnement} expire {jours <= 0 ? "aujourd'hui" : `dans ${jours} jour${jours > 1 ? 's' : ''}`} ({dateFr(boutique.abonnementExpireLe)}).
      {' '}Ensuite, la boutique repassera au plan gratuit.
      {versParametres && <> <NavLink to={versParametres} style={{ color: '#92400e', textDecoration: 'underline' }}>Activer une licence</NavLink></>}
    </div>
  );
}

export default function LicenceBoutique({ boutiqueId }) {
  const [boutique, recharger] = useBoutique(boutiqueId);
  const [cle, setCle] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok'|'erreur', texte }

  const activer = async () => {
    if (!cle.trim()) { setMessage({ type: 'erreur', texte: 'Saisissez votre clé de licence.' }); return; }
    setEnvoi(true);
    setMessage(null);
    try {
      const { ok, data } = await appel('POST', '/api/licences/activer', { cle });
      if (!ok) { setMessage({ type: 'erreur', texte: data?.message || 'Activation impossible.' }); return; }
      setCle('');
      setMessage({ type: 'ok', texte: `Licence activée : abonnement ${data.abonnement} valable jusqu'au ${dateFr(data.abonnementExpireLe)}.` });
      recharger();
    } catch (e) {
      setMessage({ type: 'erreur', texte: e.message });
    } finally {
      setEnvoi(false);
    }
  };

  const plan = boutique?.abonnement || 'gratuit';
  const [fond, couleur] = couleursPlan[plan] || couleursPlan.gratuit;
  const jours = joursRestants(boutique);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <span style={{ background: fond, color: couleur, padding: '4px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', textTransform: 'capitalize' }}>{plan}</span>
        <span style={{ fontSize: '13px', color: '#666' }}>
          {!boutique ? 'Chargement...'
            : jours === null ? (plan === 'gratuit' ? 'Plan gratuit' : 'Sans date d\'expiration')
            : `Valable jusqu'au ${dateFr(boutique.abonnementExpireLe)} (${jours} jour${jours > 1 ? 's' : ''} restant${jours > 1 ? 's' : ''})`}
        </span>
      </div>

      <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Activer une licence</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input value={cle} onChange={e => setCle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') activer(); }}
          placeholder="BS-STD-XXXX-XXXX-XXXX" autoCapitalize="characters" spellCheck={false}
          style={{ flex: '1 1 220px', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', outline: 'none' }} />
        <button onClick={activer} disabled={envoi} style={{
          padding: '10px 18px', background: envoi ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px',
          fontSize: '14px', fontWeight: '700', cursor: envoi ? 'not-allowed' : 'pointer'
        }}>{envoi ? '...' : 'Activer'}</button>
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
        La clé vous est fournie par l'administrateur de la plateforme. Si vous en activez une du même abonnement avant l'échéance, la durée s'ajoute.
      </div>

      {message && (
        <div style={{
          marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
          background: message.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (message.type === 'ok' ? '#bbf7d0' : '#fecaca'),
          color: message.type === 'ok' ? '#166534' : '#dc2626'
        }}>{message.type === 'ok' ? '✅' : '⚠️'} {message.texte}</div>
      )}
    </div>
  );
}
