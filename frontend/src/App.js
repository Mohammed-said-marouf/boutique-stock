import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IconesProvider } from './context/IconesContext';
import Login from './pages/Login';

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
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <IconesProvider>
          <AppRoutes />
        </IconesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}