import { useState, useEffect, useRef } from 'react';
import { alertesStockBoutiques } from '../api/produits';

// Cloche de notification de l'en-tête (admin et vendeur) : produits dont le
// stock BOUTIQUE est au seuil d'alerte ou en dessous — voir
// GET /api/produits/alertes-boutiques (backend en ligne et serveur local du
// desktop, qui la calcule sur sa base SQLite pour marcher hors-ligne).
// Rafraîchie toutes les 30 s, et aussitôt après une vente ou un transfert
// (événement "stock-modifie"). Quand un produit PASSE sous le seuil pendant
// que l'appli est ouverte, un bandeau le signale en plus de la pastille.

const cle = (b, p) => `${b.comptoirId}:${p._id}`;

export default function ClocheAlertesStock() {
  const [alertes, setAlertes] = useState({ total: 0, boutiques: [] });
  const [ouvert, setOuvert] = useState(false);
  const [bandeau, setBandeau] = useState(null);
  const dejaVues = useRef(null); // null = premier chargement (pas de bandeau)
  const conteneur = useRef(null);

  useEffect(() => {
    let arrete = false;
    let minuteurBandeau;
    const lire = async () => {
      try {
        const { data } = await alertesStockBoutiques();
        if (arrete || !data) return;
        const cles = new Set();
        const nouvelles = [];
        for (const b of data.boutiques || []) {
          for (const p of b.produits) {
            cles.add(cle(b, p));
            if (dejaVues.current && !dejaVues.current.has(cle(b, p))) nouvelles.push({ ...p, comptoirNom: b.comptoirNom });
          }
        }
        dejaVues.current = cles;
        setAlertes({ total: data.total || 0, boutiques: data.boutiques || [] });
        if (nouvelles.length > 0) {
          setBandeau(nouvelles);
          clearTimeout(minuteurBandeau);
          minuteurBandeau = setTimeout(() => setBandeau(null), 8000);
        }
      } catch { /* hors-ligne ou réseau instable : on réessaiera au prochain passage */ }
    };
    lire();
    const minuteur = setInterval(lire, 30000);
    window.addEventListener('stock-modifie', lire);
    return () => {
      arrete = true;
      clearInterval(minuteur);
      clearTimeout(minuteurBandeau);
      window.removeEventListener('stock-modifie', lire);
    };
  }, []);

  // Ferme la liste au clic en dehors
  useEffect(() => {
    if (!ouvert) return undefined;
    const fermer = (e) => { if (conteneur.current && !conteneur.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, [ouvert]);

  const { total, boutiques } = alertes;

  return (
    <div ref={conteneur} style={{ position: 'relative' }}>
      <span onClick={() => setOuvert(v => !v)} title={total > 0 ? `${total} produit(s) en stock bas` : 'Aucune alerte de stock'}
        style={{ fontSize: '20px', cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
        🔔
        {total > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-8px', background: '#dc2626', color: 'white',
            borderRadius: '10px', padding: '1px 5px', fontSize: '10px', fontWeight: '700',
            minWidth: '16px', textAlign: 'center', lineHeight: '14px'
          }}>{total > 99 ? '99+' : total}</span>
        )}
      </span>

      {ouvert && (
        <div style={{
          position: 'absolute', right: 0, top: '34px', width: 'min(340px, calc(100vw - 24px))',
          maxHeight: '420px', overflowY: 'auto', background: 'white', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100, border: '1px solid #e2e8f0'
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>
            ⚠️ Stock bas en boutique
          </div>
          {total === 0 ? (
            <div style={{ padding: '18px 14px', color: '#16a34a', fontSize: '13px', textAlign: 'center' }}>
              ✅ Aucun produit sous son seuil d'alerte
            </div>
          ) : boutiques.map(b => (
            <div key={b.comptoirId}>
              <div style={{ padding: '8px 14px 4px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {b.comptoirNom}
              </div>
              {b.produits.map(p => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '7px 14px', fontSize: '13px' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a' }}>{p.nom}</span>
                  <span style={{
                    flexShrink: 0, fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
                    background: p.quantite <= 0 ? '#fee2e2' : '#fef9c3', color: p.quantite <= 0 ? '#dc2626' : '#a16207'
                  }}>
                    {p.quantite <= 0 ? 'Rupture' : `${p.quantite} / seuil ${p.seuilAlerte}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {bandeau && (
        <div onClick={() => { setBandeau(null); setOuvert(true); }} style={{
          position: 'fixed', top: '72px', right: '16px', maxWidth: 'calc(100vw - 32px)', width: '320px',
          background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '10px', padding: '12px 14px',
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)', zIndex: 1000, cursor: 'pointer', fontSize: '13px', color: '#7c2d12'
        }}>
          <div style={{ fontWeight: '700', marginBottom: '4px' }}>⚠️ Seuil d'alerte atteint</div>
          {bandeau.slice(0, 3).map(p => (
            <div key={`${p.comptoirNom}:${p._id}`}>
              {p.nom} — {p.quantite <= 0 ? 'rupture' : `${p.quantite} restant(s)`} ({p.comptoirNom})
            </div>
          ))}
          {bandeau.length > 3 && <div>… et {bandeau.length - 3} autre(s)</div>}
        </div>
      )}
    </div>
  );
}
