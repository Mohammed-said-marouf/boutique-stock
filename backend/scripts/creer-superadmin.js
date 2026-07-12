// Script à exécuter UNE SEULE FOIS pour créer le compte superadmin initial.
// Usage : node scripts/creer-superadmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Modifiez ces valeurs si besoin avant de lancer le script
const SUPERADMIN = {
  nom: 'Super Admin',
  email: 'superadmin@boutique.com',
  motDePasse: 'Admin2026!',
  role: 'superadmin',
};

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    const existant = await User.findOne({ email: SUPERADMIN.email });
    if (existant) {
      console.log(`⚠️  Un compte avec l'email ${SUPERADMIN.email} existe déjà. Aucune action effectuée.`);
      process.exit(0);
    }

    const user = new User(SUPERADMIN);
    await user.save();

    console.log('🎉 Compte superadmin créé avec succès !');
    console.log('   Email :', SUPERADMIN.email);
    console.log('   Mot de passe :', SUPERADMIN.motDePasse);
    console.log('   ⚠️  Changez ce mot de passe après votre première connexion.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
}

main();