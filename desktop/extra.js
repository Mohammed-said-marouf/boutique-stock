// Script de test : valide le push pour produits, mouvements_stock et logs.
// Lancer avec : node extra.js

const BASE = 'http://localhost:4000';

// Valeurs récupérées dans MongoDB Atlas (collection "produits" existant),
// utilisées pour le test du mouvement de stock.
const PRODUIT_ID_EXISTANT = 'ea180a10-005c-4667-a8c3-de91450897eb';
const BOUTIQUE_ID_EXISTANTE = 'a98c8d05-7e00-4d2d-9597-fbd42ed53693';

async function main() {
  // 1. Créer un log test
  const resLog = await fetch(`${BASE}/api/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'test_desktop', message: 'Test de synchronisation depuis le desktop', niveau: 'info' }),
  });
  const log = await resLog.json();
  console.log('✅ Log créé :', log._id);

  // 2. Créer un produit test (sans image, cas géré par le nouveau push)
  const resProduit = await fetch(`${BASE}/api/produits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: 'Produit Test Push ' + new Date().toISOString().slice(11, 19),
      description: 'Créé par extra.js pour tester le push',
      prix: 1500,
      quantite: 10,
      categorie: 'Test',
      boutiqueId: BOUTIQUE_ID_EXISTANTE,
      seuilAlerte: 3,
    }),
  });
  const produit = await resProduit.json();
  console.log('✅ Produit créé :', produit._id, '-', produit.nom);

  // 3. Créer un utilisateur test (le mot de passe est haché en local avant stockage)
  const emailTest = `test.desktop.${Date.now()}@boutique.com`;
  const motDePasseTest = 'MotDePasseTest123!';

  const resUser = await fetch(`${BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nom: 'Utilisateur Test Desktop',
      email: emailTest,
      motDePasse: motDePasseTest,
      role: 'vendeur',
      boutiqueId: BOUTIQUE_ID_EXISTANTE,
    }),
  });
  const user = await resUser.json();
  console.log('✅ Utilisateur créé :', user._id, '-', user.email);

  // 4. Créer un mouvement de stock (entrée de 5 unités sur le produit existant en ligne)
  const resMouvement = await fetch(`${BASE}/api/mouvements-stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      produit: PRODUIT_ID_EXISTANT,
      boutiqueId: BOUTIQUE_ID_EXISTANTE,
      type: 'entree',
      quantite: 5,
      note: 'Test desktop - produit existant en ligne',
    }),
  });
  const mouvement = await resMouvement.json();
  console.log('✅ Mouvement de stock créé :', mouvement._id, '- nouveau stock :', mouvement.stockRestant);

  // 5. Déclencher le push
  console.log('\n🔄 Déclenchement du push...\n');
  const resPush = await fetch(`${BASE}/api/sync/push`, { method: 'POST' });
  const resultatPush = await resPush.json();
  console.log(JSON.stringify(resultatPush, null, 2));

  // 6. Vérifier que l'utilisateur peut se connecter EN LIGNE avec son mot de
  // passe en clair d'origine — le vrai test qui confirme l'absence de
  // double hachage (backend en ligne, pas le serveur local).
  console.log('\n🔐 Vérification de connexion en ligne pour l\'utilisateur test...\n');
  const API_EN_LIGNE = 'https://boutique-stock-api.onrender.com'; // <-- à adapter avec ta vraie URL Render
  const resLoginTest = await fetch(`${API_EN_LIGNE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailTest, motDePasse: motDePasseTest }),
  });
  if (resLoginTest.ok) {
    console.log('✅ Connexion en ligne réussie avec le mot de passe en clair — pas de double hachage !');
  } else {
    const texte = await resLoginTest.text();
    console.log('❌ Échec de connexion en ligne :', resLoginTest.status, texte);
  }
}

main().catch(err => console.error('❌ Erreur :', err.message));