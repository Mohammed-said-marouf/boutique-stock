const cron = require('node-cron');
const Produit = require('../models/Produit');
const { envoyerAlerteStock } = require('./emailService');

const demarrerVerificationStock = () => {
  // Vérification toutes les heures
  cron.schedule('0 * * * *', async () => {
    console.log('🔍 Vérification des stocks...');
    try {
      const produitsBasStock = await Produit.find({
        $expr: { $lte: ['$quantite', '$seuilAlerte'] }
      });

      if (produitsBasStock.length > 0) {
        console.log(`⚠️ ${produitsBasStock.length} produit(s) en stock bas`);
        await envoyerAlerteStock(produitsBasStock);
      } else {
        console.log('✅ Tous les stocks sont OK');
      }
    } catch (err) {
      console.log('❌ Erreur vérification stock :', err.message);
    }
  });

  console.log('✅ Vérification automatique des stocks démarrée');
};

module.exports = { demarrerVerificationStock };