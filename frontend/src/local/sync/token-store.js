// Stockage des tokens en ligne (réels JWT), un par utilisateur local connu —
// PAS un fichier session-sync.json unique comme desktop/sync/token-store.js.
//
// C'est un choix délibéré, pas un oubli : côté desktop, une session UNIQUE
// partagée par tout le moteur de synchro a causé plusieurs bugs réels cette
// session (une mutation d'un vendeur poussée sous l'identité d'un admin
// resté connecté, ou l'inverse, selon qui s'est connecté EN DERNIER sur le
// poste — voir desktop/routes/auth.js, rafraichirSessionSyncEnArrierePlan).
// Sur mobile, chaque item de sync_outbox porte déjà sa propre auteur_id (voir
// local-db/schema.js) : push.js peut donc résoudre le VRAI token de l'auteur
// réel de CHAQUE mutation, au lieu de faire confiance à "la session active
// en ce moment".
//
// Stocké dans la base SQLite locale elle-même (table sessions_sync) plutôt
// que dans un fichier séparé : un seul mécanisme de stockage persistant à
// gérer côté mobile, pas deux.

import { lancer, interrogerUne, interroger } from '../../local-db/db';

const maintenant = () => new Date().toISOString();

// Enregistre (ou remplace) le token en ligne connu pour un utilisateur local
// donné — appelé après chaque login/refresh réussi EN LIGNE (voir
// local/services/auth.js, Phase 5).
export async function enregistrerSession(userId, { token, nom, role, boutiqueId, caisseId }) {
  await lancer(
    `INSERT INTO sessions_sync (user_id, token, nom, role, boutique_id, caisse_id, enregistre_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       token = excluded.token, nom = excluded.nom, role = excluded.role,
       boutique_id = excluded.boutique_id, caisse_id = excluded.caisse_id,
       enregistre_le = excluded.enregistre_le`,
    [userId, token, nom || '', role || '', boutiqueId || null, caisseId || null, maintenant()]
  );
}

// Session connue pour UN utilisateur précis (résolution par auteur_id d'un
// item d'outbox) — ou undefined si cet utilisateur ne s'est jamais connecté
// en ligne depuis cet appareil.
export async function lireSession(userId) {
  if (!userId) return undefined;
  return interrogerUne('SELECT * FROM sessions_sync WHERE user_id = ?', [userId]);
}

// Toutes les sessions connues (utile au scheduler pour rafraîchir chaque
// token avant expiration — voir Phase 3/AuthContext.js, même mécanisme que
// desktop/sync/scheduler.js mais pour plusieurs utilisateurs à la fois).
export async function listerSessions() {
  return interroger('SELECT * FROM sessions_sync');
}

export async function effacerSession(userId) {
  await lancer('DELETE FROM sessions_sync WHERE user_id = ?', [userId]);
}
