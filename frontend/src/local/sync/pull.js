// Moteur de pull — récupère les données modifiées en ligne et les
// insère/met à jour dans la base SQLite locale. Port de desktop/sync/pull.js,
// restreint aux collections nécessaires au parcours vendeur hors-ligne
// (voir le plan : boutiques, comptoirs, magasins, caisses, produits,
// depenses, versements, clients, ventes, + le profil du vendeur connecté).
// Non repris ici, hors périmètre vendeur : fournisseurs, mouvements_stock,
// logs, icones (icones a déjà son propre cache localStorage, voir
// IconesContext.js), et la liste complète des users du Compte (seul le
// profil de l'utilisateur connecté sur CET appareil est tenu à jour, via
// tirerMonProfil — un vendeur n'a pas d'écran de gestion des autres users).
//
// Même règle de non-écrasement que le desktop : une ligne locale marquée
// is_dirty = 1 (modification locale pas encore poussée) n'est jamais
// écrasée par le pull — elle sera réconciliée au push suivant.
//
// Différence structurelle avec le desktop : toutes les fonctions ici sont
// async (la base locale l'est, via @capacitor-community/sqlite), y compris
// les vérifications de référence "souple" existeLocal() — le desktop peut se
// permettre de les appeler en synchrone au milieu de la construction d'un
// objet littéral (better-sqlite3), pas nous : chaque versColonnes() est donc
// lui-même async ici.

import { interrogerUne, lancer, executerLot } from '../../local-db/db';
import { estEnLigne, API_EN_LIGNE } from './connectivite';
import { lireSession } from './token-store';
import { identiteActuelle } from '../identite';

const maintenant = () => new Date().toISOString();

// L'identité "active" pour le pull est celle de l'utilisateur actuellement
// connecté sur CET appareil (localStorage), pas une session globale — voir
// local/identite.js. Le pull mobile n'a qu'un seul utilisateur actif à la
// fois (contrairement au desktop, partagé par plusieurs comptes sur le même
// poste), donc pas besoin de la logique multi-session ici : seul push.js (à
// venir) doit résoudre une identité PAR ITEM d'outbox.
async function identiteConnectee() {
  return identiteActuelle();
}

async function obtenirToken() {
  const identite = await identiteConnectee();
  if (!identite) return null;
  const session = await lireSession(identite.id);
  return session?.token || null;
}

async function appelApiGet(url, token) {
  const reponse = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!reponse.ok) {
    const texte = await reponse.text().catch(() => '');
    throw new Error(`HTTP ${reponse.status} — ${texte || '(réponse vide)'}`);
  }
  return reponse.json();
}

// Certains champs peuvent être populate() côté backend (objet avec _id) ou
// rester une simple chaîne d'id — on gère les deux cas.
function idRef(valeur) {
  if (valeur && typeof valeur === 'object') return valeur._id || null;
  return valeur || null;
}

async function existeLocal(table, id) {
  if (!id) return false;
  return !!(await interrogerUne(`SELECT id FROM ${table} WHERE id = ?`, [id]));
}

