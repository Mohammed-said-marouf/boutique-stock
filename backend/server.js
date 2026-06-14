const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares CORS - doit être AVANT tout
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors());
app.use(express.json());

// Route de test
app.get('/', (req, res) => {
  res.json({ message: '✅ Serveur boutique-stock opérationnel !' });
});

// Routes
const produitsRouter = require('./routes/produits');
const fournisseursRouter = require('./routes/fournisseurs');
const ventesRouter = require('./routes/ventes');

app.use('/api/produits', produitsRouter);
app.use('/api/fournisseurs', fournisseursRouter);
app.use('/api/ventes', ventesRouter);

// Vérification automatique des stocks
const { demarrerVerificationStock } = require('./services/stockVerifier');

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB');
    demarrerVerificationStock();
    app.listen(process.env.PORT || 5000, () => {
      console.log('✅ Serveur démarré sur https://boutique-stock-production.up.railway.app');
    });
  })
  .catch((err) => console.log('❌ Erreur MongoDB :', err));