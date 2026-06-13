import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { exportVentesPDF } from '../components/ExportPDF';

function Ventes() {
  const [ventes, setVentes] = useState([]);
  const [produits, setProduits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ produitId: '', quantite: 1, typeVente: 'presentiel' });
  const [produitSelectionne, setProduitSelectionne] = useState(null);

  const fetchData = async () => {
    const [v, p] = await Promise.all([
      axios.get('http://localhost:5000/api/ventes'),
      axios.get('http://localhost:5000/api/produits')
    ]);
    setVentes(v.data);
    setProduits(p.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleProduitChange = (e) => {
    const p = produits.find(p => p._id === e.target.value);
    setProduitSelectionne(p);
    setForm({ ...form, produitId: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!produitSelectionne) return;
    const montantTotal = produitSelectionne.prix * form.quantite;
    await axios.post('http://localhost:5000/api/ventes', {
      produits: [{ produit: form.produitId, quantite: form.quantite, prixUnitaire: produitSelectionne.prix }],
      montantTotal,
      typeVente: form.typeVente
    });
    setForm({ produitId: '', quantite: 1, typeVente: 'presentiel' });
    setProduitSelectionne(null);
    setShowForm(false);
    fetchData();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h1>🛒 Ventes</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => exportVentesPDF(ventes)} style={{
            backgroundColor: '#2ec4b6', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
          }}>
            📄 Exporter PDF
          </button>
          <button onClick={() => setShowForm(!showForm)} style={{
            backgroundColor: '#e94560', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
          }}>
            {showForm ? '✕ Annuler' : '+ Nouvelle vente'}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginBottom: '20px' }}>Enregistrer une vente</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Produit</label>
                <select value={form.produitId} onChange={handleProduitChange} required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                  <option value="">-- Sélectionner --</option>
                  {produits.map(p => (
                    <option key={p._id} value={p._id}>{p.nom} ({p.quantite} en stock)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Quantité</label>
                <input type="number" min="1" value={form.quantite}
                  onChange={e => setForm({ ...form, quantite: parseInt(e.target.value) })} required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Type de vente</label>
                <select value={form.typeVente} onChange={e => setForm({ ...form, typeVente: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                  <option value="presentiel">🏪 En boutique</option>
                  <option value="en_ligne">🌐 En ligne</option>
                </select>
              </div>
            </div>

            {produitSelectionne && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '8px' }}>
                💰 <strong>Montant total : {produitSelectionne.prix * form.quantite} FCFA</strong>
              </div>
            )}

            <button type="submit" style={{
              marginTop: '20px', backgroundColor: '#4361ee', color: 'white',
              border: 'none', padding: '12px 30px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
            }}>
              ✅ Enregistrer la vente
            </button>
          </form>
        </div>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a1a2e', color: 'white' }}>
              {['Produit', 'Quantité', 'Montant', 'Type', 'Date'].map(h => (
                <th key={h} style={{ padding: '15px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ventes.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>Aucune vente enregistrée</td></tr>
            ) : (
              ventes.map((v, i) => (
                <tr key={v._id} style={{ backgroundColor: i % 2 === 0 ? '#f9f9f9' : 'white' }}>
                  <td style={{ padding: '12px 15px' }}>
                    {v.produits.map(p => p.produit?.nom || 'Produit supprimé').join(', ')}
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    {v.produits.reduce((acc, p) => acc + p.quantite, 0)}
                  </td>
                  <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#2ec4b6' }}>
                    {v.montantTotal} FCFA
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '13px',
                      backgroundColor: v.typeVente === 'en_ligne' ? '#e0f0ff' : '#e0ffe0',
                      color: v.typeVente === 'en_ligne' ? '#4361ee' : '#2ec4b6'
                    }}>
                      {v.typeVente === 'en_ligne' ? '🌐 En ligne' : '🏪 En boutique'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 15px', color: '#888' }}>
                    {new Date(v.dateVente).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Ventes;