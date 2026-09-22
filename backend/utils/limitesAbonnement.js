const Boutique = require('../models/Boutique');
const Produit = require('../models/Produit');

// Nombre maximum de produits qu'un Compte peut enregistrer selon son
// abonnement. Garder synchronisé avec les fiches plans affichées côté
// superadmin (components/SuperAdminOutils.js) et admin (Paramètres).
const LIMITES_PRODUITS = { gratuit: 5, standard: 500, premium: Infinity };

function limiteProduits(abonnement) {
  return LIMITES_PRODUITS[abonnement] ?? LIMITES_PRODUITS.gratuit;
}

// Vérifie qu'un Compte peut encore enregistrer `nombreAAjouter` produit(s)
// avant de les créer. Retourne { ok: true } si c'est possible, ou
// { ok: false, message } sinon (à renvoyer tel quel au client).
// boutiqueId manquant (produit non rattaché à un Compte) : jamais bloqué.
async function verifierLimiteProduits(boutiqueId, nombreAAjouter = 1) {
  if (!boutiqueId) return { ok: true };

  const boutique = await Boutique.findById(boutiqueId, 'abonnement nom');
  if (!boutique) return { ok: true }; // laisse Mongoose refuser via la référence manquante

  const limite = limiteProduits(boutique.abonnement);
  if (limite === Infinity) return { ok: true };

  const nbActuel = await Produit.countDocuments({ boutiqueId });
  if (nbActuel + nombreAAjouter > limite) {
    return {
      ok: false,
      message: `Le plan ${boutique.abonnement} est limité à ${limite} produit(s) (${nbActuel}/${limite} déjà enregistré(s)). Activez une licence standard ou premium pour en ajouter davantage.`,
    };
  }
  return { ok: true };
}

module.exports = { LIMITES_PRODUITS, limiteProduits, verifierLimiteProduits };
