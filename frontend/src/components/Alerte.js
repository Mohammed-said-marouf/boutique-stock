import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Alerte() {
  const [alertes, setAlertes] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/produits/alertes')
      .then(res => setAlertes(res.data))
      .catch(err => console.log(err));
  }, []);

  if (alertes.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#fff3cd',
      border: '1px solid #ffc107',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#856404', marginBottom: '10px' }}>
        ⚠️ Alertes stock bas ({alertes.length})
      </h3>
      {alertes.map(produit => (
        <div key={produit._id} style={{ color: '#856404', marginBottom: '5px' }}>
          📦 <strong>{produit.nom}</strong> — Stock : {produit.quantite} unités (seuil : {produit.seuilAlerte})
        </div>
      ))}
    </div>
  );
}

export default Alerte;