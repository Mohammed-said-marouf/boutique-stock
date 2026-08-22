import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { API_URL } from '../config';

const API_BASE = `${API_URL}`;

export default function Inscription() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nomBoutique: '', adresse: '', telephoneBoutique: '',
    nomAdmin: '', emailAdmin: '', motDePasseAdmin: '', confirmation: ''
  });
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const majChamp = (cle, valeur) => setForm(p => ({ ...p, [cle]: valeur }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');

    if (!form.nomBoutique || !form.nomAdmin || !form.emailAdmin || !form.motDePasseAdmin) {
      setErreur('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (form.motDePasseAdmin.length < 6) {
      setErreur('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (form.motDePasseAdmin !== form.confirmation) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }

    setEnvoi(true);
    try {
      const res = await fetch(`${API_BASE}/api/boutiques/inscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomBoutique: form.nomBoutique,
          adresse: form.adresse,
          telephoneBoutique: form.telephoneBoutique,
          nomAdmin: form.nomAdmin,
          emailAdmin: form.emailAdmin,
          motDePasseAdmin: form.motDePasseAdmin
        })
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.message || 'Erreur lors de la création du compte.'); setEnvoi(false); return; }

      setSucces('✅ Boutique créée ! Redirection vers la connexion...');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setErreur('Erreur réseau : ' + err.message);
      setEnvoi(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.bgImage} />
      <div style={styles.bgOverlay} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <img src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Stock Boutique" style={styles.logo} />
          <h1 style={styles.title}>Créer ma boutique</h1>
        </div>
        <p style={styles.subtitle}>Quelques infos pour démarrer, c'est gratuit</p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={styles.sectionLabel}>MA BOUTIQUE</div>

          <label style={styles.label}>Nom de la boutique *</label>
          <input value={form.nomBoutique} onChange={e => majChamp('nomBoutique', e.target.value)}
            placeholder="Ex: Boutique Awa" required style={styles.input} />

          <label style={styles.label}>Adresse</label>
          <input value={form.adresse} onChange={e => majChamp('adresse', e.target.value)}
            placeholder="Ex: Yaoundé, Cameroun" style={styles.input} />

          <label style={styles.label}>Téléphone de la boutique</label>
          <input value={form.telephoneBoutique} onChange={e => majChamp('telephoneBoutique', e.target.value)}
            placeholder="Ex: +237 6XX XXX XXX" style={styles.input} />

          <div style={{ ...styles.sectionLabel, marginTop: '6px' }}>MON COMPTE ADMINISTRATEUR</div>

          <label style={styles.label}>Nom complet *</label>
          <input value={form.nomAdmin} onChange={e => majChamp('nomAdmin', e.target.value)}
            placeholder="Votre nom" required style={styles.input} />

          <label style={styles.label}>Email *</label>
          <input type="email" value={form.emailAdmin} onChange={e => majChamp('emailAdmin', e.target.value)}
            placeholder="votre@email.com" required style={styles.input} />

          <label style={styles.label}>Mot de passe *</label>
          <input type="password" value={form.motDePasseAdmin} onChange={e => majChamp('motDePasseAdmin', e.target.value)}
            placeholder="Au moins 6 caractères" required style={styles.input} />

          <label style={styles.label}>Confirmer le mot de passe *</label>
          <input type="password" value={form.confirmation} onChange={e => majChamp('confirmation', e.target.value)}
            placeholder="••••••••" required style={{ ...styles.input, marginBottom: '16px' }} />

          {erreur && <div style={styles.erreur}>⚠️ {erreur}</div>}
          {succes && <div style={styles.succes}>{succes}</div>}

          <button type="submit" disabled={envoi} style={{
            ...styles.submitBtn, opacity: envoi ? 0.7 : 1, cursor: envoi ? 'not-allowed' : 'pointer'
          }}>
            {envoi ? 'Création...' : 'Créer ma boutique'}
          </button>

          <div style={styles.lienBas}>
            Déjà un compte ? <Link to="/login" style={styles.lien}>Se connecter</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    position: 'relative', minHeight: '100vh', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', boxSizing: 'border-box', padding: '4vh 4vw'
  },
  bgImage: {
    position: 'absolute', inset: 0, backgroundColor: '#0f1420',
    backgroundImage: "url('https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=45')",
    backgroundSize: 'cover', backgroundPosition: 'center', filter: 'saturate(0.9)'
  },
  bgOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(160deg, rgba(15,20,35,0.92) 0%, rgba(20,30,55,0.88) 55%, rgba(10,15,25,0.94) 100%)'
  },
  card: {
    position: 'relative', zIndex: 1, width: 'min(90%, 420px)',
    maxHeight: '94vh', overflowY: 'auto',
    background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'clamp(14px, 2.5vw, 20px)',
    padding: 'clamp(22px, 4vh, 32px) clamp(20px, 5vw, 32px)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
    display: 'flex', flexDirection: 'column', alignItems: 'center'
  },
  logoWrap: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '6px' },
  logo: { width: 'clamp(56px, 12vh, 72px)', height: 'auto', objectFit: 'contain', borderRadius: '14px', boxShadow: '0 6px 16px rgba(0,0,0,0.25)' },
  title: { margin: '10px 0 0', fontSize: 'clamp(19px, 3.5vh, 23px)', fontWeight: 800, color: '#ffffff', textAlign: 'center' },
  subtitle: { margin: '4px 0 18px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', textAlign: 'center' },
  sectionLabel: { fontSize: '11px', fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.5px', marginBottom: '8px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontSize: '13px' },
  input: {
    width: '100%', padding: '10px 14px', marginBottom: '12px',
    border: '1px solid rgba(255,255,255,0.16)', borderRadius: '9px', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', color: '#ffffff'
  },
  erreur: {
    background: 'rgba(233,69,96,0.12)', border: '1px solid rgba(233,69,96,0.35)', color: '#ff8fa3',
    padding: '10px 14px', borderRadius: '9px', marginBottom: '14px', fontSize: '13px'
  },
  succes: {
    background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.35)', color: '#86efac',
    padding: '10px 14px', borderRadius: '9px', marginBottom: '14px', fontSize: '13px'
  },
  submitBtn: {
    width: '100%', padding: '13px', background: 'linear-gradient(135deg, #4361ee, #7209b7)',
    color: 'white', border: 'none', borderRadius: '9px', fontSize: '15px', fontWeight: 600
  },
  lienBas: { textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.65)' },
  lien: { color: '#93c5fd', fontWeight: 600, textDecoration: 'none' }
};