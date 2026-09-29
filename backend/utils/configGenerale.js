const Parametre = require('../models/Parametre');

// Configuration générale de la plateforme, modifiable par le super admin
// (Paramètres système) et stockée dans Parametre sous la clé
// "configGenerale". Valeurs par défaut = celles qui étaient écrites en dur
// dans l'application avant que ce soit configurable.
const DEFAUTS = {
  nomApplication: 'Boutique Stock',
  emailContact: 'contact@boutique-stock.com',
  devise: 'FCFA',
  fuseauHoraire: 'Africa/Douala',
};

// Petit cache mémoire : lue par les e-mails, inutile d'interroger la base à
// chaque envoi ; invalidé dès qu'elle est modifiée.
let cache = null;
let cacheLeLe = 0;

async function lireConfigGenerale() {
  if (cache && Date.now() - cacheLeLe < 60000) return cache;
  const parametre = await Parametre.findOne({ cle: 'configGenerale' }).lean();
  cache = { ...DEFAUTS, ...(parametre?.valeur || {}) };
  cacheLeLe = Date.now();
  return cache;
}

// Vérifie et nettoie les valeurs envoyées ; renvoie { config } ou { erreur }.
function validerConfigGenerale(corps) {
  const config = {};
  const texte = (v) => String(v ?? '').trim();

  config.nomApplication = texte(corps.nomApplication);
  if (!config.nomApplication || config.nomApplication.length > 60) {
    return { erreur: "Le nom de l'application est requis (60 caractères maximum)." };
  }
  config.emailContact = texte(corps.emailContact);
  if (config.emailContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.emailContact)) {
    return { erreur: "L'email de contact n'est pas valide." };
  }
  config.devise = texte(corps.devise);
  if (!config.devise || config.devise.length > 10) {
    return { erreur: 'La devise est requise (10 caractères maximum, ex : FCFA, EUR, $).' };
  }
  config.fuseauHoraire = texte(corps.fuseauHoraire);
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: config.fuseauHoraire });
  } catch {
    return { erreur: 'Fuseau horaire inconnu (exemples valides : Africa/Douala, Africa/Abidjan, Europe/Paris).' };
  }
  return { config };
}

async function enregistrerConfigGenerale(config) {
  await Parametre.findOneAndUpdate({ cle: 'configGenerale' }, { valeur: config }, { upsert: true });
  cache = null;
  return lireConfigGenerale();
}

module.exports = { DEFAUTS, lireConfigGenerale, validerConfigGenerale, enregistrerConfigGenerale };
