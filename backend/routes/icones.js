const express = require('express');
const router = express.Router();
const Icone = require('../models/Icone');
const { verifierToken, autoriser } = require('../middleware/auth');

// GET - Récupérer tous les icônes
router.get('/', async (req, res) => {
  try {
    const icones = await Icone.find().sort({ categorie: 1, cle: 1 });
    res.json(icones);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT - Modifier un icône (SuperAdmin seulement)
router.put('/:id', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const icone = await Icone.findByIdAndUpdate(
      req.params.id,
      { valeur: req.body.valeur },
      { new: true }
    );
    res.json(icone);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST - Initialiser les icônes par défaut (à lancer une seule fois)
router.post('/initialiser', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const iconesDefaut = [
      // Menu SuperAdmin
      { cle: 'dashboard', valeur: '📊', categorie: 'menu', description: 'Tableau de bord' },
      { cle: 'boutiques', valeur: '🏪', categorie: 'menu', description: 'Boutiques' },
      { cle: 'utilisateurs', valeur: '👥', categorie: 'menu', description: 'Utilisateurs' },
      { cle: 'parametres', valeur: '⚙️', categorie: 'menu', description: 'Paramètres' },
      { cle: 'deconnexion', valeur: '🚪', categorie: 'menu', description: 'Déconnexion' },
      
      // Menu Admin
      { cle: 'produits', valeur: '📦', categorie: 'menu', description: 'Produits' },
      { cle: 'ventes', valeur: '💰', categorie: 'menu', description: 'Ventes' },
      { cle: 'clients', valeur: '👤', categorie: 'menu', description: 'Clients' },
      { cle: 'stock', valeur: '📊', categorie: 'menu', description: 'Stock' },
      
      // Menu Vendeur
      { cle: 'caisse', valeur: '🛒', categorie: 'menu', description: 'Caisse' },
      
      // Actions
      { cle: 'ajouter', valeur: '➕', categorie: 'actions', description: 'Ajouter' },
      { cle: 'modifier', valeur: '✏️', categorie: 'actions', description: 'Modifier' },
      { cle: 'supprimer', valeur: '🗑️', categorie: 'actions', description: 'Supprimer' },
      { cle: 'rechercher', valeur: '🔍', categorie: 'actions', description: 'Rechercher' },
      { cle: 'exporter', valeur: '📥', categorie: 'actions', description: 'Exporter' },
      { cle: 'imprimer', valeur: '🖨️', categorie: 'actions', description: 'Imprimer' },
      
      // Statuts
      { cle: 'actif', valeur: '✅', categorie: 'statuts', description: 'Actif' },
      { cle: 'inactif', valeur: '❌', categorie: 'statuts', description: 'Inactif' },
      { cle: 'en_attente', valeur: '⏳', categorie: 'statuts', description: 'En attente' },
      { cle: 'valide', valeur: '✓', categorie: 'statuts', description: 'Validé' }
    ];

    await Icone.insertMany(iconesDefaut);
    res.json({ message: '✅ Icônes initialisés', count: iconesDefaut.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;