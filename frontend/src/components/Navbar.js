import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const logoStyle = {
  fontSize: '18px',
  fontWeight: 'bold',
  padding: '0 20px 30px',
  borderBottom: '1px solid #ffffff20',
  marginBottom: '20px',
  color: '#e94560'
};

const linkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '12px 20px',
  color: 'white',
  textDecoration: 'none',
  fontSize: '15px',
  transition: 'background 0.2s'
};

const activeStyle = {
  ...linkStyle,
  backgroundColor: '#e94560',
  borderRadius: '0 20px 20px 0',
  marginRight: '10px'
};

function Navbar({ onLogout }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navStyle = {
    width: '220px',
    height: '100vh',
    backgroundColor: '#1a1a2e',
    color: 'white',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    zIndex: 999,
    transition: 'transform 0.3s ease'
  };

  const links = [
    { path: '/', label: '📊 Dashboard' },
    { path: '/produits', label: '📦 Produits' },
    { path: '/ventes', label: '🛒 Ventes' },
    { path: '/fournisseurs', label: '🚚 Fournisseurs' }
  ];

  return (
    <>
      {/* Bouton hamburger mobile */}
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? '✕' : '☰'}
      </button>

      {/* Overlay sombre mobile */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998
        }} />
      )}

      <nav style={navStyle} className={`nav-sidebar ${menuOpen ? 'open' : ''}`}>
        <div style={logoStyle}>🏪 Boutique Stock</div>
        {links.map(link => (
          <Link
            key={link.path}
            to={link.path}
            style={location.pathname === link.path ? activeStyle : linkStyle}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <div style={{ marginTop: 'auto', padding: '20px' }}>
          <button onClick={onLogout} style={{
            width: '100%', padding: '10px', backgroundColor: '#e94560',
            color: 'white', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontSize: '14px'
          }}>
            🚪 Déconnexion
          </button>
        </div>
      </nav>
    </>
  );
}

export default Navbar;