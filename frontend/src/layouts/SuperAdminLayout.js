import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icone, useIcones } from '../context/IconesContext';
import axios from 'axios';
import { LicencesAdmin, ModaleMotDePasseTemporaire } from '../components/SuperAdminOutils';
import Avatar from '../components/Avatar';
import EditeurPhotoProfil from '../components/EditeurPhotoProfil';

import { API_URL } from '../config';

const menuItems = [
  { path: '/superadmin', iconKey: 'dashboard', label: 'Tableau de bord' },
  { path: '/superadmin/boutiques', iconKey: 'boutiques', label: 'Boutiques' },
  { path: '/superadmin/utilisateurs', iconKey: 'utilisateurs', label: 'Utilisateurs' },
  { path: '/superadmin/abonnements', icon: '🔑', label: 'Licences' },
  { path: '/superadmin/parametres', iconKey: 'parametres', label: 'Paramètres système' },
  { path: '/superadmin/journal', icon: '📋', label: "Journal d'activités" },
];

const outilsItems = [
  { path: '/superadmin/icones', icon: '🎨', label: 'Icônes' },
  { path: '/superadmin/notifications', icon: '🔔', label: 'Notifications' },
  { path: '/superadmin/sauvegardes', icon: '💾', label: 'Sauvegardes' },
  { path: '/superadmin/maintenance', icon: '🔧', label: 'Maintenance' },
];

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif', background: '#f0f2f5' }}>
      <div style={{
        width: collapsed ? '70px' : '240px', background: '#1e1b4b',
        display: 'flex', flexDirection: 'column', transition: 'width 0.3s',
        overflow: 'hidden', flexShrink: 0
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #312e81', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0, overflow: 'hidden'
          }}>
            
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: 'white', fontWeight: '700', fontSize: '14px' }}>Super Admin</div>
              <div style={{ color: '#a5b4fc', fontSize: '11px' }}>Panel de contrôle</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          <div style={{ color: '#6366f1', fontSize: '10px', fontWeight: '700', padding: '8px 8px 4px', letterSpacing: '1px' }}>
            {!collapsed && 'MENU PRINCIPAL'}
          </div>
          {menuItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/superadmin'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 8px', borderRadius: '8px', marginBottom: '2px',
                textDecoration: 'none', color: isActive ? 'white' : '#a5b4fc',
                background: isActive ? '#4f46e5' : 'transparent',
                transition: 'all 0.2s', fontSize: '14px'
              })}>
              <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px' }}>
                {item.iconKey ? <Icone nom={item.iconKey} size={24} /> : item.icon}
              </div>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}

          <div style={{ color: '#6366f1', fontSize: '10px', fontWeight: '700', padding: '16px 8px 4px', letterSpacing: '1px' }}>
            {!collapsed && 'OUTILS'}
          </div>
          {outilsItems.map(item => (
            <NavLink key={item.path} to={item.path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 8px', borderRadius: '8px', marginBottom: '2px',
                textDecoration: 'none', color: isActive ? 'white' : '#a5b4fc',
                background: isActive ? '#4f46e5' : 'transparent', fontSize: '14px'
              })}>
              <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '20px' }}>
                {item.iconKey ? <Icone nom={item.iconKey} size={24} /> : item.icon}
              </div>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid #312e81', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar nom={user?.nom} photo={user?.photo} size={36} fond="#4f46e5" />
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'white', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.nom}</div>
              <div style={{ color: '#a5b4fc', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={handleLogout} title="Déconnexion"
              style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>
              <Icone nom="deconnexion" size={20} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          background: 'white', padding: '0 24px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setCollapsed(!collapsed)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>
              ☰
            </button>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e1b4b' }}>Tableau de bord</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input placeholder="Rechercher..." style={{
              padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '20px',
              fontSize: '14px', outline: 'none', width: '200px'
            }} />
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444',
                color: 'white', borderRadius: '50%', width: '16px', height: '16px',
                fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>8</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar nom={user?.nom} photo={user?.photo} size={36} fond="#4f46e5" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e1b4b' }}>Super Admin</div>
                <div style={{ fontSize: '11px', color: '#666' }}>Administrateur principal</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <Routes>
            <Route path="" element={<SuperAdminDashboard />} />
            <Route path="boutiques" element={<BoutiquesAdmin />} />
            <Route path="utilisateurs" element={<UtilisateursAdmin />} />
            <Route path="abonnements" element={<LicencesAdmin />} />
            <Route path="parametres" element={<ParametresSuperAdmin user={user} />} />
            <Route path="journal" element={<JournalAdmin />} />
            <Route path="icones" element={<PageIcones />} />
            <Route path="notifications" element={<NotificationsAdmin />} />
            <Route path="sauvegardes" element={<SauvegardesAdmin />} />
            <Route path="maintenance" element={<MaintenanceAdmin />} />
            <Route path="*" element={<div><h2>Page en construction</h2></div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

// ===================== DASHBOARD =====================
// Le super admin gère les boutiques, leurs licences et leurs comptes : ce
// tableau de bord ne montre volontairement aucune vente ni chiffre d'affaires.
function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalBoutiques: 0, boutiquesActives: 0,
    totalUsers: 0, usersActifs: 0,
    abonnementsPayants: 0, abonnementsExpirant: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/api/ventes/stats-globales`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { if (data && !data.message) setStats(data); })
      .catch(err => console.log('Stats error:', err));
  }, []);

  const cartes = [
    { label: 'Boutiques', value: stats.totalBoutiques, sub: `Actives : ${stats.boutiquesActives}`, iconKey: 'boutiques', color: '#e0e7ff' },
    { label: 'Utilisateurs', value: stats.totalUsers, sub: `Actifs : ${stats.usersActifs}`, iconKey: 'utilisateurs', color: '#fce7f3' },
    { label: 'Abonnements payants', value: stats.abonnementsPayants, sub: `Expirent sous 15 jours : ${stats.abonnementsExpirant}`, icon: '🔑', color: '#ede9fe' },
  ];

  const raccourcis = [
    { to: '/superadmin/boutiques', label: 'Gérer les boutiques', icon: '🏪' },
    { to: '/superadmin/abonnements', label: 'Générer une licence', icon: '🔑' },
    { to: '/superadmin/utilisateurs', label: 'Réinitialiser un mot de passe', icon: '🔐' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {cartes.map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.iconKey ? <Icone nom={s.iconKey} size={24} /> : <span style={{ fontSize: '22px' }}>{s.icon}</span>}
              </div>
              <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1e1b4b', marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {raccourcis.map(r => (
          <NavLink key={r.to} to={r.to} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', background: 'white', borderRadius: '10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textDecoration: 'none', color: '#1e1b4b', fontSize: '14px', fontWeight: '600'
          }}>
            <span style={{ fontSize: '18px' }}>{r.icon}</span> {r.label}
          </NavLink>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 16px', color: '#1e1b4b', fontSize: '16px' }}>⚠️ Alertes</h3>
        {[
          { label: 'Boutiques inactives', count: stats.totalBoutiques - stats.boutiquesActives, color: '#fbbf24' },
          { label: 'Abonnements expirant sous 15 jours', count: stats.abonnementsExpirant, color: '#f97316' },
          { label: 'Utilisateurs inactifs', count: stats.totalUsers - stats.usersActifs, color: '#a855f7' },
        ].map((a, i, liste) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < liste.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <span style={{ fontSize: '14px', color: '#444' }}>{a.label}</span>
            <span style={{ background: a.color, color: 'white', borderRadius: '20px', padding: '2px 10px', fontSize: '13px', fontWeight: '600' }}>{a.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== BOUTIQUES =====================
function BoutiquesAdmin() {
  const [boutiques, setBoutiques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({
    nomBoutique: '', adresse: '', telephoneBoutique: '', abonnement: 'gratuit',
    nomAdmin: '', emailAdmin: '', motDePasseAdmin: ''
  });

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const chargerBoutiques = () => {
    setLoading(true);
    fetch(`${API_URL}/api/boutiques`, authHeaders)
      .then(r => r.json())
      .then(data => { setBoutiques(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { chargerBoutiques(); }, []);

  const ajouter = async () => {
    setErreur('');
    if (!form.nomBoutique || !form.nomAdmin || !form.emailAdmin || !form.motDePasseAdmin) {
      setErreur('Veuillez remplir au minimum le nom de la boutique et les infos admin.');
      return;
    }
    setEnvoi(true);
    try {
      const res = await fetch(`${API_URL}/api/boutiques/creer-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.message || 'Erreur lors de la création'); setEnvoi(false); return; }

      setForm({ nomBoutique: '', adresse: '', telephoneBoutique: '', abonnement: 'gratuit', nomAdmin: '', emailAdmin: '', motDePasseAdmin: '' });
      setShowForm(false);
      setEnvoi(false);
      chargerBoutiques();
    } catch (err) {
      setErreur('Erreur réseau : ' + err.message);
      setEnvoi(false);
    }
  };

  const toggleActif = async (b) => {
    await fetch(`${API_URL}/api/boutiques/${b._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actif: !b.actif })
    });
    chargerBoutiques();
  };

  const supprimer = async (b) => {
    if (!window.confirm(
      `Supprimer définitivement « ${b.nom} » ?\n\n` +
      `Cela supprime AUSSI, pour ce compte : ses utilisateurs (admin et vendeurs), ` +
      `ses boutiques et caisses, ses magasins, ses produits, ses clients, ses ventes, ` +
      `ses dépenses et versements, et ses licences.\n\nCette action est irréversible.`
    )) return;
    try {
      const res = await fetch(`${API_URL}/api/boutiques/${b._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { window.alert(data.message || 'Erreur'); return; }
      const bi = data.bilan || {};
      window.alert(
        `✅ « ${b.nom} » supprimée.\n\n` +
        `${bi.utilisateurs || 0} utilisateur(s), ${bi.produits || 0} produit(s), ${bi.ventes || 0} vente(s), ` +
        `${bi.comptoirs || 0} boutique(s), ${bi.caisses || 0} caisse(s), ${bi.magasins || 0} magasin(s) supprimé(s).`
      );
    } catch (err) {
      window.alert(err.message);
    }
    chargerBoutiques();
  };

  const abonnementColor = { premium: '#7c3aed', standard: '#2563eb', gratuit: '#16a34a' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icone nom="boutiques" size={28} /> Gestion des Boutiques
        </h2>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          + Nouvelle boutique
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#1e1b4b' }}>Créer une boutique avec son compte Admin</h3>

          <div style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5', marginBottom: '8px', letterSpacing: '0.5px' }}>INFOS BOUTIQUE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <input placeholder="Nom de la boutique" value={form.nomBoutique} onChange={e => setForm(p => ({ ...p, nomBoutique: e.target.value }))}
              style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
            <input placeholder="Adresse" value={form.adresse} onChange={e => setForm(p => ({ ...p, adresse: e.target.value }))}
              style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
            <input placeholder="Téléphone boutique" value={form.telephoneBoutique} onChange={e => setForm(p => ({ ...p, telephoneBoutique: e.target.value }))}
              style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
            <select value={form.abonnement} onChange={e => setForm(p => ({ ...p, abonnement: e.target.value }))}
              style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }}>
              {['gratuit', 'standard', 'premium'].map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
            </select>
          </div>

          <div style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5', marginBottom: '8px', letterSpacing: '0.5px' }}>COMPTE ADMIN (PROPRIÉTAIRE)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <input placeholder="Nom complet" value={form.nomAdmin} onChange={e => setForm(p => ({ ...p, nomAdmin: e.target.value }))}
              style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
            <input placeholder="Email" value={form.emailAdmin} onChange={e => setForm(p => ({ ...p, emailAdmin: e.target.value }))}
              style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
            <input type="password" placeholder="Mot de passe" value={form.motDePasseAdmin} onChange={e => setForm(p => ({ ...p, motDePasseAdmin: e.target.value }))}
              style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none' }} />
          </div>

          {erreur && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              ⚠️ {erreur}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={ajouter} disabled={envoi} style={{ padding: '10px 24px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: envoi ? 0.7 : 1 }}>
              {envoi ? 'Création...' : 'Créer la boutique'}
            </button>
            <button onClick={() => { setShowForm(false); setErreur(''); }} style={{ padding: '10px 24px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
      ) : boutiques.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#666', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          Aucune boutique pour le moment. Cliquez sur "+ Nouvelle boutique" pour en créer une.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {boutiques.map((b) => (
            <div key={b._id} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', background: '#e0e7ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icone nom="boutiques" size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', color: '#1e1b4b', fontSize: '15px' }}>{b.nom}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{b.proprietaire?.nom || '—'}</div>
                  </div>
                </div>
                <span style={{ background: abonnementColor[b.abonnement] || '#666', color: 'white', padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                  {b.abonnement}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>📧 {b.email || '—'}</div>
              {b.abonnement !== 'gratuit' && b.abonnementExpireLe && (
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>⏳ Licence jusqu'au {new Date(b.abonnementExpireLe).toLocaleDateString('fr-FR')}</div>
              )}
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>📞 {b.telephone || '—'}</div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <span style={{ background: b.actif ? '#dcfce7' : '#fee2e2', color: b.actif ? '#16a34a' : '#dc2626', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                  {b.actif ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => toggleActif(b)} style={{
                  flex: 1, padding: '8px', background: b.actif ? '#fee2e2' : '#dcfce7',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                  color: b.actif ? '#dc2626' : '#16a34a', fontWeight: '600'
                }}>{b.actif ? '🔒 Désactiver' : '✅ Activer'}</button>
                <button onClick={() => supprimer(b)} style={{ padding: '8px 12px', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>
                  <Icone nom="supprimer" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== UTILISATEURS =====================
function UtilisateursAdmin() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('Tous');
  const [reinit, setReinit] = useState(null); // résultat d'une réinitialisation (mot de passe temporaire)

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const charger = () => {
    setChargement(true);
    fetch(`${API_URL}/api/users`, authHeaders)
      .then(r => r.json())
      .then(data => { setUtilisateurs(Array.isArray(data) ? data : []); setChargement(false); })
      .catch(() => setChargement(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const toggleActif = async (u) => {
    await fetch(`${API_URL}/api/users/${u._id}/statut`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actif: !u.actif })
    });
    charger();
  };

  const reinitialiserMotDePasse = async (u) => {
    if (!window.confirm(`Réinitialiser le mot de passe de ${u.nom} (${u.email}) ?\n\nSon mot de passe actuel ne fonctionnera plus. Un mot de passe temporaire va être généré : il devra le remplacer à sa prochaine connexion.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${u._id}/reinitialiser-mot-de-passe`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { window.alert(data.message || 'Erreur'); return; }
      setReinit(data);
    } catch (e) {
      window.alert(e.message);
    }
  };

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    await fetch(`${API_URL}/api/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    charger();
  };

  const roleColor = { admin: '#2563eb', vendeur: '#16a34a', superadmin: '#7c3aed' };
  const roleBg = { admin: '#dbeafe', vendeur: '#dcfce7', superadmin: '#ede9fe' };
  const filtres = filtre === 'Tous' ? utilisateurs : utilisateurs.filter(u => u.role === filtre.toLowerCase());

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icone nom="utilisateurs" size={28} /> Gestion des Utilisateurs
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Tous', 'Admin', 'Vendeur'].map(f => (
            <button key={f} onClick={() => setFiltre(f)} style={{
              padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: filtre === f ? '#4f46e5' : '#f1f5f9',
              color: filtre === f ? 'white' : '#666', fontWeight: '500', fontSize: '13px'
            }}>{f}</button>
          ))}
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : filtres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun utilisateur pour le moment.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Nom', 'Email', 'Rôle', 'Boutique', 'Créé le', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtres.map((u) => (
                <tr key={u._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '600', color: '#1e1b4b' }}>{u.nom}</td>
                  <td style={{ padding: '12px 8px', color: '#666', fontSize: '13px' }}>{u.email}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ background: roleBg[u.role], color: roleColor[u.role], padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '12px 8px', color: '#666', fontSize: '13px' }}>{u.boutiqueId?.nom || '—'}</td>
                  <td style={{ padding: '12px 8px', color: '#666', fontSize: '13px' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ background: u.actif ? '#dcfce7' : '#fee2e2', color: u.actif ? '#16a34a' : '#dc2626', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {u.role !== 'superadmin' && (
                        <button onClick={() => reinitialiserMotDePasse(u)} title="Réinitialiser le mot de passe oublié"
                          style={{ padding: '5px 10px', background: '#fef9c3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#a16207', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          🔑 Mot de passe
                        </button>
                      )}
                      <button onClick={() => toggleActif(u)}
                        style={{ padding: '5px 10px', background: u.actif ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: u.actif ? '#dc2626' : '#16a34a', fontWeight: '600' }}>
                        {u.actif ? 'Désactiver' : 'Activer'}
                      </button>
                      <button onClick={() => supprimer(u._id)}
                        style={{ padding: '5px 10px', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>
                        <Icone nom="supprimer" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ModaleMotDePasseTemporaire resultat={reinit} onClose={() => setReinit(null)} />
    </div>
  );
}

// ===================== PARAMETRES =====================
function EditeurIcones() {
  const { icones, loading, refresh } = useIcones();
  const [brouillon, setBrouillon] = useState({});
  const [enregistrement, setEnregistrement] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => { setBrouillon(icones); }, [icones]);

  const modifier = (cle, valeur) => setBrouillon(p => ({ ...p, [cle]: valeur }));

  const handleFichier = (cle, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => modifier(cle, ev.target.result);
    reader.readAsDataURL(file);
  };

  const enregistrerUne = async (cle) => {
    setEnregistrement(cle);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/icones/${cle}`,
        { valeur: brouillon[cle] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      refresh();
      setMessage(`✅ Icône "${cle}" mise à jour.`);
    } catch (err) {
      setMessage('❌ Erreur : ' + (err.response?.data?.message || err.message) + ' — vérifiez le format de la route backend/routes/icones.js');
    } finally {
      setEnregistrement(null);
    }
  };

  if (loading) return <div style={{ color: '#666', padding: '20px' }}>Chargement des icônes...</div>;

  const cles = Object.keys(icones).sort();

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 8px', color: '#1e1b4b' }}>🎨 Icônes de l'application</h3>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
        Tapez un emoji, ou cliquez sur l'image pour uploader un fichier, puis cliquez sur 💾. Les changements s'appliquent à tous les comptes.
      </p>

      {message && (
        <div style={{
          padding: '10px 16px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
          background: message.startsWith('✅') ? '#dcfce7' : '#fee2e2',
          color: message.startsWith('✅') ? '#16a34a' : '#dc2626'
        }}>{message}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
        {cles.map(cle => {
          const valeur = brouillon[cle] || '';
          const estImage = valeur.startsWith('data:image') || valeur.startsWith('http');
          const inputId = `icone-file-${cle}`;
          return (
            <div key={cle} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px' }}>
              <label htmlFor={inputId} style={{
                width: '40px', height: '40px', flexShrink: 0, borderRadius: '6px',
                border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
              }} title="Cliquer pour changer l'image">
                {estImage ? (
                  <img src={valeur} alt={cle} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '20px' }}>{valeur || '❓'}</span>
                )}
              </label>
              <input id={inputId} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => handleFichier(cle, e)} />

              <input
                value={estImage ? '' : valeur}
                placeholder={estImage ? '(image)' : '🙂'}
                onChange={e => modifier(cle, e.target.value)}
                style={{ width: '48px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', textAlign: 'center', outline: 'none', flexShrink: 0 }} />

              <span style={{ fontSize: '12px', color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cle}</span>

              <button onClick={() => enregistrerUne(cle)} disabled={enregistrement === cle}
                style={{ padding: '4px 10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                {enregistrement === cle ? '...' : '💾'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageIcones() {
  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        🎨 Icônes de l'application
      </h2>
      <EditeurIcones />
    </div>
  );
}

function ParametresSuperAdmin({ user }) {
  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icone nom="parametres" size={28} /> Paramètres système
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#1e1b4b' }}>🔧 Configuration générale</h3>
          {[
            { label: "Nom de l'application", val: 'Boutique Stock' },
            { label: 'Email de contact', val: 'contact@boutique-stock.com' },
            { label: 'Devise', val: 'FCFA' },
            { label: 'Fuseau horaire', val: 'Africa/Douala' },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '6px' }}>{f.label}</label>
              <input defaultValue={f.val} style={{ width: '100%', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <button style={{ padding: '10px 24px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>💾 Sauvegarder</button>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#1e1b4b' }}>🔒 Mon compte Super Admin</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '10px' }}>
            <EditeurPhotoProfil fond="#4f46e5" taille={56} />
            <div>
              <div style={{ fontWeight: '700', color: '#1e1b4b', fontSize: '16px' }}>{user?.nom}</div>
              <div style={{ color: '#666', fontSize: '14px' }}>{user?.email}</div>
              <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>Super Admin</span>
            </div>
          </div>
          {[
            { label: 'Nouveau mot de passe', type: 'password', ph: '••••••••' },
            { label: 'Confirmer le mot de passe', type: 'password', ph: '••••••••' },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '6px' }}>{f.label}</label>
              <input type={f.type} placeholder={f.ph} style={{ width: '100%', padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <button style={{ padding: '10px 24px', background: '#1e1b4b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>🔒 Changer le mot de passe</button>
        </div>
      </div>
    </div>
  );
}

// ===================== JOURNAL =====================
function JournalAdmin() {
  const [logs, setLogs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API_URL}/api/logs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setChargement(false); })
      .catch(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const libelles = {
    connexion: 'Connexion',
    connexion_echouee: 'Tentative de connexion échouée',
    boutique_creee: 'Boutique créée',
    boutique_activee: 'Boutique activée',
    boutique_desactivee: 'Boutique désactivée',
    utilisateur_cree: 'Utilisateur créé',
    vente_creee: 'Vente créée',
    produit_ajoute: 'Produit ajouté',
  };

  const typeBg = { success: '#dcfce7', error: '#fee2e2', info: '#dbeafe' };
  const typeColor = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
  const typeIcon = { success: '✅', error: '❌', info: 'ℹ️' };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        📋 Journal d'activités
      </h2>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucune activité enregistrée pour le moment.</div>
        ) : (
          logs.map((e, i) => (
            <div key={e._id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 0', borderBottom: i < logs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: typeBg[e.niveau], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                {typeIcon[e.niveau]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e1b4b', marginBottom: '2px' }}>
                  <span style={{ color: typeColor[e.niveau] }}>{libelles[e.type] || e.type}</span> — {e.message}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Par <strong>{e.nomUtilisateur}</strong></div>
              </div>
              <div style={{ fontSize: '12px', color: '#999', flexShrink: 0 }}>
                {e.createdAt ? new Date(e.createdAt).toLocaleString('fr-FR') : '—'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===================== NOTIFICATIONS =====================
function NotificationsAdmin() {
  const [notifs, setNotifs] = useState([
    { id: 1, titre: "Boutique en attente d'activation", detail: 'Elégance Plus attend votre validation', type: 'warning', lu: false },
    { id: 2, titre: 'Paiement échoué', detail: 'Tendance Shop — renouvellement échoué', type: 'error', lu: false },
    { id: 3, titre: 'Abonnement expirant', detail: 'Mode & Style — expire dans 30 jours', type: 'warning', lu: false },
    { id: 4, titre: 'Nouvel utilisateur', detail: 'Moussa Diallo a été créé avec succès', type: 'success', lu: true },
  ]);

  const typeBg = { success: '#dcfce7', error: '#fee2e2', warning: '#fef9c3' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🔔 Notifications
        </h2>
        <button onClick={() => setNotifs(p => p.map(n => ({ ...n, lu: true })))}
          style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          Tout marquer comme lu
        </button>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {notifs.map((n, i) => (
          <div key={i} onClick={() => setNotifs(p => p.map(x => x.id === n.id ? { ...x, lu: true } : x))}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px', marginBottom: '8px', borderRadius: '10px', background: n.lu ? '#fafafa' : '#f0f7ff', cursor: 'pointer', border: `1px solid ${n.lu ? '#f1f5f9' : '#dbeafe'}` }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: typeBg[n.type], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : '⚠️'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: n.lu ? '500' : '700', color: '#1e1b4b', marginBottom: '4px' }}>{n.titre}</div>
              <div style={{ fontSize: '13px', color: '#666' }}>{n.detail}</div>
            </div>
            {!n.lu && <div style={{ width: '8px', height: '8px', background: '#4f46e5', borderRadius: '50%', flexShrink: 0, marginTop: '6px' }}></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== SAUVEGARDES =====================
function SauvegardesAdmin() {
  const sauvegardes = [
    { date: '24/06/2026 02:00', type: 'Automatique', taille: '45.2 MB', statut: 'Réussie' },
    { date: '23/06/2026 02:00', type: 'Automatique', taille: '44.8 MB', statut: 'Réussie' },
    { date: '22/06/2026 14:30', type: 'Manuelle', taille: '44.1 MB', statut: 'Réussie' },
    { date: '21/06/2026 02:00', type: 'Automatique', taille: '43.9 MB', statut: 'Échouée' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          💾 Sauvegardes
        </h2>
        <button style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          💾 Sauvegarder maintenant
        </button>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {['Date', 'Type', 'Taille', 'Statut', 'Action'].map(h => (
                <th key={h} style={{ padding: '12px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sauvegardes.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '12px 8px', color: '#333', fontSize: '13px' }}>{s.date}</td>
                <td style={{ padding: '12px 8px', color: '#666', fontSize: '13px' }}>{s.type}</td>
                <td style={{ padding: '12px 8px', color: '#333', fontWeight: '500' }}>{s.taille}</td>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{ background: s.statut === 'Réussie' ? '#dcfce7' : '#fee2e2', color: s.statut === 'Réussie' ? '#16a34a' : '#dc2626', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>{s.statut}</span>
                </td>
                <td style={{ padding: '12px 8px' }}>
                  <button style={{ padding: '5px 12px', background: '#e0e7ff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#4f46e5', fontWeight: '600' }}>⬇️ Restaurer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== MAINTENANCE =====================
function MaintenanceAdmin() {
  const [modeMaintenance, setModeMaintenance] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [envoiToggle, setEnvoiToggle] = useState(false);
  const [actionEnCours, setActionEnCours] = useState('');
  const [messages, setMessages] = useState({});

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const chargerStatut = () => {
    fetch(`${API_URL}/api/maintenance/statut`)
      .then(r => r.json())
      .then(d => { setModeMaintenance(!!d.enMaintenance); setChargement(false); })
      .catch(() => setChargement(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { chargerStatut(); }, []);

  const toggleMaintenance = async () => {
    setEnvoiToggle(true);
    try {
      const route = modeMaintenance ? 'desactiver' : 'activer';
      const res = await fetch(`${API_URL}/api/maintenance/${route}`, { method: 'POST', ...authHeaders });
      const data = await res.json();
      if (res.ok) setModeMaintenance(data.enMaintenance);
    } catch (err) {
      alert('Erreur réseau : ' + err.message);
    } finally {
      setEnvoiToggle(false);
    }
  };

  const declencherAction = async (cle) => {
    setActionEnCours(cle);
    setMessages(p => ({ ...p, [cle]: '' }));
    try {
      const res = await fetch(`${API_URL}/api/maintenance/${cle}`, { method: 'POST', ...authHeaders });
      const data = await res.json();
      setMessages(p => ({ ...p, [cle]: data.message || (res.ok ? '✅ Terminé.' : '❌ Erreur.') }));
    } catch (err) {
      setMessages(p => ({ ...p, [cle]: '❌ Erreur réseau : ' + err.message }));
    } finally {
      setActionEnCours('');
    }
  };

  const actions = [
    { cle: 'vider-cache', icon: '🗑️', label: 'Vider le cache', sub: 'Libère la mémoire temporaire', color: '#fef9c3', textColor: '#ca8a04' },
    { cle: 'optimiser-bd', icon: '📊', label: 'Optimiser la base de données', sub: 'Diagnostic sans modification', color: '#dbeafe', textColor: '#2563eb' },
    { cle: 'tester-email', icon: '📧', label: 'Tester les emails', sub: "Vérifie l'envoi de notifications", color: '#dcfce7', textColor: '#16a34a' },
    { cle: 'redemarrer', icon: '🔄', label: 'Redémarrer les services', sub: 'Action symbolique pour le moment', color: '#ede9fe', textColor: '#7c3aed' },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '10px' }}>
        🔧 Maintenance
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#1e1b4b' }}>🔴 Mode maintenance</h3>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
            En mode maintenance, seul le Super Admin peut accéder à l'application.
          </p>
          {chargement ? (
            <div style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>Chargement du statut...</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: modeMaintenance ? '#fee2e2' : '#f0fdf4', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: modeMaintenance ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                {modeMaintenance ? '🔴' : '🟢'}
              </div>
              <div>
                <div style={{ fontWeight: '700', color: modeMaintenance ? '#dc2626' : '#16a34a', fontSize: '15px' }}>
                  {modeMaintenance ? 'Mode maintenance ACTIF' : 'Système opérationnel'}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {modeMaintenance ? "L'accès est restreint" : 'Toutes les boutiques ont accès'}
                </div>
              </div>
            </div>
          )}
          <button onClick={toggleMaintenance} disabled={envoiToggle || chargement} style={{
            padding: '12px 24px', background: modeMaintenance ? '#16a34a' : '#dc2626',
            color: 'white', border: 'none', borderRadius: '8px', cursor: (envoiToggle || chargement) ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '14px',
            opacity: envoiToggle ? 0.7 : 1
          }}>
            {envoiToggle ? '...' : modeMaintenance ? '✅ Désactiver la maintenance' : '🔧 Activer la maintenance'}
          </button>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#1e1b4b' }}>🧹 Actions système</h3>
          {actions.map((a) => (
            <div key={a.cle} style={{ marginBottom: '10px' }}>
              <button onClick={() => declencherAction(a.cle)} disabled={actionEnCours === a.cle} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px',
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                cursor: actionEnCours === a.cle ? 'not-allowed' : 'pointer', textAlign: 'left',
                opacity: actionEnCours === a.cle ? 0.7 : 1
              }}>
                <div style={{ width: '40px', height: '40px', background: a.color, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{a.icon}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: a.textColor }}>
                    {actionEnCours === a.cle ? 'En cours...' : a.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{a.sub}</div>
                </div>
              </button>
              {messages[a.cle] && (
                <div style={{ fontSize: '12px', color: '#555', marginTop: '6px', paddingLeft: '4px', whiteSpace: 'pre-wrap' }}>
                  {messages[a.cle]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}