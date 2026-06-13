import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Produits from './pages/Produits';
import Ventes from './pages/Ventes';
import Fournisseurs from './pages/Fournisseurs';
import Login from './pages/Login';
import './App.css';

function App() {
  const [isAuth, setIsAuth] = useState(localStorage.getItem('auth') === 'true');

  const handleLogin = () => setIsAuth(true);

  const handleLogout = () => {
    localStorage.removeItem('auth');
    setIsAuth(false);
  };

  if (!isAuth) return <Login onLogin={handleLogin} />;

  return (
    <Router>
      <div className="app">
        <Navbar onLogout={handleLogout} />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/produits" element={<Produits />} />
            <Route path="/ventes" element={<Ventes />} />
            <Route path="/fournisseurs" element={<Fournisseurs />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;