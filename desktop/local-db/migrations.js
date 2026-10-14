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

// users a été créée, sur les postes existants, sans la colonne caisse_id
// (ajoutée avec le support des Caisses). Simple ALTER TABLE ADD COLUMN.
function migrerUsersVersCaisse(db) {
  if (colonneExiste(db, 'users', 'caisse_id')) return;
  console.log('🔧 Migration : ajout de caisse_id à users...');
  db.exec(`ALTER TABLE users ADD COLUMN caisse_id TEXT REFERENCES caisses(id)`);
  console.log('✅ Migration users (caisse_id) terminée.');
}

// ventes a été créée, sur les postes existants, sans la colonne caisse_id
// (nécessaire pour calculer le solde d'UNE caisse précise — un comptoir
// peut avoir plusieurs caisses). Simple ALTER TABLE ADD COLUMN.
function migrerVentesVersCaisse(db) {
  if (colonneExiste(db, 'ventes', 'caisse_id')) return;
  console.log('🔧 Migration : ajout de caisse_id à ventes...');
  db.exec(`ALTER TABLE ventes ADD COLUMN caisse_id TEXT REFERENCES caisses(id)`);
  console.log('✅ Migration ventes (caisse_id) terminée.');
}

// boutiques a été créée, sur les postes existants, sans la colonne niu
// (Numéro d'Identifiant Unique, affiché sur les factures). Simple ALTER
// TABLE ADD COLUMN.
function migrerBoutiquesVersNiu(db) {
  if (colonneExiste(db, 'boutiques', 'niu')) return;
  console.log('🔧 Migration : ajout de niu à boutiques...');
  db.exec(`ALTER TABLE boutiques ADD COLUMN niu TEXT DEFAULT ''`);
  console.log('✅ Migration boutiques (niu) terminée.');
}

// boutiques a été créée, sur les postes existants, sans la colonne activite
// (secteur d'activité, affiché sur les factures). Simple ALTER TABLE ADD COLUMN.
function migrerBoutiquesVersActivite(db) {
  if (colonneExiste(db, 'boutiques', 'activite')) return;
  console.log('🔧 Migration : ajout de activite à boutiques...');
  db.exec(`ALTER TABLE boutiques ADD COLUMN activite TEXT DEFAULT ''`);
  console.log('✅ Migration boutiques (activite) terminée.');
}

// users a été créée, sur les postes existants, sans la colonne
// doit_changer_mot_de_passe (forcer le remplacement d'un mot de passe
// temporaire posé par le super admin). Simple ALTER TABLE ADD COLUMN.
function migrerUsersVersDoitChangerMotDePasse(db) {
  if (colonneExiste(db, 'users', 'doit_changer_mot_de_passe')) return;
  console.log('🔧 Migration : ajout de doit_changer_mot_de_passe à users...');
  db.exec(`ALTER TABLE users ADD COLUMN doit_changer_mot_de_passe INTEGER DEFAULT 0`);
  console.log('✅ Migration users (doit_changer_mot_de_passe) terminée.');
}

// Avant la 1.0.30, POST /api/produits (desktop) créait les produits avec
// boutique_id = NULL (voir routes/produits.js) : enregistrés, mais
// invisibles dans la liste, filtrée par boutique. On les rattache :
//  1. à la boutique du magasin qui porte leur stock, quand il y en a un ;
//  2. sinon à l'unique boutique du poste — seulement s'il n'y en a qu'une,
//     pour ne jamais deviner entre plusieurs boutiques.
// Les payloads encore en attente dans sync_outbox sont corrigés aussi, pour
// que le serveur en ligne reçoive la bonne boutique.
function reparerProduitsSansBoutique(db) {
  const orphelins = db.prepare('SELECT id FROM produits WHERE boutique_id IS NULL').all();
  if (orphelins.length === 0) return;

  const viaMagasin = db.prepare(`
    SELECT m.boutique_id FROM stock_magasins sm
    JOIN magasins m ON m.id = sm.magasin_id
    WHERE sm.produit_id = ? AND m.boutique_id IS NOT NULL
    LIMIT 1
  `);
  const boutiques = db.prepare('SELECT id FROM boutiques WHERE is_deleted = 0').all();
  const boutiqueUnique = boutiques.length === 1 ? boutiques[0].id : null;

  const majProduit = db.prepare('UPDATE produits SET boutique_id = ? WHERE id = ?');
  const outboxEnAttente = db.prepare(`
    SELECT id, payload FROM sync_outbox
    WHERE collection = 'produits' AND record_id = ? AND synced = 0 AND payload IS NOT NULL
  `);
  const majOutbox = db.prepare('UPDATE sync_outbox SET payload = ? WHERE id = ?');

  let repares = 0;
  db.transaction(() => {
    for (const { id } of orphelins) {
      const boutiqueId = viaMagasin.get(id)?.boutique_id || boutiqueUnique;
      if (!boutiqueId) continue;
      majProduit.run(boutiqueId, id);
      for (const entree of outboxEnAttente.all(id)) {
        try {
          const payload = JSON.parse(entree.payload);
          if (!payload.boutiqueId) {
            payload.boutiqueId = boutiqueId;
            majOutbox.run(JSON.stringify(payload), entree.id);
          }
        } catch {
          // payload illisible : laissé tel quel
        }
      }
      repares++;
    }
  })();

  if (repares > 0) console.log(`✅ Réparation : ${repares} produit(s) sans boutique rattaché(s) à leur boutique.`);
  if (repares < orphelins.length) {
    console.warn(`⚠️ ${orphelins.length - repares} produit(s) sans boutique non rattaché(s) (boutique impossible à déterminer).`);
  }
}

function executerMigrations(db) {
  migrerMouvementsStockVersComptoirs(db);
  migrerVentesVersComptoirs(db);
  migrerMouvementsStockVersMagasins(db);
  migrerUsersVersPhoto(db);
  migrerUsersVersCaisse(db);
  migrerVentesVersCaisse(db);
  migrerBoutiquesVersNiu(db);
  migrerBoutiquesVersActivite(db);
  migrerUsersVersDoitChangerMotDePasse(db);
  reparerProduitsSansBoutique(db);
}

module.exports = { executerMigrations };