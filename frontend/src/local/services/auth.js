// Connexion hors-ligne de l'APK Android — équivalent de la connexion locale
// du desktop (desktop/routes/auth.js), adapté au fait que le téléphone n'a
// pas de copie des comptes : il ne connaît QUE les comptes qui s'y sont déjà
// connectés EN LIGNE au moins une fois.
//
// À chaque connexion en ligne réussie (memoriserCompte), on garde :
//  - dans users : le profil + une empreinte PBKDF2 du mot de passe (sel
//    aléatoire, jamais le mot de passe en clair) ;
//  - dans sessions_sync : le dernier token en ligne et l'objet "user" tel que
//    renvoyé par le serveur (pour restaurer exactement la même session).
// Sans réseau, connexionHorsLigne vérifie le mot de passe contre cette
// empreinte et rend la session mémorisée. Son token peut avoir expiré : il
// suffit pour identifier l'utilisateur localement (local/identite.js ne
// vérifie pas l'expiration), et la synchro demandera une reconnexion en
// ligne dès que le serveur sera joignable (voir sync/scheduler.js).

import { interrogerUne, lancer } from '../../local-db/db';
import { enregistrerSession, lireSession } from '../sync/token-store';

const ITERATIONS = 100000;
const maintenant = () => new Date().toISOString();

const versHex = (octets) => Array.from(new Uint8Array(octets), o => o.toString(16).padStart(2, '0')).join('');
const depuisHex = (hex) => Uint8Array.from(hex.match(/.{2}/g) || [], h => parseInt(h, 16));

async function deriver(motDePasse, sel, iterations) {
  const cle = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await window.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, cle, 256);
  return versHex(bits);
}

async function empreinte(motDePasse) {
  const sel = window.crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${versHex(sel)}$${await deriver(motDePasse, sel, ITERATIONS)}`;
}

async function verifier(motDePasse, stocke) {
  const [algo, iterations, selHex, attendu] = String(stocke || '').split('$');
  if (algo !== 'pbkdf2' || !attendu) return false;
  return (await deriver(motDePasse, depuisHex(selHex), Number(iterations))) === attendu;
}

const normaliserEmail = (email) => String(email || '').trim().toLowerCase();

// Appelé par AuthContext après une connexion EN LIGNE réussie.
export async function memoriserCompte(email, motDePasse, token, user) {
  const id = user?.id || user?._id;
  if (!id) return;
  const boutiqueId = user.boutique?._id || user.boutique || null;
  const caisseId = user.caisseId || null;
  // boutique/caisse sont des clés étrangères : on ne les renseigne que si
  // elles existent déjà localement (au tout premier login elles n'arrivent
  // qu'avec la synchro qui suit — tirerMonProfil complète alors la ligne).
  const boutiqueLocale = boutiqueId && (await interrogerUne('SELECT id FROM boutiques WHERE id = ?', [boutiqueId]));
  const caisseLocale = caisseId && (await interrogerUne('SELECT id FROM caisses WHERE id = ?', [caisseId]));
  const emailNormalise = normaliserEmail(email || user.email);
  const ts = maintenant();

  // Un autre compte local avec le même email (recréé côté serveur) : on le
  // retire, la colonne email est UNIQUE.
  await lancer('DELETE FROM users WHERE email = ? AND id != ?', [emailNormalise, id]);
  await lancer(
    `INSERT INTO users (id, nom, email, mot_de_passe, role, boutique_id, caisse_id, photo, actif, created_at, updated_at, is_dirty, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, 0)
     ON CONFLICT(id) DO UPDATE SET
       nom = excluded.nom, email = excluded.email, mot_de_passe = excluded.mot_de_passe, role = excluded.role,
       boutique_id = excluded.boutique_id, caisse_id = excluded.caisse_id, photo = excluded.photo,
       actif = 1, updated_at = excluded.updated_at, is_deleted = 0`,
    [id, user.nom || '', emailNormalise, await empreinte(motDePasse), user.role || 'vendeur',
      boutiqueLocale ? boutiqueId : null, caisseLocale ? caisseId : null, user.photo || null, ts, ts]
  );
  await enregistrerSession(id, { token, nom: user.nom, role: user.role, boutiqueId, caisseId, user });
}

// Après un renouvellement de token en ligne (AuthContext) : garde la session
// mémorisée à jour, sans toucher à l'empreinte du mot de passe.
export async function mettreAJourSessionMemorisee(token, user) {
  const id = user?.id || user?._id;
  if (!id || !(await lireSession(id))) return;
  await enregistrerSession(id, {
    token, nom: user.nom, role: user.role,
    boutiqueId: user.boutique?._id || user.boutique || null, caisseId: user.caisseId || null, user,
  });
}

// Connexion sans réseau. Renvoie { token, user } comme POST /api/auth/login,
// ou lève une erreur au même format qu'axios (err.response.data.message).
export async function connexionHorsLigne(email, motDePasse) {
  const refus = (message) => {
    const err = new Error(message);
    err.response = { status: 401, data: { message } };
    return err;
  };

  const compte = await interrogerUne('SELECT * FROM users WHERE email = ? AND is_deleted = 0', [normaliserEmail(email)]);
  const session = compte && (await lireSession(compte.id));
  if (!compte || !session?.user_json) {
    throw refus("Pas de connexion internet. Ce compte ne s'est encore jamais connecté sur ce téléphone : connectez-vous une première fois avec internet.");
  }
  if (!(await verifier(motDePasse, compte.mot_de_passe))) throw refus('Email ou mot de passe incorrect');
  if (compte.role !== 'vendeur') {
    throw refus("Pas de connexion internet. Sur le téléphone, seul l'espace vendeur fonctionne hors-ligne.");
  }
  return { token: session.token, user: JSON.parse(session.user_json) };
}
