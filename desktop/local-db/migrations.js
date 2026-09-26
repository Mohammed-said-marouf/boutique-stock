/**
 * Migrations légères, exécutées à chaque démarrage (idempotentes — chaque
 * étape se vérifie elle-même avant d'agir, donc rejouer ce fichier sur une
 * base déjà à jour ne fait rien).
 *
 * Pourquoi ce fichier existe : schema.sql utilise `CREATE TABLE IF NOT EXISTS`,
 * ce qui crée bien les nouvelles tables sur un poste existant, mais ne modifie
 * JAMAIS une table déjà créée (ni pour ajouter une colonne, ni pour changer une
 * contrainte CHECK). Pour les postes qui avaient déjà lancé l'app avant l'ajout
 * du système Magasin/Comptoir, on comble donc l'écart ici.
 */

function colonneExiste(db, table, colonne) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === colonne);
}

// mouvements_stock a été créée, sur les postes existants, avec
// CHECK (type IN ('entree', 'sortie')) et sans la colonne
// comptoir_destination. SQLite ne permet pas de modifier une contrainte
// CHECK existante — la seule solution fiable est de reconstruire la table
// (renommer, recréer avec le nouveau schéma, recopier les données, supprimer
// l'ancienne). On ne le fait QUE si c'est nécessaire.
function migrerMouvementsStockVersComptoirs(db) {
  const definition = db.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mouvements_stock'
  `).get();

  if (!definition) return; // table pas encore créée du tout (premier lancement) — schema.sql s'en charge

  const dejaAJour = definition.sql.includes("'transfert'") && colonneExiste(db, 'mouvements_stock', 'comptoir_destination');
  if (dejaAJour) return;

  console.log('🔧 Migration : mise à jour de mouvements_stock pour le système Magasin/Comptoir...');

  db.exec(`
    ALTER TABLE mouvements_stock RENAME TO mouvements_stock_ancien;

    CREATE TABLE mouvements_stock (
      id                    TEXT PRIMARY KEY,
      produit               TEXT NOT NULL REFERENCES produits(id),
      boutique_id           TEXT NOT NULL REFERENCES boutiques(id),
      type                  TEXT NOT NULL CHECK (type IN ('entree', 'sortie', 'transfert')),
      quantite              INTEGER NOT NULL,
      stock_restant         INTEGER NOT NULL,
      comptoir_destination  TEXT REFERENCES comptoirs(id),
      note                  TEXT DEFAULT '',
      created_at            TEXT,
      updated_at            TEXT,
      is_dirty              INTEGER DEFAULT 0,
      is_deleted            INTEGER DEFAULT 0
    );

    INSERT INTO mouvements_stock (id, produit, boutique_id, type, quantite, stock_restant, note, created_at, updated_at, is_dirty, is_deleted)
    SELECT id, produit, boutique_id, type, quantite, stock_restant, note, created_at, updated_at, is_dirty, is_deleted
    FROM mouvements_stock_ancien;

    DROP TABLE mouvements_stock_ancien;
  `);

  console.log('✅ Migration mouvements_stock terminée.');
}

// ventes a été créée, sur les postes existants, sans la colonne comptoir_id.
// Ici un simple ALTER TABLE ADD COLUMN suffit (pas de CHECK à toucher).
function migrerVentesVersComptoirs(db) {
  if (colonneExiste(db, 'ventes', 'comptoir_id')) return;
  console.log('🔧 Migration : ajout de comptoir_id à ventes...');
  db.exec(`ALTER TABLE ventes ADD COLUMN comptoir_id TEXT REFERENCES comptoirs(id)`);
  console.log('✅ Migration ventes terminée.');
}

// mouvements_stock a été créée, sur les postes existants (même après
// migrerMouvementsStockVersComptoirs), sans la colonne magasin_id (ajoutée
// avec le support des Magasins multiples). Un simple ALTER TABLE ADD
// COLUMN suffit (pas de CHECK à toucher).
function migrerMouvementsStockVersMagasins(db) {
  if (colonneExiste(db, 'mouvements_stock', 'magasin_id')) return;
  console.log('🔧 Migration : ajout de magasin_id à mouvements_stock...');
  db.exec(`ALTER TABLE mouvements_stock ADD COLUMN magasin_id TEXT REFERENCES magasins(id)`);
  console.log('✅ Migration mouvements_stock (magasin_id) terminée.');
}

// users a été créée, sur les postes existants, sans la colonne photo
// (ajoutée avec le support des photos de profil). Simple ALTER TABLE ADD
// COLUMN (pas de CHECK à toucher).
function migrerUsersVersPhoto(db) {
  if (colonneExiste(db, 'users', 'photo')) return;
  console.log('🔧 Migration : ajout de photo à users...');
  db.exec(`ALTER TABLE users ADD COLUMN photo TEXT`);
  console.log('✅ Migration users (photo) terminée.');
}

function executerMigrations(db) {
  migrerMouvementsStockVersComptoirs(db);
  migrerVentesVersComptoirs(db);
  migrerMouvementsStockVersMagasins(db);
  migrerUsersVersPhoto(db);
}

module.exports = { executerMigrations };