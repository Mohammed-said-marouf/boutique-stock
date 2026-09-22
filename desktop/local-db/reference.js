/**
 * Génération de la référence d'un produit — équivalent local (SQLite) de
 * backend/utils/reference.js. Pas de partage de code entre les deux serveurs
 * (backend en ligne / serveur local desktop), comme pour le reste des
 * modèles/routes de ce dossier : la logique est dupliquée intentionnellement.
 *
 * Contrairement à Mongo, pas besoin de compteur atomique séparé ici :
 * better-sqlite3 est synchrone et Node mono-thread traite les requêtes une
 * par une, donc lire le max existant puis l'utiliser ne peut pas dupliquer.
 */

// Initiales du nom du produit : première lettre de chaque mot, en majuscule.
// Identique à backend/utils/reference.js — garder les deux synchronisés.
// /^.../ ancre la recherche en tête de mot : un mot qui ne commence pas par
// une lettre (ex: "33cl") est ignoré plutôt que de matcher une lettre en son
// milieu.
function initiales(nom) {
  const lettres = String(nom || '')
    .split(/[\s\-_/]+/)
    .map(mot => mot.match(/^[A-Za-zÀ-ÖØ-öø-ÿ]/))
    .filter(Boolean)
    .map(m => m[0].toUpperCase());
  return lettres.length > 0 ? lettres.join('') : 'PRD';
}

// Génère la référence suivante pour ce Compte, à partir des initiales du nom
// ("RB-001", "RB-002"...). Les produits supprimés comptent aussi dans la
// recherche du numéro le plus haut, pour ne jamais réutiliser une référence.
function genererReference(db, nom, boutiqueId) {
  const prefixe = initiales(nom);
  // "IS" plutôt que "=" : contrairement à Mongo, SQLite ne fait jamais
  // matcher "colonne = ?" quand le paramètre est NULL (même sur une colonne
  // NULL) — "IS" gère cette comparaison correctement dans les deux cas.
  const lignes = db.prepare('SELECT ref FROM produits WHERE boutique_id IS ? AND ref LIKE ?').all(boutiqueId, `${prefixe}-%`);

  let max = 0;
  for (const { ref } of lignes) {
    const m = /-(\d+)$/.exec(ref || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const numero = String(max + 1).padStart(3, '0');
  return `${prefixe}-${numero}`;
}

module.exports = { genererReference, initiales };
