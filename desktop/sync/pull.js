/**
 * Moteur de pull — récupère les données modifiées en ligne et les
 * insère/met à jour dans la base SQLite locale.
 *
 * Première version : collections simples uniquement (pas de table de
 * jonction). "ventes" (+ vente_produits) et "users" (mot de passe non
 * renvoyé par l'API) sont volontairement exclus pour l'instant.
 *
 * Règle de non-écrasement : une ligne locale marquée is_dirty = 1
 * (modification locale pas encore poussée vers le serveur) n'est jamais
 * écrasée par le pull — elle sera réconciliée au push suivant.
 */

const db = require('../local-db/db');
const crypto = require('crypto');
const { estEnLigne, API_EN_LIGNE } = require('./connectivite');
const { lireSession } = require('./token-store');

const maintenant = () => new Date().toISOString();

function obtenirToken() {
  const session = lireSession();
  return session?.token || null;
}

async function appelApiGet(url, token) {
  const reponse = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!reponse.ok) {
    const texte = await reponse.text().catch(() => '');
    throw new Error(`HTTP ${reponse.status} — ${texte || '(réponse vide)'}`);
  }
  return reponse.json();
}

// Certains champs peuvent être populate() côté backend (objet avec _id)
// ou rester une simple chaîne d'id — on gère les deux cas.
function idRef(valeur) {
  if (valeur && typeof valeur === 'object') return valeur._id || null;
  return valeur || null;
}

// ------- Mapping par collection -------
// endpoint : route GET côté API en ligne.
// table    : table SQLite locale correspondante.
// versColonnes : transforme un objet reçu de l'API (camelCase, format
//                Mongo) vers les colonnes SQLite locales (snake_case).
// Vérifie si un enregistrement existe déjà en local dans une table donnée.
// Utilisé pour les références "souples" : plutôt que de faire échouer toute
// la ligne à cause d'une clé étrangère manquante (ex: un utilisateur pas
// encore pullé), on stocke null pour ce champ précis.
function existeLocal(table, id) {
  if (!id) return false;
  return !!db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
}

const COLLECTIONS = {
  boutiques: {
    endpoint: '/api/boutiques',
    table: 'boutiques',
    versColonnes: (item) => ({
      id: item._id,
      nom: item.nom,
      // "proprietaire" peut être populé côté backend (objet User complet)
      // plutôt qu'une simple chaîne d'id — idRef() gère les deux cas.
      // better-sqlite3 refuse de lier un objet JS brut, d'où l'erreur
      // "can only bind numbers, strings, bigints, buffers, and null".
      proprietaire: idRef(item.proprietaire),
      adresse: item.adresse || null,
      telephone: item.telephone || null,
      email: item.email || null,
      logo: item.logo || null,
      abonnement: item.abonnement || 'gratuit',
      actif: item.actif ? 1 : 0,
      created_at: item.createdAt || maintenant(),
      updated_at: item.updatedAt || maintenant(),
    }),
  },

  fournisseurs: {
    endpoint: '/api/fournisseurs',
    table: 'fournisseurs',
    versColonnes: (item) => ({
      id: item._id,
      nom: item.nom,
      telephone: item.telephone || null,
      email: item.email || null,
      adresse: item.adresse || null,
      date_ajout: item.dateAjout || item.createdAt || maintenant(),
      created_at: item.createdAt || maintenant(),
      updated_at: item.updatedAt || maintenant(),
    }),
  },

  produits: {
    endpoint: '/api/produits',
    table: 'produits',
    versColonnes: (item) => ({
      id: item._id,
      nom: item.nom,
      description: item.description || null,
      prix: item.prix,
      quantite: item.quantite ?? 0,
      categorie: item.categorie,
      fournisseur: idRef(item.fournisseur),
      boutique_id: item.boutiqueId || null,
      seuil_alerte: item.seuilAlerte ?? 5,
      ref: item.ref || null,
      image: item.image || null,
      date_ajout: item.dateAjout || item.createdAt || maintenant(),
      created_at: item.createdAt || maintenant(),
      updated_at: item.updatedAt || maintenant(),
    }),
  },

  mouvements_stock: {
    endpoint: '/api/mouvements-stock',
    table: 'mouvements_stock',
    versColonnes: (item) => ({
      id: item._id,
      produit: idRef(item.produit),
      boutique_id: item.boutiqueId,
      type: item.type,
      quantite: item.quantite,
      stock_restant: item.stockRestant,
      note: item.note || '',
      created_at: item.createdAt || maintenant(),
      updated_at: item.updatedAt || maintenant(),
    }),
  },

  logs: {
    endpoint: '/api/logs',
    table: 'logs',
    versColonnes: (item) => ({
      id: item._id,
      type: item.type,
      message: item.message,
      // Référence "souple" : si l'utilisateur référencé n'existe pas encore
      // en local (collection "users" pas encore pullée), on stocke null au
      // lieu de faire échouer toute la ligne — nom_utilisateur (dénormalisé)
      // reste disponible pour l'affichage dans tous les cas.
      utilisateur: existeLocal('users', idRef(item.utilisateur)) ? idRef(item.utilisateur) : null,
      nom_utilisateur: item.nomUtilisateur || 'Inconnu',
      niveau: item.niveau || 'info',
      created_at: item.createdAt || maintenant(),
      updated_at: item.updatedAt || maintenant(),
    }),
  },

  icones: {
    endpoint: '/api/icones',
    table: 'icones',
    versColonnes: (item) => ({
      id: item._id,
      cle: item.cle,
      valeur: item.valeur,
      categorie: item.categorie,
      description: item.description || null,
      created_at: item.createdAt || maintenant(),
      updated_at: item.updatedAt || maintenant(),
    }),
  },

  // "ventes" : nécessite de gérer aussi vente_produits (table de jonction)
  //            — traité à part, pas dans cette première version.
  // "users"  : le backend ne renvoie jamais motDePasse (.select('-motDePasse')),
  //            impossible d'insérer un nouvel utilisateur local sans mot de
  //            passe (colonne NOT NULL) — à traiter séparément.
  // "clients": volontairement laissé de côté (voir push.js).
};

