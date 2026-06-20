import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Alerte from '../components/Alerte';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

const cardStyle = {
  backgroundColor: 'white', borderRadius: '12px',
  padding: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', flex: 1, minWidth: '200px'
};

function Dashboard() {
  const [stats, setStats] = useState({ totalProduits: 0, totalVentes: 0, chiffreAffaires: 0, totalFournisseurs: 0 });
  const [graphVentes, setGraphVentes] = useState([]);
  const [graphProduits, setGraphProduits] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [produits, ventes, fournisseurs] = await Promise.all([
          axios.get('/api/produits'),
          axios.get('/api/ventes'),
          axios.get('/api/fournisseurs')
        ]);

        const statsVentes = await axios.get('/api/ventes/stats');

        setStats({
          totalProduits: produits.data.length,
          totalVentes: statsVentes.data.totalVentes,
          chiffreAffaires: statsVentes.data.chiffreAffaires,
          totalFournisseurs: fournisseurs.data.length
        });

        // Graphique ventes par jour
        const ventesParJour = {};
        ventes.data.forEach(v => {
          const date = new Date(v.dateVente).toLocaleDateString('fr-FR');
          ventesParJour[date] = (ventesParJour[date] || 0) + v.montantTotal;
        });
        setGraphVentes(Object.entries(ventesParJour).map(([date, montant]) => ({ date, montant })));

        // Graphique stock par produit
        setGraphProduits(produits.data.map(p => ({ nom: p.nom, stock: p.quantite, seuil: p.seuilAlerte })));

      } catch (err) { console.log(err); }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Produits', value: stats.totalProduits, icon: '📦', color: '#4361ee' },
    { label: 'Ventes', value: stats.totalVentes, icon: '🛒', color: '#e94560' },
    { label: "Chiffre d'affaires", value: `${stats.chiffreAffaires} FCFA`, icon: '💰', color: '#2ec4b6' },
    { label: 'Fournisseurs', value: stats.totalFournisseurs, icon: '🚚', color: '#ff9f1c' }
  ];

  return (
    <div>
      <h1 style={{ marginBottom: '25px', fontSize: '26px' }}>📊 Tableau de bord</h1>

      <Alerte />

      {/* Cartes stats */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
        {cards.map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>{card.icon}</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: card.color }}>{card.value}</div>
            <div style={{ color: '#888', marginTop: '5px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Graphique ventes */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', marginBottom: '25px' }}>
        <h2 style={{ marginBottom: '20px' }}>📈 Chiffre d'affaires par jour</h2>
        {graphVentes.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>Pas encore de données de ventes</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={graphVentes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v) => `${v} FCFA`} />
              <Line type="monotone" dataKey="montant" stroke="#e94560" strokeWidth={3} dot={{ r: 6 }} name="Montant" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Graphique stock */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '25px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
        <h2 style={{ marginBottom: '20px' }}>📦 Niveaux de stock</h2>
        {graphProduits.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>Aucun produit enregistré</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={graphProduits}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nom" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="stock" fill="#4361ee" name="Stock actuel" radius={[6,6,0,0]} />
              <Bar dataKey="seuil" fill="#ff9f1c" name="Seuil alerte" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default Dashboard;