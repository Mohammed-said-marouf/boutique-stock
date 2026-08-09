// Script à lancer UNE SEULE FOIS avant test-sync-extra.js.
// Insère localement (SQLite) la boutique et le produit qui existent déjà
// en ligne dans MongoDB Atlas, avec les MÊMES id, pour que la vérification
// "le produit doit exister localement" dans routes/mouvements-stock.js passe,
// tout en pointant vers de vraies données côté serveur.
//
// Lancer avec : node inserer-produit-test-local.js
// (à exécuter depuis le dossier desktop/, là où se trouve local-db/db.js)

const db = require('./local-db/db');

const BOUTIQUE_ID_EXISTANTE = 'a98c8d05-7e00-4d2d-9597-fbd42ed53693';
const PRODUIT_ID_EXISTANT = 'ea180a10-005c-4667-a8c3-de91450897eb';

const maintenant = new Date().toISOString();

// INSERT OR IGNORE : si la ligne existe déjà (relance du script), rien ne se
// passe, pas d'erreur de doublon.

db.prepare(`
  INSERT OR IGNORE INTO boutiques (id, nom, adresse, created_at, updated_at, is_dirty, is_deleted)
  VALUES (@id, @nom, @adresse, @createdAt, @updatedAt, 0, 0)
`).run({
  id: BOUTIQUE_ID_EXISTANTE,
  nom: 'Boutique (miroir local pour tests)',
  adresse: 'Yaoundé',
  createdAt: maintenant,
  updatedAt: maintenant,
});

db.prepare(`
  INSERT OR IGNORE INTO produits (id, nom, description, prix, quantite, categorie, boutique_id, seuil_alerte, created_at, updated_at, is_dirty, is_deleted)
  VALUES (@id, @nom, @description, @prix, @quantite, @categorie, @boutiqueId, @seuilAlerte, @createdAt, @updatedAt, 0, 0)
`).run({
  id: PRODUIT_ID_EXISTANT,
  nom: 'ORDINATEUR PORTABLE',
  description: '',
  prix: 90000,
  quantite: 50,
  categorie: 'ÉLECTRONIQUE',
  boutiqueId: BOUTIQUE_ID_EXISTANTE,
  seuilAlerte: 5,
  createdAt: maintenant,
  updatedAt: maintenant,
});

console.log('✅ Boutique et produit insérés (ou déjà présents) localement.');
console.log('   Boutique :', BOUTIQUE_ID_EXISTANTE);
console.log('   Produit  :', PRODUIT_ID_EXISTANT);