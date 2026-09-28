import { SCHEMA_SQL } from './schema';
import { executerMigrations } from './migrations';

// Accès à la base SQLite locale sur l'APK Android (plugin natif Capacitor
// @capacitor-community/sqlite). Même convention que Sauvegarde.js /
// EditeurPhotoProfil.js pour les plugins Capacitor : pas d'import npm dans le
// bundle frontend partagé (web/desktop) — on récupère au runtime le plugin
// déjà enregistré par Capacitor. Inerte sur web/desktop (estDisponible()
// renvoie false, aucune des fonctions ci-dessous n'y est appelée).
//
// On appelle directement les méthodes "brutes" du plugin (options objet :
// database/statements/statement/values...), pas la classe JS SQLiteConnection
// du paquet npm (laquelle n'est utile que si l'on gère plusieurs bases ou
// plusieurs plateformes à la fois — inutile ici, un seul fichier, Android
// uniquement).

const NOM_BASE = 'boutique_stock_local';

export const estDisponible = () =>
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

function plugin() {
  if (!estDisponible()) return null;
  return window.Capacitor.registerPlugin('CapacitorSQLite');
}

let ouverture = null;

// Ouvre (une seule fois par session de l'appli) la connexion à la base
// locale, applique le schéma puis les migrations, et retourne le plugin prêt
// à l'emploi. Idempotent : tout appelant peut faire `await getDb()` sans se
// soucier de qui a déjà ouvert la connexion.
export function getDb() {
  const sqlite = plugin();
  if (!sqlite) return Promise.reject(new Error("SQLite local indisponible (hors de l'APK)."));
  if (!ouverture) {
    ouverture = (async () => {
      await sqlite.createConnection({ database: NOM_BASE, encrypted: false, mode: 'no-encryption', version: 1, readonly: false });
      await sqlite.open({ database: NOM_BASE });
      await sqlite.execute({ database: NOM_BASE, statements: SCHEMA_SQL, transaction: true });
      await executerMigrations(sqlite, NOM_BASE);
      return sqlite;
    })().catch(err => { ouverture = null; throw err; }); // un échec à l'ouverture ne doit pas bloquer définitivement les tentatives suivantes
  }
  return ouverture;
}

// Exécute un lot d'instructions SQL sans valeur de retour exploitable
// (CREATE TABLE, ALTER TABLE...).
export async function executer(statements) {
  const sqlite = await getDb();
  return sqlite.execute({ database: NOM_BASE, statements, transaction: true });
}

// INSERT/UPDATE/DELETE paramétré. Retourne { changes, lastId }.
export async function lancer(statement, valeurs = []) {
  const sqlite = await getDb();
  const { changes } = await sqlite.run({ database: NOM_BASE, statement, values: valeurs, transaction: true });
  return changes || { changes: 0 };
}

// SELECT paramétré. Retourne un tableau de lignes (objets {colonne: valeur}).
export async function interroger(statement, valeurs = []) {
  const sqlite = await getDb();
  const { values } = await sqlite.query({ database: NOM_BASE, statement, values: valeurs });
  return values || [];
}

// Une seule ligne, ou undefined (raccourci pratique, même esprit que
// better-sqlite3's .get() côté desktop).
export async function interrogerUne(statement, valeurs = []) {
  const lignes = await interroger(statement, valeurs);
  return lignes[0];
}
