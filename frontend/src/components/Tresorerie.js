import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';

// Page "Dépenses & versements", partagée entre l'admin et le vendeur.
//  - Dépense : argent sorti de la caisse (vendeur sur sa caisse assignée, admin
//    sur la caisse de son choix).
//  - Versement : remise d'espèces par le vendeur à l'admin.
//  - Solde d'une caisse = ventes en espèces - dépenses - versements validés
//    (calculé par le backend, voir routes/tresorerie.js).
// Le vendeur voit et crée les siens ; l'admin voit tout son Compte, crée des
// dépenses, et peut corriger/supprimer dépenses et versements.
// Un versement déclaré par le vendeur reste "en attente" jusqu'à ce que l'admin
// confirme l'avoir reçu : seuls les versements validés réduisent le solde.

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
const STATUTS = {
  en_attente: ['⏳ En attente', '#fef9c3', '#a16207'],
  valide: ['✅ Validé', '#dcfce7', '#166534'],
  refuse: ['❌ Refusé', '#fee2e2', '#b91c1c'],
  inconnu: ['❔ Statut inconnu', '#f1f5f9', '#64748b'],
};
const boutonMini = { padding: '4px 8px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };

// Nombre de versements à approuver, rafraîchi toutes les 30 s : alimente la
// pastille de notification du menu admin. La page Trésorerie émet
// "versements-modifies" après chaque décision pour la mettre à jour aussitôt.
export function useVersementsEnAttente(actif = true) {
  const [nombre, setNombre] = useState(0);
  useEffect(() => {
    if (!actif) return undefined;
    let arrete = false;
    const lire = async () => {
      try {
        const { ok, data } = await appel('GET', '/api/versements/en-attente/nombre');
        if (!arrete && ok) setNombre(data.nombre || 0);
      } catch { /* réseau instable : on réessaiera au prochain passage */ }
    };
    lire();
    const minuteur = setInterval(lire, 30000);
    window.addEventListener('versements-modifies', lire);
    return () => { arrete = true; clearInterval(minuteur); window.removeEventListener('versements-modifies', lire); };
  }, [actif]);
  return nombre;
}

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
  const [info, setInfo] = useState('');
  const premierChargement = useRef(true);

  const charger = async () => {
    const [s, d, v] = await Promise.all([
      appel('GET', '/api/tresorerie/soldes'),
      appel('GET', '/api/depenses'),
      appel('GET', '/api/versements'),
    ]);
    if (Array.isArray(s.data)) setSoldes(s.data);
    if (Array.isArray(d.data)) setDepenses(d.data);
    if (Array.isArray(v.data)) {
      setVersements(v.data);
      // L'admin arrive directement sur l'onglet qui demande son attention
      if (premierChargement.current && estAdmin && v.data.some(x => x.statut === 'en_attente')) setOnglet('versements');
    }
    premierChargement.current = false;
    setChargement(false);
  };

  // Rafraîchi toutes les 30 s pour que l'admin voie arriver les nouveaux versements
  useEffect(() => {
    charger();
    const minuteur = setInterval(() => { charger().catch(() => {}); }, 30000);
    return () => clearInterval(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nomCaisse = (id) => {
    const c = soldes.find(s => s.caisseId === id);
    return c ? `${c.nom}${c.boutiqueNom ? ' · ' + c.boutiqueNom : ''}` : '—';
  };

  const ouvrirFormulaire = () => {
    setErreur('');
    setInfo('');
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
      if (onglet === 'versements' && !form.id) {
        setInfo("Versement envoyé : il sera pris en compte dans le solde de la caisse dès que l'admin l'aura approuvé.");
      }
      setForm(null);
      charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  // Décision de l'admin sur un versement en attente
  const decider = async (ligne, action, corps) => {
    const { ok, data } = await appel('PUT', `/api/versements/${ligne._id}/${action}`, corps);
    if (!ok) window.alert(data?.message || 'Erreur');
    await charger();
    window.dispatchEvent(new Event('versements-modifies')); // met la pastille du menu à jour
  };

  const approuver = (ligne) => {
    if (!window.confirm(`Confirmer que vous avez bien reçu ${fcfa(ligne.montant)} de la part de ${ligne.nomAuteur || 'ce vendeur'} ?`)) return;
    decider(ligne, 'valider');
  };

  const refuser = (ligne) => {
    const motif = window.prompt(`Refuser le versement de ${fcfa(ligne.montant)} ? Motif (facultatif) :`, '');
    if (motif === null) return; // annulé
    decider(ligne, 'refuser', { motif });
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
  const enAttente = versements.filter(v => v.statut === 'en_attente');
  // Pour les versements, seul ce qui est validé compte réellement
  const total = lignes.filter(l => onglet !== 'versements' || l.statut === 'valide').reduce((s, l) => s + (l.montant || 0), 0);

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '20px' }}>Dépenses & versements</h2>
      <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#666' }}>
        Solde de caisse = ventes en espèces − dépenses − versements approuvés par l'admin.
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
            {s.versementsEnAttente > 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '600', color: '#a16207', background: '#fef9c3', borderRadius: '6px', padding: '4px 8px' }}>
                ⏳ {fcfa(s.versementsEnAttente)} en attente d'approbation
              </div>
            )}
          </div>
        ))}
        {!chargement && soldes.length === 0 && (
          <div style={{ ...carte, color: '#999', fontSize: '13px' }}>Aucune caisse à afficher.</div>
        )}
      </div>

      {estAdmin && enAttente.length > 0 && onglet !== 'versements' && (
        <div onClick={() => setOnglet('versements')} style={{
          background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '12px 16px', borderRadius: '10px',
          fontSize: '14px', fontWeight: '600', marginBottom: '16px', cursor: 'pointer'
        }}>
          🔔 {enAttente.length} versement{enAttente.length > 1 ? 's' : ''} en attente d'approbation — cliquez pour {enAttente.length > 1 ? 'les' : 'le'} traiter
        </div>
      )}

      {info && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
          ✅ {info}
        </div>
      )}

      <div style={carte}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {[['depenses', '💸 Dépenses'], ['versements', '🏦 Versements']].map(([cle, libelle]) => (
            <button key={cle} onClick={() => { setOnglet(cle); setForm(null); setErreur(''); setInfo(''); }} style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              background: onglet === cle ? '#2563eb' : '#f1f5f9', color: onglet === cle ? 'white' : '#475569'
            }}>{libelle}{estAdmin && cle === 'versements' && enAttente.length > 0 && (
              <span style={{ marginLeft: '6px', background: '#dc2626', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px' }}>{enAttente.length}</span>
            )}</button>
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
            {onglet === 'versements' && !form.id && (
              <div style={{ fontSize: '12px', color: '#a16207', marginTop: '10px' }}>
                ⏳ Ce versement sera « en attente » : il ne réduira le solde de la caisse qu'une fois approuvé par l'admin, qui sera prévenu.
              </div>
            )}
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
                  {['Date', 'Caisse', ...(estAdmin ? ['Saisi par'] : []), 'Montant', onglet === 'depenses' ? 'Motif' : 'Note', ...(onglet === 'versements' ? ['Statut'] : []), ...(estAdmin ? [''] : [])].map((h, i) => (
                    <th key={h + i} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l._id} style={{ borderBottom: '1px solid #f8fafc', background: onglet === 'versements' && l.statut === 'en_attente' ? '#fffbeb' : undefined }}>
                    <td style={{ padding: '10px 8px', color: '#666', fontSize: '13px', whiteSpace: 'nowrap' }}>{dateFr(l.date)}</td>
                    <td style={{ padding: '10px 8px', color: '#333', fontSize: '13px' }}>{nomCaisse(l.caisseId)}</td>
                    {estAdmin && <td style={{ padding: '10px 8px', color: '#333', fontSize: '13px' }}>{l.nomAuteur || '—'}</td>}
                    <td style={{ padding: '10px 8px', color: onglet === 'depenses' ? '#dc2626' : '#2563eb', fontWeight: '700', whiteSpace: 'nowrap' }}>{fcfa(l.montant)}</td>
                    <td style={{ padding: '10px 8px', color: '#333', fontSize: '13px' }}>
                      {onglet === 'depenses' ? l.motif : (l.note || '—')}
                      {onglet === 'depenses' && l.note && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{l.note}</div>}
                    </td>
                    {onglet === 'versements' && (
                      <td style={{ padding: '10px 8px', fontSize: '12px' }}>
                        {(() => {
                          // Pas de statut = le serveur n'est pas à jour : on ne prétend jamais "validé"
                          const [libelle, fond, couleur] = STATUTS[l.statut] || STATUTS.inconnu;
                          return <span style={{ background: fond, color: couleur, padding: '2px 9px', borderRadius: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>{libelle}</span>;
                        })()}
                        {l.statut === 'refuse' && l.motifRefus && <div style={{ color: '#b91c1c', marginTop: '3px' }}>{l.motifRefus}</div>}
                        {l.statut !== 'en_attente' && l.nomDecidePar && <div style={{ color: '#94a3b8', marginTop: '3px' }}>par {l.nomDecidePar}</div>}
                      </td>
                    )}
                    {estAdmin && (
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        {onglet === 'versements' && l.statut === 'en_attente' && (
                          <>
                            <button onClick={() => approuver(l)} title="Approuver : j'ai reçu cet argent" style={{ ...boutonMini, background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', fontWeight: '700' }}>✅ Approuver</button>{' '}
                            <button onClick={() => refuser(l)} title="Refuser" style={{ ...boutonMini, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: '700' }}>❌ Refuser</button>{' '}
                          </>
                        )}
                        <button onClick={() => ouvrirEdition(l)} title="Modifier" style={boutonMini}>✏️</button>{' '}
                        <button onClick={() => supprimer(l)} title="Supprimer" style={{ ...boutonMini, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>🗑️</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', padding: '12px 8px 0', fontSize: '13px', color: '#666' }}>
              {onglet === 'versements' ? 'Total validé' : 'Total'} : <strong style={{ color: '#0f172a' }}>{fcfa(total)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
