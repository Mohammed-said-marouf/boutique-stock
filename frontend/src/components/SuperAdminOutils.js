import { useState, useEffect } from 'react';
import { API_URL } from '../config';

// Outils du super admin :
//  - LicencesAdmin : génération des clés de licence par boutique (abonnement +
//    durée), suivi de leur état, et échéances des abonnements.
//  - ModaleMotDePasseTemporaire : affiche, une seule fois, le mot de passe
//    temporaire généré lors d'une réinitialisation (page Utilisateurs).
// Côté serveur : backend/routes/licences.js et routes/users.js.

const JOUR = 24 * 3600 * 1000;
const dateFr = (d) => new Date(d).toLocaleDateString('fr-FR');
const carte = { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' };
const etiquette = { fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' };
const champ = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none', background: 'white' };
const couleursPlan = { premium: ['#ede9fe', '#7c3aed'], standard: ['#dbeafe', '#2563eb'], gratuit: ['#dcfce7', '#16a34a'] };

const PLANS = [
  { nom: 'Gratuit', prix: '0 FCFA', features: ['1 vendeur', '5 produits', 'Support email'], couleur: '#16a34a', fond: '#dcfce7' },
  { nom: 'Standard', prix: '75 000 FCFA/an', features: ['5 vendeurs', '500 produits', 'Support prioritaire', 'Rapports avancés'], couleur: '#2563eb', fond: '#dbeafe' },
  { nom: 'Premium', prix: '150 000 FCFA/an', features: ['Vendeurs illimités', 'Produits illimités', 'Support 24/7', 'Toutes les fonctions'], couleur: '#7c3aed', fond: '#ede9fe' },
];

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

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    try {
      const zone = document.createElement('textarea');
      zone.value = texte;
      document.body.appendChild(zone);
      zone.select();
      const ok = document.execCommand('copy');
      zone.remove();
      return ok;
    } catch { return false; }
  }
}

function BoutonCopier({ texte, libelle = 'Copier', style }) {
  const [copie, setCopie] = useState(false);
  return (
    <button onClick={async () => { if (await copier(texte)) { setCopie(true); setTimeout(() => setCopie(false), 1800); } }}
      style={{ padding: '7px 14px', background: copie ? '#dcfce7' : 'white', border: '1px solid ' + (copie ? '#bbf7d0' : '#cbd5e1'), borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: copie ? '#166534' : '#334155', ...style }}>
      {copie ? '✅ Copié' : `📋 ${libelle}`}
    </button>
  );
}

export function ModaleMotDePasseTemporaire({ resultat, onClose }) {
  if (!resultat) return null;
  const message = `Bonjour ${resultat.nom}, votre mot de passe Boutique Stock a été réinitialisé.\nEmail : ${resultat.email}\nMot de passe temporaire : ${resultat.motDePasseTemporaire}\nVous devrez le remplacer par le vôtre à la première connexion.`;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '420px' }}>
        <h3 style={{ margin: '0 0 6px', color: '#1e1b4b', fontSize: '17px' }}>🔑 Mot de passe réinitialisé</h3>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666' }}>
          <strong>{resultat.nom}</strong> ({resultat.email}) devra le remplacer par le sien à sa prochaine connexion.
        </p>
        <div style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '16px', textAlign: 'center', fontFamily: 'monospace', fontSize: '24px', fontWeight: '700', letterSpacing: '2px', color: '#0f172a', userSelect: 'all', wordBreak: 'break-all' }}>
          {resultat.motDePasseTemporaire}
        </div>
        <div style={{ fontSize: '12px', color: '#dc2626', margin: '10px 0 14px' }}>
          ⚠️ Ce mot de passe n'est affiché qu'une seule fois : notez-le ou copiez-le maintenant.
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <BoutonCopier texte={resultat.motDePasseTemporaire} libelle="Copier le mot de passe" />
          <BoutonCopier texte={message} libelle="Copier le message" />
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: '16px', padding: '11px', background: '#1e1b4b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>Fermer</button>
      </div>
    </div>
  );
}

