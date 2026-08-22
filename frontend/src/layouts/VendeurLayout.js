import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Icone } from '../context/IconesContext';
import { Html5Qrcode } from 'html5-qrcode';
import { bipSucces, bipErreur } from '../utils/bip';

import { API_URL } from '../config';

const API_BASE = `${API_URL}`;
const resoudreImage = (chemin) => {
  if (!chemin) return null;
  return chemin.startsWith('http') ? chemin : `${API_BASE}${chemin}`;
};

// Helper : retourne les headers avec le token JWT
function authHeaders() {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
}

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
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const fermerMenuMobile = () => { if (isMobile) setCollapsed(true); };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif', background: '#f0f2f5', position: 'relative', overflow: 'hidden' }}>
      {isMobile && !collapsed && (
        <div onClick={() => setCollapsed(true)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40
        }} />
      )}

      <div style={{
        width: isMobile ? '240px' : (collapsed ? '70px' : '220px'),
        background: '#064e3b',
        display: 'flex', flexDirection: 'column', transition: 'transform 0.3s, width 0.3s',
        overflow: 'hidden', flexShrink: 0,
        ...(isMobile ? {
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50,
          transform: collapsed ? 'translateX(-100%)' : 'translateX(0)'
        } : {})
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #065f46', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', background: '#10b981', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, overflow: 'hidden'
          }}>
            {user?.boutique?.logo ? (
              <img src={resoudreImage(user.boutique.logo)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={`${process.env.PUBLIC_URL}/logo512.png`} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          {(!collapsed || isMobile) && (
            <div>
              <div style={{ color: 'white', fontWeight: '700', fontSize: '14px' }}>{user?.boutique?.nom || 'Ma Boutique'}</div>
              <div style={{ color: '#6ee7b7', fontSize: '11px' }}>Vendeur</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/vendeur'} onClick={fermerMenuMobile}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 8px', borderRadius: '8px', marginBottom: '2px',
                textDecoration: 'none', color: isActive ? 'white' : '#6ee7b7',
                background: isActive ? '#059669' : 'transparent', fontSize: '14px'
              })}>
              <div style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icone nom={item.iconKey} size={22} />
              </div>
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid #065f46', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', background: '#059669',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0
          }}>{user?.nom?.charAt(0) || 'V'}</div>
          {(!collapsed || isMobile) && (
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
            {!isMobile && (
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#064e3b' }}>Accueil</h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Tableau de bord</p>
              </div>
            )}
            {isMobile && (
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#064e3b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Accueil</h2>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', flexShrink: 0 }}>
            {!isMobile && (
              <input placeholder="Rechercher un produit (nom, code-barres)..." style={{
                padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '20px',
                fontSize: '14px', outline: 'none', width: '280px'
              }} />
            )}
            {isMobile && (
              <span onClick={() => setRechercheOuverte(v => !v)} style={{ fontSize: '19px', cursor: 'pointer' }}>🔍</span>
            )}
            <span style={{ fontSize: '20px', cursor: 'pointer' }}>🔔</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: '700', flexShrink: 0
              }}>{user?.nom?.charAt(0) || 'V'}</div>
              {!isMobile && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#064e3b' }}>{user?.nom}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Vendeur</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isMobile && rechercheOuverte && (
          <div style={{ background: 'white', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
            <input autoFocus placeholder="Rechercher un produit (nom, code-barres)..." style={{
              width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '20px',
              fontSize: '14px', outline: 'none', boxSizing: 'border-box'
            }} />
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '14px' : '24px' }}>
          <Routes>
            <Route path="" element={<VendeurDashboard user={user} />} />
            <Route path="nouvelle-vente" element={<CaisseVendeur nomVendeur={user?.nom} vendeurId={user?.id} boutique={user?.boutique} />} />
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
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({ ventesJour: 0, caJour: 0, totalVentes: 0, chiffreAffaires: 0 });
  const [produits, setProduits] = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    axios.get(`${API_BASE}/api/ventes/stats`, authHeaders())
      .then(res => setStats(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE}/api/produits`, authHeaders())
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

  const getImageUrl = (img) => resoudreImage(img);
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
          marginBottom: '24px', height: isMobile ? 'auto' : '220px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: '#064e3b'
        }}>
          {produitVedette && (
            <>
              <div style={{
                width: isMobile ? '100%' : '260px', height: isMobile ? '160px' : '100%', flexShrink: 0, background: '#f0fdf4',
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
                padding: isMobile ? '16px 20px' : '0 32px', minWidth: 0
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
                    Stock magasin: {produitVedette.quantite}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
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
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
function CaisseVendeur({ nomVendeur, vendeurId, boutique }) {
  const isMobile = useIsMobile();
  const [panier, setPanier] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [clientNom, setClientNom] = useState('');
  const [encaissement, setEncaissement] = useState(false);
  const [erreur, setErreur] = useState('');

  // ----- Comptoir de vente -----
  // Le stock affecté par une vente est désormais celui d'un COMPTOIR précis
  // (le stock Magasin n'est qu'une réserve, jamais vendu directement — voir
  // backend/routes/ventes.js). Le vendeur choisit son comptoir une fois ;
  // on retient son choix pour la prochaine visite sur ce même appareil.
  const [comptoirs, setComptoirs] = useState([]);
  const [comptoirId, setComptoirId] = useState(() => localStorage.getItem('bs_comptoir_id') || '');
  useEffect(() => {
    axios.get(`${API_BASE}/api/comptoirs`, authHeaders())
      .then(res => {
        const liste = (res.data || []).filter(c => c.actif);
        setComptoirs(liste);
        setComptoirId(prev => (prev && liste.some(c => c._id === prev)) ? prev : (liste[0]?._id || ''));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (comptoirId) localStorage.setItem('bs_comptoir_id', comptoirId);
  }, [comptoirId]);

  // Stock vendable d'un produit AU COMPTOIR sélectionné (pas p.quantite, qui
  // est désormais le stock Magasin, non vendable directement).
  const stockComptoirDe = (produit) => {
    const entree = (produit.stockComptoirs || []).find(sc => (sc.comptoir?._id || sc.comptoir) === comptoirId);
    return entree ? entree.quantite : 0;
  };

  // ----- Scan QR -----
  const [scanActif, setScanActif] = useState(false);
  const [scanMessage, setScanMessage] = useState(null); // { type: 'ok'|'erreur', texte }
  const scannerRef = useRef(null);
  const produitsRef = useRef(produits); // évite un scanner "figé" sur l'ancienne liste de produits
  const dernierScanRef = useRef({ code: null, ts: 0 });

  useEffect(() => { produitsRef.current = produits; }, [produits]);

  useEffect(() => {
    if (!scanActif) return;

    const scanner = new Html5Qrcode('lecteur-qr-vendeur');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (texteDecode) => {
        // Ignore un re-scan du même code QR dans les 2 secondes (le flux caméra le détecte en continu)
        const maintenant = Date.now();
        if (dernierScanRef.current.code === texteDecode && maintenant - dernierScanRef.current.ts < 2000) return;
        dernierScanRef.current = { code: texteDecode, ts: maintenant };

        let donnees;
        try {
          donnees = JSON.parse(texteDecode);
        } catch {
          bipErreur();
          setScanMessage({ type: 'erreur', texte: 'QR non reconnu (pas une étiquette produit)' });
          return;
        }

        const produit = produitsRef.current.find(p => p._id === donnees.id);
        if (!produit) {
          bipErreur();
          setScanMessage({ type: 'erreur', texte: `Produit introuvable ou plus disponible : ${donnees.nom || ''}` });
          return;
        }
        if (stockComptoirDe(produit) <= 0) {
          bipErreur();
          setScanMessage({ type: 'erreur', texte: `Rupture de stock à ce comptoir : ${produit.nom}` });
          return;
        }

        bipSucces();
        setScanMessage({ type: 'ok', texte: `${produit.nom} ajouté au panier` });
        ajouterAuPanier(produit);
      },
      () => { /* pas de QR dans le champ à cet instant — pas une erreur, on ignore */ }
    ).catch((err) => {
      setScanMessage({ type: 'erreur', texte: "Impossible d'accéder à la caméra : " + err });
      setScanActif(false);
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanActif]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/produits`, authHeaders())
      .then(res => {
        setProduits(res.data || []);
        setChargement(false);
      })
      .catch(() => {
        setErreur('Impossible de charger les produits');
        setChargement(false);
      });
  }, []);

  const produitsFiltres = produits
    .filter(p => stockComptoirDe(p) > 0)
    .filter(p =>
      p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
      (p.categorie && p.categorie.toLowerCase().includes(recherche.toLowerCase()))
    );

  const ajouterAuPanier = (produit) => {
    const stockDispo = stockComptoirDe(produit);
    setPanier(prev => {
      const existant = prev.find(p => p._id === produit._id);
      if (existant) {
        if (existant.qte >= stockDispo) return prev;
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
      if (newQte > stockComptoirDe(p)) return p;
      return { ...p, qte: newQte };
    }).filter(Boolean));
  };

  const supprimerDuPanier = (id) => setPanier(prev => prev.filter(p => p._id !== id));

  const total = panier.reduce((sum, p) => sum + p.prix * p.qte, 0);

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

  const [venteAConfirmer, setVenteAConfirmer] = useState(null); // { numFacture, date, heure, panier, clientNom, total }

  const finaliserVente = async () => {
    if (panier.length === 0) return;
    if (!comptoirId) {
      setErreur("Sélectionnez d'abord un comptoir de vente en haut de l'écran.");
      return;
    }
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
        comptoirId,
      };

      const res = await axios.post(`${API_BASE}/api/ventes`, venteData, authHeaders());
      const numFacture = res.data.numFacture || ('FAC-' + Date.now().toString().slice(-6));

      setVenteAConfirmer({
        numFacture,
        date: new Date().toLocaleDateString('fr-FR'),
        heure: new Date().toLocaleTimeString('fr-FR'),
        panier: [...panier],
        clientNom: clientNom || 'Client anonyme',
        total,
      });

      setProduits(prev => prev.map(p => {
        const vendu = panier.find(v => v._id === p._id);
        if (!vendu) return p;
        return {
          ...p,
          stockComptoirs: (p.stockComptoirs || []).map(sc =>
            (sc.comptoir?._id || sc.comptoir) === comptoirId
              ? { ...sc, quantite: sc.quantite - vendu.qte }
              : sc
          ),
        };
      }));

      setPanier([]);
      setClientNom('');
    } catch (err) {
      setErreur("Erreur lors de l'enregistrement : " + (err.response?.data?.message || err.message));
    } finally {
      setEncaissement(false);
    }
  };

  const genererFacturePdfA4 = async (vente) => {
    const numFacture = vente.numFacture;
    const nomBoutique = boutique?.nom || 'Boutique Stock';
    const logoBase64 = await chargerImageBase64(resoudreImage(boutique?.logo));

    const doc = new jsPDF();
    const date = vente.date;
    const heure = vente.heure;

    const dessinerCopie = (yBase, labelCopie) => {
      doc.setFillColor(6, 78, 59);
      doc.rect(0, yBase, 210, 30, 'F');

      let xTexte = 14;
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'JPEG', 14, yBase + 5, 20, 20, undefined, 'FAST');
          xTexte = 40;
        } catch (e) { /* image illisible, on continue sans */ }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(nomBoutique, xTexte, yBase + 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Votre boutique de confiance', xTexte, yBase + 18);
      doc.text(`Facture N° ${numFacture}`, xTexte, yBase + 25);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(labelCopie, 196, yBase + 12, { align: 'right' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date : ${date} a ${heure}`, 120, yBase + 40);
      doc.text(`Vendeur : ${nomVendeur || 'Vendeur'}`, 120, yBase + 46);
      doc.text(`Client : ${vente.clientNom}`, 120, yBase + 52);

      autoTable(doc, {
        startY: yBase + 58,
        head: [['Produit', 'Categorie', 'Prix unitaire', 'Qte', 'Total']],
        body: vente.panier.map(p => [
          p.nom,
          p.categorie || '-',
          formatMontant(p.prix),
          p.qte,
          formatMontant(p.prix * p.qte)
        ]),
        headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : yBase + 90) + 6;
      doc.setFillColor(240, 253, 244);
      doc.rect(134, finalY, 62, 18, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text('TOTAL A PAYER :', 138, finalY + 7);
      doc.text(formatMontant(vente.total), 138, finalY + 14);

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
    doc.text('✂ - - - - - - - - - - - - - - - - - découper ici - - - - - - - - - - - - - - - - - ✂', 105, 148, { align: 'center' });

    dessinerCopie(150, 'COPIE CLIENT');

    doc.save(`Facture-${numFacture}.pdf`);
    setVenteAConfirmer(null);
  };

  // Ticket thermique (58/80mm) : imprimé via le navigateur (window.print), pas
  // de PDF généré — la plupart des imprimantes thermiques s'installent comme
  // une imprimante système classique, sélectionnable dans la boîte de
  // dialogue d'impression du navigateur.
  const [venteThermique, setVenteThermique] = useState(null);
  const imprimerTicketThermique = (vente) => {
    setVenteThermique(vente);
    setVenteAConfirmer(null);
  };
  useEffect(() => {
    if (venteThermique) {
      const t = setTimeout(() => window.print(), 60);
      return () => clearTimeout(t);
    }
  }, [venteThermique]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
      gap: '20px',
      height: isMobile ? 'auto' : 'calc(100vh - 140px)'
    }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {comptoirs.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600' }}>🏪 Comptoir de vente :</span>
            <select value={comptoirId} onChange={e => setComptoirId(e.target.value)} style={{
              padding: '6px 10px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '13px', background: 'white', fontWeight: '600', color: '#1e40af'
            }}>
              {comptoirs.map(c => <option key={c._id} value={c._id}>{c.nom}</option>)}
            </select>
          </div>
        )}
        {comptoirs.length === 0 && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ Aucun comptoir actif n'est configuré — demandez à l'admin d'en créer un dans Stocks → Comptoirs avant de pouvoir vendre.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, color: '#064e3b', fontSize: '16px' }}>📦 Produits disponibles</h3>
          <button onClick={() => { setScanMessage(null); setScanActif(v => !v); }} style={{
            padding: '8px 16px', background: scanActif ? '#dc2626' : '#059669', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            {scanActif ? '✖ Fermer le scanner' : '📷 Scanner un QR'}
          </button>
        </div>

        {scanActif && (
          <div style={{ marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
            <div id="lecteur-qr-vendeur" style={{ width: '100%', maxWidth: '360px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden' }} />
            {scanMessage && (
              <div style={{
                marginTop: '10px', textAlign: 'center', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                background: scanMessage.type === 'ok' ? '#dcfce7' : '#fee2e2',
                color: scanMessage.type === 'ok' ? '#16a34a' : '#dc2626'
              }}>
                {scanMessage.type === 'ok' ? '✅ ' : '⚠️ '}{scanMessage.texte}
              </div>
            )}
            <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
              Visez l'étiquette QR collée sur le produit — un bip confirme chaque ajout au panier.
            </div>
          </div>
        )}

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
                      src={resoudreImage(p.image)}
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
                <div style={{ fontSize: '11px', color: stockComptoirDe(p) <= p.seuilAlerte ? '#dc2626' : '#666' }}>
                  Stock comptoir : {stockComptoirDe(p)}
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
            onClick={finaliserVente}
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

      {venteAConfirmer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '28px 24px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px' }}>✅</div>
            <h3 style={{ margin: '8px 0 4px' }}>Vente enregistrée</h3>
            <div style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>Facture {venteAConfirmer.numFacture}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => genererFacturePdfA4(venteAConfirmer)} style={{
                padding: '12px', background: '#2563eb', color: 'white', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px'
              }}>🧾 Facture PDF A4</button>
              <button onClick={() => imprimerTicketThermique(venteAConfirmer)} style={{
                padding: '12px', background: '#059669', color: 'white', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px'
              }}>🖨️ Ticket thermique (58/80mm)</button>
              <button onClick={() => setVenteAConfirmer(null)} style={{
                padding: '10px', background: '#f1f5f9', color: '#666', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
              }}>Fermer sans imprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Zone imprimable pour le ticket thermique — invisible à l'écran, visible
          uniquement dans la boîte de dialogue d'impression (voir <style> ci-dessous). */}
      <style>{`
        #ticket-thermique-print { display: none; }
        @media print {
          body * { visibility: hidden; }
          #ticket-thermique-print, #ticket-thermique-print * { visibility: visible; }
          #ticket-thermique-print {
            display: block; position: absolute; top: 0; left: 0;
            width: 76mm; font-family: 'Courier New', monospace; font-size: 11px;
          }
          #ticket-thermique-print .centre { text-align: center; }
          #ticket-thermique-print .titre { font-weight: bold; }
          #ticket-thermique-print .separateur { border-top: 1px dashed #000; margin: 5px 0; }
          #ticket-thermique-print .ligne { display: flex; justify-content: space-between; }
          @page { size: 80mm auto; margin: 2mm; }
        }
      `}</style>
      {venteThermique && (
        <div id="ticket-thermique-print">
          <div className="centre titre">{boutique?.nom || 'BOUTIQUE'}</div>
          <div className="separateur" />
          <div>Facture N° {venteThermique.numFacture}</div>
          <div>{venteThermique.date}  {venteThermique.heure}</div>
          <div className="separateur" />
          {venteThermique.panier.map(p => (
            <div key={p._id}>
              <div>{p.nom}</div>
              <div className="ligne"><span>{p.qte} x {formatMontant(p.prix)}</span><span>{formatMontant(p.prix * p.qte)}</span></div>
            </div>
          ))}
          <div className="separateur" />
          <div className="ligne titre"><span>TOTAL</span><span>{formatMontant(venteThermique.total)}</span></div>
          <div className="separateur" />
          <div className="centre">Merci pour votre achat</div>
        </div>
      )}
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
    axios.get(`${API_BASE}/api/produits`, authHeaders())
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
                    src={resoudreImage(p.image)}
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
                }} title="Stock au Magasin (réserve) — le stock réellement vendable dépend du comptoir, voir Nouvelle vente">Stock magasin : {p.quantite}</span>
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
    axios.get(`${API_BASE}/api/ventes`, authHeaders())
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
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
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
          </div>
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
  const [clients, setClients] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = () => {
    axios.get(`${API_BASE}/api/clients`, authHeaders())
      .then(res => { setClients(res.data); setChargement(false); })
      .catch(() => setChargement(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, []);

  const ajouterClient = async () => {
    if (!nom) return;
    setEnvoi(true);
    setErreur('');
    try {
      await axios.post(`${API_BASE}/api/clients`, { nom, telephone }, authHeaders());
      setNom(''); setTelephone(''); setNouveau(false);
      charger();
    } catch (err) {
      setErreur(err.response?.data?.message || err.message);
    } finally {
      setEnvoi(false);
    }
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
            <button onClick={ajouterClient} disabled={envoi} style={{
              padding: '10px 20px', background: '#059669', color: 'white',
              border: 'none', borderRadius: '8px', cursor: envoi ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: envoi ? 0.7 : 1
            }}>{envoi ? '...' : 'Enregistrer'}</button>
          </div>
          {erreur && <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px' }}>⚠️ {erreur}</div>}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>⏳ Chargement...</div>
        ) : clients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Aucun client pour le moment.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                {['Nom', 'Téléphone', 'Achats', 'Total dépensé'].map(h => (
                  <th key={h} style={{ padding: '12px 8px', textAlign: 'left', fontSize: '13px', color: '#666', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c._id} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '600', color: '#333' }}>{c.nom}</td>
                  <td style={{ padding: '12px 8px', color: '#666' }}>{c.telephone || '—'}</td>
                  <td style={{ padding: '12px 8px', color: '#333' }}>{c.achats || 0} achat(s)</td>
                  <td style={{ padding: '12px 8px', color: '#059669', fontWeight: '600' }}>{(c.total || 0).toLocaleString()} FCFA</td>
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