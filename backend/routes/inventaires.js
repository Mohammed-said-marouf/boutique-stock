const express = require('express');
const router = express.Router();
const Inventaire = require('../models/Inventaire');
const Produit = require('../models/Produit');
const Magasin = require('../models/Magasin');
const Comptoir = require('../models/Comptoir');
const Caisse = require('../models/Caisse');
const MouvementStock = require('../models/MouvementStock');
const Vente = require('../models/Vente');
const { verifierToken, autoriser } = require('../middleware/auth');
const enregistrerLog = require('../utils/logger');
const REFERENCES = ['stock_initial', 'dernier_approvisionnement', 'historique_mouvements'];

// Le théorique "de départ" (baseline) : ce qui avait été corrigé au dernier
// inventaire validé sur cette cible, pour chaque produit (stock juste après
// validation si compté — repli sur quantiteReelle pour les sessions validées
// avant ce champ — sinon quantiteTheorique de l'époque) ; date = quand.
// Réutilisé par "stock_initial" tel quel, et par "historique_mouvements"
// comme point de départ auquel s'ajoutent les mouvements survenus depuis.
async function dernierInventaireValide(cibleType, cibleId) {
  const dernier = await Inventaire.findOne({ cibleType, cibleId, statut: 'valide' }).sort({ valideLe: -1 });
  if (!dernier) return { baseline: new Map(), depuis: null };
  const baseline = new Map(dernier.lignes.map(l => [
    l.produit,
    l.stockApresValidation ?? l.quantiteReelle ?? l.quantiteTheorique,
  ]));
  return { baseline, depuis: dernier.valideLe };
}

// Mouvements affectant le stock de la cible, produit par produit, depuis une
// date (ou depuis toujours si `depuis` est null), séparés en entrées et
// sorties (toutes deux positives) — Map produitId -> { entrees, sorties } :
//  - magasin  : entrées = approvisionnements ; sorties = sorties manuelles
//               + transferts sortants vers une boutique
//  - comptoir : entrées = transferts reçus d'un magasin ; sorties = ventes
// `produitId` (optionnel) restreint le calcul à un seul produit.
async function detailMouvementsDepuis(cibleType, cibleId, depuis, produitId = null) {
  const filtreDate = depuis ? { createdAt: { $gt: depuis } } : {};
  const resultat = new Map();
  const ajouter = (id, champ, qte) => {
    const r = resultat.get(id) || { entrees: 0, sorties: 0 };
    r[champ] += qte;
    resultat.set(id, r);
  };

  if (cibleType === 'magasin') {
    const agg = await MouvementStock.aggregate([
      { $match: { magasinId: cibleId, type: { $in: ['entree', 'sortie', 'transfert'] }, ...filtreDate, ...(produitId ? { produit: produitId } : {}) } },
      { $group: { _id: { produit: '$produit', entree: { $eq: ['$type', 'entree'] } }, total: { $sum: '$quantite' } } },
    ]);
    for (const a of agg) ajouter(a._id.produit, a._id.entree ? 'entrees' : 'sorties', a.total);
    return resultat;
  }
  // Ancien système (stock par caisse) : transferts et ventes rattachés à une
  // caisse de cette boutique, sans la boutique elle-même — comptés aussi.
  const caisses = (await Caisse.find({ comptoirId: cibleId }, '_id')).map(c => c._id);
  const [transferts, ventes] = await Promise.all([
    MouvementStock.aggregate([
      { $match: {
        type: 'transfert', ...filtreDate, ...(produitId ? { produit: produitId } : {}),
        $or: [{ comptoirDestination: cibleId }, { comptoirDestination: null, caisseDestination: { $in: caisses } }],
      } },
      { $group: { _id: '$produit', total: { $sum: '$quantite' } } },
    ]),
    Vente.aggregate([
      { $match: {
        ...(depuis ? { dateVente: { $gt: depuis } } : {}),
        $or: [{ comptoirId: cibleId }, { comptoirId: null, caisseId: { $in: caisses } }],
      } },
      { $unwind: '$produits' },
      ...(produitId ? [{ $match: { 'produits.produit': produitId } }] : []),
      { $group: { _id: '$produits.produit', total: { $sum: '$produits.quantite' } } },
    ]),
  ]);
  for (const t of transferts) ajouter(t._id, 'entrees', t.total);
  for (const v of ventes) ajouter(v._id, 'sorties', v.total);
  return resultat;
}

