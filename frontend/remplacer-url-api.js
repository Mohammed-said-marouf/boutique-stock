/**
 * Script à lancer UNE SEULE FOIS, depuis frontend/, avec :
 *   node remplacer-url-api.js
 *
 * Parcourt tout src/, remplace chaque occurrence de l'URL en dur
 * (quel que soit le type de guillemets utilisé) par un template literal
 * utilisant API_URL, et ajoute l'import de config.js si nécessaire.
 *
 * IMPORTANT : fais un commit AVANT de lancer ce script, pour pouvoir
 * comparer le diff (git diff) et vérifier que tout est correct avant de
 * committer le résultat. Le script ne touche qu'à src/, jamais à
 * node_modules ni build/.
 */

const fs = require('fs');
const path = require('path');

const DOSSIER_SRC = path.join(__dirname, 'src');
const ANCIENNE_URL = 'https://boutique-stock-api.onrender.com';

// Capture l'URL entre guillemets simples, doubles ou backticks, et tout ce
// qui suit jusqu'à la fermeture du même type de guillemet (ex: le chemin
// /api/clients, avec d'éventuels ${...} déjà présents dans un template).
const REGEX_URL = /(['"`])https:\/\/boutique-stock-api\.onrender\.com([^'"`]*)\1/g;

function listerFichiersJs(dossier) {
  let resultats = [];
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const cheminComplet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      resultats = resultats.concat(listerFichiersJs(cheminComplet));
    } else if (entree.isFile() && (entree.name.endsWith('.js') || entree.name.endsWith('.jsx'))) {
      resultats.push(cheminComplet);
    }
  }
  return resultats;
}

function calculerCheminImport(fichier) {
  // Chemin relatif depuis le fichier jusqu'à src/config.js
  const dossierFichier = path.dirname(fichier);
  let relatif = path.relative(dossierFichier, path.join(DOSSIER_SRC, 'config'));
  relatif = relatif.split(path.sep).join('/'); // Windows -> style import JS
  if (!relatif.startsWith('.')) relatif = './' + relatif;
  return relatif;
}

let fichiersModifies = 0;
let occurrencesRemplacees = 0;

for (const fichier of listerFichiersJs(DOSSIER_SRC)) {
  if (path.resolve(fichier) === path.resolve(path.join(DOSSIER_SRC, 'config.js'))) continue;

  let contenu = fs.readFileSync(fichier, 'utf8');
  if (!contenu.includes(ANCIENNE_URL)) continue;

  const nbOccurrencesAvant = (contenu.match(REGEX_URL) || []).length;
  contenu = contenu.replace(REGEX_URL, (correspondanceComplete, guillemet, reste) => {
    return '`${API_URL}' + reste + '`';
  });

  // Ajoute l'import s'il n'est pas déjà présent dans le fichier.
  if (!contenu.includes("from '" + calculerCheminImport(fichier) + "'") && !/import\s*{\s*API_URL\s*}/.test(contenu)) {
    const cheminImport = calculerCheminImport(fichier);
    const ligneImport = `import { API_URL } from '${cheminImport}';\n`;

    // Insère après le dernier import existant, ou en tout début de fichier si aucun import.
    const dernierImportMatch = [...contenu.matchAll(/^import .*;\s*$/gm)].pop();
    if (dernierImportMatch) {
      const positionFin = dernierImportMatch.index + dernierImportMatch[0].length;
      contenu = contenu.slice(0, positionFin) + '\n' + ligneImport + contenu.slice(positionFin);
    } else {
      contenu = ligneImport + contenu;
    }
  }

  fs.writeFileSync(fichier, contenu, 'utf8');
  fichiersModifies++;
  occurrencesRemplacees += nbOccurrencesAvant;
  console.log(`✅ ${path.relative(DOSSIER_SRC, fichier)} — ${nbOccurrencesAvant} occurrence(s) remplacée(s)`);
}

console.log(`\nTerminé : ${occurrencesRemplacees} occurrence(s) remplacée(s) dans ${fichiersModifies} fichier(s).`);
console.log('Vérifie le résultat avec "git diff" avant de committer.');