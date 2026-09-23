/**
 * Ajoute les nouvelles clés d'icône introduites par des écrans ajoutés après
 * le jeu d'icônes initial (Inventaires, Fournisseurs, Rapports, Factures,
 * Sauvegarde, Dépenses & versements, cartes du tableau de bord...).
 *
 * Beaucoup d'icônes existantes ont été remplacées par le superadmin par de
 * vraies images uploadées (voir migration/optimiserIcones.js) : on ne touche
 * donc JAMAIS une clé déjà présente en base, seulement celles qui manquent —
 * idempotent, sûr à rejouer, exécuté au démarrage du serveur.
 */
async function ajouterIconesManquantes() {
  const Icone = require('../models/Icone');

  const nouvelles = [
    { cle: 'inventaires', valeur: '📋', categorie: 'menu', description: 'Inventaires' },
    { cle: 'fournisseurs', valeur: '🚚', categorie: 'menu', description: 'Fournisseurs' },
    { cle: 'rapports', valeur: '📈', categorie: 'menu', description: 'Rapports' },
    { cle: 'factures', valeur: '📄', categorie: 'menu', description: 'Factures' },
    { cle: 'sauvegarde', valeur: '💾', categorie: 'menu', description: 'Sauvegarde' },
    { cle: 'tresorerie', valeur: '💸', categorie: 'menu', description: 'Dépenses & versements' },
    { cle: 'solde', valeur: '🏦', categorie: 'menu', description: 'Solde de caisse' },
    { cle: 'calendrier', valeur: '🗓️', categorie: 'menu', description: 'Ventes du mois' },
    { cle: 'chiffreaffaires', valeur: '💹', categorie: 'menu', description: "Chiffre d'affaires" },
    { cle: 'monprofil', valeur: '🪪', categorie: 'menu', description: 'Mon profil' },
  ];

  const existantes = new Set((await Icone.find({ cle: { $in: nouvelles.map(n => n.cle) } }, 'cle').lean()).map(i => i.cle));
  const aCreer = nouvelles.filter(n => !existantes.has(n.cle));
  if (aCreer.length === 0) return;

  await Icone.insertMany(aCreer);
  console.log(`✅ Icônes ajoutées : ${aCreer.map(i => i.cle).join(', ')}`);
}

module.exports = { ajouterIconesManquantes };
