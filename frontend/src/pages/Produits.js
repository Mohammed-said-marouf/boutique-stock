import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { exportProduitsPDF } from '../components/ExportPDF';

const API = 'https://boutique-stock-production.up.railway.app/api/produits';

const inputStyle = {
  width: '100%', padding: '10px', borderRadius: '8px',
  border: '1px solid #ddd', fontSize: '14px'
};

function Produits() {
  const [produits, setProduits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [form, setForm] = useState({
    nom: '', description: '', prix: '', quantite: '', categorie: '', seuilAlerte: 5
  });

  const fetchProduits = async () => {
    const res = await axios.get(API);
    setProduits(res.data);
  };

  useEffect(() => { fetchProduits(); }, []);

  const handleEdit = (p) => {
    setEditId(p._id);
    setForm({ nom: p.nom, description: p.description || '', prix: p.prix, quantite: p.quantite, categorie: p.categorie, seuilAlerte: p.seuilAlerte });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) {
      await axios.put(`${API}/${editId}`, form);
      setEditId(null);
    } else {
      await axios.post(API, form);
    }
    setForm({ nom: '', description: '', prix: '', quantite: '', categorie: '', seuilAlerte: 5 });
    setShowForm(false);
    fetchProduits();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer ce produit ?')) {
      await axios.delete(`${API}/${id}`);
      fetchProduits();
    }
  };

  const produitsFiltres = produits.filter(p =>
    p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    p.categorie.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h1>📦 Produits</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => exportProduitsPDF(produits)} style={{
            backgroundColor: '#2ec4b6', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
          }}>
            📄 Exporter PDF
          </button>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nom: '', description: '', prix: '', quantite: '', categorie: '', seuilAlerte: 5 }); }} style={{
            backgroundColor: '#e94560', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
          }}>
            {showForm ? '✕ Annuler' : '+ Ajouter un produit'}
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="🔍 Rechercher par nom ou catégorie..."
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        style={{ ...inputStyle, marginBottom: '20px', padding: '12px 15px', fontSize: '15px' }}
      />

      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginBottom: '20px' }}>{editId ? '✏️ Modifier le produit' : 'Nouveau produit'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {[
                { label: 'Nom', key: 'nom', type: 'text' },
                { label: 'Catégorie', key: 'categorie', type: 'text' },
                { label: 'Prix (FCFA)', key: 'prix', type: 'number' },
                { label: 'Quantité', key: 'quantite', type: 'number' },
                { label: 'Seuil alerte', key: 'seuilAlerte', type: 'number' },
                { label: 'Description', key: 'description', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <button type="submit" style={{
              marginTop: '20px', backgroundColor: '#4361ee', color: 'white',
              border: 'none', padding: '12px 30px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
            }}>
              {editId ? '✏️ Modifier' : '✅ Enregistrer'}
            </button>
          </form>
        </div>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a1a2e', color: 'white' }}>
              {['Nom', 'Catégorie', 'Prix', 'Quantité', 'Statut', 'Actions'].map(h => (
                <th key={h} style={{ padding: '15px', textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {produitsFiltres.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#888' }}>Aucun produit trouvé</td></tr>
            ) : (
              produitsFiltres.map((p, i) => (
                <tr key={p._id} style={{ backgroundColor: i % 2 === 0 ? '#f9f9f9' : 'white' }}>
                  <td style={{ padding: '12px 15px', fontWeight: '500' }}>{p.nom}</td>
                  <td style={{ padding: '12px 15px' }}>{p.categorie}</td>
                  <td style={{ padding: '12px 15px' }}>{p.prix} FCFA</td>
                  <td style={{ padding: '12px 15px' }}>{p.quantite}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '13px',
                      backgroundColor: p.quantite <= p.seuilAlerte ? '#ffe0e0' : '#e0ffe0',
                      color: p.quantite <= p.seuilAlerte ? '#e94560' : '#2ec4b6'
                    }}>
                      {p.quantite <= p.seuilAlerte ? '⚠️ Stock bas' : '✅ OK'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(p)} style={{
                        backgroundColor: '#4361ee', color: 'white', border: 'none',
                        padding: '6px 14px', borderRadius: '6px', cursor: 'pointer'
                      }}>✏️ Modifier</button>
                      <button onClick={() => handleDelete(p._id)} style={{
                        backgroundColor: '#e94560', color: 'white', border: 'none',
                        padding: '6px 14px', borderRadius: '6px', cursor: 'pointer'
                      }}>🗑️ Supprimer</button>
                    </div>
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

export default Produits;