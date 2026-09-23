const Boutique = require('../models/Boutique');
const Comptoir = require('../models/Comptoir');
const Caisse = require('../models/Caisse');
const Magasin = require('../models/Magasin');
const Produit = require('../models/Produit');
const Client = require('../models/Client');
const Vente = require('../models/Vente');
const MouvementStock = require('../models/MouvementStock');
const Depense = require('../models/Depense');
const Versement = require('../models/Versement');
const Licence = require('../models/Licence');
const Inventaire = require('../models/Inventaire');
const User = require('../models/User');

/**
 * Supprime DÉFINITIVEMENT un Compte (Boutique) et TOUTES les données qui lui
 * appartiennent : utilisateurs, boutiques (Comptoirs) et leurs caisses,
 * magasins, produits, clients, ventes, mouvements de stock, dépenses,
 * versements, licences et inventaires. Appelée par DELETE /api/boutiques/:id
 * — irréversible.
 *
 * Les Fournisseurs ne sont pas rattachés à un Compte (partagés entre
 * comptes) : jamais supprimés ici.
 *
 * Retourne le nombre de documents supprimés par catégorie, pour le journal
 * d'activités et pour informer le superadmin de ce qui a disparu.
 */
async function supprimerCompteEtDonnees(boutiqueId) {
  const comptoirs = await Comptoir.find({ boutiqueId }, '_id');
  const idsComptoirs = comptoirs.map(c => c._id);

  const [
    utilisateurs, produits, clients, ventes, mouvements,
    depenses, versements, licences, inventaires, caisses, magasins,
  ] = await Promise.all([
    User.deleteMany({ boutiqueId }),
    Produit.deleteMany({ boutiqueId }),
    Client.deleteMany({ boutiqueId }),
    Vente.deleteMany({ boutiqueId }),
    MouvementStock.deleteMany({ boutiqueId }),
    Depense.deleteMany({ boutiqueId }),
    Versement.deleteMany({ boutiqueId }),
    Licence.deleteMany({ boutiqueId }),
    Inventaire.deleteMany({ boutiqueId }),
    Caisse.deleteMany({ comptoirId: { $in: idsComptoirs } }),
    Magasin.deleteMany({ boutiqueId }),
  ]);
  const comptoirsSupprimes = await Comptoir.deleteMany({ boutiqueId });
  await Boutique.findByIdAndDelete(boutiqueId);

  return {
    utilisateurs: utilisateurs.deletedCount,
    produits: produits.deletedCount,
    clients: clients.deletedCount,
    ventes: ventes.deletedCount,
    mouvements: mouvements.deletedCount,
    depenses: depenses.deletedCount,
    versements: versements.deletedCount,
    licences: licences.deletedCount,
    inventaires: inventaires.deletedCount,
    caisses: caisses.deletedCount,
    magasins: magasins.deletedCount,
    comptoirs: comptoirsSupprimes.deletedCount,
  };
}

module.exports = { supprimerCompteEtDonnees };
