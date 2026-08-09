// Script de test : crée une vente via l'API locale.
// Lancer avec : node test-vente.js

const donnees = {
  produits: [
    { produit: 'c5d88160-119e-45e2-a19f-9a8bdd143240', quantite: 2, prixUnitaire: 5000 }
  ],
  montantTotal: 10000,
  clientNom: 'Client Test Desktop'
  // boutiqueId volontairement omis pour ce test : la table "boutiques" est
  // encore vide, et la contrainte FK refuserait un id fictif.
};

fetch('http://localhost:4000/api/ventes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(donnees)
})
  .then(res => res.json())
  .then(data => {
    console.log('✅ Réponse reçue :');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => {
    console.error('❌ Erreur :', err.message);
  });