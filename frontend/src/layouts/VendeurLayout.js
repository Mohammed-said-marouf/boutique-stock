import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Icone } from '../context/IconesContext';

// Helper : retourne les headers avec le token JWT
function authHeaders() {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
}

// Réutilise les mêmes clés d'icônes que AdminLayout / SuperAdminLayout
// pour que l'éditeur d'icônes du Super Admin les modifie toutes en même temps.
const menuItems = [
  { path: '/vendeur', iconKey: 'dashboard', label: 'Tableau de bord' },
  { path: '/vendeur/produits', iconKey: 'produits', label: 'Produits' },
  { path: '/vendeur/nouvelle-vente', iconKey: 'caisse', label: 'Nouvelle vente' },
  { path: '/vendeur/factures', iconKey: 'ventes', label: 'Mes factures' },
  { path: '/vendeur/clients', iconKey: 'clients', label: 'Clients' },
  { path: '/vendeur/profil', iconKey: 'utilisateurs', label: 'Mon profil' },
];

export default function VendeurLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif', background: '#f0f2f5' }}>
      <div style={{
        width: collapsed ? '70px' : '220px', background: '#064e3b',
        display: 'flex', flexDirection: 'column', transition: 'width 0.3s',
        overflow: 'hidden', flexShrink: 0
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #065f46', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', background: '#10b981', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0
          }}><Icone nom="boutiques" size={20} /></div>
          {!collapsed && (
            <div>
              <div style={{ color: 'white', fontWeight: '700', fontSize: '14px' }}>Ma Boutique</div>
              <div style={{ color: '#6ee7b7', fontSize: '11px' }}>Vendeur</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/vendeur'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 8px', borderRadius: '8px', marginBottom: '2px',
                textDecoration: 'none', color: isActive ? 'white' : '#6ee7b7',
                background: isActive ? '#059669' : 'transparent', fontSize: '14px'
              })}>
              <div style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icone nom={item.iconKey} size={22} />
              </div>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid #065f46', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', background: '#059669',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0
          }}>{user?.nom?.charAt(0) || 'V'}</div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{user?.nom}</div>
                <div style={{ color: '#6ee7b7', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
                  En ligne
                </div>
              </div>
              <button onClick={handleLogout}
                style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '16px' }}>
                <Icone nom="deconnexion" size={18} />
              </button>
            </>
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
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#064e3b' }}>Accueil</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Tableau de bord</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input placeholder="Rechercher un produit (nom, code-barres)..." style={{
              padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '20px',
              fontSize: '14px', outline: 'none', width: '280px'
            }} />
            <span style={{ fontSize: '20px', cursor: 'pointer' }}>🔔</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '700'
              }}>{user?.nom?.charAt(0) || 'V'}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#064e3b' }}>{user?.nom}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>Vendeur</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <Routes>
            <Route path="" element={<VendeurDashboard user={user} />} />
            <Route path="nouvelle-vente" element={<CaisseVendeur nomVendeur={user?.nom} vendeurId={user?.id} />} />
            <Route path="produits" element={<ProduitsVendeur />} />
            <Route path="factures" element={<FacturesVendeur />} />
            <Route path="clients" element={<ClientsVendeur />} />
            <Route path="profil" element={<ProfilVendeur user={user} />} />
            <Route path="*" element={<div><h2>Page en construction</h2></div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

// ===================== DASHBOARD =====================
function VendeurDashboard({ user }) {
  const [stats, setStats] = useState({ ventesJour: 0, caJour: 0, totalVentes: 0, chiffreAffaires: 0 });
  const [produits, setProduits] = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    axios.get('http://localhost:5000/api/ventes/stats', authHeaders())
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    axios.get('http://localhost:5000/api/produits', authHeaders())
      .then(res => {
        const disponibles = res.data.filter(p => p.image && p.quantite > 0);
        setProduits(disponibles);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (produits.length <= 1) return;
    const interval = setInterval(() => {
      setSlideIndex(prev => (prev + 1) % produits.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [produits]);

  const getImageUrl = (img) => img.startsWith('http') ? img : `http://localhost:5000${img}`;
  const produitVedette = produits[slideIndex];

  const cartes = [
    { label: 'Ventes du jour', value: `${(stats.caJour || 0).toLocaleString()} FCFA`, sub: `${stats.ventesJour || 0} ventes`, icon: '🛒', bg: '#dcfce7', color: '#059669' },
    { label: 'Nombre de ventes', value: String(stats.ventesJour || 0), sub: "Aujourd'hui", icon: '📊', bg: '#dbeafe', color: '#2563eb' },
    { label: 'Total ventes', value: String(stats.totalVentes || 0), sub: 'Depuis le début', icon: '📦', bg: '#ede9fe', color: '#7c3aed' },
    { label: "Chiffre d'affaires", value: `${(stats.chiffreAffaires || 0).toLocaleString()} FCFA`, sub: 'Total', icon: '💰', bg: '#fef9c3', color: '#ca8a04' },
  ];

  const raccourcis = [
    { icon: '🛒', label: 'Nouvelle vente' },
    { icon: '🔍', label: 'Rechercher produit' },
    { icon: '🧾', label: 'Mes factures' },
    { icon: '👥', label: 'Clients' },
  ];

  return (
    <div>
      {produits.length > 0 && (
        <div style={{
          position: 'relative', borderRadius: '16px', overflow: 'hidden',
          marginBottom: '24px', height: '220px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', background: '#064e3b'
        }}>
          {produitVedette && (
            <>
              <div style={{
                width: '260px', height: '100%', flexShrink: 0, background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
              }}>
                <img
                  src={getImageUrl(produitVedette.image)}
                  alt={produitVedette.nom}
                  style={{
                    maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto',
                    objectFit: 'contain', transition: 'opacity 0.4s'
                  }}
                />
              </div>
              <div style={{
                flex: 1, background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '0 32px', minWidth: 0
              }}>
                <span style={{
                  alignSelf: 'flex-start', background: '#facc15', color: '#78350f',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '11px',
                  fontWeight: '700', marginBottom: '10px', letterSpacing: '0.5px'
                }}>✨ EN VEDETTE</span>
                <div style={{ color: 'white', fontSize: '24px', fontWeight: '800', marginBottom: '6px', maxWidth: '420px' }}>
                  {produitVedette.nom}
                </div>
                <div style={{ color: '#d1fae5', fontSize: '13px', marginBottom: '12px' }}>
                  {produitVedette.categorie}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: '#6ee7b7', fontSize: '26px', fontWeight: '800' }}>
                    {(produitVedette.prix || 0).toLocaleString()} FCFA
                  </span>
                  <span style={{
                    background: 'rgba(255,255,255,0.15)', color: 'white', padding: '4px 12px',
                    borderRadius: '20px', fontSize: '12px', fontWeight: '600'
                  }}>
                    Stock: {produitVedette.quantite}
                  </span>
                </div>
              </div>
            </>
          )}

          {produits.length > 1 && (
            <div style={{
              position: 'absolute', bottom: '14px', right: '20px',
              display: 'flex', gap: '6px'
            }}>
              {produits.map((_, i) => (
                <button key={i} onClick={() => setSlideIndex(i)} style={{
                  width: i === slideIndex ? '20px' : '8px', height: '8px', borderRadius: '4px',
                  border: 'none', cursor: 'pointer', padding: 0,
                  background: i === slideIndex ? '#6ee7b7' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.3s'
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {produits.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px', color: '#064e3b', fontSize: '15px' }}>🛍️ Notre catalogue</h3>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
            {produits.map((p, i) => (
              <div key={p._id} onClick={() => setSlideIndex(i)} style={{
                minWidth: '140px', background: 'white', borderRadius: '12px',
                boxShadow: i === slideIndex ? '0 0 0 2px #059669' : '0 1px 4px rgba(0,0,0,0.06)',
                cursor: 'pointer', overflow: 'hidden', flexShrink: 0
              }}>
                <div style={{ width: '100%', height: '90px', overflow: 'hidden', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={getImageUrl(p.image)} alt={p.nom}
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }} />
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.nom}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>
                    {(p.prix || 0).toLocaleString()} FCFA
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {cartes.map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                {s.icon}
              </div>
              <span style={{ fontSize: '13px', color: '#666' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#064e3b', marginBottom: '4px' }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: s.color, fontWeight: '500' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px', color: '#064e3b', fontSize: '15px' }}>⚡ Raccourcis rapides</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {raccourcis.map((r, i) => (
            <button key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
              cursor: 'pointer', fontSize: '13px', color: '#064e3b', fontWeight: '500'
            }}>
              <span>{r.icon}</span> {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===================== CAISSE =====================
function CaisseVendeur({ nomVendeur, vendeurId }) {
  const [panier, setPanier] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [clientNom, setClientNom] = useState('');
  const [encaissement, setEncaissement] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/produits', authHeaders())
      .then(res => {
        setProduits(res.data.filter(p => p.quantite > 0));
        setChargement(false);
      })
      .catch(() => {
        setErreur('Impossible de charger les produits');
        setChargement(false);
      });
  }, []);

  const produitsFiltres = produits.filter(p =>
    p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.categorie && p.categorie.toLowerCase().includes(recherche.toLowerCase()))
  );

  const ajouterAuPanier = (produit) => {
    setPanier(prev => {
      const existant = prev.find(p => p._id === produit._id);
      if (existant) {
        if (existant.qte >= produit.quantite) return prev;
        return prev.map(p => p._id === produit._id ? { ...p, qte: p.qte + 1 } : p);
      }
      return [...prev, { ...produit, qte: 1 }];
    });
  };

  const modifierQte = (id, delta) => {
    setPanier(prev => prev.map(p => {
      if (p._id !== id) return p;
      const newQte = p.qte + delta;
      if (newQte <= 0) return null;
      if (newQte > p.quantite) return p;
      return { ...p, qte: newQte };
    }).filter(Boolean));
  };

  const supprimerDuPanier = (id) => setPanier(prev => prev.filter(p => p._id !== id));

  const total = panier.reduce((sum, p) => sum + p.prix * p.qte, 0);

  const genererFacture = async () => {
    if (panier.length === 0) return;
    setEncaissement(true);
    setErreur('');

    try {
      const venteData = {
        produits: panier.map(p => ({
          produit: p._id,
          quantite: p.qte,
          prixUnitaire: p.prix
        })),
        montantTotal: total,
        typeVente: 'presentiel',
        vendeur: vendeurId,
        nomVendeur: nomVendeur,
        clientNom: clientNom || 'Client anonyme',
      };

      const res = await axios.post('http://localhost:5000/api/ventes', venteData, authHeaders());
      const numFacture = res.data.numFacture || ('FAC-' + Date.now().toString().slice(-6));

      const doc = new jsPDF();
      const date = new Date().toLocaleDateString('fr-FR');
      const heure = new Date().toLocaleTimeString('fr-FR');

      doc.setFillColor(6, 78, 59);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('BOUTIQUE STOCK', 14, 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Votre boutique de confiance', 14, 22);
      doc.text(`Facture N° ${numFacture}`, 14, 29);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Date : ${date} a ${heure}`, 120, 45);
      doc.text(`Vendeur : ${nomVendeur || 'Vendeur'}`, 120, 52);
      doc.text(`Client : ${clientNom || 'Client anonyme'}`, 120, 59);

      autoTable(doc, {
        startY: 70,
        head: [['Produit', 'Categorie', 'Prix unitaire', 'Qte', 'Total']],
        body: panier.map(p => [
          p.nom,
          p.categorie || '-',
          `${p.prix.toLocaleString()} FCFA`,
          p.qte,
          `${(p.prix * p.qte).toLocaleString()} FCFA`
        ]),
        headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 10 },
      });

      const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 120) + 10;
      doc.setFillColor(240, 253, 244);
      doc.rect(120, finalY, 76, 22, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text('TOTAL A PAYER :', 124, finalY + 9);
      doc.text(`${total.toLocaleString()} FCFA`, 124, finalY + 18);

      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text('Merci pour votre achat !', 105, 285, { align: 'center' });

      doc.save(`Facture-${numFacture}.pdf`);

      setProduits(prev => prev.map(p => {
        const vendu = panier.find(v => v._id === p._id);
        if (vendu) return { ...p, quantite: p.quantite - vendu.qte };
        return p;
      }).filter(p => p.quantite > 0));

      setPanier([]);
      setClientNom('');
      alert(`Vente enregistree ! Facture ${numFacture} telechargee.`);

    } catch (err) {
      setErreur("Erreur lors de l'enregistrement : " + (err.response?.data?.message || err.message));
    } finally {
      setEncaissement(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', height: 'calc(100vh - 140px)' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 16px', color: '#064e3b', fontSize: '16px' }}>📦 Produits disponibles</h3>
        <input value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un produit..." style={{
            width: '100%', padding: '10px 16px', border: '1px solid #e2e8f0',
            borderRadius: '8px', fontSize: '14px', outline: 'none',
            marginBottom: '16px', boxSizing: 'border-box'
          }} />

        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>⏳ Chargement des produits...</div>
        ) : erreur ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#dc2626' }}>{erreur}</div>
        ) : produitsFiltres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun produit trouvé</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {produitsFiltres.map(p => (
              <div key={p._id} onClick={() => ajouterAuPanier(p)} style={{
                border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px',
                cursor: 'pointer', transition: 'all 0.2s', background: '#fafafa'
              }}>
                <div style={{
                  width: '100%', height: '80px', background: '#f0fdf4',
                  borderRadius: '8px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '32px', marginBottom: '10px',
                  overflow: 'hidden'
                }}>
                  {p.image ? (
                    <img
                      src={p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`}
                      alt={p.nom}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = '📦'; }}
                    />
                  ) : '📦'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '4px' }}>{p.nom}</div>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>{p.categorie}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#059669', marginBottom: '4px' }}>
                  {(p.prix || 0).toLocaleString()} FCFA
                </div>
                <div style={{ fontSize: '11px', color: p.quantite <= p.seuilAlerte ? '#dc2626' : '#666' }}>
                  Stock: {p.quantite}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <h3 style={{ margin: '0 0 12px', color: '#064e3b', fontSize: '16px' }}>🛒 Vente en cours</h3>

        <input value={clientNom} onChange={e => setClientNom(e.target.value)}
          placeholder="Nom du client (optionnel)" style={{
            width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0',
            borderRadius: '8px', fontSize: '13px', outline: 'none',
            marginBottom: '12px', boxSizing: 'border-box'
          }} />

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
          {panier.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px 0', fontSize: '14px' }}>
              Cliquez sur un produit pour l'ajouter
            </div>
          ) : panier.map(p => (
            <div key={p._id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 0', borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>{p.nom}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{(p.prix || 0).toLocaleString()} FCFA</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => modifierQte(p._id, -1)} style={{
                  width: '24px', height: '24px', border: '1px solid #e2e8f0',
                  borderRadius: '4px', cursor: 'pointer', background: 'white', fontSize: '14px'
                }}>-</button>
                <span style={{ fontSize: '14px', fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{p.qte}</span>
                <button onClick={() => modifierQte(p._id, 1)} style={{
                  width: '24px', height: '24px', border: '1px solid #e2e8f0',
                  borderRadius: '4px', cursor: 'pointer', background: 'white', fontSize: '14px'
                }}>+</button>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#059669', minWidth: '80px', textAlign: 'right' }}>
                {((p.prix || 0) * p.qte).toLocaleString()} FCFA
              </div>
              <button onClick={() => supprimerDuPanier(p._id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px'
              }}>🗑️</button>
            </div>
          ))}
        </div>

        {erreur && (
          <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '10px' }}>
            ⚠️ {erreur}
          </div>
        )}

        <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
            <span>Sous-total</span><span>{total.toLocaleString()} FCFA</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: '#666' }}>
            <span>Réduction</span><span>0 FCFA</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '18px', fontWeight: '700', color: '#064e3b' }}>
            <span>Total</span><span>{total.toLocaleString()} FCFA</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button onClick={() => setPanier([])} style={{
              flex: 1, padding: '10px', background: '#f1f5f9', border: 'none',
              borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#666'
            }}>🗑️ Vider</button>
            <button style={{
              flex: 1, padding: '10px', background: '#fef9c3', border: 'none',
              borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#ca8a04', fontWeight: '600'
            }}>⏸️ Suspendre</button>
          </div>
          <button
            onClick={genererFacture}
            disabled={panier.length === 0 || encaissement}
            style={{
              width: '100%', padding: '14px',
              background: panier.length === 0 || encaissement ? '#ccc' : '#059669',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: '700',
              cursor: panier.length === 0 || encaissement ? 'not-allowed' : 'pointer'
            }}>
            {encaissement ? '⏳ Enregistrement...' : '🧾 Encaisser et générer la facture'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== PRODUITS =====================
function ProduitsVendeur() {
  const [produits, setProduits] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('Tous');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:5000/api/produits', authHeaders())
      .then(res => { setProduits(res.data); setChargement(false); })
      .catch(() => setChargement(false));
  }, []);

  const categories = ['Tous', ...new Set(produits.map(p => p.categorie).filter(Boolean))];

  const filtres = produits.filter(p =>
    (categorie === 'Tous' || p.categorie === categorie) &&
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#064e3b' }}>📦 Produits disponibles</h2>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un produit..." style={{
            padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px',
            fontSize: '14px', outline: 'none', width: '280px'
          }} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button key={c} onClick={() => setCategorie(c)} style={{
              padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: categorie === c ? '#059669' : '#f0fdf4',
              color: categorie === c ? 'white' : '#064e3b', fontWeight: '500', fontSize: '13px'
            }}>{c}</button>
          ))}
        </div>
      </div>

      {chargement ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>⏳ Chargement...</div>
      ) : filtres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>Aucun produit trouvé</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {filtres.map(p => (
            <div key={p._id} style={{
              background: 'white', borderRadius: '12px', padding: '16px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0'
            }}>
              <div style={{
                width: '100%', height: '100px', background: '#f0fdf4', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '40px', marginBottom: '12px', overflow: 'hidden'
              }}>
                {p.image ? (
                  <img
                    src={p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`}
                    alt={p.nom}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = '📦'; }}
                  />
                ) : '📦'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#333', marginBottom: '4px' }}>{p.nom}</div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>{p.categorie}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#059669' }}>{(p.prix || 0).toLocaleString()} FCFA</span>
                <span style={{
                  background: p.quantite === 0 ? '#fee2e2' : p.quantite <= p.seuilAlerte ? '#fef9c3' : '#dcfce7',
                  color: p.quantite === 0 ? '#dc2626' : p.quantite <= p.seuilAlerte ? '#ca8a04' : '#16a34a',
                  padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600'
                }}>Stock: {p.quantite}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== FACTURES =====================
function FacturesVendeur() {
  const [ventes, setVentes] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:5000/api/ventes', authHeaders())
      .then(res => { setVentes(res.data); setChargement(false); })
      .catch(() => setChargement(false));
  }, []);

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#064e3b' }}>🧾 Mes factures</h2>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>⏳ Chargement...</div>
        ) : ventes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucune vente enregistrée</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['N° Facture', 'Date', 'Client', 'Articles', 'Montant', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '12px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventes.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 8px', color: '#059669', fontWeight: '600', fontSize: '14px' }}>{v.numFacture || '—'}</td>
                  <td style={{ padding: '12px 8px', color: '#666', fontSize: '13px' }}>
                    {new Date(v.dateVente).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={{ padding: '12px 8px', color: '#333' }}>{v.clientNom || 'Client anonyme'}</td>
                  <td style={{ padding: '12px 8px', color: '#333', fontSize: '14px' }}>{v.produits?.length || 0} article(s)</td>
                  <td style={{ padding: '12px 8px', color: '#333', fontWeight: '600', fontSize: '14px' }}>{(v.montantTotal || 0).toLocaleString()} FCFA</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                      Payée
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ===================== CLIENTS =====================
function ClientsVendeur() {
  const [nouveau, setNouveau] = useState(false);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [clients, setClients] = useState([
    { id: 1, nom: 'Mariam Diop', telephone: '77 123 45 67', achats: 3, total: 245000 },
    { id: 2, nom: 'Ibrahima Diallo', telephone: '76 234 56 78', achats: 1, total: 85000 },
    { id: 3, nom: 'Aissata Camara', telephone: '70 345 67 89', achats: 2, total: 120000 },
  ]);

  const ajouterClient = () => {
    if (!nom || !telephone) return;
    setClients(prev => [...prev, { id: Date.now(), nom, telephone, achats: 0, total: 0 }]);
    setNom(''); setTelephone(''); setNouveau(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#064e3b' }}>👤 Clients</h2>
        <button onClick={() => setNouveau(!nouveau)} style={{
          padding: '10px 20px', background: '#059669', color: 'white',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
        }}>+ Nouveau client</button>
      </div>

      {nouveau && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom complet" style={{
              padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', flex: 1
            }} />
            <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="Téléphone" style={{
              padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', flex: 1
            }} />
            <button onClick={ajouterClient} style={{
              padding: '10px 20px', background: '#059669', color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'
            }}>Enregistrer</button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              {['Nom', 'Téléphone', 'Achats', 'Total dépensé'].map(h => (
                <th key={h} style={{ padding: '12px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '12px 8px', fontWeight: '600', color: '#333' }}>{c.nom}</td>
                <td style={{ padding: '12px 8px', color: '#666' }}>{c.telephone}</td>
                <td style={{ padding: '12px 8px', color: '#333' }}>{c.achats} achat(s)</td>
                <td style={{ padding: '12px 8px', color: '#059669', fontWeight: '600' }}>{c.total.toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== PROFIL =====================
function ProfilVendeur({ user }) {
  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#064e3b' }}>👤 Mon profil</h2>
      <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '500px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', background: '#059669',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '32px', fontWeight: '700'
          }}>{user?.nom?.charAt(0) || 'V'}</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#064e3b' }}>{user?.nom}</div>
            <div style={{ fontSize: '14px', color: '#666' }}>{user?.email}</div>
            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
              Vendeur
            </span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
          {[
            { label: 'Nom complet', val: user?.nom },
            { label: 'Email', val: user?.email },
            { label: 'Rôle', val: 'Vendeur' },
          ].map((f, i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', color: '#666', fontWeight: '600', display: 'block', marginBottom: '6px' }}>{f.label}</label>
              <div style={{ padding: '10px 16px', background: '#f8fafc', borderRadius: '8px', fontSize: '14px', color: '#333' }}>{f.val}</div>
            </div>
          ))}
          <button style={{
            width: '100%', padding: '12px', background: '#059669', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px', marginTop: '8px'
          }}>🔒 Changer le mot de passe</button>
        </div>
      </div>
    </div>
  );
}