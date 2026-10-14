// Service local "produits" pour l'APK Android hors-ligne — lecture seule
// (le vendeur ne crée/modifie jamais de produit, voir le plan : périmètre
// vendeur uniquement). Port de la lecture de desktop/routes/produits.js.
//
// stockMagasins n'est jamais renseigné (toujours []) : la répartition du
// stock par Magasin n'est pas répliquée sur l'appareil du vendeur (table
// stock_magasins absente du schéma mobile, voir local-db/schema.js) — le
// vendeur n'en a pas besoin, seul stockComptoirs (stock vendable) compte
// pour vendre (voir CaisseVendeur.stockBoutiqueDe côté frontend).

import { interroger, interrogerUne } from '../../local-db/db';
import { identiteActuelle } from '../identite';

async function versFormatApi(ligne) {
  const stockComptoirs = await interroger(
    `SELECT sc.comptoir_id, sc.quantite, c.nom AS comptoir_nom, c.actif AS comptoir_actif
     FROM stock_comptoirs sc JOIN comptoirs c ON c.id = sc.comptoir_id
     WHERE sc.produit_id = ?`,
    [ligne.id]
  );

  return {
    _id: ligne.id,
    nom: ligne.nom,
    description: ligne.description,
    prix: ligne.prix,
    quantite: ligne.quantite,
    stockMagasins: [],
    stockComptoirs: stockComptoirs.map(sc => ({
      comptoir: { _id: sc.comptoir_id, nom: sc.comptoir_nom, actif: !!sc.comptoir_actif },
      quantite: sc.quantite,
    })),
    categorie: ligne.categorie,
    fournisseur: ligne.fournisseur,
    boutiqueId: ligne.boutique_id,
    seuilAlerte: ligne.seuil_alerte,
    ref: ligne.ref,
    // Chemin relatif (/uploads/produits/xxx.png) ou URL Cloudinary complète,
    // selon d'où vient la dernière synchro — resoudreImage() (frontend) gère
    // les deux cas, comme pour le desktop.
    image: ligne.image,
    dateAjout: ligne.date_ajout,
  };
}

// GET équivalent — catalogue de la boutique de l'appelant.
export async function listerProduits() {
  const identite = identiteActuelle();
  let sql = 'SELECT * FROM produits WHERE is_deleted = 0';
  const params = [];
  if ((identite?.role === 'admin' || identite?.role === 'vendeur') && identite.boutiqueId) {
    sql += ' AND boutique_id = ?';
    params.push(identite.boutiqueId);
  }
  sql += ' ORDER BY date_ajout DESC';
  const lignes = await interroger(sql, params);

  const data = [];
  for (const ligne of lignes) data.push(await versFormatApi(ligne));
  return { data };
}

// GET /alertes-boutiques équivalent (cloche de notification) — port de
// desktop/routes/produits.js : produits au seuil d'alerte ou en dessous dans
// le stock de la boutique (comptoir) de la caisse du vendeur.
export async function alertesStockBoutiques() {
  const identite = identiteActuelle();
  const caisse = identite?.caisseId
    ? await interrogerUne('SELECT comptoir_id FROM caisses WHERE id = ? AND is_deleted = 0', [identite.caisseId])
    : null;
  if (!caisse) return { data: { total: 0, boutiques: [] } };

  const comptoirs = await interroger('SELECT id, nom FROM comptoirs WHERE id = ? AND is_deleted = 0 AND actif = 1', [caisse.comptoir_id]);
  const boutiques = [];
  for (const c of comptoirs) {
    const produits = await interroger(
      `SELECT p.id, p.nom, p.ref, sc.quantite, COALESCE(p.seuil_alerte, 5) AS seuil
       FROM stock_comptoirs sc JOIN produits p ON p.id = sc.produit_id
       WHERE sc.comptoir_id = ? AND p.is_deleted = 0 AND sc.quantite <= COALESCE(p.seuil_alerte, 5)
       ORDER BY sc.quantite ASC`,
      [c.id]
    );
    if (produits.length > 0) {
      boutiques.push({
        comptoirId: c.id,
        comptoirNom: c.nom,
        produits: produits.map(p => ({ _id: p.id, nom: p.nom, ref: p.ref, quantite: p.quantite, seuilAlerte: p.seuil })),
      });
    }
  }
  return { data: { total: boutiques.reduce((s, b) => s + b.produits.length, 0), boutiques } };
}
