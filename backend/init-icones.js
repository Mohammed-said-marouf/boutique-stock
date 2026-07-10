const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Icone = require('./models/Icone');

const iconesDefaut = [
  { cle: 'dashboard', valeur: '📊', categorie: 'menu', description: 'Tableau de bord' },
  { cle: 'boutiques', valeur: '🏪', categorie: 'menu', description: 'Boutiques' },
  { cle: 'utilisateurs', valeur: '👥', categorie: 'menu', description: 'Utilisateurs' },
  { cle: 'parametres', valeur: '⚙️', categorie: 'menu', description: 'Paramètres' },
  { cle: 'deconnexion', valeur: '🚪', categorie: 'menu', description: 'Déconnexion' },
  { cle: 'produits', valeur: '📦', categorie: 'menu', description: 'Produits' },
  { cle: 'ventes', valeur: '💰', categorie: 'menu', description: 'Ventes' },
  { cle: 'clients', valeur: '👤', categorie: 'menu', description: 'Clients' },
  { cle: 'stock', valeur: '📊', categorie: 'menu', description: 'Stock' },
  { cle: 'caisse', valeur: '🛒', categorie: 'menu', description: 'Caisse' },
  { cle: 'ajouter', valeur: '➕', categorie: 'actions', description: 'Ajouter' },
  { cle: 'modifier', valeur: '✏️', categorie: 'actions', description: 'Modifier' },
  { cle: 'supprimer', valeur: '🗑️', categorie: 'actions', description: 'Supprimer' },
  { cle: 'rechercher', valeur: '🔍', categorie: 'actions', description: 'Rechercher' },
  { cle: 'exporter', valeur: '📥', categorie: 'actions', description: 'Exporter' },
  { cle: 'imprimer', valeur: '🖨️', categorie: 'actions', description: 'Imprimer' },
  { cle: 'actif', valeur: '✅', categorie: 'statuts', description: 'Actif' },
  { cle: 'inactif', valeur: '❌', categorie: 'statuts', description: 'Inactif' },
  { cle: 'en_attente', valeur: '⏳', categorie: 'statuts', description: 'En attente' },
  { cle: 'valide', valeur: '✓', categorie: 'statuts', description: 'Validé' }
];

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI introuvable. Vérifiez backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  await Icone.deleteMany({});
  await Icone.insertMany(iconesDefaut);
  console.log('✅', iconesDefaut.length, 'icônes initialisés');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});