// La "feuille" de la cible : pour chaque produit, le stock au dernier
// inventaire validé (dernierInv), les entrées et sorties depuis, et le stock
// attendu qui en découle (jamais négatif). C'est le calcul "historique_
// mouvements" ci-dessous, détaillé colonne par colonne pour l'écran.
//
// Produit jamais inventorié ici : l'historique ne suffit pas à reconstituer
// son stock (le stock saisi à la création ou à l'import d'un produit arrive
// sans aucun mouvement). Son point de départ est alors ESTIMÉ à partir du
// stock enregistré : enregistré − entrées + sorties (jamais négatif), de
// sorte que l'attendu retombe sur le stock enregistré, sauf si l'historique
// prouve qu'il en manque (plus de sorties que ce qui a pu entrer).
// Map produitId -> { dernierInv, dernierInvEstime, entrees, sorties, attendu }.
async function calculerFeuille(cibleType, cibleId, produitId = null) {
  const { baseline, depuis } = await dernierInventaireValide(cibleType, cibleId);
  const champCible = cibleType === 'magasin' ? 'stockMagasins.magasin' : 'stockComptoirs.comptoir';
  const [mouvements, produits] = await Promise.all([
    detailMouvementsDepuis(cibleType, cibleId, depuis, produitId),
    Produit.find(produitId ? { _id: produitId } : { [champCible]: cibleId }, 'stockMagasins stockComptoirs'),
  ]);
  const enregistre = new Map(produits.map(p => [p._id, stockDansCible(p, cibleType, cibleId)]));
  const ids = produitId ? [produitId] : new Set([...baseline.keys(), ...mouvements.keys(), ...enregistre.keys()]);
  const lignes = new Map();
  for (const id of ids) {
    const { entrees, sorties } = mouvements.get(id) || { entrees: 0, sorties: 0 };
    const dernierInvEstime = !baseline.has(id);
    const dernierInv = dernierInvEstime
      ? Math.max(0, (enregistre.get(id) || 0) - entrees + sorties)
      : baseline.get(id);
    lignes.set(id, { dernierInv, dernierInvEstime, entrees, sorties, attendu: Math.max(0, dernierInv + entrees - sorties) });
  }
  return { depuis, lignes };
}

