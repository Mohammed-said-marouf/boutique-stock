import { useState, useEffect } from 'react';
import { API_URL } from '../config';

// Page "Dépenses & versements", partagée entre l'admin et le vendeur.
//  - Dépense : argent sorti de la caisse (vendeur sur sa caisse assignée, admin
//    sur la caisse de son choix).
//  - Versement : remise d'espèces par le vendeur (à l'admin ou à la banque).
//  - Solde d'une caisse = ventes en espèces - dépenses - versements
//    (calculé par le backend, voir routes/tresorerie.js).
// Le vendeur voit et crée les siens ; l'admin voit tout son Compte, crée des
// dépenses, et peut corriger/supprimer dépenses et versements.

const fcfa = (n) => `${(n || 0).toLocaleString('fr-FR')} FCFA`;
const dateFr = (d) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

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

const champ = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' };
const etiquette = { fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' };
const carte = { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const boutonMini = { padding: '4px 8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };

export default function Tresorerie({ role, caisseId }) {
  const estAdmin = role !== 'vendeur';
  const [onglet, setOnglet] = useState('depenses'); // 'depenses' | 'versements'
  const [soldes, setSoldes] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [versements, setVersements] = useState([]);
  const [chargement, setChargement] = useState(true);

  // null = formulaire fermé ; { id?, caisseId, montant, motif, note }
  const [form, setForm] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    const [s, d, v] = await Promise.all([
      appel('GET', '/api/tresorerie/soldes'),
      appel('GET', '/api/depenses'),
      appel('GET', '/api/versements'),
    ]);
    if (Array.isArray(s.data)) setSoldes(s.data);
    if (Array.isArray(d.data)) setDepenses(d.data);
    if (Array.isArray(v.data)) setVersements(v.data);
    setChargement(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const nomCaisse = (id) => {
    const c = soldes.find(s => s.caisseId === id);
    return c ? `${c.nom}${c.boutiqueNom ? ' · ' + c.boutiqueNom : ''}` : '—';
  };

  const ouvrirFormulaire = () => {
    setErreur('');
    setForm({ caisseId: soldes[0]?.caisseId || '', montant: '', motif: '', note: '' });
  };

  const ouvrirEdition = (ligne) => {
    setErreur('');
    setForm({ id: ligne._id, caisseId: ligne.caisseId, montant: String(ligne.montant), motif: ligne.motif || '', note: ligne.note || '' });
  };

  const soumettre = async () => {
    const montant = Number(form.montant);
    if (!montant || montant <= 0) { setErreur('Saisissez un montant supérieur à 0.'); return; }
    if (onglet === 'depenses' && !form.motif.trim()) { setErreur('Le motif est requis.'); return; }
    if (!form.id && estAdmin && onglet === 'depenses' && !form.caisseId) { setErreur('Choisissez une caisse.'); return; }

    const base = onglet === 'depenses' ? '/api/depenses' : '/api/versements';
    const corps = onglet === 'depenses'
      ? { montant, motif: form.motif, note: form.note, caisseId: form.caisseId }
      : { montant, note: form.note };

    setEnvoi(true);
    setErreur('');
    try {
      const { ok, data } = form.id
        ? await appel('PUT', `${base}/${form.id}`, corps)
        : await appel('POST', base, corps);
      if (!ok) { setErreur(data?.message || 'Erreur'); return; }
      setForm(null);
      charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (ligne) => {
    const quoi = onglet === 'depenses' ? 'cette dépense' : 'ce versement';
    if (!window.confirm(`Supprimer ${quoi} de ${fcfa(ligne.montant)} ?`)) return;
    const { ok, data } = await appel('DELETE', `${onglet === 'depenses' ? '/api/depenses' : '/api/versements'}/${ligne._id}`);
    if (!ok) { window.alert(data?.message || 'Erreur'); return; }
    charger();
  };

  const aCaisse = soldes.length > 0;
  const lignes = onglet === 'depenses' ? depenses : versements;
  // Le vendeur crée dépenses et versements ; l'admin ne crée que des dépenses.
  const peutCreer = onglet === 'depenses' || !estAdmin;
  const total = lignes.reduce((s, l) => s + (l.montant || 0), 0);

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '20px' }}>Dépenses & versements</h2>
      <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#666' }}>
        Solde de caisse = ventes en espèces − dépenses − versements.
      </p>

      {!estAdmin && !caisseId && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
          ⚠️ Aucune caisse ne vous est assignée — demandez à l'admin de vous en attribuer une avant d'enregistrer une dépense ou un versement.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {soldes.map(s => (
          <div key={s.caisseId} style={{ ...carte, padding: '16px' }}>
            <div style={{ fontSize: '13px', color: '#666', fontWeight: '600' }}>🧾 {s.nom}{s.boutiqueNom ? ` · ${s.boutiqueNom}` : ''}</div>
            <div style={{ fontSize: '22px', fontWeight: '800', margin: '6px 0', color: s.solde < 0 ? '#dc2626' : '#16a34a' }}>{fcfa(s.solde)}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
              Ventes {fcfa(s.ventes)}<br />
              Dépenses − {fcfa(s.depenses)}<br />
              Versements − {fcfa(s.versements)}
            </div>
          </div>
        ))}
        {!chargement && soldes.length === 0 && (
          <div style={{ ...carte, color: '#999', fontSize: '13px' }}>Aucune caisse à afficher.</div>
        )}
      </div>

      <div style={carte}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {[['depenses', '💸 Dépenses'], ['versements', '🏦 Versements']].map(([cle, libelle]) => (
            <button key={cle} onClick={() => { setOnglet(cle); setForm(null); setErreur(''); }} style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              background: onglet === cle ? '#2563eb' : '#f1f5f9', color: onglet === cle ? 'white' : '#475569'
            }}>{libelle}</button>
          ))}
          {peutCreer && (
            <button onClick={ouvrirFormulaire} disabled={!aCaisse} style={{
              marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: '700',
              background: aCaisse ? '#16a34a' : '#ccc', color: 'white', cursor: aCaisse ? 'pointer' : 'not-allowed'
            }}>+ {onglet === 'depenses' ? 'Nouvelle dépense' : 'Nouveau versement'}</button>
          )}
        </div>

        {form && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
              {form.id ? 'Modifier' : 'Nouveau'} {onglet === 'depenses' ? 'dépense' : 'versement'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {estAdmin && !form.id && onglet === 'depenses' && (
                <div>
                  <label style={etiquette}>Caisse</label>
                  <select value={form.caisseId} onChange={e => setForm({ ...form, caisseId: e.target.value })} style={champ}>
                    {soldes.map(s => <option key={s.caisseId} value={s.caisseId}>{s.nom}{s.boutiqueNom ? ` · ${s.boutiqueNom}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={etiquette}>Montant (FCFA)</label>
                <input type="number" min="1" autoFocus value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} style={champ} />
              </div>
              {onglet === 'depenses' && (
                <div>
                  <label style={etiquette}>Motif</label>
                  <input value={form.motif} onChange={e => setForm({ ...form, motif: e.target.value })} placeholder="Ex: Transport, sacs, électricité..." style={champ} />
                </div>
              )}
              <div>
                <label style={etiquette}>Note (facultatif)</label>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') soumettre(); }}
                  placeholder={onglet === 'versements' ? 'Ex: remis à M. Diallo' : ''} style={champ} />
              </div>
            </div>
            {erreur && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>⚠️ {erreur}</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button onClick={() => setForm(null)} style={{ padding: '9px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#666', fontWeight: '600' }}>Annuler</button>
              <button onClick={soumettre} disabled={envoi} style={{ padding: '9px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '700', opacity: envoi ? 0.7 : 1 }}>
                {envoi ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        {chargement ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Chargement...</div>
        ) : lignes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#999', fontSize: '13px' }}>
            Aucun{onglet === 'depenses' ? 'e dépense' : ' versement'} enregistré{onglet === 'depenses' ? 'e' : ''} pour l'instant.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Date', 'Caisse', ...(estAdmin ? ['Saisi par'] : []), 'Montant', onglet === 'depenses' ? 'Motif' : 'Note', ...(estAdmin ? [''] : [])].map((h, i) => (
                    <th key={h + i} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 8px', color: '#666', fontSize: '13px', whiteSpace: 'nowrap' }}>{dateFr(l.date)}</td>
                    <td style={{ padding: '10px 8px', color: '#333', fontSize: '13px' }}>{nomCaisse(l.caisseId)}</td>
                    {estAdmin && <td style={{ padding: '10px 8px', color: '#333', fontSize: '13px' }}>{l.nomAuteur || '—'}</td>}
                    <td style={{ padding: '10px 8px', color: onglet === 'depenses' ? '#dc2626' : '#2563eb', fontWeight: '700', whiteSpace: 'nowrap' }}>{fcfa(l.montant)}</td>
                    <td style={{ padding: '10px 8px', color: '#333', fontSize: '13px' }}>
                      {onglet === 'depenses' ? l.motif : (l.note || '—')}
                      {onglet === 'depenses' && l.note && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{l.note}</div>}
                    </td>
                    {estAdmin && (
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => ouvrirEdition(l)} title="Modifier" style={boutonMini}>✏️</button>{' '}
                        <button onClick={() => supprimer(l)} title="Supprimer" style={{ ...boutonMini, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>🗑️</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', padding: '12px 8px 0', fontSize: '13px', color: '#666' }}>
              Total : <strong style={{ color: '#0f172a' }}>{fcfa(total)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
