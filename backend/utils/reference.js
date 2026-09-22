const Compteur = require('../models/Compteur');

// Initiales du nom du produit : première lettre de chaque mot, en majuscule.
// "Riz Basmati" -> "RB", "Savon" -> "S", "Coca-Cola 33cl" -> "CC" (un mot qui
// ne COMMENCE PAS par une lettre, comme "33cl", est ignoré — /^.../ ancre la
// recherche en tête de mot, sinon "33cl" ferait matcher le "c" du milieu).
// Repli sur "PRD" si le nom ne contient aucun mot commençant par une lettre.
function initiales(nom) {
  const lettres = String(nom || '')
    .split(/[\s\-_/]+/)
    .map(mot => mot.match(/^[A-Za-zÀ-ÖØ-öø-ÿ]/))
    .filter(Boolean)
    .map(m => m[0].toUpperCase());
  return lettres.length > 0 ? lettres.join('') : 'PRD';
}

// Génère la référence d'un nouveau produit à partir des initiales de son
// nom : "RB-001", puis "RB-002" pour le prochain produit dont le nom donne
// les mêmes initiales, etc. La séquence est propre à chaque Compte
// (boutiqueId) — deux comptes ne se marchent jamais dessus — et incrémentée
// de façon atomique pour rester correcte même si plusieurs produits sont
// créés en même temps (import en masse compris).
async function genererReference(nom, boutiqueId) {
  const prefixe = initiales(nom);
  const cle = `ref:${boutiqueId || 'sans-compte'}:${prefixe}`;
  const compteur = await Compteur.findOneAndUpdate(
    { _id: cle },
    { $inc: { valeur: 1 } },
    { upsert: true, new: true }
  );
  const numero = String(compteur.valeur).padStart(3, '0');
  return `${prefixe}-${numero}`;
}

module.exports = { genererReference, initiales };
