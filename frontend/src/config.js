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