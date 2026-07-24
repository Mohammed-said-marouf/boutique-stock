import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [seSouvenir, setSeSouvenir] = useState(true);
  const [voirMdp, setVoirMdp] = useState(false);
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
    <div style={styles.page}>
      {/* Fond image + voile sombre */}
      <div style={styles.bgImage} />
      <div style={styles.bgOverlay} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src="/logo-boutique-stock.png" alt="Stock Boutique" style={styles.logo} />
          <h1 style={styles.title}>Connexion</h1>
        </div>

        <p style={styles.subtitle}>Connectez-vous à votre espace</p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="votre@email.com"
            required
            style={styles.input}
          />

          <label style={styles.label}>Mot de passe</label>
          <div style={styles.pwdWrap}>
            <input
              type={voirMdp ? 'text' : 'password'}
              value={motDePasse}
              onChange={e => setMotDePasse(e.target.value)}
              placeholder="••••••••"
              required
              style={{ ...styles.input, marginBottom: 0, paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setVoirMdp(v => !v)}
              style={styles.eyeBtn}
              aria-label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {voirMdp ? '🙈' : '👁️'}
            </button>
          </div>

          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={seSouvenir}
              onChange={e => setSeSouvenir(e.target.checked)}
              style={styles.checkbox}
            />
            Se souvenir de moi
          </label>

          {erreur && <div style={styles.erreur}>⚠️ {erreur}</div>}

          <button type="submit" disabled={chargement} style={{
            ...styles.submitBtn,
            opacity: chargement ? 0.7 : 1,
            cursor: chargement ? 'not-allowed' : 'pointer'
          }}>
            {chargement ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    position: 'relative',
    height: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxSizing: 'border-box',
    padding: '2vh 4vw'
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'saturate(0.9)'
  },
  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(160deg, rgba(15,20,35,0.92) 0%, rgba(20,30,55,0.88) 55%, rgba(10,15,25,0.94) 100%)'
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: 'min(86%, 360px)',
    maxHeight: '96vh',
    overflowY: 'auto',
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 'clamp(14px, 2.5vw, 20px)',
    padding: 'clamp(18px, 3.5vh, 30px) clamp(20px, 5vw, 32px)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxSizing: 'border-box'
  },
  logoWrap: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '10px'
  },
  logo: {
    width: 'clamp(64px, 14vh, 80px)',
    height: 'auto',
    objectFit: 'contain'
  },
  title: {
    margin: '4px 0 0',
    fontSize: 'clamp(24px, 4.5vh, 30px)',
    fontWeight: 800,
    color: '#ffffff',
    textAlign: 'center'
  },
  subtitle: {
    margin: '4px 0 16px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 'clamp(12px, 2vh, 13.5px)',
    textAlign: 'center'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
    fontSize: '13px'
  },
  input: {
    width: '100%',
    padding: 'clamp(9px, 1.6vh, 12px) 14px',
    marginBottom: '12px',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '9px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff'
  },
  pwdWrap: {
    position: 'relative',
    width: '100%',
    marginBottom: '10px'
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    fontSize: '17px',
    cursor: 'pointer',
    padding: '4px'
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: 'rgba(255,255,255,0.75)',
    fontSize: '13px',
    marginBottom: '14px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '15px',
    height: '15px',
    accentColor: '#4361ee',
    cursor: 'pointer'
  },
  erreur: {
    background: 'rgba(233,69,96,0.12)',
    border: '1px solid rgba(233,69,96,0.35)',
    color: '#ff8fa3',
    padding: '10px 14px',
    borderRadius: '9px',
    marginBottom: '14px',
    fontSize: '13px'
  },
  submitBtn: {
    width: '100%',
    padding: 'clamp(10px, 1.8vh, 13px)',
    background: 'linear-gradient(135deg, #4361ee, #7209b7)',
    color: 'white',
    border: 'none',
    borderRadius: '9px',
    fontSize: '15px',
    fontWeight: 600
  }
};