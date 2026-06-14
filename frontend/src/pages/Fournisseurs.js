import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'https://boutique-stock-production.up.railway.app/api/fournisseurs';

function Fournisseurs() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '' });

  const fetchFournisseurs = async () => {
    const res = await axios.get(API);
    setFournisseurs(res.data);
  };

  useEffect(() => { fetchFournisseurs(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post(API, form);
    setForm({ nom: '', telephone: '', email: '', adresse: '' });
    setShowForm(false);
    fetchFournisseurs();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Supprimer ce fournisseur ?')) {
      await axios.delete(`${API}/${id}`);
      fetchFournisseurs();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h1>🚚 Fournisseurs</h1>
        <button onClick={() => setShowForm(!showForm)} style={{
          backgroundColor: '#e94560', color: 'white', border: 'none',
          padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
        }}>
          {showForm ? '✕ Annuler' : '+ Ajouter un fournisseur'}
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginBottom: '20px' }}>Nouveau fournisseur</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {[
                { label: 'Nom', key: 'nom', type: 'text' },
                { label: 'Téléphone', key: 'telephone', type: 'text' },
                { label: 'Email', key: 'email', type: 'email' },
                { label: 'Adresse', key: 'adresse', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
                  />
                </div>
              ))}
            </div>
            <button type="submit" style={{
              marginTop: '20px', backgroundColor: '#4361ee', color: 'white',
              border: 'none', padding: '12px 30px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
            }}>
              ✅ Enregistrer
            </button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {fournisseurs.length === 0 ? (
          <p style={{ color: '#888' }}>Aucun fournisseur — ajoutez-en un !</p>
        ) : (
          fournisseurs.map(f => (
            <div key={f._id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
              <h3 style={{ marginBottom: '10px', color: '#1a1a2e' }}>🚚 {f.nom}</h3>
              {f.telephone && <p style={{ color: '#555', marginBottom: '5px' }}>📞 {f.telephone}</p>}
              {f.email && <p style={{ color: '#555', marginBottom: '5px' }}>📧 {f.email}</p>}
              {f.adresse && <p style={{ color: '#555', marginBottom: '15px' }}>📍 {f.adresse}</p>}
              <button onClick={() => handleDelete(f._id)} style={{
                backgroundColor: '#e94560', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer'
              }}>🗑️ Supprimer</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Fournisseurs;