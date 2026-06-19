const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// CORS - doit être EN PREMIER
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: '✅ Serveur boutique-stock opérationnel !' });
});

const produitsRouter = require('./routes/produits');
const fournisseursRouter = require('./routes/fournisseurs');
const ventesRouter = require('./routes/ventes');

app.use('/api/produits', produitsRouter);
app.use('/api/fournisseurs', fournisseursRouter);
app.use('/api/ventes', ventesRouter);

const { demarrerVerificationStock } = require('./services/stockVerifier');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB');
    demarrerVerificationStock();
    app.listen(process.env.PORT || 5000, () => {
      console.log('✅ Serveur démarré');
    });
  })
  .catch((err) => console.log('❌ Erreur MongoDB :', err));