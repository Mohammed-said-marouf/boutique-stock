import { useState, useRef } from 'react';
import { API_URL } from '../config';

// Page "Sauvegarde", partagée entre l'admin et le vendeur.
//  - Tous : télécharger un fichier de sauvegarde (.json) de ses données
//    (admin : tout le compte ; vendeur : ses ventes, dépenses et versements).
//  - Admin : restaurer un fichier de sauvegarde (fusion : rien n'est supprimé).
// Côté serveur : backend/routes/sauvegarde.js.

const LIBELLES = {
  comptoirs: 'Boutiques', caisses: 'Caisses', magasins: 'Magasins', fournisseurs: 'Fournisseurs',
  produits: 'Produits', clients: 'Clients', ventes: 'Ventes', mouvements: 'Mouvements de stock',
  depenses: 'Dépenses', versements: 'Versements', inventaires: 'Inventaires',
};

const carte = { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' };
const bouton = (couleur, desactive) => ({
  padding: '10px 16px', background: desactive ? '#ccc' : couleur, color: 'white', border: 'none', borderRadius: '8px',
  cursor: desactive ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700',
});

// Dans l'APK (Capacitor), un téléchargement par lien ne fonctionne pas : on
// écrit le fichier dans le cache de l'appli puis on ouvre la feuille de
// partage Android (Enregistrer dans Drive/Fichiers, WhatsApp, e-mail...).
const estNatif = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

async function enregistrerFichier(nom, texte) {
  if (estNatif()) {
    const cap = window.Capacitor;
    const Filesystem = cap.registerPlugin('Filesystem');
    const Share = cap.registerPlugin('Share');
    const ecrit = await Filesystem.writeFile({ path: nom, data: texte, directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title: nom, url: ecrit.uri, dialogTitle: 'Enregistrer la sauvegarde' });
    return;
  }
  const url = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function appel(methode, chemin, corps) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* corps non JSON */ }
  return { ok: res.ok, status: res.status, data };
}