// Calcule, pour chaque produit, le théorique de référence choisi par l'admin
// à l'ouverture — voir models/Inventaire.js pour la définition de chaque
// type. Retourne une Map produitId -> { quantite, date }, ou null si le type
// choisi n'a pas de notion d'historique ici (aucun produit n'aura de
// référence : tous retomberont sur le stock actuel, voir POST /).
async function calculerReferences(referenceType, cibleType, cibleId) {
  if (referenceType === 'stock_initial') {
    const { baseline, depuis } = await dernierInventaireValide(cibleType, cibleId);
    if (!depuis) return null; // jamais d'inventaire ici -> repli sur le stock actuel
    return new Map([...baseline].map(([id, quantite]) => [id, { quantite, date: depuis }]));
  }

  if (referenceType === 'dernier_approvisionnement') {
    // stockRestant de la dernière entrée de stock de chaque produit dans ce
    // magasin — un seul aller-retour base via une agrégation, plutôt qu'une
    // requête par produit.
    const dernieresEntrees = await MouvementStock.aggregate([
      { $match: { magasinId: cibleId, type: 'entree' } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$produit', stockRestant: { $first: '$stockRestant' }, date: { $first: '$createdAt' } } },
    ]);
    return new Map(dernieresEntrees.map(d => [d._id, { quantite: d.stockRestant, date: d.date }]));
  }

  // historique_mouvements : recalcul automatique, en ignorant le stock
  // actuellement enregistré — repart du dernier inventaire validé (comme
  // "stock_initial"), puis ajoute tout ce qui s'est passé depuis
  // (transferts/ventes ou entrées/sorties/transferts sortants). Sans
  // inventaire précédent, repart de zéro et additionne tout l'historique.
  const { depuis, lignes } = await calculerFeuille(cibleType, cibleId);
  return new Map([...lignes].map(([id, l]) => [id, { quantite: l.attendu, date: depuis }]));
}

// Cycle de vie d'une session : "en_cours" (ouverte, comptage en cours) ->
// "valide" (clôturée, stock corrigé) ou "annulée" (abandonnée, rien touché).

// Filtre limitant un admin aux sessions de son Compte (superadmin : tout)
const filtreCompte = (req) => (req.user.role === 'superadmin' ? {} : { boutiqueId: req.user.boutiqueId });

async function cibleAccessible(cibleType, cibleId, boutiqueId) {
  if (cibleType === 'magasin') return Magasin.findOne({ _id: cibleId, boutiqueId });
  return Comptoir.findOne({ _id: cibleId, boutiqueId });
}

// Stock actuellement enregistré d'un produit dans la cible (0 si absent).
function stockDansCible(produit, cibleType, cibleId) {
  const ligne = cibleType === 'magasin'
    ? (produit.stockMagasins || []).find(sm => sm.magasin === cibleId)
    : (produit.stockComptoirs || []).find(sc => sc.comptoir === cibleId);
  return ligne ? ligne.quantite : 0;
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

// GET /feuille?cibleType=&cibleId= - La feuille d'inventaire "du moment"
// d'une cible, consultable même sans session ouverte : pour chaque produit
// du Compte, le stock au dernier inventaire, les entrées/sorties depuis, le
// stock attendu, le stock enregistré et le prix ; plus la session en cours
// sur cette cible s'il y en a une (avec ses lignes comptées).
router.get('/feuille', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const { cibleType, cibleId } = req.query;
    if (!['magasin', 'comptoir'].includes(cibleType) || !cibleId) {
      return res.status(400).json({ message: 'cibleType ("magasin" ou "comptoir") et cibleId sont requis.' });
    }
    const Modele = cibleType === 'magasin' ? Magasin : Comptoir;
    const cible = await Modele.findOne({ _id: cibleId, ...filtreCompte(req) });
    if (!cible) return res.status(404).json({ message: cibleType === 'magasin' ? 'Magasin introuvable.' : 'Boutique introuvable.' });

    const [produits, { depuis, lignes }, session] = await Promise.all([
      Produit.find({ boutiqueId: cible.boutiqueId }, 'nom ref prix stockMagasins stockComptoirs').sort({ nom: 1 }),
      calculerFeuille(cibleType, cibleId),
      Inventaire.findOne({ cibleType, cibleId, statut: 'en_cours' }),
    ]);

    res.json({
      cible: { type: cibleType, id: cibleId, nom: cible.nom },
      depuis,
      session,
      lignes: produits.map(p => ({
        produit: p._id, nom: p.nom, ref: p.ref || '', prix: p.prix || 0,
        ...(lignes.get(p._id) || { dernierInv: 0, dernierInvEstime: true, entrees: 0, sorties: 0, attendu: 0 }),
        stockEnregistre: stockDansCible(p, cibleType, cibleId),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /:id - Détail complet (avec les lignes), pour compter ou consulter.
// Chaque ligne est complétée du prix actuel du produit (colonne "Valeur").
router.get('/:id', verifierToken, autoriser('superadmin', 'admin'), async (req, res) => {
  try {
    const inv = await Inventaire.findOne({ _id: req.params.id, ...filtreCompte(req) }).lean();
    if (!inv) return res.status(404).json({ message: 'Inventaire introuvable.' });
    const produits = await Produit.find({ _id: { $in: inv.lignes.map(l => l.produit) } }, 'prix').lean();
    const prix = new Map(produits.map(p => [p._id, p.prix || 0]));
    inv.lignes = inv.lignes.map(l => ({ ...l, prix: prix.get(l.produit) || 0 }));
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
    // Sans choix explicite : le calcul automatique (celui de la feuille).
    const { cibleType, cibleId, referenceType = 'historique_mouvements' } = req.body;
    if (!['magasin', 'comptoir'].includes(cibleType) || !cibleId) {
      return res.status(400).json({ message: 'cibleType ("magasin" ou "comptoir") et cibleId sont requis.' });
    }
    if (!REFERENCES.includes(referenceType)) {
      return res.status(400).json({ message: `referenceType (${REFERENCES.map(r => `"${r}"`).join(', ')}) est requis.` });
    }
    if (referenceType === 'dernier_approvisionnement' && cibleType !== 'magasin') {
      return res.status(400).json({ message: "Le dernier approvisionnement n'est disponible que pour un magasin : une boutique ne reçoit que des transferts, jamais d'entrée directe." });
    }

    const cible = await cibleAccessible(cibleType, cibleId, boutiqueId);
    if (!cible) return res.status(404).json({ message: cibleType === 'magasin' ? 'Magasin introuvable.' : 'Boutique introuvable.' });

    const dejaEnCours = await Inventaire.findOne({ boutiqueId, cibleType, cibleId, statut: 'en_cours' });
    if (dejaEnCours) {
      return res.status(409).json({ message: 'Une session d\'inventaire est déjà en cours pour cette cible.', inventaireId: dejaEnCours._id });
    }

    const produits = await Produit.find({ boutiqueId }).sort({ nom: 1 });
    const references = await calculerReferences(referenceType, cibleType, cibleId);
    const lignes = produits.map(p => {
      const stockActuel = stockDansCible(p, cibleType, cibleId);
      // Produit absent de la référence (jamais approvisionné ici, ou pas
      // encore présent au dernier inventaire) : repli sur le stock actuel.
      const reference = references ? references.get(p._id) : null;
      return {
        produit: p._id, nom: p.nom, ref: p.ref || '',
        quantiteTheorique: reference ? reference.quantite : stockActuel,
        referenceDate: reference ? reference.date : null,
        quantiteReelle: null, compteLe: null,
      };
    });

    const inventaire = await new Inventaire({
      boutiqueId, cibleType, cibleId, cibleNom: cible.nom, referenceType, lignes,
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

    const inv = await Inventaire.findOne({ _id: req.params.id, ...filtreCompte(req) }, 'statut cibleType cibleId');
    if (!inv) return res.status(404).json({ message: 'Inventaire introuvable.' });
    if (inv.statut !== 'en_cours') return res.status(400).json({ message: 'Cette session n\'est plus modifiable.' });

    // Stock enregistré à l'instant du comptage : c'est par rapport à lui que
    // l'écart sera appliqué à la validation (voir PUT /:id/valider). Un
    // produit supprimé entre-temps compte pour 0.
    const [produit, feuille] = await Promise.all([
      Produit.findById(req.body.produitId, 'stockMagasins stockComptoirs'),
      calculerFeuille(inv.cibleType, inv.cibleId, req.body.produitId),
    ]);
    const stockAuComptage = produit ? stockDansCible(produit, inv.cibleType, inv.cibleId) : 0;
    // Détail de la feuille figé à l'instant du comptage : l'écart affiché
    // (compté − attendu) ne bouge plus si on vend ce produit ensuite.
    const { dernierInv, dernierInvEstime, entrees, sorties, attendu } = feuille.lignes.get(req.body.produitId);

    // $set positionnel : ne touche que la ligne visée, atomique, et échoue
    // proprement (matchedCount 0) si le produit n'est pas dans cette session
    // ou si elle a été clôturée entre-temps.
    const maintenant = new Date();
    const r = await Inventaire.updateOne(
      { _id: req.params.id, statut: 'en_cours', 'lignes.produit': req.body.produitId, ...filtreCompte(req) },
      { $set: {
        'lignes.$.quantiteReelle': qte, 'lignes.$.compteLe': maintenant, 'lignes.$.stockAuComptage': stockAuComptage,
        'lignes.$.dernierInv': dernierInv, 'lignes.$.dernierInvEstime': dernierInvEstime, 'lignes.$.entrees': entrees, 'lignes.$.sorties': sorties, 'lignes.$.attenduAuComptage': attendu,
      } }
    );
    if (r.matchedCount === 0) {
      const apres = await Inventaire.findOne({ _id: req.params.id }, 'statut');
      if (apres && apres.statut !== 'en_cours') return res.status(400).json({ message: 'Cette session n\'est plus modifiable.' });
      return res.status(404).json({ message: 'Ce produit ne fait pas partie de cette session.' });
    }

    res.json({
      produitId: req.body.produitId, quantiteReelle: qte, compteLe: maintenant, stockAuComptage,
      dernierInv, dernierInvEstime, entrees, sorties, attenduAuComptage: attendu,
    });
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
// est corrigé de l'écart constaté AU MOMENT DU COMPTAGE (quantiteReelle −
// stockAuComptage), pas écrasé par la quantité comptée : une vente ou un
// transfert survenu entre le comptage et la validation reste donc pris en
// compte. (Ce n'est pas non plus l'écart au théorique de référence affiché,
// qui sert seulement d'indicateur.) Chaque correction est tracée par un
// MouvementStock 'inventaire'. Les produits non comptés restent inchangés ;
// la session garde leur ligne à quantiteReelle=null.
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
    const estMagasin = inv.cibleType === 'magasin';
    const champStock = estMagasin ? 'stockMagasins' : 'stockComptoirs';
    const champCible = estMagasin ? 'magasin' : 'comptoir';
    let nbAjustes = 0;

    for (const ligne of lignesComptees) {
      const produit = await Produit.findById(ligne.produit);
      if (!produit) continue; // produit supprimé entre-temps : rien à ajuster

      const stockActuel = stockDansCible(produit, inv.cibleType, inv.cibleId);
      // Ligne comptée avant l'ajout de stockAuComptage : pas de référence au
      // moment du comptage, on retombe sur l'ancien comportement (le stock
      // devient exactement la quantité comptée).
      const ecart = ligne.stockAuComptage !== null && ligne.stockAuComptage !== undefined
        ? ligne.quantiteReelle - ligne.stockAuComptage
        : ligne.quantiteReelle - stockActuel;
      // Jamais de stock négatif : si la cible s'est vidée depuis le comptage
      // au point que l'écart ferait passer sous zéro, on s'arrête à 0.
      const nouveauStock = Math.max(0, stockActuel + ecart);
      const delta = nouveauStock - stockActuel;
      ligne.stockApresValidation = nouveauStock;
      if (delta === 0) continue;

      // $inc atomique plutôt que produit.save() : une vente qui décrémente
      // le même stock au même instant (routes/ventes.js fait aussi un $inc)
      // n'est jamais écrasée.
      const existe = (produit[champStock] || []).some(x => x[champCible] === inv.cibleId);
      const inc = { [`${champStock}.$.quantite`]: delta, ...(estMagasin ? { quantite: delta } : {}) };
      if (existe) {
        await Produit.updateOne({ _id: produit._id, [`${champStock}.${champCible}`]: inv.cibleId }, { $inc: inc });
      } else {
        await Produit.updateOne({ _id: produit._id }, {
          $push: { [champStock]: { [champCible]: inv.cibleId, quantite: delta } },
          ...(estMagasin ? { $inc: { quantite: delta } } : {}),
        });
      }

      await new MouvementStock({
        produit: produit._id, boutiqueId: inv.boutiqueId, type: 'inventaire',
        magasinId: estMagasin ? inv.cibleId : null,
        comptoirId: estMagasin ? null : inv.cibleId,
        inventaireId: inv._id,
        quantite: delta, stockRestant: nouveauStock,
        note: `Inventaire du ${inv.createdAt.toLocaleDateString('fr-FR')} : ${delta > 0 ? 'surplus' : 'manquant'} constaté`,
      }).save();
      nbAjustes++;
    }

    // Mémorise le stock obtenu, point de départ du prochain inventaire de
    // cette cible (voir dernierInventaireValide).
    await Inventaire.updateOne({ _id: inv._id }, { $set: { lignes: inv.lignes } });

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
