-- ============================================================
-- Schéma SQLite local — Boutique Stock (mode desktop / hors-ligne)
-- Miroir des collections MongoDB, avec colonnes de synchronisation.
--
-- Convention pour chaque table métier :
--   id            TEXT PRIMARY KEY   -- même UUID que côté serveur (voir migration)
--   ...champs métier identiques au modèle Mongoose...
--   created_at    TEXT               -- ISO 8601
--   updated_at    TEXT               -- ISO 8601
--   is_dirty      INTEGER DEFAULT 0  -- 1 = modifié localement, à pousser vers le serveur
--   is_deleted    INTEGER DEFAULT 0  -- 1 = suppression locale en attente de synchro
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- Boutiques ----------
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

-- ---------- Utilisateurs ----------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  mot_de_passe  TEXT NOT NULL,
  role          TEXT DEFAULT 'vendeur' CHECK (role IN ('superadmin', 'admin', 'vendeur')),
  boutique_id   TEXT REFERENCES boutiques(id),
  actif         INTEGER DEFAULT 1,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

-- ---------- Clients ----------
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

-- ---------- Fournisseurs ----------
CREATE TABLE IF NOT EXISTS fournisseurs (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  telephone     TEXT,
  email         TEXT,
  adresse       TEXT,
  date_ajout    TEXT,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

-- Relation Fournisseur <-> Produits (array côté Mongo => table de jonction ici)
CREATE TABLE IF NOT EXISTS fournisseur_produits (
  fournisseur_id  TEXT NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
  produit_id      TEXT NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  PRIMARY KEY (fournisseur_id, produit_id)
);

-- ---------- Produits ----------
CREATE TABLE IF NOT EXISTS produits (
  id            TEXT PRIMARY KEY,
  nom           TEXT NOT NULL,
  description   TEXT,
  prix          REAL NOT NULL,
  quantite      INTEGER NOT NULL DEFAULT 0,
  categorie     TEXT NOT NULL,
  fournisseur   TEXT REFERENCES fournisseurs(id),
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

-- ---------- Ventes ----------
CREATE TABLE IF NOT EXISTS ventes (
  id             TEXT PRIMARY KEY,
  montant_total  REAL NOT NULL,
  type_vente     TEXT DEFAULT 'presentiel' CHECK (type_vente IN ('en_ligne', 'presentiel')),
  vendeur        TEXT REFERENCES users(id),
  nom_vendeur    TEXT,
  client_nom     TEXT DEFAULT 'Client anonyme',
  num_facture    TEXT,
  boutique_id    TEXT REFERENCES boutiques(id),
  date_vente     TEXT,
  notes          TEXT,
  created_at     TEXT,
  updated_at     TEXT,
  is_dirty       INTEGER DEFAULT 0,
  is_deleted     INTEGER DEFAULT 0
);

-- Lignes de produits d'une vente (array côté Mongo => table de jonction ici)
CREATE TABLE IF NOT EXISTS vente_produits (
  id              TEXT PRIMARY KEY,   -- id de ligne local (UUID généré localement)
  vente_id        TEXT NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  produit_id      TEXT NOT NULL REFERENCES produits(id),
  quantite        INTEGER NOT NULL,
  prix_unitaire   REAL NOT NULL
);

-- ---------- Mouvements de stock ----------
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id             TEXT PRIMARY KEY,
  produit        TEXT NOT NULL REFERENCES produits(id),
  boutique_id    TEXT NOT NULL REFERENCES boutiques(id),
  type           TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  quantite       INTEGER NOT NULL,
  stock_restant  INTEGER NOT NULL,
  note           TEXT DEFAULT '',
  created_at     TEXT,
  updated_at     TEXT,
  is_dirty       INTEGER DEFAULT 0,
  is_deleted     INTEGER DEFAULT 0
);

-- ---------- Logs d'activité ----------
CREATE TABLE IF NOT EXISTS logs (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  message         TEXT NOT NULL,
  utilisateur     TEXT REFERENCES users(id),
  nom_utilisateur TEXT DEFAULT 'Inconnu',
  niveau          TEXT DEFAULT 'info' CHECK (niveau IN ('info', 'success', 'error')),
  created_at      TEXT,
  updated_at      TEXT,
  is_dirty        INTEGER DEFAULT 0,
  is_deleted      INTEGER DEFAULT 0
);

-- ---------- Icônes ----------
CREATE TABLE IF NOT EXISTS icones (
  id            TEXT PRIMARY KEY,
  cle           TEXT NOT NULL UNIQUE,
  valeur        TEXT NOT NULL,
  categorie     TEXT NOT NULL,
  description   TEXT,
  created_at    TEXT,
  updated_at    TEXT,
  is_dirty      INTEGER DEFAULT 0,
  is_deleted    INTEGER DEFAULT 0
);

-- ============================================================
-- Tables techniques de synchronisation
-- ============================================================

-- File d'attente des actions faites hors-ligne, à rejouer vers le serveur
-- dès que la connexion est rétablie (traitées dans l'ordre, FIFO).
CREATE TABLE IF NOT EXISTS sync_outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  collection      TEXT NOT NULL,        -- ex: 'ventes', 'produits'...
  operation       TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  record_id       TEXT NOT NULL,        -- l'id du document concerné
  payload         TEXT,                 -- JSON du document (pour create/update)
  created_at      TEXT NOT NULL,
  attempts        INTEGER DEFAULT 0,
  last_error      TEXT,
  synced          INTEGER DEFAULT 0     -- 1 = déjà traité avec succès
);

-- Horodatage de la dernière synchronisation réussie, par collection.
-- Permet de ne récupérer (pull) que ce qui a changé depuis la dernière fois.
CREATE TABLE IF NOT EXISTS sync_meta (
  collection        TEXT PRIMARY KEY,
  last_synced_at    TEXT
);

-- Initialisation des collections connues (dates nulles = jamais synchronisé)
INSERT OR IGNORE INTO sync_meta (collection, last_synced_at) VALUES
  ('boutiques', NULL),
  ('users', NULL),
  ('clients', NULL),
  ('fournisseurs', NULL),
  ('produits', NULL),
  ('ventes', NULL),
  ('mouvements_stock', NULL),
  ('logs', NULL),
  ('icones', NULL);