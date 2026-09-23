const express = require('express');
const router = express.Router();
const Inventaire = require('../models/Inventaire');
const Produit = require('../models/Produit');
const Magasin = require('../models/Magasin');
const Comptoir = require('../models/Comptoir');
const { verifierToken, autoriser } = require('../middleware/auth');
const enregistrerLog = require('../utils/logger');

// Cycle de vie d'une session : "en_cours" (ouverte, comptage en cours) ->
// "valide" (clôturée, stock corrigé) ou "annulée" (abandonnée, rien touché).

// Filtre limitant un admin aux sessions de son Compte (superadmin : tout)
const filtreCompte = (req) => (req.user.role === 'superadmin' ? {} : { boutiqueId: req.user.boutiqueId });

async function cibleAccessible(cibleType, cibleId, boutiqueId) {
  if (cibleType === 'magasin') return Magasin.findOne({ _id: cibleId, boutiqueId });
  return Comptoir.findOne({ _id: cibleId, boutiqueId });
}

// GET - Lister les sessions du Compte (sans les lignes, pour rester léger)
router.get('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const inventaires = await Inventaire.find(filtreCompte(req), '-lignes').sort({ createdAt: -1 }).limit(100);
    res.json(inventaires);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /:id - Détail complet (avec les lignes), pour compter ou consulter
router.get('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const inv = await Inventaire.findOne({ _id: req.params.id, ...filtreCompte(req) });
    if (!inv) return res.status(404).json({ message: 'Inventaire introuvable.' });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - Ouvrir une session : snapshot du stock théorique de tous les
// produits du Compte pour la cible choisie (Magasin ou Boutique).
router.post('/', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const boutiqueId = req.user.role === 'admin' ? req.user.boutiqueId : req.body.boutiqueId;
    if (!boutiqueId) return res.status(400).json({ message: 'boutiqueId requis.' });
    const { cibleType, cibleId } = req.body;
    if (!['magasin', 'comptoir'].includes(cibleType) || !cibleId) {
      return res.status(400).json({ message: 'cibleType ("magasin" ou "comptoir") et cibleId sont requis.' });
    }

    const cible = await cibleAccessible(cibleType, cibleId, boutiqueId);
    if (!cible) return res.status(404).json({ message: cibleType === 'magasin' ? 'Magasin introuvable.' : 'Boutique introuvable.' });

    const dejaEnCours = await Inventaire.findOne({ boutiqueId, cibleType, cibleId, statut: 'en_cours' });
    if (dejaEnCours) {
      return res.status(409).json({ message: 'Une session d\'inventaire est déjà en cours pour cette cible.', inventaireId: dejaEnCours._id });
    }

    const produits = await Produit.find({ boutiqueId }).sort({ nom: 1 });
    const lignes = produits.map(p => {
      const stock = cibleType === 'magasin'
        ? (p.stockMagasins || []).find(sm => sm.magasin === cibleId)
        : (p.stockComptoirs || []).find(sc => sc.comptoir === cibleId);
      return { produit: p._id, nom: p.nom, ref: p.ref || '', quantiteTheorique: stock ? stock.quantite : 0, quantiteReelle: null, compteLe: null };
    });

    const inventaire = await new Inventaire({
      boutiqueId, cibleType, cibleId, cibleNom: cible.nom, lignes,
      creePar: req.user.id, nomCreePar: req.user.nom || '',
    }).save();

    await enregistrerLog({
      type: 'inventaire_ouvert', message: `${cible.nom} (${lignes.length} produit(s))`,
      utilisateur: req.user.id, nomUtilisateur: req.user.nom || 'Admin', niveau: 'info',
    });

    res.status(201).json(inventaire);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /:id/compter - Saisir/corriger la quantité réellement comptée d'UN
// produit. Sauvegardé immédiatement (pas d'envoi groupé en fin de session),
// pour ne rien perdre si l'appareil se ferme en plein comptage.
router.put('/:id/compter', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const qte = Number(req.body.quantiteReelle);
    if (!req.body.produitId || isNaN(qte) || qte < 0) {
      return res.status(400).json({ message: 'produitId et quantiteReelle (nombre >= 0) sont requis.' });
    }

    // $set positionnel : ne touche que la ligne visée, atomique, et échoue
    // proprement (matchedCount 0) si le produit n'est pas dans cette session.
    const maintenant = new Date();
    const r = await Inventaire.updateOne(
      { _id: req.params.id, statut: 'en_cours', 'lignes.produit': req.body.produitId, ...filtreCompte(req) },
      { $set: { 'lignes.$.quantiteReelle': qte, 'lignes.$.compteLe': maintenant } }
    );
    if (r.matchedCount === 0) {
      const inv = await Inventaire.findOne({ _id: req.params.id, ...filtreCompte(req) }, 'statut');
      if (!inv) return res.status(404).json({ message: 'Inventaire introuvable.' });
      if (inv.statut !== 'en_cours') return res.status(400).json({ message: 'Cette session n\'est plus modifiable.' });
      return res.status(404).json({ message: 'Ce produit ne fait pas partie de cette session.' });
    }

    res.json({ produitId: req.body.produitId, quantiteReelle: qte, compteLe: maintenant });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /:id/annuler - Abandonne la session : rien n'est touché au stock.
router.put('/:id/annuler', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const inv = await Inventaire.findOneAndUpdate(
      { _id: req.params.id, statut: 'en_cours', ...filtreCompte(req) },
      { $set: { statut: 'annule' } },
      { returnDocument: 'after' }
    );
    if (!inv) return res.status(409).json({ message: 'Session introuvable ou déjà clôturée.' });
    res.json(inv);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /:id/valider - Clôture la session : le stock de chaque produit COMPTÉ
// est mis à jour pour correspondre exactement à la quantité réelle saisie
// (pas un delta par rapport au théorique du snapshot — la session elle-même
// fait foi de la trace/l'écart constaté). Les produits non comptés restent
// inchangés ; la session garde leur ligne à quantiteReelle=null.
router.put('/:id/valider', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    // Bascule atomique du statut en premier : deux clics simultanés ne
    // peuvent jamais appliquer les ajustements deux fois.
    const inv = await Inventaire.findOneAndUpdate(
      { _id: req.params.id, statut: 'en_cours', ...filtreCompte(req) },
      { $set: { statut: 'valide', valideLe: new Date(), valideParId: req.user.id, nomValidePar: req.user.nom || '' } },
      { returnDocument: 'after' }
    );
    if (!inv) return res.status(409).json({ message: 'Session introuvable ou déjà clôturée.' });

    const lignesComptees = inv.lignes.filter(l => l.quantiteReelle !== null);
    let nbAjustes = 0;

    for (const ligne of lignesComptees) {
      const produit = await Produit.findById(ligne.produit);
      if (!produit) continue; // produit supprimé entre-temps : rien à ajuster

      if (inv.cibleType === 'magasin') {
        const sm = produit.stockMagasins.find(x => x.magasin === inv.cibleId);
        if (sm) {
          if (sm.quantite === ligne.quantiteReelle) continue;
          sm.quantite = ligne.quantiteReelle;
        } else {
          if (ligne.quantiteReelle === 0) continue;
          produit.stockMagasins.push({ magasin: inv.cibleId, quantite: ligne.quantiteReelle });
        }
        produit.quantite = produit.stockMagasins.reduce((s, x) => s + x.quantite, 0); // total recalculé
      } else {
        const sc = produit.stockComptoirs.find(x => x.comptoir === inv.cibleId);
        if (sc) {
          if (sc.quantite === ligne.quantiteReelle) continue;
          sc.quantite = ligne.quantiteReelle;
        } else {
          if (ligne.quantiteReelle === 0) continue;
          produit.stockComptoirs.push({ comptoir: inv.cibleId, quantite: ligne.quantiteReelle });
        }
      }
      await produit.save();
      nbAjustes++;
    }

    const nbNonComptes = inv.lignes.length - lignesComptees.length;
    await enregistrerLog({
      type: 'inventaire_valide',
      message: `${inv.cibleNom} : ${nbAjustes} produit(s) ajusté(s)${nbNonComptes > 0 ? `, ${nbNonComptes} non compté(s)` : ''}`,
      utilisateur: req.user.id, nomUtilisateur: req.user.nom || 'Admin', niveau: 'success',
    });

    res.json({ message: '✅ Inventaire validé', nbAjustes, nbNonComptes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
