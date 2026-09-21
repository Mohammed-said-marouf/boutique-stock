const express = require('express');
const router = express.Router();
const Caisse = require('../models/Caisse');
const Comptoir = require('../models/Comptoir');
const Vente = require('../models/Vente');
const Depense = require('../models/Depense');
const Versement = require('../models/Versement');
const { verifierToken } = require('../middleware/auth');

// GET /soldes - Solde d'espèces de chaque caisse visible par l'utilisateur :
//   solde = ventes en espèces - dépenses - versements APPROUVÉS par l'admin
// (vendeur : sa caisse ; admin : les caisses de son Compte ; superadmin : toutes).
// Les ventes "en_ligne" ne passent pas par la caisse et sont exclues.
router.get('/soldes', verifierToken, async (req, res) => {
  try {
    let caisses;
    if (req.user.role === 'vendeur') {
      caisses = req.user.caisseId ? await Caisse.find({ _id: req.user.caisseId }) : [];
    } else if (req.user.role === 'admin') {
      const comptoirsDuCompte = await Comptoir.find({ boutiqueId: req.user.boutiqueId }, '_id');
      caisses = await Caisse.find({ comptoirId: { $in: comptoirsDuCompte.map(c => c._id) } });
    } else {
      caisses = await Caisse.find({});
    }
    const comptoirs = await Comptoir.find({ _id: { $in: caisses.map(c => c.comptoirId) } });
    const nomComptoir = new Map(comptoirs.map(c => [c._id, c.nom]));
    const ids = caisses.map(c => c._id);

    const totalParCaisse = (Modele, champ, filtre = {}) => Modele.aggregate([
      { $match: { caisseId: { $in: ids }, ...filtre } },
      { $group: { _id: '$caisseId', total: { $sum: champ } } },
    ]).then(lignes => new Map(lignes.map(l => [l._id, l.total])));

    const [ventes, depenses, versements, versementsEnAttente] = await Promise.all([
      totalParCaisse(Vente, '$montantTotal', { typeVente: { $ne: 'en_ligne' } }),
      totalParCaisse(Depense, '$montant'),
      // Seuls les versements APPROUVÉS par l'admin réduisent le solde
      totalParCaisse(Versement, '$montant', { statut: 'valide' }),
      totalParCaisse(Versement, '$montant', { statut: 'en_attente' }),
    ]);

    res.json(caisses.map(c => {
      const v = ventes.get(c._id) || 0;
      const d = depenses.get(c._id) || 0;
      const ver = versements.get(c._id) || 0;
      return {
        caisseId: c._id,
        nom: c.nom,
        comptoirId: c.comptoirId,
        boutiqueNom: nomComptoir.get(c.comptoirId) || '',
        ventes: v,
        depenses: d,
        versements: ver,
        versementsEnAttente: versementsEnAttente.get(c._id) || 0,
        solde: v - d - ver,
      };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