// Insère ou met à jour une ligne locale. Ne touche jamais une ligne locale
// marquée is_dirty = 1 (modification locale pas encore poussée).
function upsertLigne(table, colonnes) {
  const existante = db.prepare(`SELECT is_dirty FROM ${table} WHERE id = ?`).get(colonnes.id);

  if (existante && existante.is_dirty === 1) {
    return 'ignoree_dirty';
  }

  const nomsColonnes = Object.keys(colonnes);
  const placeholders = nomsColonnes.map(c => `@${c}`).join(', ');
  const misAJour = nomsColonnes.filter(c => c !== 'id').map(c => `${c} = @${c}`).join(', ');

  if (existante) {
    db.prepare(`UPDATE ${table} SET ${misAJour}, is_dirty = 0, is_deleted = 0 WHERE id = @id`).run(colonnes);
    return 'mise_a_jour';
  }

  db.prepare(`
    INSERT INTO ${table} (${nomsColonnes.join(', ')}, is_dirty, is_deleted)
    VALUES (${placeholders}, 0, 0)
  `).run(colonnes);
  return 'creee';
}

// "ventes" a besoin d'un traitement dédié (pas générique comme les autres
// collections) car chaque vente a des lignes de produits associées dans la
// table de jonction vente_produits. Stratégie : à chaque pull, on supprime
// les anciennes lignes locales de la vente puis on réinsère les nouvelles
// depuis l'API — plus simple et plus sûr que d'essayer de faire
// correspondre les lignes une par une.
async function tirerVentes() {
  const token = obtenirToken();
  const items = await appelApiGet(`${API_EN_LIGNE}/api/ventes`, token);

  let creees = 0, misesAJour = 0, ignoreesDirty = 0, echouees = 0, lignesIgnorees = 0;
  const echantillonsErreurs = [];

  for (const item of items) {
    const venteId = item._id;
    if (!venteId) continue;

    const existante = db.prepare('SELECT is_dirty FROM ventes WHERE id = ?').get(venteId);
    if (existante && existante.is_dirty === 1) {
      ignoreesDirty++;
      continue;
    }

    // "vendeur" est populé côté API (objet User complet) — référence souple
    // comme pour logs.utilisateur : null si le compte n'existe pas encore
    // en local ("users" n'est pas encore pullé).
    const vendeurId = idRef(item.vendeur);
    const colonnesVente = {
      id: venteId,
      montant_total: item.montantTotal,
      type_vente: item.typeVente || 'presentiel',
      vendeur: existeLocal('users', vendeurId) ? vendeurId : null,
      nom_vendeur: item.nomVendeur || (item.vendeur && item.vendeur.nom) || null,
      client_nom: item.clientNom || 'Client anonyme',
      num_facture: item.numFacture || null,
      boutique_id: item.boutiqueId || null,
      date_vente: item.dateVente || item.createdAt || maintenant(),
      notes: item.notes || null,
      created_at: item.createdAt || maintenant(),
      updated_at: item.updatedAt || maintenant(),
    };

    try {
      const estNouvelle = db.transaction(() => {
        const nomsColonnes = Object.keys(colonnesVente);
        const placeholders = nomsColonnes.map(c => `@${c}`).join(', ');
        const misAJourSql = nomsColonnes.filter(c => c !== 'id').map(c => `${c} = @${c}`).join(', ');

        const nouvelle = !existante;
        if (existante) {
          db.prepare(`UPDATE ventes SET ${misAJourSql}, is_dirty = 0, is_deleted = 0 WHERE id = @id`).run(colonnesVente);
        } else {
          db.prepare(`INSERT INTO ventes (${nomsColonnes.join(', ')}, is_dirty, is_deleted) VALUES (${placeholders}, 0, 0)`).run(colonnesVente);
        }

        // Recrée les lignes de produits de cette vente.
        db.prepare('DELETE FROM vente_produits WHERE vente_id = ?').run(venteId);
        const insererLigne = db.prepare(`
          INSERT INTO vente_produits (id, vente_id, produit_id, quantite, prix_unitaire)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const ligne of (item.produits || [])) {
          const produitId = idRef(ligne.produit);
          // Une ligne dont le produit n'existe pas en local (ex: supprimé
          // depuis, ou pas encore pullé) est ignorée individuellement plutôt
          // que de faire échouer toute la vente.
          if (!produitId || !existeLocal('produits', produitId)) {
            lignesIgnorees++;
            continue;
          }
          insererLigne.run(crypto.randomUUID(), venteId, produitId, ligne.quantite, ligne.prixUnitaire);
        }

        return nouvelle;
      })();

      if (estNouvelle) creees++; else misesAJour++;
    } catch (err) {
      echouees++;
      if (echantillonsErreurs.length < 3) {
        echantillonsErreurs.push({ id: venteId, erreur: err.message });
      }
    }
  }

  db.prepare(`
    INSERT INTO sync_meta (collection, last_synced_at) VALUES (?, ?)
    ON CONFLICT(collection) DO UPDATE SET last_synced_at = excluded.last_synced_at
  `).run('ventes', maintenant());

  return {
    collection: 'ventes',
    total_recus: items.length,
    creees,
    mises_a_jour: misesAJour,
    ignorees_dirty: ignoreesDirty,
    echouees,
    lignes_produits_ignorees: lignesIgnorees,
    echantillons_erreurs: echantillonsErreurs,
  };
}

// "users" — option A : on met à jour les champs non sensibles (nom, role,
// actif, boutiqueId) des utilisateurs DÉJÀ connus en local, mais on n'en
// crée JAMAIS de nouveaux via le pull — le backend ne renvoie jamais le
// mot de passe haché (.select('-motDePasse')), donc impossible de créer un
// compte local complet sans lui. Un nouvel utilisateur n'apparaîtra en
// local que le jour où il se connecte lui-même au desktop (POST
// /api/sync/login), pas via le pull.
async function tirerUsers() {
  const token = obtenirToken();
  const items = await appelApiGet(`${API_EN_LIGNE}/api/users`, token);

  let misesAJour = 0, ignoreesAbsent = 0, ignoreesDirty = 0, echouees = 0;
  const echantillonsErreurs = [];

  for (const item of items) {
    const id = item._id;
    if (!id) continue;

    const existante = db.prepare('SELECT is_dirty FROM users WHERE id = ?').get(id);
    if (!existante) {
      ignoreesAbsent++; // ne crée jamais via le pull, voir commentaire ci-dessus
      continue;
    }
    if (existante.is_dirty === 1) {
      ignoreesDirty++;
      continue;
    }

    try {
      db.prepare(`
        UPDATE users SET
          nom = @nom,
          email = @email,
          role = @role,
          boutique_id = @boutiqueId,
          actif = @actif,
          updated_at = @updatedAt,
          is_dirty = 0
        WHERE id = @id
      `).run({
        id,
        nom: item.nom,
        email: item.email,
        role: item.role,
        boutiqueId: idRef(item.boutiqueId), // populé côté API (.populate('boutiqueId', 'nom'))
        actif: item.actif ? 1 : 0,
        updatedAt: item.updatedAt || maintenant(),
      });
      misesAJour++;
    } catch (err) {
      echouees++;
      if (echantillonsErreurs.length < 3) {
        echantillonsErreurs.push({ id, erreur: err.message });
      }
    }
  }

  db.prepare(`
    INSERT INTO sync_meta (collection, last_synced_at) VALUES (?, ?)
    ON CONFLICT(collection) DO UPDATE SET last_synced_at = excluded.last_synced_at
  `).run('users', maintenant());

  return {
    collection: 'users',
    total_recus: items.length,
    mises_a_jour: misesAJour,
    ignorees_absent: ignoreesAbsent,
    ignorees_dirty: ignoreesDirty,
    echouees,
    echantillons_erreurs: echantillonsErreurs,
  };
}

async function tirerCollection(nomCollection) {
  const config = COLLECTIONS[nomCollection];
  if (!config) throw new Error(`Collection "${nomCollection}" non prise en charge par le pull.`);

  const token = obtenirToken();
  const items = await appelApiGet(`${API_EN_LIGNE}${config.endpoint}`, token);

  let creees = 0, misesAJour = 0, ignoreesDirty = 0, echouees = 0;
  const echantillonsErreurs = [];

  for (const item of items) {
    const colonnes = config.versColonnes(item);
    if (!colonnes.id) continue; // sécurité : ignore une entrée sans id

    try {
      const resultat = upsertLigne(config.table, colonnes);
      if (resultat === 'creee') creees++;
      else if (resultat === 'mise_a_jour') misesAJour++;
      else ignoreesDirty++;
    } catch (err) {
      // Ex: clé étrangère manquante (référence à un enregistrement pas
      // encore présent en local) — on ignore cette ligne et on continue,
      // plutôt que de faire échouer toute la collection. On garde
      // quelques échantillons du vrai message pour diagnostiquer.
      echouees++;
      if (echantillonsErreurs.length < 3) {
        echantillonsErreurs.push({ id: colonnes.id, erreur: err.message });
      }
    }
  }

  db.prepare(`
    INSERT INTO sync_meta (collection, last_synced_at) VALUES (?, ?)
    ON CONFLICT(collection) DO UPDATE SET last_synced_at = excluded.last_synced_at
  `).run(nomCollection, maintenant());

  return {
    collection: nomCollection,
    total_recus: items.length,
    creees,
    mises_a_jour: misesAJour,
    ignorees_dirty: ignoreesDirty,
    echouees,
    echantillons_erreurs: echantillonsErreurs,
  };
}

async function tirerTout() {
  const enLigne = await estEnLigne();
  if (!enLigne) {
    return { statut: 'hors_ligne', message: 'Serveur en ligne injoignable — pull annulé.' };
  }

  const session = lireSession();
  if (!session || !session.token) {
    return { statut: 'non_connecte', message: 'Aucune session active — connectez-vous d\'abord.' };
  }

  const resultats = [];
  // L'ordre respecte les dépendances : boutiques avant produits, produits
  // avant mouvements_stock — utile pour limiter les échecs de clé étrangère.
  for (const nomCollection of Object.keys(COLLECTIONS)) {
    try {
      resultats.push(await tirerCollection(nomCollection));
    } catch (err) {
      resultats.push({ collection: nomCollection, erreur: err.message });
    }
  }

  // "ventes" après les collections simples : dépend de boutiques et produits
  // déjà présents en local pour limiter les lignes ignorées.
  try {
    resultats.push(await tirerVentes());
  } catch (err) {
    resultats.push({ collection: 'ventes', erreur: err.message });
  }

  // "users" : option A, met à jour les comptes déjà connus en local sans
  // jamais en créer de nouveaux (voir commentaire sur tirerUsers).
  try {
    resultats.push(await tirerUsers());
  } catch (err) {
    resultats.push({ collection: 'users', erreur: err.message });
  }

  return { statut: 'termine', resultats };
}

module.exports = { tirerTout, tirerCollection, tirerVentes, tirerUsers };