/**
 * Route "auth" du serveur local — authentifie un utilisateur, avec un
 * comportement hybride pensé pour l'offline-first :
 *
 *  1. Si l'utilisateur existe déjà en local (SQLite), on vérifie le mot de
 *     passe directement dessus — fonctionne même hors-ligne.
 *  2. S'il n'existe PAS encore en local (ex: compte créé sur le site web,
 *     jamais utilisé sur ce poste desktop), et qu'une connexion internet
 *     est disponible, on relaie les identifiants vers l'API en ligne. En
 *     cas de succès, on CRÉE le compte en local (mot de passe haché avec
 *     bcrypt, même id que celui renvoyé par l'API en ligne) — la
 *     prochaine connexion pourra se faire même hors-ligne.
 *  3. Si l'utilisateur n'existe pas en local ET qu'on est hors-ligne, on
 *     renvoie un message clair expliquant qu'une première connexion en
 *     ligne est nécessaire.
 *
 * Note de sécurité : voir le commentaire sur le token dans la fonction
 * genererTokenLocal — pas de signature cryptographique, le serveur local
 * n'écoutant que sur localhost et ne vérifiant lui-même aucun token pour
 * l'instant.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../local-db/db');
const { estEnLigne, API_EN_LIGNE } = require('../sync/connectivite');

const maintenant = () => new Date().toISOString();

// Le champ "boutique" renvoyé par l'API en ligne peut être un objet populé
// (ex: { _id, nom }) plutôt qu'une simple chaîne d'id — better-sqlite3
// refuse de lier un objet JS brut, d'où l'erreur "can only bind numbers,
// strings, bigints, buffers, and null" si on ne le déballe pas.
function idRef(valeur) {
  if (valeur && typeof valeur === 'object') return valeur._id || null;
  return valeur || null;
}

function genererTokenLocal(utilisateur) {
  // Token léger, non signé cryptographiquement — suffisant tant qu'aucune
  // route locale ne le vérifie (voir en-tête du fichier). boutiqueId est
  // inclus pour permettre aux routes de filtrer leurs résultats par
  // boutique (voir middleware/identifierUtilisateur.js).
  return Buffer.from(JSON.stringify({
    id: utilisateur.id,
    role: utilisateur.role,
    boutiqueId: utilisateur.boutique_id || null,
    genereLe: maintenant(),
  })).toString('base64');
}

function formaterUtilisateur(ligne) {
  let boutique = null;
  if (ligne.boutique_id) {
    // Le frontend (AdminLayout.js, etc.) attend un objet boutique complet
    // (user.boutique.nom, .logo, .adresse, .abonnement...), pas juste
    // l'id — on va donc chercher les vraies infos dans la table locale
    // boutiques (déjà peuplée par le pull).
    const ligneBoutique = db.prepare('SELECT * FROM boutiques WHERE id = ?').get(ligne.boutique_id);
    if (ligneBoutique) {
      boutique = {
        _id: ligneBoutique.id,
        nom: ligneBoutique.nom,
        adresse: ligneBoutique.adresse,
        telephone: ligneBoutique.telephone,
        email: ligneBoutique.email,
        logo: ligneBoutique.logo,
        abonnement: ligneBoutique.abonnement,
        actif: !!ligneBoutique.actif,
      };
    }
  }

  return {
    id: ligne.id,
    nom: ligne.nom,
    email: ligne.email,
    role: ligne.role,
    boutique,
  };
}

router.post('/login', async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    if (!email || !motDePasse) {
      return res.status(400).json({ message: 'email et motDePasse sont requis.' });
    }

    const utilisateurLocal = db.prepare('SELECT * FROM users WHERE email = ? AND is_deleted = 0').get(email);

    // --- Cas 1 : le compte existe déjà en local ---
    if (utilisateurLocal) {
      if (!utilisateurLocal.actif) {
        return res.status(403).json({ message: 'Ce compte est désactivé.' });
      }

      const motDePasseValide = await bcrypt.compare(motDePasse, utilisateurLocal.mot_de_passe);
      if (!motDePasseValide) {
        return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
      }

      return res.json({
        token: genererTokenLocal(utilisateurLocal),
        user: formaterUtilisateur(utilisateurLocal),
      });
    }

    // --- Cas 2 : le compte n'existe pas en local — tentative en ligne ---
    const enLigne = await estEnLigne();
    if (!enLigne) {
      return res.status(503).json({
        message: 'Ce compte n\'a encore jamais été utilisé sur cet appareil. Une connexion internet est nécessaire pour la première connexion.',
      });
    }

    const reponseEnLigne = await fetch(`${API_EN_LIGNE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, motDePasse }),
    });

    const donneesEnLigne = await reponseEnLigne.json();

    if (!reponseEnLigne.ok) {
      // On relaie tel quel le message d'erreur de l'API en ligne
      // (ex: "Email ou mot de passe incorrect").
      return res.status(reponseEnLigne.status).json(donneesEnLigne);
    }

    // Connexion en ligne réussie : on crée le compte en local, avec le
    // MÊME id que celui renvoyé par l'API (cohérence des UUID, comme
    // partout ailleurs dans le projet), pour que ce compte soit
    // utilisable hors-ligne dès la prochaine connexion.
    const { user: utilisateurDistant } = donneesEnLigne;

    // Sur une machine neuve, la table locale "boutiques" peut être
    // complètement vide (aucun pull n'a encore eu lieu, puisque le pull
    // automatique a besoin d'une session déjà active pour fonctionner —
    // exactement la session qu'on est en train d'établir ici). Si on
    // insère l'utilisateur avec un boutique_id qui n'existe pas encore
    // localement, la contrainte de clé étrangère échoue. On crée donc
    // d'abord la boutique référencée si besoin, à partir de l'objet
    // complet déjà renvoyé par l'API de connexion en ligne.
    const boutiqueDistante = utilisateurDistant.boutique;
    if (boutiqueDistante && boutiqueDistante._id) {
      const boutiqueExistante = db.prepare('SELECT id FROM boutiques WHERE id = ?').get(boutiqueDistante._id);
      if (!boutiqueExistante) {
        const maintenantIsoBoutique = maintenant();
        db.prepare(`
          INSERT INTO boutiques (id, nom, adresse, telephone, email, logo, abonnement, actif, created_at, updated_at, is_dirty, is_deleted)
          VALUES (@id, @nom, @adresse, @telephone, @email, @logo, @abonnement, @actif, @createdAt, @updatedAt, 0, 0)
        `).run({
          id: boutiqueDistante._id,
          nom: boutiqueDistante.nom || 'Boutique',
          adresse: boutiqueDistante.adresse || null,
          telephone: boutiqueDistante.telephone || null,
          email: boutiqueDistante.email || null,
          logo: boutiqueDistante.logo || null,
          abonnement: boutiqueDistante.abonnement || 'gratuit',
          actif: boutiqueDistante.actif === false ? 0 : 1,
          createdAt: maintenantIsoBoutique,
          updatedAt: maintenantIsoBoutique,
        });
      }
    }

    const motDePasseHache = await bcrypt.hash(motDePasse, 10);
    const maintenantIso = maintenant();

    db.prepare(`
      INSERT INTO users (id, nom, email, mot_de_passe, role, boutique_id, actif, created_at, updated_at, is_dirty, is_deleted)
      VALUES (@id, @nom, @email, @motDePasse, @role, @boutiqueId, 1, @createdAt, @updatedAt, 0, 0)
    `).run({
      id: utilisateurDistant.id,
      nom: utilisateurDistant.nom,
      email: utilisateurDistant.email,
      motDePasse: motDePasseHache,
      role: utilisateurDistant.role,
      boutiqueId: idRef(utilisateurDistant.boutique),
      createdAt: maintenantIso,
      updatedAt: maintenantIso,
    });

    // On renvoie directement la réponse de l'API en ligne (déjà au bon format).
    res.json(donneesEnLigne);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;