export function LicencesAdmin() {
  const [boutiques, setBoutiques] = useState([]);
  const [licences, setLicences] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [form, setForm] = useState({ boutiqueId: '', abonnement: 'standard', dureeMois: 12 });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [derniere, setDerniere] = useState(null); // dernière licence générée, mise en avant
  const [filtreBoutique, setFiltreBoutique] = useState('');

  const charger = async () => {
    const [b, l] = await Promise.all([appel('GET', '/api/boutiques'), appel('GET', '/api/licences')]);
    if (Array.isArray(b.data)) {
      setBoutiques(b.data);
      setForm(f => ({ ...f, boutiqueId: f.boutiqueId || b.data[0]?._id || '' }));
    }
    if (Array.isArray(l.data)) setLicences(l.data);
    setChargement(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const nomBoutique = (id) => boutiques.find(b => b._id === id)?.nom || '—';

  const generer = async () => {
    if (!form.boutiqueId) { setErreur('Choisissez une boutique.'); return; }
    setEnvoi(true);
    setErreur('');
    try {
      const { ok, data } = await appel('POST', '/api/licences', { ...form, dureeMois: Number(form.dureeMois) });
      if (!ok) { setErreur(data?.message || 'Erreur'); return; }
      setDerniere(data);
      charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  const revoquer = async (l) => {
    if (!window.confirm(`Révoquer la licence ${l.cle} ? Elle ne pourra plus être activée.`)) return;
    const { ok, data } = await appel('PUT', `/api/licences/${l._id}/revoquer`);
    if (!ok) window.alert(data?.message || 'Erreur');
    charger();
  };

  const messagePour = (l) => `Bonjour, voici votre clé de licence Boutique Stock (abonnement ${l.abonnement}, ${l.dureeMois} mois) :\n${l.cle}\nPour l'activer : connectez-vous → Paramètres → « Activer une licence ».`;

  const statutLicence = (l) => {
    if (l.statut === 'activee') return { texte: `✅ Activée le ${dateFr(l.dateActivation)}${l.dateExpiration ? ` · expire le ${dateFr(l.dateExpiration)}` : ''}`, fond: '#dcfce7', couleur: '#166534' };
    if (l.statut === 'revoquee') return { texte: '🚫 Révoquée', fond: '#fee2e2', couleur: '#b91c1c' };
    return { texte: '⏳ En attente d\'activation', fond: '#fef9c3', couleur: '#a16207' };
  };

  const licencesAffichees = filtreBoutique ? licences.filter(l => (l.boutiqueId?._id || l.boutiqueId) === filtreBoutique) : licences;

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#1e1b4b' }}>🔑 Licences</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {PLANS.map(p => (
          <div key={p.nom} style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `2px solid ${p.fond}` }}>
            <div style={{ fontSize: '17px', fontWeight: '700', color: p.couleur }}>{p.nom}</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e1b4b', margin: '2px 0 10px' }}>{p.prix}</div>
            {p.features.map(f => <div key={f} style={{ fontSize: '13px', color: '#666', marginBottom: '3px' }}>✅ {f}</div>)}
          </div>
        ))}
      </div>

      <div style={carte}>
        <h3 style={{ margin: '0 0 14px', color: '#1e1b4b', fontSize: '15px' }}>Générer une licence</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
          <div>
            <label style={etiquette}>Boutique</label>
            <select value={form.boutiqueId} onChange={e => setForm({ ...form, boutiqueId: e.target.value })} style={champ}>
              {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
            </select>
          </div>
          <div>
            <label style={etiquette}>Abonnement</label>
            <select value={form.abonnement} onChange={e => setForm({ ...form, abonnement: e.target.value })} style={champ}>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label style={etiquette}>Durée</label>
            <select value={form.dureeMois} onChange={e => setForm({ ...form, dureeMois: e.target.value })} style={champ}>
              <option value={1}>1 mois</option>
              <option value={3}>3 mois</option>
              <option value={6}>6 mois</option>
              <option value={12}>12 mois</option>
            </select>
          </div>
        </div>
        {erreur && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>⚠️ {erreur}</div>}
        <button onClick={generer} disabled={envoi || boutiques.length === 0} style={{
          marginTop: '14px', padding: '10px 18px', background: envoi ? '#a5b4fc' : '#4f46e5', color: 'white', border: 'none',
          borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700'
        }}>{envoi ? '...' : '🔑 Générer la licence'}</button>

        {derniere && (
          <div style={{ marginTop: '18px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '13px', color: '#5b21b6', fontWeight: '600', marginBottom: '8px' }}>
              Licence {derniere.abonnement} · {derniere.dureeMois} mois · {nomBoutique(derniere.boutiqueId)}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: '700', letterSpacing: '1.5px', color: '#0f172a', userSelect: 'all', wordBreak: 'break-all' }}>{derniere.cle}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              <BoutonCopier texte={derniere.cle} libelle="Copier la clé" />
              <BoutonCopier texte={messagePour(derniere)} libelle="Copier le message à envoyer" />
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
              Cette clé ne fonctionne que pour cette boutique et une seule fois. Transmettez-la à son administrateur.
            </div>
          </div>
        )}
      </div>

      <div style={carte}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, color: '#1e1b4b', fontSize: '15px' }}>Licences générées</h3>
          <select value={filtreBoutique} onChange={e => setFiltreBoutique(e.target.value)} style={{ ...champ, width: 'auto', minWidth: '180px' }}>
            <option value="">Toutes les boutiques</option>
            {boutiques.map(b => <option key={b._id} value={b._id}>{b.nom}</option>)}
          </select>
        </div>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#999' }}>Chargement...</div>
        ) : licencesAffichees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#999', fontSize: '13px' }}>Aucune licence générée pour l'instant.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Clé', 'Boutique', 'Abonnement', 'Durée', 'État', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {licencesAffichees.map(l => {
                  const st = statutLicence(l);
                  const [fond, couleur] = couleursPlan[l.abonnement] || couleursPlan.gratuit;
                  return (
                    <tr key={l._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', color: '#1e1b4b', whiteSpace: 'nowrap' }}>{l.cle}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#333' }}>{l.boutiqueId?.nom || nomBoutique(l.boutiqueId)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ background: fond, color: couleur, padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>{l.abonnement}</span>
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#666', whiteSpace: 'nowrap' }}>{l.dureeMois} mois</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ background: st.fond, color: st.couleur, padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>{st.texte}</span>
                      </td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                        {l.statut === 'disponible' && (
                          <>
                            <BoutonCopier texte={messagePour({ ...l })} libelle="Message" style={{ padding: '4px 10px', fontSize: '12px' }} />{' '}
                            <button onClick={() => revoquer(l)} style={{ padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>Révoquer</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={carte}>
        <h3 style={{ margin: '0 0 14px', color: '#1e1b4b', fontSize: '15px' }}>Abonnement de chaque boutique</h3>
        {boutiques.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '13px' }}>Aucune boutique pour le moment.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Boutique', 'Abonnement', 'Échéance', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boutiques.map(b => {
                  const [fond, couleur] = couleursPlan[b.abonnement] || couleursPlan.gratuit;
                  const jours = b.abonnement !== 'gratuit' && b.abonnementExpireLe ? Math.ceil((new Date(b.abonnementExpireLe).getTime() - Date.now()) / JOUR) : null;
                  return (
                    <tr key={b._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '600', color: '#1e1b4b' }}>{b.nom}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ background: fond, color: couleur, padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>{b.abonnement}</span>
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: jours !== null && jours <= 15 ? '#dc2626' : '#666', fontWeight: jours !== null && jours <= 15 ? '700' : '400' }}>
                        {jours === null ? (b.abonnement === 'gratuit' ? '—' : 'Sans échéance') : `${dateFr(b.abonnementExpireLe)} (${jours} j)`}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ background: b.actif ? '#dcfce7' : '#fee2e2', color: b.actif ? '#16a34a' : '#dc2626', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>{b.actif ? 'Actif' : 'Inactif'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
