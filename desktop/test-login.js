// Script de test : se connecte via le serveur local (qui relaie vers l'API en ligne)
// et vérifie que le token est bien stocké.
// Lancer avec : node test-login.js

const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Email : ', (email) => {
  rl.question('Mot de passe : ', async (motDePasse) => {
    rl.close();

    try {
      const reponse = await fetch('http://localhost:4000/api/sync/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, motDePasse }),
      });

      const donnees = await reponse.json();

      if (!reponse.ok) {
        console.error('❌ Échec de connexion :', donnees.message);
        return;
      }

      console.log('✅ Connexion réussie !');
      console.log('Utilisateur :', donnees.user.nom, `(${donnees.user.role})`);
      console.log('Token reçu (tronqué) :', donnees.token.slice(0, 30) + '...');

      // Vérifie que la session est bien persistée
      const verif = await fetch('http://localhost:4000/api/sync/session');
      const session = await verif.json();
      console.log('\n📋 Session stockée localement :', JSON.stringify(session, null, 2));
    } catch (err) {
      console.error('❌ Erreur :', err.message);
    }
  });
});