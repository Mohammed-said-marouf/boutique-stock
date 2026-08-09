// Se connecte avec le compte SUPERADMIN via la route locale, ce qui stocke
// un nouveau token (superadmin) dans session-sync.json, remplaçant le token
// admin utilisé jusqu'ici. Une fois connecté, on relance directement le push
// pour voir si "boutiques" passe.
//
// Lancer avec : node se-connecter-superadmin.js

const BASE = 'http://localhost:4000';

const EMAIL = 'superadmin@boutique.com';
const MOT_DE_PASSE = 'Admin2026!';

async function main() {
  const resLogin = await fetch(`${BASE}/api/sync/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, motDePasse: MOT_DE_PASSE }),
  });

  if (!resLogin.ok) {
    const texte = await resLogin.text();
    console.error('❌ Échec de connexion :', resLogin.status, texte);
    return;
  }

  const resultat = await resLogin.json();
  console.log('✅ Connecté en tant que superadmin. Session mise à jour.');
  console.log(JSON.stringify(resultat, null, 2));

  console.log('\n🔄 Déclenchement du push avec le nouveau token...\n');
  const resPush = await fetch(`${BASE}/api/sync/push`, { method: 'POST' });
  const resultatPush = await resPush.json();
  console.log(JSON.stringify(resultatPush, null, 2));
}

main().catch(err => console.error('❌ Erreur :', err.message));