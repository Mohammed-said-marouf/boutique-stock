const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  next();
});

app.use(express.json());
const path = require('path');
app.use('/uploads', require('express').static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({ message: '✅ Serveur boutique-stock opérationnel !' });
});

// Routes existantes
app.use('/api/produits', require('./routes/produits'));
app.use('/api/fournisseurs', require('./routes/fournisseurs'));
app.use('/api/ventes', require('./routes/ventes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/boutiques', require('./routes/boutiques'));
app.use('/api/users', require('./routes/users'));

// Nouvelle route pour les icônes
app.use('/api/icones', require('./routes/icones'));

const { demarrerVerificationStock } = require('./services/stockVerifier');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB');
    demarrerVerificationStock();
    app.listen(process.env.PORT || 5000, () => {
      console.log('✅ Serveur démarré sur le port', process.env.PORT || 5000);
    });
  })
  .catch((err) => console.log('❌ Erreur MongoDB :', err));