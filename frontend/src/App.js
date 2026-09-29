import { Fragment, useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { chargerConfigGenerale, EVENEMENT as EVENEMENT_CONFIG } from './utils/configGenerale';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IconesProvider } from './context/IconesContext';
import Login from './pages/Login';
import Inscription from './pages/Inscription';
import ChangementMotDePasseObligatoire from './components/ChangementMotDePasseObligatoire';
import BarriereMaintenance from './components/Maintenance';

// Layouts
import SuperAdminLayout from './layouts/SuperAdminLayout';
import AdminLayout from './layouts/AdminLayout';
import VendeurLayout from './layouts/VendeurLayout';

// Route protégée selon le rôle
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>Chargement...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
  return children;
};

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <>
    {/* Après une réinitialisation par le super admin : écran bloquant tant que le mot de passe temporaire n'est pas remplacé */}
    {user?.doitChangerMotDePasse && <ChangementMotDePasseObligatoire />}
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={
        user.role === 'superadmin' ? '/superadmin' :
        user.role === 'admin' ? '/admin' : '/vendeur'
      } />} />

      <Route path="/inscription" element={!user ? <Inscription /> : <Navigate to={
        user.role === 'superadmin' ? '/superadmin' :
        user.role === 'admin' ? '/admin' : '/vendeur'
      } />} />

      <Route path="/superadmin/*" element={
        <ProtectedRoute roles={['superadmin']}>
          <SuperAdminLayout />
        </ProtectedRoute>
      } />

      <Route path="/admin/*" element={
        <ProtectedRoute roles={['admin']}>
          <AdminLayout />
        </ProtectedRoute>
      } />

      <Route path="/vendeur/*" element={
        <ProtectedRoute roles={['vendeur']}>
          <VendeurLayout />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
    </>
  );
}

// Charge la configuration générale (nom, devise, fuseau... — voir
// utils/configGenerale.js) et ré-affiche l'appli quand elle change. Les
// composants lisent devise()/nomApplication() directement au rendu, sans
// s'abonner : on remonte donc l'arbre (clé) — ça n'arrive que lorsque le
// super admin modifie la configuration, ou au premier chargement sur un
// appareil qui ne la connaissait pas encore.
function ConfigGeneraleProvider({ children }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const maj = () => setVersion(v => v + 1);
    window.addEventListener(EVENEMENT_CONFIG, maj);
    chargerConfigGenerale();
    return () => window.removeEventListener(EVENEMENT_CONFIG, maj);
  }, []);
  return <Fragment key={version}>{children}</Fragment>;
}

export default function App() {
  return (
    <HashRouter>
      <ConfigGeneraleProvider>
      <AuthProvider>
        <IconesProvider>
          <BarriereMaintenance>
            <AppRoutes />
          </BarriereMaintenance>
        </IconesProvider>
      </AuthProvider>
      </ConfigGeneraleProvider>
    </HashRouter>
  );
}