/**
 * Migration vers le système Boutique → Caisses / Compte → Magasins.
 *
 * Exécutée automatiquement au démarrage du serveur (voir server.js), après
 * la connexion à MongoDB. Entièrement idempotente : rejouer cette fonction
 * sur une base déjà migrée ne fait rien (chaque étape se vérifie avant d'agir).
 *
 * Ce qu'elle fait, pour chaque Comptoir (= "Boutique" dans l'interface) qui
 * n'a encore AUCUNE Caisse :
 *   1. Crée une Caisse par défaut dessus (même nom que le comptoir).
 *   2. Déplace tout le stock de Produit.stockComptoirs (ancien système) vers
 *      Produit.stockCaisses, sur cette nouvelle caisse.
 *
 * Et pour chaque Boutique (= "Compte" dans l'interface) qui n'a encore AUCUN
 * Magasin :
 *   1. Crée un Magasin par défaut dessus ("Magasin principal").
 *   2. Déplace le stock Magasin actuel de chaque produit (Produit.quantite)
 *      vers Produit.stockMagasins, sur ce nouveau magasin.
 *
 * Rien n'est jamais supprimé silencieusement : les anciens champs
 * (stockComptoirs) sont laissés tels quels après migration, juste plus lus
 * par le nouveau code — au cas où il faudrait vérifier/revenir en arrière.
 */

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

    const caisse = await new Caisse({
      nom: comptoir.nom,
      comptoirId: comptoir._id,
      actif: true,
    }).save();
    nbCaissesCreees++;

    // Déplace le stock stockComptoirs -> stockCaisses pour tous les produits
    // qui avaient du stock sur ce comptoir.
    const produitsAvecStock = await Produit.find({ 'stockComptoirs.comptoir': comptoir._id });
    for (const produit of produitsAvecStock) {
      const ligne = (produit.stockComptoirs || []).find(sc => sc.comptoir === comptoir._id);
      if (!ligne || ligne.quantite <= 0) continue;

      const dejaPresent = (produit.stockCaisses || []).some(sc => sc.caisse === caisse._id);
      if (dejaPresent) continue; // sécurité anti-doublon si rejoué

      produit.stockCaisses.push({ caisse: caisse._id, quantite: ligne.quantite });
      await produit.save();
    }
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

  if (nbCaissesCreees > 0 || nbMagasinsCrees > 0) {
    console.log(`✅ Migration Boutiques/Caisses/Magasins : ${nbCaissesCreees} caisse(s) et ${nbMagasinsCrees} magasin(s) par défaut créé(s).`);
  }
}

module.exports = { migrerVersCaissesEtMagasins };