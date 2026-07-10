import { createContext, useContext, useState, useEffect } from 'react';

const IconesContext = createContext();

export function IconesProvider({ children }) {
  const [icones, setIcones] = useState({});
  const [loading, setLoading] = useState(true);

  const chargerIcones = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/icones');
      const data = await res.json();
      
      // Transformer en objet { cle: valeur } pour un accès rapide
      const iconesMap = {};
      data.forEach(icone => {
        iconesMap[icone.cle] = icone.valeur;
      });
      
      setIcones(iconesMap);
    } catch (err) {
      console.error('Erreur chargement icônes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerIcones();
  }, []);

  const refresh = () => chargerIcones();

  return (
    <IconesContext.Provider value={{ icones, loading, refresh }}>
      {children}
    </IconesContext.Provider>
  );
}

export function useIcones() {
  return useContext(IconesContext);
}

// Composant réutilisable pour afficher un icône
export function Icone({ nom, size = 20, style = {} }) {
  const { icones } = useIcones();
  const valeur = icones[nom] || '❓';

  // Si c'est une image base64
  if (valeur && valeur.startsWith('data:image')) {
    return (
      <img 
        src={valeur} 
        alt={nom} 
        style={{ 
          width: size, 
          height: size, 
          objectFit: 'contain',
          verticalAlign: 'middle',
          ...style 
        }} 
      />
    );
  }

  // Sinon c'est un emoji
  return (
    <span style={{ fontSize: size, ...style }}>
      {valeur}
    </span>
  );
}