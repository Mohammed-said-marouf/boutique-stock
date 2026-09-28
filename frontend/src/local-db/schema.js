// ============================================================
// Schéma SQLite local — APK Android, périmètre vendeur.
// Port de desktop/local-db/schema.sql (voir ce fichier pour le schéma complet
// desktop) restreint aux tables nécessaires au parcours vendeur hors-ligne :
// vendre, consulter son catalogue/ses clients/ses factures, gérer sa
// trésorerie (dépenses/versements). Les tables admin-only du desktop
// (fournisseurs, mouvements_stock, logs, icones...) ne sont pas répliquées
// ici — le vendeur ne les modifie jamais et n'en a pas besoin hors-ligne.
//
// Même convention que le desktop pour chaque table métier :
//   id            TEXT PRIMARY KEY   -- même UUID que côté serveur
//   ...champs métier identiques au modèle Mongoose...
//   created_at / updated_at         -- ISO 8601
//   is_dirty      INTEGER DEFAULT 0  -- 1 = modifié localement, à pousser
//   is_deleted    INTEGER DEFAULT 0  -- 1 = suppression locale en attente
// ============================================================

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS boutiques (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  proprietaire  TEXT,
  adresse       TEXT,
  telephone     TEXT,
  email         TEXT,
  logo          TEXT,
  abonnement    TEXT DEFAULT 'gratuit' CHECK (abonnement IN ('gratuit', 'standard', 'premium')),
  actif         INTEGER DEFAULT 1,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  mot_de_passe  TEXT NOT NULL,
  role          TEXT DEFAULT 'vendeur' CHECK (role IN ('superadmin', 'admin', 'vendeur')),
  boutique_id   TEXT REFERENCES boutiques(id),
  caisse_id     TEXT REFERENCES caisses(id),
  photo         TEXT,
  actif         INTEGER DEFAULT 1,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clients (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  telephone     TEXT,
  email         TEXT,
  boutique_id   TEXT NOT NULL REFERENCES boutiques(id),
  achats        INTEGER DEFAULT 0,
  total         REAL DEFAULT 0,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

-- Comptoirs (points de vente au sein d'une boutique) : le vendeur ne les
-- modifie jamais, mais doit connaître le sien pour afficher son stock.
CREATE TABLE IF NOT EXISTS comptoirs (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  boutique_id   TEXT NOT NULL REFERENCES boutiques(id),
  actif         INTEGER DEFAULT 1,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

-- Magasins : jamais affichés ni modifiés côté vendeur, mais référencés par
-- stock_magasins/produits.quantite côté serveur — répliqués en lecture
-- seule pour ne pas casser les jointures lors du pull.
CREATE TABLE IF NOT EXISTS magasins (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  boutique_id   TEXT NOT NULL REFERENCES boutiques(id),
  adresse       TEXT DEFAULT '',
  actif         INTEGER DEFAULT 1,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

-- Caisses : ne portent aucun stock. Sert à assigner le vendeur
-- (users.caisse_id) et à tracer d'où vient chaque vente/dépense/versement.
CREATE TABLE IF NOT EXISTS caisses (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  comptoir_id   TEXT NOT NULL REFERENCES comptoirs(id),
  actif         INTEGER DEFAULT 1,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS depenses (
  id            TEXT PRIMARY KEY,
  montant       REAL NOT NULL,
  motif         TEXT NOT NULL,
  note          TEXT DEFAULT '',
  boutique_id   TEXT NOT NULL REFERENCES boutiques(id),
  comptoir_id   TEXT NOT NULL REFERENCES comptoirs(id),
  caisse_id     TEXT NOT NULL REFERENCES caisses(id),
  auteur        TEXT REFERENCES users(id),
  nom_auteur    TEXT DEFAULT '',
  role_auteur   TEXT DEFAULT '',
  date          TEXT,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS versements (
  id              TEXT PRIMARY KEY,
  montant         REAL NOT NULL,
  note            TEXT DEFAULT '',
  statut          TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'valide', 'refuse')),
  decide_par      TEXT REFERENCES users(id),
  nom_decide_par  TEXT DEFAULT '',
  date_decision   TEXT,
  motif_refus     TEXT DEFAULT '',
  boutique_id     TEXT NOT NULL REFERENCES boutiques(id),
  comptoir_id     TEXT NOT NULL REFERENCES comptoirs(id),
  caisse_id       TEXT NOT NULL REFERENCES caisses(id),
  auteur          TEXT REFERENCES users(id),
  nom_auteur      TEXT DEFAULT '',
  date            TEXT,
  created_at      TEXT,
  updated_at      TEXT,
  is_dirty        INTEGER DEFAULT 0,
  is_deleted      INTEGER DEFAULT 0
);

-- "quantite" = total du stock Magasin (réserve, pas vendable) ; le stock
-- réellement vendable par le vendeur est dans stock_comptoirs ci-dessous.
CREATE TABLE IF NOT EXISTS produits (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  description   TEXT,
  prix          REAL NOT NULL,
  quantite      INTEGER NOT NULL DEFAULT 0,
  categorie     TEXT NOT NULL,
  fournisseur   TEXT,
  boutique_id   TEXT REFERENCES boutiques(id),
  seuil_alerte  INTEGER DEFAULT 5,
  ref           TEXT,
  image         TEXT,
  date_ajout    TEXT,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

-- Stock vendable d'un produit DANS une boutique donnée (voir
-- CaisseVendeur.stockBoutiqueDe côté frontend) — c'est celui qui compte pour
-- la vente, jamais produits.quantite (stock Magasin, réserve).
CREATE TABLE IF NOT EXISTS stock_comptoirs (
  produit_id    TEXT NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  comptoir_id   TEXT NOT NULL REFERENCES comptoirs(id) ON DELETE CASCADE,
  quantite      INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT,
  PRIMARY KEY (produit_id, comptoir_id)
);

CREATE TABLE IF NOT EXISTS ventes (
  id             TEXT PRIMARY KEY,
  montant_total  REAL NOT NULL,
  type_vente     TEXT DEFAULT 'presentiel' CHECK (type_vente IN ('en_ligne', 'presentiel')),
  vendeur        TEXT REFERENCES users(id),
  nom_vendeur    TEXT,
  client_nom     TEXT DEFAULT 'Client anonyme',
  num_facture    TEXT,
  boutique_id    TEXT REFERENCES boutiques(id),
  comptoir_id    TEXT REFERENCES comptoirs(id),
  caisse_id      TEXT REFERENCES caisses(id),
  date_vente     TEXT,
  notes          TEXT,
  created_at     TEXT,
  updated_at     TEXT,
  is_dirty       INTEGER DEFAULT 0,
  is_deleted     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vente_produits (
  id              TEXT PRIMARY KEY,
  vente_id        TEXT NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  produit_id      TEXT NOT NULL REFERENCES produits(id),
  quantite        INTEGER NOT NULL,
  prix_unitaire   REAL NOT NULL
);

-- ============================================================
-- Tables techniques de synchronisation (identiques au desktop)
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  collection      TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  record_id       TEXT NOT NULL,
  payload         TEXT,
  auteur_id       TEXT,
  created_at      TEXT NOT NULL,
  attempts        INTEGER DEFAULT 0,
  last_error      TEXT,
  synced          INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_meta (
  collection        TEXT PRIMARY KEY,
  last_synced_at    TEXT
);

-- Un token en ligne (réel JWT) PAR utilisateur local connu, plutôt qu'une
-- session unique partagée par tout le moteur de synchro (c'est cette session
-- unique, côté desktop, qui a causé plusieurs bugs cette session : une
-- mutation poussée sous la mauvaise identité quand un autre utilisateur
-- s'était connecté entre-temps). push.js résout le token à utiliser pour
-- CHAQUE item de sync_outbox via sync_outbox.auteur_id -> sessions_sync.user_id,
-- jamais via "la session active en ce moment".
CREATE TABLE IF NOT EXISTS sessions_sync (
  user_id         TEXT PRIMARY KEY,
  token           TEXT NOT NULL,
  nom             TEXT,
  role            TEXT,
  boutique_id     TEXT,
  caisse_id       TEXT,
  enregistre_le   TEXT
);

INSERT OR IGNORE INTO sync_meta (collection, last_synced_at) VALUES
  ('boutiques', NULL),
  ('users', NULL),
  ('clients', NULL),
  ('comptoirs', NULL),
  ('magasins', NULL),
  ('caisses', NULL),
  ('depenses', NULL),
  ('versements', NULL),
  ('produits', NULL),
  ('ventes', NULL);
`;