export default function Sauvegarde({ role }) {
  const estAdmin = role !== 'vendeur';
  const [envoiExport, setEnvoiExport] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok'|'erreur', texte }
  const [aRestaurer, setARestaurer] = useState(null); // { nomFichier, fichier }
  const [envoiRestauration, setEnvoiRestauration] = useState(false);
  const [bilan, setBilan] = useState(null);
  const champFichier = useRef(null);

  const exporter = async () => {
    setMessage(null);
    setEnvoiExport(true);
    try {
      const { ok, status, data } = await appel('GET', '/api/sauvegarde/export');
      if (!ok || !data) { setMessage({ type: 'erreur', texte: data?.message || `Sauvegarde impossible (erreur ${status}).` }); return; }
      const jour = new Date().toISOString().slice(0, 10);
      const compte = (data.nomCompte || 'compte').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const nom = `sauvegarde-${compte}-${role}-${jour}.json`;
      await enregistrerFichier(nom, JSON.stringify(data));
      const total = Object.values(data.compteurs || {}).reduce((s, n) => s + n, 0);
      setMessage({ type: 'ok', texte: `Sauvegarde créée : ${total} élément(s). Gardez ce fichier en lieu sûr (Drive, clé USB...).` });
    } catch (e) {
      setMessage({ type: 'erreur', texte: e.message });
    } finally {
      setEnvoiExport(false);
    }
  };

  const choisirFichier = async (e) => {
    const fichier = e.target.files && e.target.files[0];
    e.target.value = ''; // permet de re-choisir le même fichier
    if (!fichier) return;
    setMessage(null);
    setBilan(null);
    try {
      const contenu = JSON.parse(await fichier.text());
      if (contenu.format !== 'boutique-stock-sauvegarde' || !contenu.donnees) throw new Error('format');
      setARestaurer({ nomFichier: fichier.name, fichier: contenu });
    } catch {
      setARestaurer(null);
      setMessage({ type: 'erreur', texte: "Ce fichier n'est pas une sauvegarde Boutique Stock valide." });
    }
  };

  const restaurer = async () => {
    setEnvoiRestauration(true);
    setMessage(null);
    try {
      const { ok, status, data } = await appel('POST', '/api/sauvegarde/restaurer', aRestaurer.fichier);
      if (!ok) {
        setMessage({ type: 'erreur', texte: data?.message || (status === 413 ? 'Fichier trop volumineux.' : `Restauration impossible (erreur ${status}).`) });
        return;
      }
      setBilan(data.bilan);
      setARestaurer(null);
      setMessage({ type: 'ok', texte: 'Sauvegarde restaurée. Rechargez les pages pour voir les données à jour.' });
    } catch (e) {
      setMessage({ type: 'erreur', texte: e.message });
    } finally {
      setEnvoiRestauration(false);
    }
  };

  const enLocalDesktop = API_URL.includes('localhost');

  return (
    <div style={{ maxWidth: '760px' }}>
      <h2 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '20px' }}>Sauvegarde</h2>
      <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#666' }}>
        Gardez une copie de vos données dans un fichier, pour les retrouver en cas de changement de téléphone ou d'ordinateur.
      </p>

      {enLocalDesktop && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
          ⚠️ Cette version hors-ligne n'a pas encore de sauvegarde par fichier : ses données se synchronisent avec le serveur dès qu'une connexion est disponible.
        </div>
      )}

      {message && (
        <div style={{
          background: message.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: '1px solid ' + (message.type === 'ok' ? '#bbf7d0' : '#fecaca'),
          color: message.type === 'ok' ? '#166534' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px'
        }}>{message.type === 'ok' ? '✅' : '⚠️'} {message.texte}</div>
      )}

      <div style={carte}>
        <h3 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: '15px' }}>💾 Sauvegarder mes données</h3>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
          {estAdmin
            ? 'Le fichier contient tout votre compte : produits et stocks, magasins, boutiques, caisses, clients, fournisseurs, ventes, mouvements, dépenses et versements.'
            : 'Le fichier contient vos ventes, vos dépenses et vos versements.'}
          {' '}Les photos des produits restent en ligne, et les comptes utilisateurs (mots de passe) ne sont jamais inclus.
        </p>
        <button onClick={exporter} disabled={envoiExport || enLocalDesktop} style={bouton('#2563eb', envoiExport || enLocalDesktop)}>
          {envoiExport ? '⏳ Préparation...' : '⬇️ Télécharger la sauvegarde'}
        </button>
        {estNatif() && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>Sur téléphone, choisissez où l'enregistrer (Drive, Fichiers, WhatsApp...).</div>}
      </div>

      {estAdmin && (
        <div style={carte}>
          <h3 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: '15px' }}>♻️ Restaurer une sauvegarde</h3>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666', lineHeight: 1.6 }}>
            Recharge un fichier de sauvegarde dans votre compte. Les éléments du fichier sont recréés, ou remplacés s'ils existent déjà ;
            <strong> rien n'est supprimé</strong>. Une modification faite après la sauvegarde sur un même élément sera donc écrasée.
          </p>
          <input ref={champFichier} type="file" accept=".json,application/json" onChange={choisirFichier} style={{ display: 'none' }} />
          <button onClick={() => champFichier.current && champFichier.current.click()} disabled={enLocalDesktop} style={bouton('#7c3aed', enLocalDesktop)}>
            📂 Choisir un fichier de sauvegarde
          </button>

          {aRestaurer && (
            <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>{aRestaurer.nomFichier}</div>
              <div style={{ fontSize: '12px', color: '#666', margin: '4px 0 10px' }}>
                {aRestaurer.fichier.nomCompte ? `Compte « ${aRestaurer.fichier.nomCompte} » · ` : ''}
                sauvegarde du {aRestaurer.fichier.exporteLe ? new Date(aRestaurer.fichier.exporteLe).toLocaleString('fr-FR') : '—'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {Object.entries(aRestaurer.fichier.compteurs || {}).map(([cle, n]) => (
                  <span key={cle} style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 9px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                    {LIBELLES[cle] || cle} : {n}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setARestaurer(null)} style={{ padding: '9px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#666', fontWeight: '600' }}>Annuler</button>
                <button onClick={restaurer} disabled={envoiRestauration} style={bouton('#16a34a', envoiRestauration)}>
                  {envoiRestauration ? '⏳ Restauration...' : 'Restaurer maintenant'}
                </button>
              </div>
            </div>
          )}

          {bilan && (
            <div style={{ marginTop: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '360px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['', 'Recréés', 'Remplacés', 'Ignorés'].map((h, i) => (
                      <th key={i} style={{ padding: '8px', textAlign: i === 0 ? 'left' : 'right', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(bilan).map(([cle, b]) => (
                    <tr key={cle} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '8px', fontSize: '13px', color: '#333' }}>{LIBELLES[cle] || cle}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>{b.crees}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px', color: '#2563eb', fontWeight: '600' }}>{b.misAJour}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px', color: b.ignores ? '#dc2626' : '#94a3b8', fontWeight: '600' }}>{b.ignores}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                « Ignorés » : éléments invalides ou n'appartenant pas à votre compte (et fournisseurs déjà existants).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
