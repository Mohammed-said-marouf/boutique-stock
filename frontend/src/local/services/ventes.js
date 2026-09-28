// Service local "ventes" pour l'APK Android hors-ligne — port de
// desktop/routes/ventes.js (lui-même un miroir de backend/routes/ventes.js
// sur SQLite plutôt que MongoDB). Gère, comme le desktop :
//  - le décrément du stock DU COMPTOIR vendu (jamais le stock Magasin, qui
//    n'est qu'une réserve non vendable directement),
//  - la création/mise à jour automatique de la fiche client,
//  - les statistiques (jour/mois/total), avec debutJour/debutMois fournis par
//    l'appelant (fuseau horaire de l'appareil, jamais celui du serveur).
//
// Différence avec le desktop : pas de req/res ni de db.transaction()
// (better-sqlite3, synchrone) — la création d'une vente est un seul lot
// d'instructions envoyé à executerLot() (transaction atomique côté plugin
// SQLite, asynchrone). L'identité de l'appelant vient de identiteActuelle().

import { interroger, interrogerUne, executerLot } from '../../local-db/db';
import { identiteActuelle } from '../identite';

const maintenant = () => new Date().toISOString();
const nouvelId = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function ajouterAOutboxInstruction(collection, operation, recordId, payload, auteurId) {
  return {
    statement: `INSERT INTO sync_outbox (collection, operation, record_id, payload, auteur_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    values: [collection, operation, recordId, payload ? JSON.stringify(payload) : null, auteurId || null, maintenant()],
  };
}

// Récupère une vente complète (avec ses lignes de produits) au format attendu
// par le frontend (même forme que chargerVenteComplete côté desktop).
async function chargerVenteComplete(venteId) {
  const vente = await interrogerUne('SELECT * FROM ventes WHERE id = ? AND is_deleted = 0', [venteId]);
  if (!vente) return null;

  const lignes = await interroger(
    `SELECT vp.quantite, vp.prix_unitaire, p.id AS produit_id, p.nom, p.categorie, p.prix, p.image
     FROM vente_produits vp LEFT JOIN produits p ON p.id = vp.produit_id
     WHERE vp.vente_id = ?`,
    [venteId]
  );

  return {
    _id: vente.id,
    produits: lignes.map(l => ({
      produit: l.produit_id ? { _id: l.produit_id, nom: l.nom, categorie: l.categorie, prix: l.prix, image: l.image } : null,
      quantite: l.quantite,
      prixUnitaire: l.prix_unitaire,
    })),
    montantTotal: vente.montant_total,
    typeVente: vente.type_vente,
    vendeur: vente.vendeur,
    nomVendeur: vente.nom_vendeur,
    clientNom: vente.client_nom,
    numFacture: vente.num_facture,
    boutiqueId: vente.boutique_id,
    comptoirId: vente.comptoir_id,
    caisseId: vente.caisse_id,
    dateVente: vente.date_vente,
    notes: vente.notes,
  };
}

// GET équivalent — liste des ventes visibles par l'appelant.
export async function listerVentes() {
  const identite = identiteActuelle();
  const boutiqueFiltre = (identite && (identite.role === 'admin' || identite.role === 'vendeur') && identite.boutiqueId)
    ? identite.boutiqueId
    : null;

  let sql = 'SELECT id FROM ventes WHERE is_deleted = 0';
  const params = [];
  if (boutiqueFiltre) { sql += ' AND boutique_id = ?'; params.push(boutiqueFiltre); }
  sql += ' ORDER BY date_vente DESC';

  const lignes = await interroger(sql, params);
  const ventes = [];
  for (const { id } of lignes) ventes.push(await chargerVenteComplete(id));
  return { data: ventes };
}

// POST équivalent — enregistre une vente (transaction atomique).
export async function creerVente(corps) {
  const identite = identiteActuelle();
  const { produits, montantTotal, typeVente, vendeur, nomVendeur, clientNom, comptoirId, notes } = corps;

  if (!Array.isArray(produits) || produits.length === 0 || montantTotal === undefined) {
    const err = new Error('produits (tableau) et montantTotal sont requis.');
    err.response = { data: { message: err.message } };
    throw err;
  }
  if (!comptoirId) {
    const err = new Error('comptoirId requis : choisissez le comptoir de vente.');
    err.response = { data: { message: err.message } };
    throw err;
  }

  // boutiqueId/caisseId viennent TOUJOURS de l'identité pour un
  // admin/vendeur (jamais du corps envoyé par l'appelant) — même règle que
  // le backend en ligne et le desktop : empêche un vendeur de "vendre au
  // nom" d'une autre boutique/caisse.
  const boutiqueId = (identite && (identite.role === 'admin' || identite.role === 'vendeur') && identite.boutiqueId)
    ? identite.boutiqueId
    : (corps.boutiqueId || null);
  const caisseId = identite?.role === 'vendeur' ? (identite.caisseId || null) : (corps.caisseId || null);

  // Validation préalable : chaque produit doit avoir assez de stock à CE
  // comptoir, avant d'émettre la moindre écriture.
  for (const item of produits) {
    const ligneStock = await interrogerUne('SELECT quantite FROM stock_comptoirs WHERE produit_id = ? AND comptoir_id = ?', [item.produit, comptoirId]);
    const dispo = ligneStock ? ligneStock.quantite : 0;
    if (dispo < item.quantite) {
      const produitInfo = await interrogerUne('SELECT nom FROM produits WHERE id = ?', [item.produit]);
      const err = new Error(`Stock insuffisant à ce comptoir pour "${produitInfo?.nom || item.produit}" (disponible : ${dispo}).`);
      err.response = { data: { message: err.message } };
      throw err;
    }
  }

  const venteId = nouvelId();
  const numFacture = 'FAC-' + Date.now().toString().slice(-6);
  const ts = maintenant();
  const instructions = [];

  instructions.push({
    statement: `INSERT INTO ventes (id, montant_total, type_vente, vendeur, nom_vendeur, client_nom, num_facture, boutique_id, comptoir_id, caisse_id, date_vente, notes, created_at, updated_at, is_dirty, is_deleted)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    values: [venteId, montantTotal, typeVente || 'presentiel', vendeur || null, nomVendeur || null, clientNom || 'Client anonyme', numFacture, boutiqueId || null, comptoirId, caisseId || null, ts, notes || null, ts, ts],
  });

  // Lignes de produits + décrément du stock DU COMPTOIR (jamais du Magasin).
  for (const item of produits) {
    instructions.push({
      statement: 'INSERT INTO vente_produits (id, vente_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?, ?)',
      values: [nouvelId(), venteId, item.produit, item.quantite, item.prixUnitaire],
    });
    instructions.push({
      statement: 'UPDATE stock_comptoirs SET quantite = quantite - ?, updated_at = ? WHERE produit_id = ? AND comptoir_id = ?',
      values: [item.quantite, ts, item.produit, comptoirId],
    });
    instructions.push(ajouterAOutboxInstruction('produits', 'update', item.produit, null, identite?.id));
  }

  // Création/mise à jour automatique de la fiche client.
  const nomClient = (clientNom || '').trim();
  if (nomClient && nomClient.toLowerCase() !== 'client anonyme' && boutiqueId) {
    const clientExistant = await interrogerUne('SELECT * FROM clients WHERE nom = ? AND boutique_id = ?', [nomClient, boutiqueId]);
    if (clientExistant) {
      instructions.push({
        statement: 'UPDATE clients SET achats = achats + 1, total = total + ?, updated_at = ?, is_dirty = 1 WHERE id = ?',
        values: [montantTotal, ts, clientExistant.id],
      });
      instructions.push(ajouterAOutboxInstruction('clients', 'update', clientExistant.id, null, identite?.id));
    } else {
      const clientId = nouvelId();
      instructions.push({
        statement: 'INSERT INTO clients (id, nom, boutique_id, achats, total, created_at, updated_at, is_dirty, is_deleted) VALUES (?, ?, ?, 1, ?, ?, ?, 1, 0)',
        values: [clientId, nomClient, boutiqueId, montantTotal, ts, ts],
      });
      instructions.push(ajouterAOutboxInstruction('clients', 'create', clientId, null, identite?.id));
    }
  }

  // La vente elle-même (payload complet, contrairement aux outbox
  // "produits"/"clients" ci-dessus qui ne portent qu'un signal — voir
  // desktop/sync/push.js pour la résolution des ids manquants à l'envoi).
  instructions.push(ajouterAOutboxInstruction('ventes', 'create', venteId, null, identite?.id));

  await executerLot(instructions);
  return { data: await chargerVenteComplete(venteId) };
}

