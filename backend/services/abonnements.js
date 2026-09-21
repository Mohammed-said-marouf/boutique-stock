const cron = require('node-cron');
const Boutique = require('../models/Boutique');
const enregistrerLog = require('../utils/logger');

// Ajoute n mois à une date en restant dans le bon mois (31 janv. + 1 mois =
// 28/29 févr., pas 3 mars).
function ajouterMois(date, n) {
  const jour = date.getDate();
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(jour, dernierJour));
  return d;
}

// Une boutique dont la licence est arrivée à expiration repasse au plan
// gratuit : elle continue de fonctionner, personne n'est bloqué.
async function expirerAbonnements() {
  const maintenant = new Date();
  const expirees = await Boutique.find({
    abonnement: { $ne: 'gratuit' },
    abonnementExpireLe: { $ne: null, $lte: maintenant },
  });

  for (const boutique of expirees) {
    const ancien = boutique.abonnement;
    // Le filtre sur la date évite d'écraser une licence activée entre-temps
    const r = await Boutique.updateOne(
      { _id: boutique._id, abonnementExpireLe: { $lte: maintenant } },
      { $set: { abonnement: 'gratuit', abonnementExpireLe: null } }
    );
    if (r.modifiedCount) {
      await enregistrerLog({
        type: 'abonnement_expire',
        message: `${boutique.nom} : ${ancien} → gratuit`,
        nomUtilisateur: 'Système',
        niveau: 'info',
      });
    }
  }
  if (expirees.length > 0) console.log(`⏰ ${expirees.length} abonnement(s) expiré(s) : retour au plan gratuit.`);
}

const demarrerVerificationAbonnements = () => {
  expirerAbonnements().catch(err => console.log('❌ Erreur expiration abonnements :', err.message));
  // Toutes les heures
  cron.schedule('15 * * * *', () => {
    expirerAbonnements().catch(err => console.log('❌ Erreur expiration abonnements :', err.message));
  });
  console.log('✅ Vérification automatique des abonnements démarrée');
};

module.exports = { ajouterMois, expirerAbonnements, demarrerVerificationAbonnements };
