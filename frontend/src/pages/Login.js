import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const user = await login(email, motDePasse);
      if (user.role === 'superadmin') navigate('/superadmin');
      else if (user.role === 'admin') navigate('/admin');
      else navigate('/vendeur');
    } catch (err) {
      setErreur(err.response?.data?.message || 'Erreur de connexion');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '48px',
        width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '28px'
          }}>🏪</div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1a1a2e' }}>
            Boutique Stock
          </h1>
          <p style={{ margin: '8px 0 0', color: '#666', fontSize: '14px' }}>
            Connectez-vous à votre espace
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333', fontSize: '14px' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com" required
              style={{
                width: '100%', padding: '12px 16px', border: '2px solid #e2e8f0',
                borderRadius: '8px', fontSize: '15px', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333', fontSize: '14px' }}>
              Mot de passe
            </label>
            <input
              type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)}
              placeholder="••••••••" required
              style={{
                width: '100%', padding: '12px 16px', border: '2px solid #e2e8f0',
                borderRadius: '8px', fontSize: '15px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {erreur && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fed7d7', color: '#c53030',
              padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px'
            }}>
              ⚠️ {erreur}
            </div>
          )}

          <button type="submit" disabled={chargement} style={{
            width: '100%', padding: '14px', background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px',
            fontWeight: '600', cursor: chargement ? 'not-allowed' : 'pointer',
            opacity: chargement ? 0.7 : 1
          }}>
            {chargement ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}