async function metaSync(collection) {
  await lancer(
    `INSERT INTO sync_meta (collection, last_synced_at) VALUES (?, ?)
     ON CONFLICT(collection) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    [collection, maintenant()]
  );
}

// ------- Collections "génériques" (pas de table de jonction associée) -------
const COLLECTIONS = {
  comptoirs: {
    endpoint: '/api/comptoirs',
    table: 'comptoirs',
    versColonnes: async (item) => ({
      id: item._id, nom: item.nom, boutique_id: idRef(item.boutiqueId),
      actif: item.actif ? 1 : 0,
      created_at: item.dateCreation || maintenant(), updated_at: item.dateCreation || maintenant(),
    }),
  },
  magasins: {
    endpoint: '/api/magasins',
    table: 'magasins',
    versColonnes: async (item) => ({
      id: item._id, nom: item.nom, boutique_id: idRef(item.boutiqueId), adresse: item.adresse || '',
      actif: item.actif ? 1 : 0,
      created_at: item.dateCreation || maintenant(), updated_at: item.dateCreation || maintenant(),
    }),
  },
  caisses: {
    endpoint: '/api/caisses',
    table: 'caisses',
    versColonnes: async (item) => ({
      id: item._id, nom: item.nom, comptoir_id: idRef(item.comptoirId),
      actif: item.actif ? 1 : 0,
      created_at: item.dateCreation || maintenant(), updated_at: item.dateCreation || maintenant(),
    }),
  },
  // Références souples sur comptoirId/caisseId/auteur : une dépense ou un
  // versement fait ailleurs sur une caisse/un auteur pas encore connu ici
  // (rare) est ignoré individuellement plutôt que de faire échouer toute la ligne.
  depenses: {
    endpoint: '/api/depenses',
    table: 'depenses',
    versColonnes: async (item) => ({
      id: item._id, montant: item.montant, motif: item.motif, note: item.note || '',
      boutique_id: idRef(item.boutiqueId),
      comptoir_id: (await existeLocal('comptoirs', idRef(item.comptoirId))) ? idRef(item.comptoirId) : null,
      caisse_id: (await existeLocal('caisses', idRef(item.caisseId))) ? idRef(item.caisseId) : null,
      auteur: (await existeLocal('users', idRef(item.auteur))) ? idRef(item.auteur) : null,
      nom_auteur: item.nomAuteur || '', role_auteur: item.roleAuteur || '',
      date: item.date || item.createdAt || maintenant(),
      created_at: item.createdAt || maintenant(), updated_at: item.updatedAt || maintenant(),
    }),
  },
  versements: {
    endpoint: '/api/versements',
    table: 'versements',
    versColonnes: async (item) => ({
      id: item._id, montant: item.montant, note: item.note || '', statut: item.statut || 'en_attente',
      decide_par: (await existeLocal('users', idRef(item.decidePar))) ? idRef(item.decidePar) : null,
      nom_decide_par: item.nomDecidePar || '', date_decision: item.dateDecision || null, motif_refus: item.motifRefus || '',
      boutique_id: idRef(item.boutiqueId),
      comptoir_id: (await existeLocal('comptoirs', idRef(item.comptoirId))) ? idRef(item.comptoirId) : null,
      caisse_id: (await existeLocal('caisses', idRef(item.caisseId))) ? idRef(item.caisseId) : null,
      auteur: (await existeLocal('users', idRef(item.auteur))) ? idRef(item.auteur) : null,
      nom_auteur: item.nomAuteur || '',
      date: item.date || item.createdAt || maintenant(),
      created_at: item.createdAt || maintenant(), updated_at: item.updatedAt || maintenant(),
    }),
  },
  clients: {
    endpoint: '/api/clients',
    table: 'clients',
    versColonnes: async (item) => ({
      id: item._id, nom: item.nom, telephone: item.telephone || null, email: item.email || null,
      boutique_id: item.boutiqueId || null, achats: item.achats ?? 0, total: item.total ?? 0,
      created_at: item.createdAt || maintenant(), updated_at: item.updatedAt || maintenant(),
    }),
  },
};

// Insère ou met à jour une ligne locale. Ne touche jamais une ligne locale
// marquée is_dirty = 1 (modification locale pas encore poussée).
async function upsertLigne(table, colonnes) {
  const existante = await interrogerUne(`SELECT is_dirty FROM ${table} WHERE id = ?`, [colonnes.id]);
  if (existante && existante.is_dirty === 1) return 'ignoree_dirty';

  const noms = Object.keys(colonnes);
  const valeurs = noms.map(n => colonnes[n]);

  if (existante) {
    const misAJour = noms.filter(c => c !== 'id').map(c => `${c} = ?`).join(', ');
    await lancer(`UPDATE ${table} SET ${misAJour}, is_dirty = 0, is_deleted = 0 WHERE id = ?`, [...valeurs.filter((_, i) => noms[i] !== 'id'), colonnes.id]);
    return 'mise_a_jour';
  }

  const placeholders = noms.map(() => '?').join(', ');
  await lancer(`INSERT INTO ${table} (${noms.join(', ')}, is_dirty, is_deleted) VALUES (${placeholders}, 0, 0)`, valeurs);
  return 'creee';
}

async function tirerCollection(nomCollection) {
  const config = COLLECTIONS[nomCollection];
  if (!config) throw new Error(`Collection "${nomCollection}" non prise en charge par le pull.`);

  const token = await obtenirToken();
  const items = await appelApiGet(`${API_EN_LIGNE}${config.endpoint}`, token);

  let creees = 0, misesAJour = 0, ignoreesDirty = 0, echouees = 0;
  const echantillonsErreurs = [];

  for (const item of items) {
    const colonnes = await config.versColonnes(item);
    if (!colonnes.id) continue;
    try {
      const resultat = await upsertLigne(config.table, colonnes);
      if (resultat === 'creee') creees++;
      else if (resultat === 'mise_a_jour') misesAJour++;
      else ignoreesDirty++;
    } catch (err) {
      echouees++;
      if (echantillonsErreurs.length < 3) echantillonsErreurs.push({ id: colonnes.id, erreur: err.message });
    }
  }

  await metaSync(nomCollection);
  return { collection: nomCollection, total_recus: items.length, creees, mises_a_jour: misesAJour, ignorees_dirty: ignoreesDirty, echouees, echantillons_erreurs: echantillonsErreurs };
}

// "boutiques" (Comptes) : GET /api/boutiques (liste complète) n'est autorisé
// qu'au superadmin côté backend — hors périmètre vendeur, on utilise
// toujours GET /api/boutiques/:id (accessible à l'admin/au vendeur de LEUR
// PROPRE boutique).
async function tirerBoutiques() {
  const identite = await identiteConnectee();
  const token = await obtenirToken();
  let items = [];
  if (identite?.boutiqueId) {
    const item = await appelApiGet(`${API_EN_LIGNE}/api/boutiques/${identite.boutiqueId}`, token);
    if (item) items = [item];
  }

  let creees = 0, misesAJour = 0, ignoreesDirty = 0, echouees = 0;
  const echantillonsErreurs = [];
  for (const item of items) {
    const colonnes = {
      id: item._id, nom: item.nom, proprietaire: idRef(item.proprietaire),
      adresse: item.adresse || null, telephone: item.telephone || null, email: item.email || null,
      logo: item.logo || null, abonnement: item.abonnement || 'gratuit', actif: item.actif ? 1 : 0,
      created_at: item.createdAt || maintenant(), updated_at: item.updatedAt || maintenant(),
    };
    if (!colonnes.id) continue;
    try {
      const resultat = await upsertLigne('boutiques', colonnes);
      if (resultat === 'creee') creees++; else if (resultat === 'mise_a_jour') misesAJour++; else ignoreesDirty++;
    } catch (err) {
      echouees++;
      if (echantillonsErreurs.length < 3) echantillonsErreurs.push({ id: colonnes.id, erreur: err.message });
    }
  }

  await metaSync('boutiques');
  return { collection: 'boutiques', total_recus: items.length, creees, mises_a_jour: misesAJour, ignorees_dirty: ignoreesDirty, echouees, echantillons_erreurs: echantillonsErreurs };
}

// "produits" a besoin d'un traitement dédié car chaque produit a une
// répartition de stock par comptoir (tableau embarqué côté Mongo) à refléter
// dans la table de jonction locale stock_comptoirs. Contrairement au
// desktop, stock_magasins n'existe pas dans le schéma mobile (non répliqué,
// inutile côté vendeur — voir local-db/schema.js) : on l'ignore simplement.
async function tirerProduits() {
  const token = await obtenirToken();
  const items = await appelApiGet(`${API_EN_LIGNE}/api/produits`, token);

  let creees = 0, misesAJour = 0, ignoreesDirty = 0, echouees = 0;
  const echantillonsErreurs = [];

  for (const item of items) {
    const produitId = item._id;
    if (!produitId) continue;

    const existante = await interrogerUne('SELECT is_dirty FROM produits WHERE id = ?', [produitId]);
    if (existante && existante.is_dirty === 1) { ignoreesDirty++; continue; }

    try {
      const colonnes = {
        id: produitId, nom: item.nom, description: item.description || null, prix: item.prix,
        quantite: item.quantite ?? 0, categorie: item.categorie, fournisseur: idRef(item.fournisseur),
        boutique_id: item.boutiqueId || null, seuil_alerte: item.seuilAlerte ?? 5, ref: item.ref || null,
        image: item.image || null, date_ajout: item.dateAjout || item.createdAt || maintenant(),
        created_at: item.createdAt || maintenant(), updated_at: item.updatedAt || maintenant(),
      };

      const instructions = [];
      const noms = Object.keys(colonnes);
      const valeurs = noms.map(n => colonnes[n]);
      if (existante) {
        const misAJourSql = noms.filter(c => c !== 'id').map(c => `${c} = ?`).join(', ');
        instructions.push({ statement: `UPDATE produits SET ${misAJourSql}, is_dirty = 0, is_deleted = 0 WHERE id = ?`, values: [...valeurs.filter((_, i) => noms[i] !== 'id'), produitId] });
      } else {
        instructions.push({ statement: `INSERT INTO produits (${noms.join(', ')}, is_dirty, is_deleted) VALUES (${noms.map(() => '?').join(', ')}, 0, 0)`, values: valeurs });
      }

      instructions.push({ statement: 'DELETE FROM stock_comptoirs WHERE produit_id = ?', values: [produitId] });
      for (const ligne of (item.stockComptoirs || [])) {
        const comptoirId = idRef(ligne.comptoir);
        if (comptoirId && (await existeLocal('comptoirs', comptoirId))) {
          instructions.push({ statement: 'INSERT INTO stock_comptoirs (produit_id, comptoir_id, quantite, updated_at) VALUES (?, ?, ?, ?)', values: [produitId, comptoirId, ligne.quantite || 0, maintenant()] });
        }
      }

      await executerLot(instructions);
      if (existante) misesAJour++; else creees++;
    } catch (err) {
      echouees++;
      if (echantillonsErreurs.length < 3) echantillonsErreurs.push({ id: produitId, erreur: err.message });
    }
  }

  await metaSync('produits');
  return { collection: 'produits', total_recus: items.length, creees, mises_a_jour: misesAJour, ignorees_dirty: ignoreesDirty, echouees, echantillons_erreurs: echantillonsErreurs };
}

// "ventes" a besoin d'un traitement dédié (lignes de produits associées dans
// vente_produits). Stratégie identique au desktop : supprimer les anciennes
// lignes locales de la vente puis réinsérer depuis l'API.
async function tirerVentes() {
  const token = await obtenirToken();
  const items = await appelApiGet(`${API_EN_LIGNE}/api/ventes`, token);

  let creees = 0, misesAJour = 0, ignoreesDirty = 0, echouees = 0, lignesIgnorees = 0;
  const echantillonsErreurs = [];

  for (const item of items) {
    const venteId = item._id;
    if (!venteId) continue;

    const existante = await interrogerUne('SELECT is_dirty FROM ventes WHERE id = ?', [venteId]);
    if (existante && existante.is_dirty === 1) { ignoreesDirty++; continue; }

    const vendeurId = idRef(item.vendeur);
    const comptoirId = idRef(item.comptoirId);
    const caisseId = idRef(item.caisseId);
    const colonnesVente = {
      id: venteId, montant_total: item.montantTotal, type_vente: item.typeVente || 'presentiel',
      vendeur: (await existeLocal('users', vendeurId)) ? vendeurId : null,
      nom_vendeur: item.nomVendeur || (item.vendeur && item.vendeur.nom) || null,
      client_nom: item.clientNom || 'Client anonyme', num_facture: item.numFacture || null,
      boutique_id: item.boutiqueId || null,
      comptoir_id: (await existeLocal('comptoirs', comptoirId)) ? comptoirId : null,
      caisse_id: (await existeLocal('caisses', caisseId)) ? caisseId : null,
      date_vente: item.dateVente || item.createdAt || maintenant(), notes: item.notes || null,
      created_at: item.createdAt || maintenant(), updated_at: item.updatedAt || maintenant(),
    };

    try {
      const noms = Object.keys(colonnesVente);
      const valeurs = noms.map(n => colonnesVente[n]);
      const instructions = [];
      if (existante) {
        const misAJourSql = noms.filter(c => c !== 'id').map(c => `${c} = ?`).join(', ');
        instructions.push({ statement: `UPDATE ventes SET ${misAJourSql}, is_dirty = 0, is_deleted = 0 WHERE id = ?`, values: [...valeurs.filter((_, i) => noms[i] !== 'id'), venteId] });
      } else {
        instructions.push({ statement: `INSERT INTO ventes (${noms.join(', ')}, is_dirty, is_deleted) VALUES (${noms.map(() => '?').join(', ')}, 0, 0)`, values: valeurs });
      }

      instructions.push({ statement: 'DELETE FROM vente_produits WHERE vente_id = ?', values: [venteId] });
      let compteLignesIgnorees = 0;
      for (const ligne of (item.produits || [])) {
        const produitId = idRef(ligne.produit);
        if (!produitId || !(await existeLocal('produits', produitId))) { compteLignesIgnorees++; continue; }
        instructions.push({
          statement: 'INSERT INTO vente_produits (id, vente_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)',
          values: [`${venteId}-${produitId}-${Math.random().toString(16).slice(2)}`, venteId, produitId, ligne.quantite, ligne.prixUnitaire],
        });
      }

      await executerLot(instructions);
      lignesIgnorees += compteLignesIgnorees;
      if (existante) misesAJour++; else creees++;
    } catch (err) {
      echouees++;
      if (echantillonsErreurs.length < 3) echantillonsErreurs.push({ id: venteId, erreur: err.message });
    }
  }

  await metaSync('ventes');
  return { collection: 'ventes', total_recus: items.length, creees, mises_a_jour: misesAJour, ignorees_dirty: ignoreesDirty, echouees, lignes_produits_ignorees: lignesIgnorees, echantillons_erreurs: echantillonsErreurs };
}

// Rafraîchit le profil de l'utilisateur actuellement connecté SUR CET
// APPAREIL (nom/email/photo/caisse) via GET /api/users/me — seul moyen de le
// tenir à jour puisqu'un vendeur n'a pas accès à GET /api/users (liste
// complète, admin uniquement) et que ce dernier ne le concernerait de toute
// façon pas hors périmètre vendeur.
export async function tirerMonProfil() {
  const identite = await identiteConnectee();
  if (!identite?.id) return { collection: 'mon_profil', ignore: true };

  const token = await obtenirToken();
  const item = await appelApiGet(`${API_EN_LIGNE}/api/users/me`, token);

  const existante = await interrogerUne('SELECT is_dirty FROM users WHERE id = ?', [identite.id]);
  if (existante && existante.is_dirty === 1) return { collection: 'mon_profil', ignoree_dirty: true };

  const caisseId = idRef(item.caisseId);
  const colonnes = {
    nom: item.nom, email: item.email, role: item.role, boutique_id: idRef(item.boutiqueId),
    caisse_id: (await existeLocal('caisses', caisseId)) ? caisseId : null,
    photo: item.photo || null, actif: item.actif ? 1 : 0, updated_at: item.updatedAt || maintenant(),
  };

  if (existante) {
    await lancer(
      `UPDATE users SET nom = ?, email = ?, role = ?, boutique_id = ?, caisse_id = ?, photo = ?, actif = ?, updated_at = ?, is_dirty = 0 WHERE id = ?`,
      [colonnes.nom, colonnes.email, colonnes.role, colonnes.boutique_id, colonnes.caisse_id, colonnes.photo, colonnes.actif, colonnes.updated_at, identite.id]
    );
  }
  // Si l'utilisateur connecté n'existe pas encore localement, rien à faire
  // ici : c'est la connexion elle-même (Phase 5, local/services/auth.js) qui
  // l'aura créé avec toutes ses infos déjà à jour.

  return { collection: 'mon_profil', mis_a_jour: !!existante };
}

export async function tirerTout() {
  const enLigne = await estEnLigne();
  if (!enLigne) return { statut: 'hors_ligne', message: 'Serveur en ligne injoignable — pull annulé.' };

  const identite = await identiteConnectee();
  const token = await obtenirToken();
  if (!identite || !token) return { statut: 'non_connecte', message: "Aucune session active — connectez-vous d'abord." };

  const resultats = [];
  const etape = async (fn, nom) => {
    try { resultats.push(await fn()); }
    catch (err) { resultats.push({ collection: nom, erreur: err.message }); }
  };

  // Ordre important (dépendances de clé étrangère) : boutiques -> comptoirs/
  // magasins -> caisses -> produits (stock_comptoirs référence comptoirs) ->
  // dépenses/versements/clients (référencent comptoirs/caisses) -> ventes
  // (référence produits/comptoirs/caisses) -> profil.
  await etape(tirerBoutiques, 'boutiques');
  await etape(() => tirerCollection('comptoirs'), 'comptoirs');
  await etape(() => tirerCollection('magasins'), 'magasins');
  await etape(() => tirerCollection('caisses'), 'caisses');
  await etape(tirerProduits, 'produits');
  await etape(() => tirerCollection('depenses'), 'depenses');
  await etape(() => tirerCollection('versements'), 'versements');
  await etape(() => tirerCollection('clients'), 'clients');
  await etape(tirerVentes, 'ventes');
  await etape(tirerMonProfil, 'mon_profil');

  return { statut: 'termine', resultats };
}

export { tirerCollection, tirerBoutiques, tirerProduits, tirerVentes };
