import { createContext, useContext, useState, useEffect } from 'react';

import { API_URL } from '../config';

const IconesContext = createContext();

// Icônes de secours : affichées tant que celles du serveur ne sont pas là (ou
// si le réseau est coupé), au lieu d'un "❓". Mêmes clés que
// backend/routes/icones.js (/initialiser) et backend/migration/ajouterIconesManquantes.js.
const ICONES_PAR_DEFAUT = {
  dashboard: '📊', boutiques: '🏪', utilisateurs: '👥', parametres: '⚙️', deconnexion: '🚪',
  produits: '📦', ventes: '💰', clients: '👤', stock: '📊', caisse: '🛒',
  ajouter: '➕', modifier: '✏️', supprimer: '🗑️', rechercher: '🔍', exporter: '📥', imprimer: '🖨️',
  actif: '✅', inactif: '❌', en_attente: '⏳', valide: '✓',
  inventaires: '📋', fournisseurs: '🚚', rapports: '📈', factures: '📄', sauvegarde: '💾',
  tresorerie: '💸', solde: '🏦', calendrier: '🗓️', chiffreaffaires: '💹', monprofil: '🪪',
};

// Dernières icônes reçues, gardées sur l'appareil : au lancement (ou avec une
// mauvaise connexion) l'appli les affiche tout de suite, sans attendre l'API
// — qui peut mettre longtemps à répondre quand le serveur "se réveille".
const CLE_CACHE = 'bs_icones_v1';

const lireCache = () => {
  try {
    const brut = localStorage.getItem(CLE_CACHE);
    return brut ? JSON.parse(brut) : null;
  } catch { return null; }
};

const ecrireCache = (icones) => {
  try { localStorage.setItem(CLE_CACHE, JSON.stringify(icones)); } catch { /* stockage plein ou indisponible */ }
};

export function IconesProvider({ children }) {
  const [icones, setIcones] = useState(() => ({ ...ICONES_PAR_DEFAUT, ...(lireCache() || {}) }));
  // Jamais bloquant : on a toujours de quoi afficher (cache ou icônes par défaut).
  const loading = false;

  // Charge les icônes du serveur, avec quelques nouvelles tentatives si le
  // réseau est mauvais. `force` contourne le cache HTTP (après une modification).
  const chargerIcones = async ({ force = false } = {}) => {
    for (let essai = 0; essai < 4; essai++) {
      try {
        const res = await fetch(`${API_URL}/api/icones`, force ? { cache: 'reload' } : undefined);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Transformer en objet { cle: valeur } pour un accès rapide
        const iconesMap = {};
        data.forEach(icone => {
          iconesMap[icone.cle] = icone.valeur;
        });

        setIcones({ ...ICONES_PAR_DEFAUT, ...iconesMap });
        ecrireCache(iconesMap);
        return;
      } catch (err) {
        console.error('Erreur chargement icônes:', err);
        await new Promise(r => setTimeout(r, 3000 * (essai + 1)));
      }
    }
  };

  useEffect(() => {
    chargerIcones();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = () => chargerIcones({ force: true });

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
