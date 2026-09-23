// URL de base de l'API. En build normal (web, Vercel), aucune variable
// d'environnement REACT_APP_API_URL n'est définie, donc le fallback vers
// la prod s'applique automatiquement — la version web continue de
// fonctionner sans aucun changement.
//
// Pour le build desktop, on définit REACT_APP_API_URL=http://localhost:4000
// avant de lancer `npm run build`, ce qui fige cette valeur dans le build
// résultant (spécifique à Create React App : toute variable préfixée
// REACT_APP_ est injectée au moment du build).
export const API_URL = process.env.REACT_APP_API_URL || 'https://boutique-stock-api.onrender.com';

// Vrai uniquement pour le build desktop (seul build où API_URL est figé sur
// localhost, voir commentaire ci-dessus) — sert à n'afficher les éléments
// d'UI propres à la synchro (bouton "synchroniser maintenant"...) que là où
// ils ont un sens : le web et l'APK parlent directement au serveur en
// ligne, il n'y a rien à synchroniser de leur côté.
export const estDesktop = API_URL.includes('localhost');