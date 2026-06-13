const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
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

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connecté à MongoDB');
    app.listen(5000, () => {
      console.log('✅ Serveur démarré sur http://localhost:5000');
    });
  })
  .catch((err) => console.log('❌ Erreur MongoDB :', err));