import { API_EN_LIGNE } from '../config';

// Configuration générale de la plateforme (nom de l'application, email de
// contact, devise, fuseau horaire), modifiable par le super admin dans
// Paramètres système — voir backend/routes/parametres.js.
//
// Lue sur le serveur EN LIGNE (le serveur local du desktop ne la connaît
// pas) et gardée dans le localStorage : le desktop la connaît donc aussi
// hors-ligne, et l'appli démarre directement avec la dernière valeur connue.
// Les composants lisent devise(), nomApplication()... au moment du rendu ;
// ConfigGeneraleProvider (App.js) les ré-affiche quand elle change.

export const DEFAUTS = {
  nomApplication: 'Boutique Stock',
  emailContact: 'contact@boutique-stock.com',
  devise: 'FCFA',
  fuseauHoraire: 'Africa/Douala',
};
const CLE_CACHE = 'configGenerale';
export const EVENEMENT = 'config-generale';

function lireCache() {
  try { return { ...DEFAUTS, ...JSON.parse(localStorage.getItem(CLE_CACHE) || '{}') }; } catch { return { ...DEFAUTS }; }
}

let config = lireCache();

export const configGenerale = () => config;
export const devise = () => config.devise;
export const nomApplication = () => config.nomApplication;
export const emailContact = () => config.emailContact;
export const fuseauHoraire = () => config.fuseauHoraire;

export function appliquerConfigGenerale(nouvelle) {
  const suivante = { ...DEFAUTS, ...nouvelle };
  const change = JSON.stringify(suivante) !== JSON.stringify(config);
  config = suivante;
  try { localStorage.setItem(CLE_CACHE, JSON.stringify(config)); } catch { /* stockage indisponible */ }
  document.title = config.nomApplication;
  if (change) window.dispatchEvent(new Event(EVENEMENT));
  return change; // vrai = l'appli va être ré-affichée
}

export async function chargerConfigGenerale() {
  const controleur = new AbortController();
  const delai = setTimeout(() => controleur.abort(), 15000);
  try {
    const res = await fetch(`${API_EN_LIGNE}/api/parametres/config`, { signal: controleur.signal });
    if (res.ok) appliquerConfigGenerale(await res.json());
  } catch {
    // hors-ligne : on garde la dernière configuration connue
  } finally {
    clearTimeout(delai);
  }
}

// Fuseau horaire : toutes les dates de l'appli sont affichées via
// toLocaleString/toLocaleDateString/toLocaleTimeString. Plutôt que de
// modifier chacun de ces appels, on y ajoute le fuseau configuré lorsqu'aucun
// n'est précisé — une seule règle, appliquée partout (écrans, factures PDF,
// exports Excel). Les nombres (Number.prototype.toLocaleString) ne sont pas
// concernés.
const originaux = {
  toLocaleString: Date.prototype.toLocaleString,
  toLocaleDateString: Date.prototype.toLocaleDateString,
  toLocaleTimeString: Date.prototype.toLocaleTimeString,
};
Object.entries(originaux).forEach(([nom, original]) => {
  // eslint-disable-next-line no-extend-native
  Date.prototype[nom] = function (locales, options) {
    if (options?.timeZone || !config.fuseauHoraire) return original.call(this, locales, options);
    try {
      return original.call(this, locales, { ...(options || {}), timeZone: config.fuseauHoraire });
    } catch {
      return original.call(this, locales, options); // fuseau invalide : affichage local
    }
  };
});

document.title = config.nomApplication;
