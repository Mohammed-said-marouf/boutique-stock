/**
 * Migration vers le système Boutique → Caisses / Compte → Magasins.
 *
 * Exécutée automatiquement au démarrage du serveur (voir server.js), après
 * la connexion à MongoDB. Entièrement idempotente : rejouer cette fonction
 * sur une base déjà migrée ne fait rien (chaque étape se vérifie avant d'agir).
 *
 * Ce qu'elle fait, pour chaque Comptoir (= "Boutique" dans l'interface) qui
 * n'a encore AUCUNE Caisse :
 *   1. Crée une Caisse par défaut dessus (même nom que le comptoir). Le stock
 *      reste sur le comptoir (Produit.stockComptoirs) : une caisse ne porte
 *      pas de stock.
 *
 * Et, pour les produits qui ont encore un stock par caisse d'une version
 * intermédiaire (Produit.stockCaisses) : voir replierStockCaissesVersComptoirs.
 *
 * Et pour chaque Boutique (= "Compte" dans l'interface) qui n'a encore AUCUN
 * Magasin :
 *   1. Crée un Magasin par défaut dessus ("Magasin principal").
 *   2. Déplace le stock Magasin actuel de chaque produit (Produit.quantite)
 *      vers Produit.stockMagasins, sur ce nouveau magasin.
 *
 * Rien n'est jamais supprimé silencieusement : l'ancien champ stockCaisses est
 * renommé en stockCaissesAncien (jamais lu par le code), au cas où il faudrait
 * vérifier/revenir en arrière.
 */

/**
 * Version intermédiaire : le stock vendable était par CAISSE
 * (Produit.stockCaisses). Il est désormais par BOUTIQUE (Produit.stockComptoirs,
 * partagé par toutes les caisses de la boutique).
 *
 * Pour chaque produit qui a encore des lignes stockCaisses : stockCaisses est
 * la référence (l'ancien stockComptoirs éventuellement présent en base est
 * périmé, il datait d'avant le passage aux caisses), donc stockComptoirs est
 * RECONSTRUIT = somme des caisses de chaque boutique, puis stockCaisses est
 * renommé en stockCaissesAncien. Idempotent : une fois renommé, le produit
 * n'est plus sélectionné.
 */
async function replierStockCaissesVersComptoirs() {
  const Caisse = require('../models/Caisse');
  const Produit = require('../models/Produit');

  const produits = await Produit.collection.find({ 'stockCaisses.0': { $exists: true } }).toArray();
  if (produits.length === 0) return;

  const comptoirParCaisse = new Map((await Caisse.find({}, '_id comptoirId')).map(c => [c._id, c.comptoirId]));
  let nbReplies = 0;

  for (const produit of produits) {
    const parComptoir = new Map();
    let caisseInconnueAvecStock = false;

    for (const ligne of produit.stockCaisses) {
      const comptoirId = comptoirParCaisse.get(ligne.caisse);
      if (!comptoirId) {
        if (ligne.quantite > 0) caisseInconnueAvecStock = true;
        continue;
      }
      parComptoir.set(comptoirId, (parComptoir.get(comptoirId) || 0) + (ligne.quantite || 0));
    }

    if (caisseInconnueAvecStock) {
      console.warn(`⚠️ Migration stock caisses -> boutiques : produit "${produit.nom}" (${produit._id}) a du stock sur une caisse introuvable, ignoré (à traiter à la main).`);
      continue;
    }

    await Produit.collection.updateOne(
      { _id: produit._id },
      {
        $set: { stockComptoirs: [...parComptoir].map(([comptoir, quantite]) => ({ comptoir, quantite })) },
        $rename: { stockCaisses: 'stockCaissesAncien' },
      }
    );
    nbReplies++;
  }

  if (nbReplies > 0) {
    console.log(`✅ Migration stock : ${nbReplies} produit(s) — stock par caisse regroupé au niveau de la boutique.`);
  }
}

async function migrerVersCaissesEtMagasins() {
  const Boutique = require('../models/Boutique');
  const Comptoir = require('../models/Comptoir');
  const Caisse = require('../models/Caisse');
  const Magasin = require('../models/Magasin');
  const Produit = require('../models/Produit');

  // ---------- 1) Comptoirs (Boutiques) sans Caisse -> créer une Caisse par défaut ----------
  const comptoirs = await Comptoir.find({});
  let nbCaissesCreees = 0;

  for (const comptoir of comptoirs) {
    const caisseExistante = await Caisse.findOne({ comptoirId: comptoir._id });
    if (caisseExistante) continue; // déjà migré pour ce comptoir

    await new Caisse({
      nom: comptoir.nom,
      comptoirId: comptoir._id,
      actif: true,
    }).save();
    nbCaissesCreees++;
  }

  // ---------- 2) Boutiques (Comptes) sans Magasin -> créer un Magasin par défaut ----------
  const comptesBoutiques = await Boutique.find({});
  let nbMagasinsCrees = 0;

  for (const compte of comptesBoutiques) {
    const magasinExistant = await Magasin.findOne({ boutiqueId: compte._id });
    if (magasinExistant) continue; // déjà migré pour ce compte

    const magasin = await new Magasin({
      nom: 'Magasin principal',
      boutiqueId: compte._id,
      actif: true,
    }).save();
    nbMagasinsCrees++;

    // Déplace le stock Magasin actuel (Produit.quantite) vers stockMagasins,
    // pour tous les produits de ce compte qui ont du stock.
    const produitsDuCompte = await Produit.find({ boutiqueId: compte._id, quantite: { $gt: 0 } });
    for (const produit of produitsDuCompte) {
      const dejaPresent = (produit.stockMagasins || []).some(sm => sm.magasin === magasin._id);
      if (dejaPresent) continue; // sécurité anti-doublon si rejoué

      produit.stockMagasins.push({ magasin: magasin._id, quantite: produit.quantite });
      await produit.save();
    }
  }

  await replierStockCaissesVersComptoirs();

  if (nbCaissesCreees > 0 || nbMagasinsCrees > 0) {
    console.log(`✅ Migration Boutiques/Caisses/Magasins : ${nbCaissesCreees} caisse(s) et ${nbMagasinsCrees} magasin(s) par défaut créé(s).`);
  }
}

module.exports = { migrerVersCaissesEtMagasins };