// Migrations légères pour la base SQLite locale de l'APK, exécutées à chaque
// démarrage (idempotentes) — même esprit que desktop/local-db/migrations.js.
//
// schema.js utilise `CREATE TABLE IF NOT EXISTS`, ce qui crée bien les
// nouvelles tables sur un appareil déjà installé, mais ne modifie JAMAIS une
// table déjà créée (ni pour ajouter une colonne, ni pour changer une
// contrainte CHECK). Ce fichier comble cet écart pour les appareils qui ont
// déjà lancé une version antérieure de l'appli.
//
// Vide pour l'instant : le schéma mobile est neuf (aucun appareil n'a encore
// installé de version antérieure). Chaque futur changement de schéma ajoute
// ici une fonction sur le modèle de celles de desktop/local-db/migrations.js
// (vérification idempotente puis ALTER TABLE / reconstruction si nécessaire),
// ajoutée à la liste dans executerMigrations().

export async function colonneExiste(sqlite, database, table, colonne) {
  const { values } = await sqlite.query({ database, statement: `PRAGMA table_info(${table})` });
  return (values || []).some(c => c.name === colonne);
}

// eslint-disable-next-line no-unused-vars
export async function executerMigrations(sqlite, database) {
  // (liste vide pour l'instant — voir commentaire ci-dessus)
}