// GET /stats équivalent — debutJour/debutMois doivent être fournis par
// l'appelant (voir frontend/src/api/ventes.js : calculés côté client, jamais
// par le serveur, pour rester cohérents avec le fuseau horaire de la
// boutique).
export async function statsVentes(debutJour, debutMois) {
  const identite = identiteActuelle();
  const boutiqueId = (identite && (identite.role === 'admin' || identite.role === 'vendeur') && identite.boutiqueId)
    ? identite.boutiqueId
    : null;
  const filtreBoutique = boutiqueId ? ' AND boutique_id = ?' : '';
  const paramsBoutique = boutiqueId ? [boutiqueId] : [];

  const debutJourIso = debutJour || (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); })();
  const debutMoisIso = debutMois || (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString(); })();

  const totalVentes = (await interrogerUne(`SELECT COUNT(*) AS n FROM ventes WHERE is_deleted = 0${filtreBoutique}`, paramsBoutique)).n;
  const chiffreAffaires = (await interrogerUne(`SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes WHERE is_deleted = 0${filtreBoutique}`, paramsBoutique)).total;

  const ventesJour = (await interrogerUne(`SELECT COUNT(*) AS n FROM ventes WHERE is_deleted = 0 AND date_vente >= ?${filtreBoutique}`, [debutJourIso, ...paramsBoutique])).n;
  const caJour = (await interrogerUne(`SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes WHERE is_deleted = 0 AND date_vente >= ?${filtreBoutique}`, [debutJourIso, ...paramsBoutique])).total;

  const ventesMois = (await interrogerUne(`SELECT COUNT(*) AS n FROM ventes WHERE is_deleted = 0 AND date_vente >= ?${filtreBoutique}`, [debutMoisIso, ...paramsBoutique])).n;
  const caMois = (await interrogerUne(`SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes WHERE is_deleted = 0 AND date_vente >= ?${filtreBoutique}`, [debutMoisIso, ...paramsBoutique])).total;

  return { data: { totalVentes, chiffreAffaires, ventesJour, caJour, ventesMois, caMois } };
}
