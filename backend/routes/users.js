const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const { verifierToken, autoriser } = require('../middleware/auth');
const enregistrerLog = require('../utils/logger');
const upload = require('../middleware/upload');

// Liste tous les utilisateurs (superadmin) ou vendeurs de sa boutique (admin)
router.get('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const filtre = req.user.role === 'admin'
      ? { boutiqueId: req.user.boutiqueId, role: 'vendeur' }
      : {};
    const users = await User.find(filtre).select('-motDePasse').populate('boutiqueId', 'nom').populate('caisseId', 'nom comptoirId');
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// (Ré)assigner la caisse fixe d'un vendeur — décision de l'admin, jamais du
// vendeur lui-même. Passer caisseId: null retire l'assignation (le vendeur
// ne pourra alors plus enregistrer de vente tant qu'il n'en a pas une).
router.put('/:id/caisse', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const cible = await User.findById(req.params.id);
    if (!cible) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    if (req.user.role === 'admin' && String(cible.boutiqueId) !== String(req.user.boutiqueId)) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    cible.caisseId = req.body.caisseId || null;
    await cible.save();
    const { motDePasse, ...userSansMotDePasse } = cible.toObject();
    res.json(userSansMotDePasse);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Récupérer mon propre profil
router.get('/me', verifierToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-motDePasse').populate('boutiqueId');
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Modifier mes propres infos (nom, email) — n'importe quel rôle connecté
router.put('/me', verifierToken, async (req, res) => {
  try {
    const { nom, email } = req.body;
    const donnees = {};
    if (nom) donnees.nom = nom;
    if (email) donnees.email = email;

    if (email) {
      const existant = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existant) return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre compte' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, donnees, { new: true })
      .select('-motDePasse').populate('boutiqueId');
    res.json(user);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Changer ma propre photo de profil (n'importe quel rôle connecté). Passe par
// upload.single(...) appelé à la main (plutôt qu'en middleware de route) pour
// renvoyer une erreur JSON propre (format/taille) au lieu de la page HTML
// d'erreur par défaut d'Express.
router.put('/me/photo', verifierToken, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Aucune image reçue.' });
    try {
      const user = await User.findByIdAndUpdate(req.user.id, { photo: req.file.path }, { new: true }).select('-motDePasse');
      res.json(user);
    } catch (e) {
      res.status(400).json({ message: e.message });
    }
  });
});

// Changer la photo de profil d'un utilisateur précis (soi-même, ou un
// admin/superadmin gérant cet utilisateur) — utilisé par la synchro
// desktop (voir desktop/sync/push.js) : le token de synchro appartient à
// UN SEUL compte du poste, qui peut avoir besoin de pousser le changement
// de photo d'un AUTRE utilisateur (ex: un vendeur a changé sa photo
// hors-ligne) — /me/photo ne le permettrait pas (toujours self-référent).
router.put('/:id/photo', verifierToken, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Aucune image reçue.' });
    try {
      const cible = await User.findById(req.params.id);
      if (!cible) return res.status(404).json({ message: 'Utilisateur introuvable.' });
      const estSoiMeme = req.user.id === req.params.id;
      const estGestionnaire = req.user.role === 'superadmin'
        || (req.user.role === 'admin' && String(cible.boutiqueId) === String(req.user.boutiqueId));
      if (!estSoiMeme && !estGestionnaire) {
        return res.status(403).json({ message: 'Accès refusé.' });
      }
      cible.photo = req.file.path;
      await cible.save();
      const { motDePasse, ...userSansMotDePasse } = cible.toObject();
      res.json(userSansMotDePasse);
    } catch (e) {
      res.status(400).json({ message: e.message });
    }
  });
});

// Changer mon propre mot de passe
router.put('/me/motdepasse', verifierToken, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({ message: 'Ancien et nouveau mot de passe requis' });
    }
    if (nouveauMotDePasse.length < 6) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const correct = await user.verifierMotDePasse(ancienMotDePasse);
    if (!correct) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

    if (user.doitChangerMotDePasse && nouveauMotDePasse === ancienMotDePasse) {
      return res.status(400).json({ message: 'Choisissez un mot de passe différent du mot de passe temporaire.' });
    }

    user.motDePasse = nouveauMotDePasse;
    user.doitChangerMotDePasse = false;
    await user.save();
    res.json({ message: '✅ Mot de passe mis à jour' });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Réinitialiser le mot de passe oublié d'un admin ou d'un vendeur (super admin
// uniquement). Génère un mot de passe TEMPORAIRE, renvoyé une seule fois au
// super admin pour qu'il le transmette ; l'utilisateur devra le remplacer par
// le sien dès sa prochaine connexion. Les comptes super admin ne sont pas
// concernés.
const ALPHABET_MDP = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
router.put('/:id/reinitialiser-mot-de-passe', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const cible = await User.findById(req.params.id);
    if (!cible) return res.status(404).json({ message: 'Utilisateur introuvable.' });
    if (cible.role === 'superadmin') {
      return res.status(403).json({ message: "Le mot de passe d'un super admin ne peut pas être réinitialisé ici." });
    }

    const motDePasseTemporaire = Array.from({ length: 10 }, () => ALPHABET_MDP[crypto.randomInt(ALPHABET_MDP.length)]).join('');
    cible.motDePasse = motDePasseTemporaire; // haché par le hook pre('save') du modèle
    cible.doitChangerMotDePasse = true;
    await cible.save();

    await enregistrerLog({
      type: 'mot_de_passe_reinitialise',
      message: `${cible.nom} (${cible.role})`,
      utilisateur: req.user.id,
      nomUtilisateur: req.user.nom || 'Super Admin',
      niveau: 'info'
    });

    res.json({ message: '✅ Mot de passe réinitialisé', nom: cible.nom, email: cible.email, motDePasseTemporaire });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Créer un utilisateur
router.post('/',verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      req.body.role = 'vendeur';
      req.body.boutiqueId = req.user.boutiqueId;
    }
    const user = new User(req.body);
    await user.save();
    const { motDePasse, ...userSansMotDePasse } = user.toObject();

    await enregistrerLog({
      type: 'utilisateur_cree',
      message: `${user.nom} (${user.role})`,
      utilisateur: req.user.id,
      nomUtilisateur: req.user.nom || 'Admin',
      niveau: 'success'
    });

    res.status(201).json(userSansMotDePasse);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Activer/désactiver un utilisateur
router.put('/:id/statut', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { actif: req.body.actif }, { new: true }
    ).select('-motDePasse');
    res.json(user);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Supprimer un utilisateur
// - superadmin : peut supprimer n'importe qui
// - admin : peut supprimer uniquement un vendeur de sa propre boutique
router.delete('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const cible = await User.findById(req.params.id);
      if (!cible) return res.status(404).json({ message: 'Utilisateur introuvable' });
      if (cible.role !== 'vendeur' || String(cible.boutiqueId) !== String(req.user.boutiqueId)) {
        return res.status(403).json({ message: 'Vous ne pouvez supprimer que les vendeurs de votre boutique' });
      }
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;