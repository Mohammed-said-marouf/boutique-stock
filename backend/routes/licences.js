const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Licence = require('../models/Licence');
const Boutique = require('../models/Boutique');
const { verifierToken, autoriser } = require('../middleware/auth');
const { ajouterMois } = require('../services/abonnements');
const enregistrerLog = require('../utils/logger');

// Circuit d'une licence : le super admin génère une clé pour une boutique
// (abonnement + durée) et la lui transmet ; l'admin de cette boutique la saisit
// dans l'appli (POST /activer) et l'abonnement est actif jusqu'à expiration,
// puis la boutique repasse au plan gratuit (services/abonnements.js).

const PREFIXES = { standard: 'STD', premium: 'PRM' };
const DUREES = [1, 3, 6, 12];
// Sans 0/O/1/I : une clé se recopie à la main ou se dicte au téléphone
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genererCle(abonnement) {
  const groupe = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `BS-${PREFIXES[abonnement]}-${groupe()}-${groupe()}-${groupe()}`;
}

// Tolère les espaces, minuscules et tirets manquants saisis à la main
const normaliserCle = (saisie) => String(saisie || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cleSansTirets = (cle) => cle.replace(/-/g, '');

// GET - Lister les licences (super admin), filtrable par ?boutiqueId=
router.get('/', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const filtre = req.query.boutiqueId ? { boutiqueId: req.query.boutiqueId } : {};
    const licences = await Licence.find(filtre).populate('boutiqueId', 'nom').sort({ createdAt: -1 }).limit(300);
    res.json(licences);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Générer une licence (super admin)
router.post('/', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const { boutiqueId, abonnement } = req.body;
    const dureeMois = Number(req.body.dureeMois);
    if (!PREFIXES[abonnement]) return res.status(400).json({ message: "Abonnement invalide (standard ou premium)." });
    if (!DUREES.includes(dureeMois)) return res.status(400).json({ message: 'Durée invalide (1, 3, 6 ou 12 mois).' });
    const boutique = await Boutique.findById(boutiqueId);
    if (!boutique) return res.status(404).json({ message: 'Boutique introuvable.' });

    // Collision de clé quasi impossible (32^12), mais on réessaie proprement
    for (let essai = 0; essai < 5; essai++) {
      try {
        const licence = await Licence.create({
          cle: genererCle(abonnement), abonnement, dureeMois, boutiqueId,
          creePar: req.user.id, nomCreePar: req.user.nom || '',
        });
        await enregistrerLog({
          type: 'licence_generee', message: `${boutique.nom} : ${abonnement} ${dureeMois} mois`,
          utilisateur: req.user.id, nomUtilisateur: req.user.nom || 'Super Admin', niveau: 'success',
        });
        return res.status(201).json(licence);
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    res.status(500).json({ message: 'Impossible de générer une clé unique, réessayez.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT - Révoquer une licence pas encore utilisée (super admin)
router.put('/:id/revoquer', verifierToken, autoriser('superadmin'), async (req, res) => {
  try {
    const licence = await Licence.findOneAndUpdate(
      { _id: req.params.id, statut: 'disponible' },
      { $set: { statut: 'revoquee' } },
      { returnDocument: 'after' }
    );
    if (!licence) return res.status(409).json({ message: 'Licence introuvable ou déjà utilisée.' });
    res.json(licence);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// POST /activer - L'admin d'une boutique active une licence avec sa clé
router.post('/activer', verifierToken, autoriser('admin'), async (req, res) => {
  try {
    const saisie = normaliserCle(req.body.cle);
    if (saisie.length < 10) return res.status(400).json({ message: 'Saisissez la clé de licence.' });

    // Message volontairement identique pour "inconnue", "déjà utilisée",
    // "révoquée" ou "d'une autre boutique" : on ne révèle rien sur les clés.
    const invalide = () => res.status(400).json({ message: 'Clé de licence invalide ou déjà utilisée.' });

    const candidates = await Licence.find({ boutiqueId: req.user.boutiqueId, statut: 'disponible' });
    const trouvee = candidates.find(l => cleSansTirets(l.cle) === saisie);
    if (!trouvee) return invalide();

    // Prise atomique : impossible de l'activer deux fois, même en parallèle
    const maintenant = new Date();
    const licence = await Licence.findOneAndUpdate(
      { _id: trouvee._id, statut: 'disponible' },
      { $set: { statut: 'activee', activeePar: req.user.id, nomActiveePar: req.user.nom || '', dateActivation: maintenant } },
      { returnDocument: 'after' }
    );
    if (!licence) return invalide();

    try {
      const boutique = await Boutique.findById(req.user.boutiqueId);
      // Même plan encore actif : la durée s'ajoute à ce qu'il reste. Autre plan
      // (ou plan expiré / sans échéance) : la durée démarre aujourd'hui.
      const prolonge = boutique.abonnement === licence.abonnement
        && boutique.abonnementExpireLe && boutique.abonnementExpireLe > maintenant;
      const debut = prolonge ? boutique.abonnementExpireLe : maintenant;
      const expiration = ajouterMois(debut, licence.dureeMois);

      boutique.abonnement = licence.abonnement;
      boutique.abonnementExpireLe = expiration;
      await boutique.save();
      await Licence.updateOne({ _id: licence._id }, { $set: { dateExpiration: expiration } });

      await enregistrerLog({
        type: 'licence_activee', message: `${boutique.nom} : ${licence.abonnement} jusqu'au ${expiration.toLocaleDateString('fr-FR')}`,
        utilisateur: req.user.id, nomUtilisateur: req.user.nom || 'Admin', niveau: 'success',
      });
      res.json({ message: '✅ Licence activée', abonnement: licence.abonnement, abonnementExpireLe: expiration });
    } catch (err) {
      // Échec après la prise de la clé : on la rend disponible pour ne pas la "brûler"
      await Licence.updateOne({ _id: licence._id }, { $set: { statut: 'disponible', activeePar: null, nomActiveePar: '', dateActivation: null } });
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
