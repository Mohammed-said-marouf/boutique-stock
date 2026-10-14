// Migrations légères pour la base SQLite locale de l'APK, exécutées à chaque
// démarrage (idempotentes) — même esprit que desktop/local-db/migrations.js.
//
// schema.js utilise `CREATE TABLE IF NOT EXISTS`, ce qui crée bien les
// nouvelles tables sur un appareil déjà installé, mais ne modifie JAMAIS une
// table déjà créée (ni pour ajouter une colonne, ni pour changer une
// contrainte CHECK). Ce fichier comble cet écart pour les appareils qui ont
// déjà lancé une version antérieure de l'appli.
//
// Chaque changement de schéma ajoute ici une fonction sur le modèle de celles
// de desktop/local-db/migrations.js (vérification idempotente puis ALTER
// TABLE / reconstruction si nécessaire), ajoutée à executerMigrations().

export async function colonneExiste(sqlite, database, table, colonne) {
  const { values } = await sqlite.query({ database, statement: `PRAGMA table_info(${table})` });
  return (values || []).some(c => c.name === colonne);
}

// sessions_sync a été créée, sur les APK de test du spike, sans user_json
// (objet "user" gardé pour la connexion hors-ligne, voir local/services/auth.js).
async function migrerSessionsVersUserJson(sqlite, database) {
  if (await colonneExiste(sqlite, database, 'sessions_sync', 'user_json')) return;
  await sqlite.execute({ database, statements: 'ALTER TABLE sessions_sync ADD COLUMN user_json TEXT', transaction: true });
}

export async function executerMigrations(sqlite, database) {
  await migrerSessionsVersUserJson(sqlite, database);
}
