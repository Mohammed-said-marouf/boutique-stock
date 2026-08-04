import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icone } from '../context/IconesContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

const API_BASE = 'https://boutique-stock-api.onrender.com';
const resoudreImage = (chemin) => {
  if (!chemin) return null;
  return chemin.startsWith('http') ? chemin : `${API_BASE}${chemin}`;
};

// Détecte si l'écran est en format mobile, se met à jour au redimensionnement
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

const menuItems = [
  { path: '/admin', iconKey: 'dashboard', label: 'Tableau de bord' },
  { path: '/admin/produits', iconKey: 'produits', label: 'Produits' },
  { path: '/admin/stocks', iconKey: 'stock', label: 'Stocks' },
  { path: '/admin/ventes', iconKey: 'ventes', label: 'Ventes' },
  { path: '/admin/clients', iconKey: 'clients', label: 'Clients' },
  { path: '/admin/fournisseurs', iconKey: 'produits', label: 'Fournisseurs' },
  { path: '/admin/vendeurs', iconKey: 'utilisateurs', label: 'Utilisateurs (Vendeurs)' },
  { path: '/admin/factures', iconKey: 'ventes', label: 'Factures' },
  { path: '/admin/rapports', iconKey: 'dashboard', label: 'Rapports' },
  { path: '/admin/parametres', iconKey: 'parametres', label: 'Paramètres' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const fermerMenuMobile = () => { if (isMobile) setCollapsed(true); };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif', background: '#f0f2f5', position: 'relative', overflow: 'hidden' }}>
      {/* Voile sombre derrière le menu en mode tiroir mobile */}
      {isMobile && !collapsed && (
        <div onClick={() => setCollapsed(true)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
      )}

      {/* Sidebar */}
      <div style={{
        width: collapsed ? '0px' : '240px', background: '#0f172a',
        display: 'flex', flexDirection: 'column', transition: 'width 0.3s, transform 0.3s',
        overflow: 'hidden', flexShrink: 0,
        ...(isMobile ? {
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50, width: '240px',
          transform: collapsed ? 'translateX(-100%)' : 'translateX(0)'
        } : {})
      }}>
        <div style={{ width: '240px', height: '100%', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{
            width: '30px', height: '30px', background: '#2563eb',
            borderRadius: '7px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '16px', flexShrink: 0, overflow: 'hidden'
          }}>
            {user?.boutique?.logo ? (
              <img src={resoudreImage(user.boutique.logo)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src="/logo512.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          {!collapsed && (
            <div>
              <div style={{ color: 'white', fontWeight: '700', fontSize: '13px' }}>
                {user?.boutique?.nom || 'Ma Boutique'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '10.5px' }}>Admin</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '8px 6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#3b82f6', fontSize: '9.5px', fontWeight: '700', padding: '4px 6px 3px', letterSpacing: '1px' }}>
            {!collapsed && 'MENU PRINCIPAL'}
          </div>
          {menuItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/admin'} onClick={fermerMenuMobile}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 8px', borderRadius: '7px', marginBottom: '1px',
                textDecoration: 'none', color: isActive ? 'white' : '#94a3b8',
                background: isActive ? '#2563eb' : 'transparent',
                transition: 'all 0.2s', fontSize: '12.5px'
              })}>
              <div style={{ width: '19px', height: '19px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icone nom={item.iconKey} size={19} />
              </div>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '10px', borderTop: '1px solid #1e293b', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px', background: '#2563eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '16px', flexShrink: 0, overflow: 'hidden'
            }}>
              {user?.boutique?.logo ? (
                <img src={resoudreImage(user.boutique.logo)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src="/logo512.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                    {user?.boutique?.nom || 'Ma Boutique'}
                  </span>
                  <span style={{ background: '#16a34a', color: 'white', fontSize: '9px', padding: '1px 6px', borderRadius: '10px' }}>Active</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px' }}>ID: #BTQ-001</div>
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>
                <Icone nom="deconnexion" size={18} />
              </button>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          background: 'white', padding: isMobile ? '0 12px' : '0 24px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flexShrink: 0, gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
            <button onClick={() => setCollapsed(!collapsed)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', flexShrink: 0 }}>
              ☰
            </button>
            <h2 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Tableau de bord</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', flexShrink: 0 }}>
            {!isMobile && (
              <input placeholder="Rechercher un produit, une facture..." style={{
                padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '20px',
                fontSize: '14px', outline: 'none', width: '260px'
              }} />
            )}
            {isMobile && (
              <span onClick={() => setRechercheOuverte(v => !v)} style={{ fontSize: '19px', cursor: 'pointer' }}>🔍</span>
            )}
            <span style={{ fontSize: '20px', cursor: 'pointer' }}>🔔</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '700', flexShrink: 0
              }}>{user?.nom?.charAt(0) || 'A'}</div>
              {!isMobile && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{user?.nom}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Propriétaire</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isMobile && rechercheOuverte && (
          <div style={{ background: 'white', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <input autoFocus placeholder="Rechercher un produit, une facture..." style={{
              width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '20px',
              fontSize: '14px', outline: 'none', boxSizing: 'border-box'
            }} />
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '14px' : '24px' }}>
          <Routes>
            <Route path="" element={<AdminDashboard />} />
            <Route path="produits" element={<AdminProduits />} />
            <Route path="stocks" element={<AdminStocks />} />
            <Route path="ventes" element={<AdminVentes />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="fournisseurs" element={<AdminFournisseurs />} />
            <Route path="vendeurs" element={<AdminVendeurs />} />
            <Route path="factures" element={<AdminFactures user={user} />} />
            <Route path="rapports" element={<AdminRapports />} />
            <Route path="parametres" element={<AdminParametres user={user} />} />
            <Route path="*" element={<div><h2>Page en construction</h2></div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [statsVentes, setStatsVentes] = useState({ caJour: 0, ventesJour: 0, caMois: 0, ventesMois: 0 });
  const [statsProduits, setStatsProduits] = useState({ total: 0, rupture: 0, faible: 0, alertes: [] });
  const [ventesRecentes, setVentesRecentes] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const h = { Authorization: `Bearer ${token}` };

    fetch('https://boutique-stock-api.onrender.com/api/ventes/stats', { headers: h })
      .then(r => r.json()).then(d => { if (!d.message) setStatsVentes(d); });

    fetch('https://boutique-stock-api.onrender.com/api/produits/stats', { headers: h })
      .then(r => r.json()).then(d => { if (!d.message) setStatsProduits(d); });

    fetch('https://boutique-stock-api.onrender.com/api/ventes', { headers: h })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setVentesRecentes(d.slice(0, 4)); });
  }, []);

  const cartes = [
    { label: 'Ventes du jour', value: `${statsVentes.caJour.toLocaleString()} FCFA`, sub: `${statsVentes.ventesJour} ventes`, iconKey: 'caisse', bg: 'linear-gradient(135deg, #2563eb, #1d4ed8)' },
    { label: 'Ventes du mois', value: `${statsVentes.caMois.toLocaleString()} FCFA`, sub: `${statsVentes.ventesMois} ventes ce mois`, iconKey: 'dashboard', bg: 'linear-gradient(135deg, #16a34a, #15803d)' },
    { label: 'Produits en stock', value: statsProduits.total, sub: 'Articles disponibles', iconKey: 'produits', bg: 'linear-gradient(135deg, #7c3aed, #6d28d9)' },
    { label: 'Produits en rupture', value: statsProduits.rupture, sub: `Stock faible : ${statsProduits.faible}`, iconKey: 'stock', bg: 'linear-gradient(135deg, #d97706, #b45309)' },
    { label: 'Chiffre total', value: `${statsVentes.chiffreAffaires?.toLocaleString() || 0} FCFA`, sub: 'Toutes périodes', iconKey: 'ventes', bg: 'linear-gradient(135deg, #0891b2, #0e7490)' },
  ];

  const quickActions = [
    { iconKey: 'produits', label: 'Ajouter un produit', path: '/admin/produits', openForm: true },
    { iconKey: 'ajouter', label: 'Entrée de stock', path: '/admin/stocks', openForm: true },
    { iconKey: 'caisse', label: 'Nouvelle vente', path: '/admin/ventes' },
    { iconKey: 'utilisateurs', label: 'Ajouter un vendeur', path: '/admin/vendeurs', openForm: true },
    { iconKey: 'ventes', label: 'Nouvelle facture', path: '/admin/factures' },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '12px',
      height: isMobile ? 'auto' : '100%', width: '100%', boxSizing: 'border-box',
      overflow: isMobile ? 'visible' : 'hidden'
    }}>
      {/* Cartes stats — couleurs distinctes, une seule ligne */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(130px, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: '10px', flexShrink: 0 }}>
        {cartes.map((s, i) => (
          <div key={i} style={{
            background: s.bg, borderRadius: '12px', padding: '14px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)', color: 'white',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icone nom={s.iconKey} size={18} />
              </div>
              <span style={{ fontSize: '11.5px', opacity: 0.9 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: '17px', fontWeight: '700', marginBottom: '2px', lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tableaux */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', flex: isMobile ? 'none' : '1 1 0%', minHeight: 0 }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0f172a' }}>⚠️ Alertes de stock</h3>
          {statsProduits.alertes.length === 0 ? (
            <div style={{ color: '#16a34a', fontSize: '13px', padding: '14px 0', textAlign: 'center' }}>✅ Aucune alerte de stock</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ color: '#666', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '5px 0', fontWeight: '600' }}>Produit</th>
                  <th style={{ textAlign: 'center', fontWeight: '600' }}>Stock</th>
                  <th style={{ textAlign: 'center', fontWeight: '600' }}>Seuil</th>
                  <th style={{ textAlign: 'center', fontWeight: '600' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {statsProduits.alertes.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '6px 0', color: '#333' }}>{a.nom}</td>
                    <td style={{ textAlign: 'center', color: '#333' }}>{a.quantite}</td>
                    <td style={{ textAlign: 'center', color: '#666' }}>{a.seuilAlerte}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        background: a.quantite === 0 ? '#fee2e2' : '#fef9c3',
                        color: a.quantite === 0 ? '#dc2626' : '#ca8a04',
                        padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: '600'
                      }}>{a.quantite === 0 ? 'Rupture' : 'Faible'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0f172a' }}>🛒 Ventes récentes</h3>
          {ventesRecentes.length === 0 ? (
            <div style={{ color: '#666', fontSize: '13px', padding: '14px 0', textAlign: 'center' }}>Aucune vente enregistrée</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ color: '#666', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ textAlign: 'left', padding: '5px 0', fontWeight: '600' }}>N° Facture</th>
                  <th style={{ textAlign: 'left', fontWeight: '600' }}>Client</th>
                  <th style={{ textAlign: 'right', fontWeight: '600' }}>Montant</th>
                  <th style={{ textAlign: 'center', fontWeight: '600' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {ventesRecentes.map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '6px 0', color: '#2563eb', fontWeight: '500' }}>{v.numFacture || '#—'}</td>
                    <td style={{ color: '#333' }}>{v.nomClient || 'Client'}</td>
                    <td style={{ textAlign: 'right', color: '#333', fontWeight: '500' }}>{(v.montantTotal || 0).toLocaleString()} FCFA</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        background: '#dcfce7', color: '#16a34a',
                        padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: '600'
                      }}>Payée</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rangée sombre en bas — Actions rapides horizontales */}
      <div style={{
        background: '#0f172a', borderRadius: '12px', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)', overflowX: 'auto'
      }}>
        <span style={{ fontSize: '12.5px', color: 'white', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, paddingRight: '4px' }}>
          ⚡ Actions rapides
        </span>
        {quickActions.map((a, i) => (
          <button key={i} onClick={() => navigate(a.path, a.openForm ? { state: { openForm: true } } : undefined)} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', cursor: 'pointer', fontSize: '11.5px', color: '#e2e8f0',
            whiteSpace: 'nowrap', flexShrink: 0
          }}>
            <Icone nom={a.iconKey} size={16} />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminProduits() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [recherche, setRecherche] = useState('');
  const [showForm, setShowForm] = useState(!!location.state?.openForm);
  const [produits, setProduits] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ nom: '', categorie: '', ref: '', prix: '', quantite: '', seuilAlerte: 5, description: '' });

  const token = localStorage.getItem('token');

  const charger = () => {
    fetch('https://boutique-stock-api.onrender.com/api/produits', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setProduits(d); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const ouvrirNouveau = () => {
    setEditId(null);
    setForm({ nom: '', categorie: '', ref: '', prix: '', quantite: '', seuilAlerte: 5, description: '' });
    setImageFile(null); setImagePreview(null);
    setShowForm(v => !v);
  };

  const ouvrirModification = (p) => {
    setEditId(p._id);
    setForm({
      nom: p.nom || '', categorie: p.categorie || '', ref: p.ref || '',
      prix: p.prix ?? '', quantite: p.quantite ?? '', seuilAlerte: p.seuilAlerte ?? 5,
      description: p.description || ''
    });
    setImageFile(null);
    setImagePreview(p.image ? resoudreImage(p.image) : null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ajouter = async () => {
    if (!form.nom || !form.prix) return;
    setEnvoi(true);
    const formData = new FormData();
    Object.keys(form).forEach(k => formData.append(k, form[k]));
    if (imageFile) formData.append('image', imageFile);

    const url = editId
      ? `https://boutique-stock-api.onrender.com/api/produits/${editId}`
      : 'https://boutique-stock-api.onrender.com/api/produits';
    const method = editId ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    setForm({ nom: '', categorie: '', ref: '', prix: '', quantite: '', seuilAlerte: 5, description: '' });
    setImageFile(null); setImagePreview(null); setShowForm(false); setEnvoi(false); setEditId(null);
    charger();
  };

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer ce produit ?')) return;
    await fetch(`https://boutique-stock-api.onrender.com/api/produits/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    charger();
  };

  const filtres = produits.filter(p => p.nom.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icone nom="produits" size={28} /> Gestion des Produits
        </h2>
        <button onClick={ouvrirNouveau} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          + Ajouter un produit
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#0f172a' }}>{editId ? '✏️ Modifier le produit' : 'Nouveau produit'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Photo du produit</label>
              <div onClick={() => document.getElementById('photoInput').click()} style={{
                width: '100%', height: '160px', border: '2px dashed #e2e8f0', borderRadius: '10px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', background: '#f8fafc', overflow: 'hidden'
              }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                ) : (
                  <>
                    <span style={{ fontSize: '32px', marginBottom: '8px' }}>📷</span>
                    <span style={{ fontSize: '13px', color: '#666' }}>Cliquer pour ajouter une photo</span>
                    <span style={{ fontSize: '11px', color: '#999' }}>JPG, PNG, WEBP — max 5MB</span>
                  </>
                )}
              </div>
              <input id="photoInput" type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
              {imagePreview && (
                <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                  style={{ marginTop: '8px', width: '100%', padding: '6px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>
                  🗑️ Supprimer la photo
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[
                { key: 'nom', label: 'Nom du produit', ph: 'Ex: Ballerine' },
                { key: 'categorie', label: 'Catégorie', ph: 'Ex: Chaussures' },
                { key: 'ref', label: 'Référence', ph: 'Ex: BAL001' },
                { key: 'prix', label: 'Prix (FCFA)', ph: '0', type: 'number' },
                { key: 'quantite', label: 'Stock initial', ph: '0', type: 'number' },
                { key: 'seuilAlerte', label: "Seuil d'alerte", ph: '5', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.ph} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description du produit..."
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', height: '60px' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={ajouter} disabled={envoi} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: envoi ? 0.7 : 1 }}>
              {envoi ? 'Enregistrement...' : editId ? '✏️ Enregistrer les modifications' : '✅ Enregistrer le produit'}
            </button>
            <button onClick={() => { setShowForm(false); setImageFile(null); setImagePreview(null); setEditId(null); }}
              style={{ padding: '10px 24px', background: '#f1f5f9', color: '#666', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un produit..."
          style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '280px', marginBottom: '16px' }} />
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {['Photo', 'Réf', 'Nom', 'Catégorie', 'Prix', 'Stock', 'Statut', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtres.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '8px' }}>
                  {p.image ? (
                    <img src={resoudreImage(p.image)} alt={p.nom}
                      style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                      onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      <Icone nom="produits" size={24} />
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 8px', color: '#2563eb', fontSize: '13px', fontWeight: '500' }}>{p.ref || '—'}</td>
                <td style={{ padding: '10px 8px', color: '#333', fontWeight: '600' }}>{p.nom}</td>
                <td style={{ padding: '10px 8px', color: '#666' }}>{p.categorie}</td>
                <td style={{ padding: '10px 8px', color: '#333', fontWeight: '500' }}>{Number(p.prix).toLocaleString()} FCFA</td>
                <td style={{ padding: '10px 8px', color: '#333' }}>{p.quantite}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    background: p.quantite <= p.seuilAlerte ? (p.quantite === 0 ? '#fee2e2' : '#fef9c3') : '#dcfce7',
                    color: p.quantite <= p.seuilAlerte ? (p.quantite === 0 ? '#dc2626' : '#ca8a04') : '#16a34a',
                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600'
                  }}>{p.quantite === 0 ? 'Rupture' : p.quantite <= p.seuilAlerte ? 'Faible' : 'Disponible'}</span>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => ouvrirModification(p)} style={{ padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#2563eb' }}>
                      <Icone nom="modifier" size={14} />
                    </button>
                    <button onClick={() => supprimer(p._id)} style={{ padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>
                      <Icone nom="supprimer" size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtres.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>Aucun produit trouvé</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function AdminStocks() {
  const location = useLocation();
  const [mouvements, setMouvements] = useState([]);
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [showForm, setShowForm] = useState(!!location.state?.openForm);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ produit: '', type: 'entree', quantite: '', note: '' });

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const charger = () => {
    setChargement(true);
    fetch('https://boutique-stock-api.onrender.com/api/mouvements-stock', authHeaders)
      .then(r => r.json())
      .then(d => { setMouvements(Array.isArray(d) ? d : []); setChargement(false); })
      .catch(() => setChargement(false));
  };

  const chargerProduits = () => {
    fetch('https://boutique-stock-api.onrender.com/api/produits', authHeaders)
      .then(r => r.json())
      .then(d => setProduits(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); chargerProduits(); }, []);

  const ajouterMouvement = async () => {
    if (!form.produit || !form.quantite) {
      setErreur('Sélectionnez un produit et une quantité.');
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/mouvements-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.message || 'Erreur'); setEnvoi(false); return; }
      setForm({ produit: '', type: 'entree', quantite: '', note: '' });
      setShowForm(false);
      charger();
      chargerProduits();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icone nom="stock" size={28} /> Gestion des Stocks
        </h2>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          + Entrée de stock
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Produit</label>
              <select value={form.produit} onChange={e => setForm(p => ({ ...p, produit: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">Sélectionner...</option>
                {produits.map(p => <option key={p._id} value={p._id}>{p.nom} (stock: {p.quantite})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                <option value="entree">Entrée</option>
                <option value="sortie">Sortie</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Quantité</label>
              <input type="number" value={form.quantite} onChange={e => setForm(p => ({ ...p, quantite: e.target.value }))} placeholder="0"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Note</label>
              <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="Ex: Commande fournisseur"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          {erreur && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>⚠️ {erreur}</div>}
          <button onClick={ajouterMouvement} disabled={envoi} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontWeight: '600', marginRight: '10px', opacity: envoi ? 0.7 : 1 }}>
            {envoi ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button onClick={() => setShowForm(false)} style={{ padding: '10px 24px', background: '#f1f5f9', color: '#666', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 16px', color: '#0f172a', fontSize: '15px' }}>📋 Historique des mouvements</h3>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : mouvements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun mouvement enregistré.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Date', 'Produit', 'Type', 'Quantité', 'Stock restant', 'Note'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m) => (
                <tr key={m._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 8px', color: '#666', fontSize: '13px' }}>{new Date(m.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding: '10px 8px', color: '#333', fontWeight: '600' }}>{m.produit?.nom || '—'}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      background: m.type === 'entree' ? '#dcfce7' : '#fee2e2',
                      color: m.type === 'entree' ? '#16a34a' : '#dc2626',
                      padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600'
                    }}>{m.type === 'entree' ? 'Entrée' : 'Sortie'}</span>
                  </td>
                  <td style={{ padding: '10px 8px', color: '#333', fontWeight: '500' }}>{m.quantite}</td>
                  <td style={{ padding: '10px 8px', color: '#333' }}>{m.stockRestant}</td>
                  <td style={{ padding: '10px 8px', color: '#666', fontSize: '13px' }}>{m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminVentes() {
  const [ventes, setVentes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('https://boutique-stock-api.onrender.com/api/ventes', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setVentes(Array.isArray(d) ? d : []); setChargement(false); })
      .catch(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = ventes.reduce((s, v) => s + (v.montantTotal || 0), 0);

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icone nom="ventes" size={28} /> Ventes
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {[
          { label: 'Total ventes', value: `${total.toLocaleString()} FCFA`, iconKey: 'ventes', color: '#dcfce7' },
          { label: 'Nombre de ventes', value: ventes.length, iconKey: 'caisse', color: '#dbeafe' },
          { label: 'Ventes payées', value: ventes.length, iconKey: 'actif', color: '#ede9fe' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icone nom={s.iconKey} size={28} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: '#666' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : ventes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucune vente enregistrée.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['N° Vente', 'Client', 'Vendeur', 'Montant', 'Statut', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventes.map((v) => (
                <tr key={v._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 8px', color: '#2563eb', fontWeight: '600' }}>{v.numFacture || '—'}</td>
                  <td style={{ padding: '10px 8px', color: '#333' }}>{v.clientNom || 'Client anonyme'}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{v.nomVendeur || '—'}</td>
                  <td style={{ padding: '10px 8px', color: '#333', fontWeight: '600' }}>{(v.montantTotal || 0).toLocaleString()} FCFA</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Payée</span>
                  </td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{v.dateVente ? new Date(v.dateVente).toLocaleDateString('fr-FR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminClients() {
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ nom: '', telephone: '', email: '' });

  const token = localStorage.getItem('token');

  const charger = () => {
    fetch('https://boutique-stock-api.onrender.com/api/clients', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setClients(Array.isArray(d) ? d : []); setChargement(false); })
      .catch(() => setChargement(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const ajouterClient = async () => {
    if (!form.nom) return;
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.message || 'Erreur'); setEnvoi(false); return; }
      setForm({ nom: '', telephone: '', email: '' });
      setShowForm(false);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icone nom="clients" size={28} /> Clients
        </h2>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Nouveau client</button>
      </div>
      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            {[{ key: 'nom', label: 'Nom', ph: 'Nom complet' }, { key: 'telephone', label: 'Téléphone', ph: '77 000 00 00' }, { key: 'email', label: 'Email', ph: 'email@exemple.com' }].map(f => (
              <div key={f.key} style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {erreur && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>⚠️ {erreur}</div>}
          <button onClick={ajouterClient} disabled={envoi} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontWeight: '600', marginRight: '10px', opacity: envoi ? 0.7 : 1 }}>
            {envoi ? '...' : 'Enregistrer'}
          </button>
          <button onClick={() => setShowForm(false)} style={{ padding: '10px 24px', background: '#f1f5f9', color: '#666', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
        </div>
      )}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : clients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun client pour le moment.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Nom', 'Téléphone', 'Email', 'Achats', 'Total dépensé'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 8px', fontWeight: '600', color: '#333' }}>{c.nom}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{c.telephone || '-'}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{c.email || '-'}</td>
                  <td style={{ padding: '10px 8px', color: '#333' }}>{c.achats || 0}</td>
                  <td style={{ padding: '10px 8px', color: '#2563eb', fontWeight: '600' }}>{(c.total || 0).toLocaleString()} FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminFournisseurs() {
  const [showForm, setShowForm] = useState(false);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '' });

  const token = localStorage.getItem('token');

  const charger = () => {
    setChargement(true);
    fetch('https://boutique-stock-api.onrender.com/api/fournisseurs', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setFournisseurs(Array.isArray(d) ? d : []); setChargement(false); })
      .catch(() => setChargement(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const ajouterFournisseur = async () => {
    if (!form.nom) return;
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/fournisseurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.message || 'Erreur'); setEnvoi(false); return; }
      setForm({ nom: '', telephone: '', email: '', adresse: '' });
      setShowForm(false);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const supprimerFournisseur = async (id) => {
    if (!window.confirm('Supprimer ce fournisseur ?')) return;
    await fetch(`https://boutique-stock-api.onrender.com/api/fournisseurs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    charger();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#0f172a' }}>🚚 Fournisseurs</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Nouveau fournisseur</button>
      </div>
      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {[{ key: 'nom', label: 'Nom', ph: 'Nom du fournisseur' }, { key: 'telephone', label: 'Téléphone', ph: '77 000 00 00' }, { key: 'email', label: 'Email', ph: 'email@exemple.com' }, { key: 'adresse', label: 'Adresse', ph: 'Ex: Dakar, Sénégal' }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {erreur && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '10px' }}>⚠️ {erreur}</div>}
          <button onClick={ajouterFournisseur} disabled={envoi} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontWeight: '600', marginRight: '10px', opacity: envoi ? 0.7 : 1 }}>
            {envoi ? '...' : 'Enregistrer'}
          </button>
          <button onClick={() => setShowForm(false)} style={{ padding: '10px 24px', background: '#f1f5f9', color: '#666', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
        </div>
      )}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : fournisseurs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun fournisseur pour le moment.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Nom', 'Téléphone', 'Email', 'Adresse', 'Produits liés', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fournisseurs.map((f) => (
                <tr key={f._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 8px', fontWeight: '600', color: '#333' }}>{f.nom}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{f.telephone || '-'}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{f.email || '-'}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{f.adresse || '-'}</td>
                  <td style={{ padding: '10px 8px', color: '#333' }}>{f.produits?.length || 0}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <button onClick={() => supprimerFournisseur(f._id)} style={{ padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>
                      🗑️ Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminVendeurs() {
  const location = useLocation();
  const [showForm, setShowForm] = useState(!!location.state?.openForm);
  const [vendeurs, setVendeurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', motDePasse: '' });

  const token = localStorage.getItem('token');
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const charger = () => {
    setChargement(true);
    fetch('https://boutique-stock-api.onrender.com/api/users', authHeaders)
      .then(r => r.json())
      .then(data => { setVendeurs(Array.isArray(data) ? data : []); setChargement(false); })
      .catch(() => setChargement(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const ajouterVendeur = async () => {
    setErreur('');
    if (!form.nom || !form.email || !form.motDePasse) {
      setErreur('Nom, email et mot de passe sont requis.');
      return;
    }
    setEnvoi(true);
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setErreur(data.message || "Erreur lors de la création"); setEnvoi(false); return; }

      setForm({ nom: '', email: '', telephone: '', motDePasse: '' });
      setShowForm(false);
      setEnvoi(false);
      charger();
    } catch (err) {
      setErreur('Erreur réseau : ' + err.message);
      setEnvoi(false);
    }
  };

  const toggleActif = async (v) => {
    await fetch(`https://boutique-stock-api.onrender.com/api/users/${v._id}/statut`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ actif: !v.actif })
    });
    charger();
  };

  const supprimerVendeur = async (v) => {
    if (!window.confirm(`Supprimer définitivement ${v.nom} ? Cette action est irréversible.`)) return;
    await fetch(`https://boutique-stock-api.onrender.com/api/users/${v._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    charger();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icone nom="utilisateurs" size={28} /> Vendeurs
        </h2>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ Ajouter un vendeur</button>
      </div>
      {showForm && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {[{ key: 'nom', label: 'Nom complet', ph: 'Nom du vendeur' }, { key: 'email', label: 'Email', ph: 'email@boutique.com' }, { key: 'telephone', label: 'Téléphone', ph: '77 000 00 00' }, { key: 'motDePasse', label: 'Mot de passe', ph: '••••••••', type: 'password' }].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {erreur && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
              ⚠️ {erreur}
            </div>
          )}
          <button onClick={ajouterVendeur} disabled={envoi} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontWeight: '600', marginRight: '10px', opacity: envoi ? 0.7 : 1 }}>
            {envoi ? 'Création...' : 'Enregistrer'}
          </button>
          <button onClick={() => { setShowForm(false); setErreur(''); }} style={{ padding: '10px 24px', background: '#f1f5f9', color: '#666', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
        </div>
      )}
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : vendeurs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun vendeur pour le moment.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Nom', 'Email', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendeurs.map((v) => (
                <tr key={v._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 8px', fontWeight: '600', color: '#333' }}>{v.nom}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{v.email}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ background: v.actif ? '#dcfce7' : '#fee2e2', color: v.actif ? '#16a34a' : '#dc2626', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                      {v.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={{ padding: '4px 10px', background: v.actif ? '#fef2f2' : '#dcfce7', border: `1px solid ${v.actif ? '#fecaca' : '#bbf7d0'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: v.actif ? '#dc2626' : '#16a34a' }}
                        onClick={() => toggleActif(v)}>
                        {v.actif ? '🔒 Désactiver' : '✅ Activer'}
                      </button>
                      <button style={{ padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}
                        onClick={() => supprimerVendeur(v)}>
                        <Icone nom="supprimer" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminFactures({ user }) {
  const [factures, setFactures] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [generation, setGeneration] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('https://boutique-stock-api.onrender.com/api/ventes', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setFactures(Array.isArray(d) ? d : []); setChargement(false); })
      .catch(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatMontant = (n) => `${Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;

  const chargerImageBase64 = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return null;
    }
  };

  const voirFacture = async (f) => {
    setGeneration(f._id);
    try {
      const nomBoutique = user?.boutique?.nom || 'Boutique Stock';
      const logoBase64 = await chargerImageBase64(resoudreImage(user?.boutique?.logo));

      const doc = new jsPDF();
      const date = f.dateVente ? new Date(f.dateVente).toLocaleDateString('fr-FR') : '';
      const heure = f.dateVente ? new Date(f.dateVente).toLocaleTimeString('fr-FR') : '';
      const produitsListe = (f.produits || []).map(p => [
        p.produit?.nom || 'Produit',
        p.produit?.categorie || '-',
        formatMontant(p.prixUnitaire),
        p.quantite,
        formatMontant(p.prixUnitaire * p.quantite)
      ]);

      const dessinerCopie = (yBase, labelCopie) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, yBase, 210, 30, 'F');

        let xTexte = 14;
        if (logoBase64) {
          try {
            doc.addImage(logoBase64, 'JPEG', 14, yBase + 5, 20, 20, undefined, 'FAST');
            xTexte = 40;
          } catch (e) { /* pas grave, on continue sans logo */ }
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(nomBoutique, xTexte, yBase + 12);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Facture N° ${f.numFacture || ''}`, xTexte, yBase + 18);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(labelCopie, 196, yBase + 12, { align: 'right' });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date : ${date} a ${heure}`, 120, yBase + 40);
        doc.text(`Vendeur : ${f.nomVendeur || '—'}`, 120, yBase + 46);
        doc.text(`Client : ${f.clientNom || 'Client anonyme'}`, 120, yBase + 52);

        autoTable(doc, {
          startY: yBase + 58,
          head: [['Produit', 'Categorie', 'Prix unitaire', 'Qte', 'Total']],
          body: produitsListe,
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });

        const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : yBase + 90) + 6;
        doc.setFillColor(241, 245, 249);
        doc.rect(134, finalY, 62, 18, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('TOTAL A PAYER :', 138, finalY + 7);
        doc.text(formatMontant(f.montantTotal), 138, finalY + 14);

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text('Merci pour votre achat !', 105, yBase + 138, { align: 'center' });
      };

      dessinerCopie(0, 'COPIE CAISSE');
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(0, 148, 210, 148);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('découper ici', 105, 148, { align: 'center' });
      dessinerCopie(150, 'COPIE CLIENT');

      window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
      alert('Erreur lors de la génération de la facture : ' + err.message);
    } finally {
      setGeneration(null);
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#0f172a' }}>🧾 Factures</h2>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>
        ) : factures.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucune facture enregistrée.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '650px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['N° Facture', 'Client', 'Vendeur', 'Montant', 'Date', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 8px', color: '#2563eb', fontWeight: '600' }}>{f.numFacture || '—'}</td>
                  <td style={{ padding: '10px 8px', color: '#333' }}>{f.clientNom || 'Client anonyme'}</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{f.nomVendeur || '—'}</td>
                  <td style={{ padding: '10px 8px', color: '#333', fontWeight: '600' }}>{(f.montantTotal || 0).toLocaleString()} FCFA</td>
                  <td style={{ padding: '10px 8px', color: '#666' }}>{f.dateVente ? new Date(f.dateVente).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>Payée</span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <button onClick={() => voirFacture(f)} disabled={generation === f._id}
                      style={{ padding: '5px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: generation === f._id ? 'not-allowed' : 'pointer', fontSize: '12px', color: '#2563eb', fontWeight: '600', opacity: generation === f._id ? 0.6 : 1 }}>
                      {generation === f._id ? '...' : '👁️ Voir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Génère et télécharge un fichier .xlsx mis en forme : titre en gras sur fond sombre,
// en-têtes de colonnes en gras avec fond bleu, bordures fines, lignes alternées.
async function telechargerXLSX(nomFichier, titreFeuille, entetes, lignes) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Boutique Stock';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(titreFeuille.slice(0, 31));

  // Ligne de titre (fusionnée sur toute la largeur du tableau)
  sheet.mergeCells(1, 1, 1, entetes.length);
  const titreCell = sheet.getCell(1, 1);
  titreCell.value = titreFeuille;
  titreCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  titreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titreCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 26;

  sheet.addRow([]); // ligne vide de respiration

  // Ligne d'en-têtes de colonnes
  const headerRow = sheet.addRow(entetes);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Lignes de données, avec alternance de fond
  lignes.forEach((ligne, i) => {
    const row = sheet.addRow(ligne);
    const estPaire = i % 2 === 1;
    row.eachCell((cell) => {
      if (estPaire) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle' };
    });
  });

  // Largeur automatique des colonnes selon le contenu
  entetes.forEach((h, i) => {
    let maxLen = String(h).length;
    lignes.forEach(l => {
      const val = String(l[i] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 4, 12), 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminRapports() {
  const [export_, setExport_] = useState('');
  const token = localStorage.getItem('token');

  const exporterVentes = async () => {
    setExport_('ventes');
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/ventes', { headers: { Authorization: `Bearer ${token}` } });
      const ventes = await res.json();
      const entetes = ['N° Facture', 'Client', 'Vendeur', 'Montant (FCFA)', 'Date'];
      const lignes = (Array.isArray(ventes) ? ventes : []).map(v => [
        v.numFacture || '', v.clientNom || '', v.nomVendeur || '', v.montantTotal || 0,
        v.dateVente ? new Date(v.dateVente).toLocaleDateString('fr-FR') : ''
      ]);
      await telechargerXLSX(`rapport-ventes-${Date.now()}.xlsx`, 'Rapport des ventes', entetes, lignes);
    } catch (err) {
      alert('Erreur export : ' + err.message);
    } finally {
      setExport_('');
    }
  };

  const exporterStocks = async () => {
    setExport_('stocks');
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/produits', { headers: { Authorization: `Bearer ${token}` } });
      const produits = await res.json();
      const entetes = ['Nom', 'Référence', 'Catégorie', 'Prix (FCFA)', 'Stock', "Seuil d'alerte"];
      const lignes = (Array.isArray(produits) ? produits : []).map(p => [
        p.nom || '', p.ref || '', p.categorie || '', p.prix || 0, p.quantite || 0, p.seuilAlerte || 0
      ]);
      await telechargerXLSX(`etat-stocks-${Date.now()}.xlsx`, 'État des stocks', entetes, lignes);
    } catch (err) {
      alert('Erreur export : ' + err.message);
    } finally {
      setExport_('');
    }
  };

  const exporterFournisseurs = async () => {
    setExport_('fournisseurs');
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/fournisseurs', { headers: { Authorization: `Bearer ${token}` } });
      const fournisseurs = await res.json();
      const entetes = ['Nom', 'Téléphone', 'Email', 'Adresse'];
      const lignes = (Array.isArray(fournisseurs) ? fournisseurs : []).map(f => [
        f.nom || '', f.telephone || '', f.email || '', f.adresse || ''
      ]);
      await telechargerXLSX(`rapport-fournisseurs-${Date.now()}.xlsx`, 'Rapport fournisseurs', entetes, lignes);
    } catch (err) {
      alert('Erreur export : ' + err.message);
    } finally {
      setExport_('');
    }
  };

  const rapports = [
    { iconKey: 'ventes', label: 'Rapport des ventes', desc: 'Ventes par période, par vendeur', color: '#dbeafe', action: exporterVentes, key: 'ventes' },
    { iconKey: 'stock', label: 'État des stocks', desc: 'Niveaux de stock, alertes', color: '#dcfce7', action: exporterStocks, key: 'stocks' },
    { iconKey: 'produits', label: 'Rapport fournisseurs', desc: 'Liste des fournisseurs', color: '#ede9fe', action: exporterFournisseurs, key: 'fournisseurs' },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icone nom="dashboard" size={28} /> Rapports
      </h2>
      <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
        Cliquez sur une carte pour télécharger un export Excel (.xlsx) à jour de vos données.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {rapports.map((r, i) => (
          <button key={i} onClick={r.action} disabled={export_ === r.key} style={{
            background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0', cursor: export_ === r.key ? 'not-allowed' : 'pointer', textAlign: 'left',
            opacity: export_ === r.key ? 0.6 : 1
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Icone nom={r.iconKey} size={28} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>{r.label}</div>
            <div style={{ fontSize: '13px', color: '#666' }}>{export_ === r.key ? 'Génération...' : r.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminParametres({ user }) {
  const token = localStorage.getItem('token');
  const boutiqueId = user?.boutiqueId || user?.boutique?._id;

  // --- Logo boutique ---
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(resoudreImage(user?.boutique?.logo) || null);
  const [envoiLogo, setEnvoiLogo] = useState(false);
  const [messageLogo, setMessageLogo] = useState('');

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const enregistrerLogo = async () => {
    if (!logoFile || !boutiqueId) return;
    setEnvoiLogo(true);
    setMessageLogo('');
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const res = await fetch(`https://boutique-stock-api.onrender.com/api/boutiques/${boutiqueId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) { setMessageLogo(data.message || 'Erreur'); setEnvoiLogo(false); return; }
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      stored.boutique = { ...(stored.boutique || {}), ...data };
      localStorage.setItem('user', JSON.stringify(stored));
      setMessageLogo('✅ Logo mis à jour. Rechargement...');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setMessageLogo('Erreur réseau : ' + err.message);
      setEnvoiLogo(false);
    }
  };

  // --- Mon compte (nom, email) ---
  const [compteForm, setCompteForm] = useState({ nom: user?.nom || '', email: user?.email || '' });
  const [envoiCompte, setEnvoiCompte] = useState(false);
  const [messageCompte, setMessageCompte] = useState('');

  const enregistrerCompte = async () => {
    setEnvoiCompte(true);
    setMessageCompte('');
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(compteForm)
      });
      const data = await res.json();
      if (!res.ok) { setMessageCompte(data.message || 'Erreur'); setEnvoiCompte(false); return; }
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      stored.nom = data.nom; stored.email = data.email;
      localStorage.setItem('user', JSON.stringify(stored));
      setMessageCompte('✅ Infos mises à jour. Rechargement...');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setMessageCompte('Erreur réseau : ' + err.message);
      setEnvoiCompte(false);
    }
  };

  // --- Changer le mot de passe ---
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({ ancienMotDePasse: '', nouveauMotDePasse: '', confirmation: '' });
  const [envoiPwd, setEnvoiPwd] = useState(false);
  const [messagePwd, setMessagePwd] = useState('');

  const changerMotDePasse = async () => {
    setMessagePwd('');
    if (!pwdForm.ancienMotDePasse || !pwdForm.nouveauMotDePasse) {
      setMessagePwd('Remplissez tous les champs.');
      return;
    }
    if (pwdForm.nouveauMotDePasse !== pwdForm.confirmation) {
      setMessagePwd('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setEnvoiPwd(true);
    try {
      const res = await fetch('https://boutique-stock-api.onrender.com/api/users/me/motdepasse', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ancienMotDePasse: pwdForm.ancienMotDePasse,
          nouveauMotDePasse: pwdForm.nouveauMotDePasse
        })
      });
      const data = await res.json();
      if (!res.ok) { setMessagePwd(data.message || 'Erreur'); setEnvoiPwd(false); return; }
      setMessagePwd('✅ Mot de passe mis à jour.');
      setPwdForm({ ancienMotDePasse: '', nouveauMotDePasse: '', confirmation: '' });
      setEnvoiPwd(false);
      setTimeout(() => { setShowPwdForm(false); setMessagePwd(''); }, 1500);
    } catch (err) {
      setMessagePwd('Erreur réseau : ' + err.message);
      setEnvoiPwd(false);
    }
  };

  // --- Ma boutique (nom, adresse, téléphone) ---
  const [boutiqueForm, setBoutiqueForm] = useState({
    nom: user?.boutique?.nom || '',
    adresse: user?.boutique?.adresse || '',
    telephone: user?.boutique?.telephone || ''
  });
  const [envoiBoutique, setEnvoiBoutique] = useState(false);
  const [messageBoutique, setMessageBoutique] = useState('');

  const enregistrerBoutique = async () => {
    if (!boutiqueId) return;
    setEnvoiBoutique(true);
    setMessageBoutique('');
    try {
      const res = await fetch(`https://boutique-stock-api.onrender.com/api/boutiques/${boutiqueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(boutiqueForm)
      });
      const data = await res.json();
      if (!res.ok) { setMessageBoutique(data.message || 'Erreur'); setEnvoiBoutique(false); return; }
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      stored.boutique = { ...(stored.boutique || {}), ...data };
      localStorage.setItem('user', JSON.stringify(stored));
      setMessageBoutique('✅ Boutique mise à jour. Rechargement...');
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setMessageBoutique('Erreur réseau : ' + err.message);
      setEnvoiBoutique(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#333', outline: 'none', boxSizing: 'border-box' };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icone nom="parametres" size={28} /> Paramètres
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#0f172a', fontSize: '16px' }}>👤 Mon compte</h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Nom</label>
            <input value={compteForm.nom} onChange={e => setCompteForm(p => ({ ...p, nom: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Email</label>
            <input type="email" value={compteForm.email} onChange={e => setCompteForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Rôle</label>
            <div style={{ padding: '10px 16px', background: '#f1f5f9', borderRadius: '8px', fontSize: '14px', color: '#666' }}>Administrateur</div>
          </div>

          {messageCompte && <div style={{ fontSize: '12.5px', color: messageCompte.startsWith('✅') ? '#16a34a' : '#dc2626', marginBottom: '10px' }}>{messageCompte}</div>}

          <button onClick={enregistrerCompte} disabled={envoiCompte} style={{ width: '100%', padding: '12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: envoiCompte ? 'not-allowed' : 'pointer', fontWeight: '600', marginBottom: '10px', opacity: envoiCompte ? 0.7 : 1 }}>
            {envoiCompte ? 'Enregistrement...' : '✅ Modifier les infos'}
          </button>

          <button onClick={() => { setShowPwdForm(v => !v); setMessagePwd(''); }} style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
            🔒 {showPwdForm ? 'Annuler' : 'Changer le mot de passe'}
          </button>

          {showPwdForm && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Mot de passe actuel</label>
                <input type="password" value={pwdForm.ancienMotDePasse} onChange={e => setPwdForm(p => ({ ...p, ancienMotDePasse: e.target.value }))} style={inputStyle} placeholder="••••••••" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Nouveau mot de passe</label>
                <input type="password" value={pwdForm.nouveauMotDePasse} onChange={e => setPwdForm(p => ({ ...p, nouveauMotDePasse: e.target.value }))} style={inputStyle} placeholder="Au moins 6 caractères" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Confirmer le nouveau mot de passe</label>
                <input type="password" value={pwdForm.confirmation} onChange={e => setPwdForm(p => ({ ...p, confirmation: e.target.value }))} style={inputStyle} placeholder="••••••••" />
              </div>
              {messagePwd && <div style={{ fontSize: '12.5px', color: messagePwd.startsWith('✅') ? '#16a34a' : '#dc2626', marginBottom: '10px' }}>{messagePwd}</div>}
              <button onClick={changerMotDePasse} disabled={envoiPwd} style={{ width: '100%', padding: '11px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoiPwd ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: envoiPwd ? 0.7 : 1 }}>
                {envoiPwd ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
              </button>
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 20px', color: '#0f172a', fontSize: '16px' }}>🏪 Ma boutique</h3>

          {/* Logo de la boutique */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '8px' }}>Logo / Photo de la boutique</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                onClick={() => document.getElementById('logoInput').click()}
                style={{
                  width: '72px', height: '72px', borderRadius: '12px', border: '2px dashed #e2e8f0',
                  background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden', flexShrink: 0
                }}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo boutique" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '22px' }}>📷</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <input id="logoInput" type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                <button
                  onClick={() => document.getElementById('logoInput').click()}
                  style={{ padding: '8px 14px', background: '#f1f5f9', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '6px' }}>
                  Choisir une image
                </button>
                {logoFile && (
                  <button
                    onClick={enregistrerLogo}
                    disabled={envoiLogo}
                    style={{ marginLeft: '8px', padding: '8px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: envoiLogo ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: envoiLogo ? 0.7 : 1 }}>
                    {envoiLogo ? 'Envoi...' : '✅ Enregistrer'}
                  </button>
                )}
                {messageLogo && <div style={{ fontSize: '12px', color: messageLogo.startsWith('✅') ? '#16a34a' : '#dc2626', marginTop: '6px' }}>{messageLogo}</div>}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Nom de la boutique</label>
            <input value={boutiqueForm.nom} onChange={e => setBoutiqueForm(p => ({ ...p, nom: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Adresse</label>
            <input value={boutiqueForm.adresse} onChange={e => setBoutiqueForm(p => ({ ...p, adresse: e.target.value }))} style={inputStyle} placeholder="Ex: Yaoundé, Cameroun" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Téléphone</label>
            <input value={boutiqueForm.telephone} onChange={e => setBoutiqueForm(p => ({ ...p, telephone: e.target.value }))} style={inputStyle} placeholder="Ex: +237 6XX XXX XXX" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Abonnement</label>
            <div style={{ padding: '10px 16px', background: '#f1f5f9', borderRadius: '8px', fontSize: '14px', color: '#666', textTransform: 'capitalize' }}>{user?.boutique?.abonnement || 'Standard'}</div>
          </div>

          {messageBoutique && <div style={{ fontSize: '12.5px', color: messageBoutique.startsWith('✅') ? '#16a34a' : '#dc2626', marginBottom: '10px' }}>{messageBoutique}</div>}

          <button onClick={enregistrerBoutique} disabled={envoiBoutique} style={{ width: '100%', padding: '12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: envoiBoutique ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: envoiBoutique ? 0.7 : 1 }}>
            <Icone nom="modifier" size={16} /> {envoiBoutique ? 'Enregistrement...' : 'Modifier les infos'}
          </button>
        </div>
      </div>
    </div>
  );
}