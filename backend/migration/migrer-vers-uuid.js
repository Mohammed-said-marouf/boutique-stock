/**
 * Script de migration ONE-SHOT : convertit tous les _id de type ObjectId
 * en UUID (string), et met à jour toutes les références croisées.
 *
 * ⚠️ À exécuter UNE SEULE FOIS, avant de déployer les nouveaux modèles Mongoose.
 * ⚠️ FAITES UNE SAUVEGARDE DE VOTRE BASE AVANT DE LANCER CE SCRIPT.
 *    (Sur MongoDB Atlas : Cluster > ... > "Take Snapshot Now", ou mongodump)
 *
 * Utilisation :
 *   1. npm install uuid mongodb --save-dev   (si pas déjà présents)
 *   2. node migrer-vers-uuid.js
 *
 * Le script :
 *   - Se connecte directement au driver MongoDB natif (pas Mongoose, pour
 *     éviter tout conflit avec les schémas pendant la transition).
 *   - Passe 1 : attribue un nouvel UUID à chaque document de chaque collection.
 *   - Passe 2 : réécrit chaque document avec son nouvel _id, et remplace toutes
 *     les références (champs "ref" Mongoose) par les nouveaux UUID correspondants.
 *   - Supprime les anciens documents et insère les nouveaux, collection par collection.
 */

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

// ⚠️ Remplacez par votre vraie chaîne de connexion (celle utilisée dans .env / MONGODB_URI)
const MONGODB_URI = process.env.MONGODB_URI || 'REMPLACER_PAR_VOTRE_URI_MONGODB_ATLAS';
const DB_NAME = process.env.DB_NAME || undefined; // laissez undefined si le nom de la base est déjà dans l'URI

async function main() {
  if (MONGODB_URI.includes('REMPLACER_PAR')) {
    console.error('❌ Merci de renseigner MONGODB_URI (variable d\'environnement ou directement dans le script).');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = DB_NAME ? client.db(DB_NAME) : client.db();
  console.log(`✅ Connecté à la base : ${db.databaseName}`);

  // ---------- PASSE 1 : construire les tables de correspondance ancien ID -> nouvel UUID ----------
  const collections = ['boutiques', 'users', 'fournisseurs', 'produits', 'clients', 'ventes', 'mouvementstocks', 'logs', 'icones'];
  const mappings = {}; // { boutiques: { "ancienObjectIdString": "nouvelUUID", ... }, ... }

  for (const nomCollection of collections) {
    const docs = await db.collection(nomCollection).find({}).toArray();
    mappings[nomCollection] = {};
    for (const doc of docs) {
      mappings[nomCollection][doc._id.toString()] = uuidv4();
    }
    console.log(`📋 ${docs.length} document(s) répertorié(s) dans "${nomCollection}"`);
  }

  // ---------- PASSE 2 : réécrire chaque collection avec les nouveaux _id et références ----------

  const remapId = (nomCollection, ancienId) => {
    if (!ancienId) return ancienId;
    const key = ancienId.toString();
    return mappings[nomCollection]?.[key] || key; // si introuvable, on garde tel quel (ne devrait pas arriver)
  };

  // --- boutiques ---
  await migrerCollection(db, 'boutiques', mappings, (doc) => ({
    ...doc,
    _id: mappings.boutiques[doc._id.toString()],
    proprietaire: doc.proprietaire ? remapId('users', doc.proprietaire) : doc.proprietaire,
  }));

  // --- users ---
  await migrerCollection(db, 'users', mappings, (doc) => ({
    ...doc,
    _id: mappings.users[doc._id.toString()],
    boutiqueId: doc.boutiqueId ? remapId('boutiques', doc.boutiqueId) : doc.boutiqueId,
  }));

  // --- fournisseurs ---
  await migrerCollection(db, 'fournisseurs', mappings, (doc) => ({
    ...doc,
    _id: mappings.fournisseurs[doc._id.toString()],
    produits: Array.isArray(doc.produits) ? doc.produits.map(pid => remapId('produits', pid)) : doc.produits,
  }));

  // --- produits ---
  await migrerCollection(db, 'produits', mappings, (doc) => ({
    ...doc,
    _id: mappings.produits[doc._id.toString()],
    fournisseur: doc.fournisseur ? remapId('fournisseurs', doc.fournisseur) : doc.fournisseur,
    boutiqueId: doc.boutiqueId ? remapId('boutiques', doc.boutiqueId) : doc.boutiqueId,
  }));

  // --- clients ---
  await migrerCollection(db, 'clients', mappings, (doc) => ({
    ...doc,
    _id: mappings.clients[doc._id.toString()],
    boutiqueId: doc.boutiqueId ? remapId('boutiques', doc.boutiqueId) : doc.boutiqueId,
  }));

  // --- ventes ---
  await migrerCollection(db, 'ventes', mappings, (doc) => ({
    ...doc,
    _id: mappings.ventes[doc._id.toString()],
    produits: Array.isArray(doc.produits) ? doc.produits.map(p => ({
      ...p,
      produit: remapId('produits', p.produit),
    })) : doc.produits,
    vendeur: doc.vendeur ? remapId('users', doc.vendeur) : doc.vendeur,
    boutiqueId: doc.boutiqueId ? remapId('boutiques', doc.boutiqueId) : doc.boutiqueId,
  }));

  // --- mouvementstocks ---
  await migrerCollection(db, 'mouvementstocks', mappings, (doc) => ({
    ...doc,
    _id: mappings.mouvementstocks[doc._id.toString()],
    produit: doc.produit ? remapId('produits', doc.produit) : doc.produit,
    boutiqueId: doc.boutiqueId ? remapId('boutiques', doc.boutiqueId) : doc.boutiqueId,
  }));

  // --- logs ---
  await migrerCollection(db, 'logs', mappings, (doc) => ({
    ...doc,
    _id: mappings.logs[doc._id.toString()],
    utilisateur: doc.utilisateur ? remapId('users', doc.utilisateur) : doc.utilisateur,
  }));

  // --- icones (pas de références) ---
  await migrerCollection(db, 'icones', mappings, (doc) => ({
    ...doc,
    _id: mappings.icones[doc._id.toString()],
  }));

  console.log('\n✅ Migration terminée avec succès. Tous les _id sont maintenant des UUID.');
  console.log('👉 Vous pouvez maintenant déployer les nouveaux modèles Mongoose (avec _id: String).');

  await client.close();
}

async function migrerCollection(db, nomCollection, mappings, transformer) {
  const collection = db.collection(nomCollection);
  const anciensDocs = await collection.find({}).toArray();

  if (anciensDocs.length === 0) {
    console.log(`⏭️  "${nomCollection}" est vide, rien à migrer.`);
    return;
  }

  const nouveauxDocs = anciensDocs.map(transformer);

  // Supprime les anciens documents, insère les nouveaux
  await collection.deleteMany({});
  await collection.insertMany(nouveauxDocs);

  console.log(`✅ "${nomCollection}" migré : ${nouveauxDocs.length} document(s) réécrit(s) avec un nouvel UUID.`);
}

main().catch(err => {
  console.error('❌ Erreur durant la migration :', err);
  process.exit(1);
});