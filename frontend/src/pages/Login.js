import React, { useState } from 'react';

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [erreur, setErreur] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.username === 'admin' && form.password === 'boutique123') {
      localStorage.setItem('auth', 'true');
      onLogin();
    } else {
      setErreur('❌ Identifiants incorrects');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f0f2f5'
    }}>
      <div style={{
        backgroundColor: 'white', padding: '40px', borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)', width: '380px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '50px' }}>🏪</div>
          <h1 style={{ color: '#1a1a2e', marginTop: '10px' }}>Boutique Stock</h1>
          <p style={{ color: '#888', marginTop: '5px' }}>Connectez-vous pour continuer</p>
        </div>

        {erreur && (
          <div style={{
            backgroundColor: '#ffe0e0', color: '#e94560', padding: '12px',
            borderRadius: '8px', marginBottom: '20px', textAlign: 'center'
          }}>
            {erreur}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              👤 Nom d'utilisateur
            </label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder="admin"
              required
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: '1px solid #ddd', fontSize: '15px', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              🔒 Mot de passe
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: '1px solid #ddd', fontSize: '15px', boxSizing: 'border-box'
              }}
            />
          </div>
          <button type="submit" style={{
            width: '100%', padding: '14px', backgroundColor: '#e94560',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '16px', cursor: 'pointer', fontWeight: 'bold'
          }}>
            🚀 Se connecter
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#aaa', fontSize: '13px' }}>
          Utilisateur : <strong>admin</strong> | Mot de passe : <strong>boutique123</strong>
        </p>
      </div>
    </div>
  );
}

export default Login;