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
  -- URL Cloudinary (comme en ligne) une fois synchronisée, ou chemin local
  -- /uploads/... si changée depuis ce poste hors-ligne (voir routes/users.js).
  photo         TEXT,
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

-- ---------- Comptoirs (points de vente au sein d'une boutique) ----------
-- Le stock de chaque produit à un comptoir donné est dans stock_comptoirs
-- (voir plus bas), pas ici — cette table ne décrit que le comptoir lui-même.
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

-- ---------- Magasins (réserves rattachées au Compte, pas à une boutique) ----------
-- Un même Magasin peut alimenter n'importe quelle boutique du Compte. Le
-- stock de chaque produit dans CE magasin est dans stock_magasins (voir
-- plus bas), pas ici — cette table ne décrit que le magasin lui-même.
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

-- ---------- Produits ----------
-- IMPORTANT : "quantite" est le TOTAL du stock Magasin (réserve, pas
-- vendable tel quel), tenu à jour automatiquement = somme de
-- stock_magasins.quantite pour ce produit (recalculé à chaque écriture qui
-- touche stock_magasins — voir routes/produits.js). La répartition réelle
-- par magasin est dans stock_magasins ci-dessous (un Compte peut avoir
-- plusieurs magasins). Le stock réellement vendable (décompté à la vente)
-- est dans stock_comptoirs — un produit doit être transféré d'un Magasin
-- vers une Boutique avant de pouvoir être vendu (voir routes/produits.js,
-- endpoint POST /:id/transferer).
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

-- ---------- Stock par magasin ----------
-- Miroir de Produit.stockMagasins (array côté Mongo) => table de jonction
-- ici. Une ligne par (produit, magasin) où du stock existe. "quantite" sur
-- la table produits est toujours la somme de ces lignes pour ce produit.
CREATE TABLE IF NOT EXISTS stock_magasins (
  produit_id    TEXT NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  magasin_id    TEXT NOT NULL REFERENCES magasins(id) ON DELETE CASCADE,
  quantite      INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT,
  PRIMARY KEY (produit_id, magasin_id)
);

-- ---------- Stock par comptoir ----------
-- Miroir de Produit.stockComptoirs (array côté Mongo) => table de jonction
-- ici. Une ligne par (produit, comptoir) où du stock a déjà été transféré.
CREATE TABLE IF NOT EXISTS stock_comptoirs (
  produit_id    TEXT NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  comptoir_id   TEXT NOT NULL REFERENCES comptoirs(id) ON DELETE CASCADE,
  quantite      INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT,
  PRIMARY KEY (produit_id, comptoir_id)
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
  comptoir_id    TEXT REFERENCES comptoirs(id),
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
-- type='transfert' : mouvement Magasin -> Comptoir (magasin_id et
-- comptoir_destination remplis). type='entree'/'sortie' : mouvement sur le
-- stock d'UN magasin précis (magasin_id rempli), comptoir_destination
-- reste NULL.
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id                    TEXT PRIMARY KEY,
  produit               TEXT NOT NULL REFERENCES produits(id),
  boutique_id           TEXT NOT NULL REFERENCES boutiques(id),
  type                  TEXT NOT NULL CHECK (type IN ('entree', 'sortie', 'transfert')),
  quantite              INTEGER NOT NULL,
  stock_restant         INTEGER NOT NULL,
  magasin_id            TEXT REFERENCES magasins(id),
  comptoir_destination  TEXT REFERENCES comptoirs(id),
  note                  TEXT DEFAULT '',
  created_at            TEXT,
  updated_at            TEXT,
  is_dirty              INTEGER DEFAULT 0,
  is_deleted            INTEGER DEFAULT 0
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
-- 'stock_comptoirs' et 'stock_magasins' n'ont pas leur propre ligne : ce
-- sont des tableaux embarqués sur "produits" côté Mongo (Produit.stockComptoirs
-- / Produit.stockMagasins), synchronisés avec le produit, pas séparément.
INSERT OR IGNORE INTO sync_meta (collection, last_synced_at) VALUES
  ('boutiques', NULL),
  ('users', NULL),
  ('clients', NULL),
  ('fournisseurs', NULL),
  ('comptoirs', NULL),
  ('magasins', NULL),
  ('produits', NULL),
  ('ventes', NULL),
  ('mouvements_stock', NULL),
  ('logs', NULL),
  ('icones', NULL);