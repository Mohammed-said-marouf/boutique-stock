// Service local "trésorerie" (dépenses, versements, soldes de caisse) pour
// l'APK Android hors-ligne — port de desktop/utils/tresorerie.js +
// desktop/routes/tresorerie.js + desktop/routes/depenses.js +
// desktop/routes/versements.js (eux-mêmes des miroirs de
// backend/utils/tresorerie.js et backend/routes/depenses.js|versements.js).
//
// Différence avec le desktop : pas de req/res, chaque fonction prend
// directement ses paramètres et lit l'identité de l'appelant via
// identiteActuelle() (frontend/src/local/identite.js). Les noms de fonctions
// et formes de retour suivent volontairement frontend/src/api/tresorerie.js
// (même contrat), pour que le câblage de la Phase 4 puisse basculer de l'un à
// l'autre sans changer les call sites.
//
// solde d'une caisse = ventes en espèces (hors "en_ligne") - dépenses -
// versements VALIDÉS (voir backend/routes/tresorerie.js).

import { interroger, interrogerUne, lancer } from '../../local-db/db';
import { identiteActuelle } from '../identite';

const maintenant = () => new Date().toISOString();
const nouvelId = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function ajouterAOutbox(collection, operation, recordId, payload, auteurId) {
  return lancer(
    `INSERT INTO sync_outbox (collection, operation, record_id, payload, auteur_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [collection, operation, recordId, payload ? JSON.stringify(payload) : null, auteurId || null, maintenant()]
  );
}

// Résout la caisse sur laquelle une dépense/un versement est enregistré, et
// vérifie qu'elle appartient bien au Compte de l'appelant (sauf superadmin).
// Un vendeur utilise TOUJOURS sa caisse assignée (jamais une valeur passée en
// paramètre) ; un admin/superadmin la précise via `corps.caisseId`.
async function resoudreCaisse(identite, corps) {
  const caisseId = identite?.role === 'vendeur' ? identite.caisseId : corps?.caisseId;
  if (!caisseId) {
    return {
      statut: 400,
      erreur: identite?.role === 'vendeur'
        ? "Aucune caisse ne vous est assignée — demandez à l'admin de vous en attribuer une."
        : 'caisseId requis : choisissez la caisse.',
    };
  }
  const caisse = await interrogerUne('SELECT * FROM caisses WHERE id = ? AND is_deleted = 0', [caisseId]);
  if (!caisse) return { statut: 404, erreur: 'Caisse introuvable.' };
  const comptoir = await interrogerUne('SELECT * FROM comptoirs WHERE id = ? AND is_deleted = 0', [caisse.comptoir_id]);
  if (!comptoir) return { statut: 404, erreur: 'Boutique introuvable.' };
  if (identite && identite.role !== 'superadmin' && comptoir.boutique_id !== identite.boutiqueId) {
    return { statut: 403, erreur: 'Accès refusé.' };
  }
  return { caisse, comptoir };
}

// Filtre de lecture : un vendeur ne voit que ses propres lignes, un admin
// toutes celles de son Compte, un superadmin tout.
function clauseFiltreLecture(identite) {
  if (identite?.role === 'vendeur') return { sql: 'boutique_id = ? AND auteur = ?', params: [identite.boutiqueId, identite.id] };
  if (identite?.role === 'admin') return { sql: 'boutique_id = ?', params: [identite.boutiqueId] };
  return { sql: '', params: [] };
}

function versFormatApiDepense(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    montant: ligne.montant,
    motif: ligne.motif,
    note: ligne.note || '',
    boutiqueId: ligne.boutique_id,
    comptoirId: ligne.comptoir_id,
    caisseId: ligne.caisse_id,
    auteur: ligne.auteur,
    nomAuteur: ligne.nom_auteur || '',
    roleAuteur: ligne.role_auteur || '',
    date: ligne.date,
  };
}

function versFormatApiVersement(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    montant: ligne.montant,
    note: ligne.note || '',
    statut: ligne.statut,
    decidePar: ligne.decide_par,
    nomDecidePar: ligne.nom_decide_par || '',
    dateDecision: ligne.date_decision,
    motifRefus: ligne.motif_refus || '',
    boutiqueId: ligne.boutique_id,
    comptoirId: ligne.comptoir_id,
    caisseId: ligne.caisse_id,
    auteur: ligne.auteur,
    nomAuteur: ligne.nom_auteur || '',
    date: ligne.date,
  };
}

// ===================== Soldes =====================

// Retourne { ok, status, data } comme frontend/src/api/tresorerie.js (même
// contrat, pour que la Phase 4 puisse appeler indifféremment l'un ou l'autre).
export async function soldes() {
  const identite = identiteActuelle();
  let caisses;
  if (identite?.role === 'vendeur') {
    caisses = identite.caisseId
      ? await interroger('SELECT * FROM caisses WHERE id = ? AND is_deleted = 0', [identite.caisseId])
      : [];
  } else if (identite?.role === 'admin') {
    caisses = await interroger(
      `SELECT ca.* FROM caisses ca JOIN comptoirs co ON co.id = ca.comptoir_id WHERE ca.is_deleted = 0 AND co.boutique_id = ?`,
      [identite.boutiqueId]
    );
  } else {
    caisses = await interroger('SELECT * FROM caisses WHERE is_deleted = 0');
  }

  const comptoirsRows = await interroger('SELECT id, nom FROM comptoirs');
  const nomComptoir = new Map(comptoirsRows.map(c => [c.id, c.nom]));

  const data = [];
  for (const c of caisses) {
    const v = (await interrogerUne(`SELECT COALESCE(SUM(montant_total), 0) AS total FROM ventes WHERE is_deleted = 0 AND caisse_id = ? AND type_vente != 'en_ligne'`, [c.id])).total;
    const d = (await interrogerUne(`SELECT COALESCE(SUM(montant), 0) AS total FROM depenses WHERE is_deleted = 0 AND caisse_id = ?`, [c.id])).total;
    const ver = (await interrogerUne(`SELECT COALESCE(SUM(montant), 0) AS total FROM versements WHERE is_deleted = 0 AND caisse_id = ? AND statut = 'valide'`, [c.id])).total;
    const versEnAttente = (await interrogerUne(`SELECT COALESCE(SUM(montant), 0) AS total FROM versements WHERE is_deleted = 0 AND caisse_id = ? AND statut = 'en_attente'`, [c.id])).total;
    data.push({
      caisseId: c.id,
      nom: c.nom,
      comptoirId: c.comptoir_id,
      boutiqueNom: nomComptoir.get(c.comptoir_id) || '',
      ventes: v,
      depenses: d,
      versements: ver,
      versementsEnAttente: versEnAttente,
      solde: v - d - ver,
    });
  }
  return { ok: true, status: 200, data };
}

// ===================== Dépenses =====================

export async function listerDepenses({ caisseId } = {}) {
  const identite = identiteActuelle();
  const { sql: clause, params } = clauseFiltreLecture(identite);
  let sql = 'SELECT * FROM depenses WHERE is_deleted = 0';
  if (clause) sql += ' AND ' + clause;
  if (caisseId) { sql += ' AND caisse_id = ?'; params.push(caisseId); }
  sql += ' ORDER BY date DESC LIMIT 300';
  const lignes = await interroger(sql, params);
  return { ok: true, status: 200, data: lignes.map(versFormatApiDepense) };
}

export async function creerDepense(corps) {
  const identite = identiteActuelle();
  const montant = Number(corps.montant);
  const motif = (corps.motif || '').trim();
  if (!montant || montant <= 0) return { ok: false, status: 400, data: { message: 'Montant invalide.' } };
  if (!motif) return { ok: false, status: 400, data: { message: 'Le motif est requis.' } };

  const r = await resoudreCaisse(identite, corps);
  if (r.erreur) return { ok: false, status: r.statut, data: { message: r.erreur } };

  const id = nouvelId();
  const ts = maintenant();
  await lancer(
    `INSERT INTO depenses (id, montant, motif, note, boutique_id, comptoir_id, caisse_id, auteur, nom_auteur, role_auteur, date, created_at, updated_at, is_dirty, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [id, montant, motif, corps.note || '', r.comptoir.boutique_id, r.comptoir.id, r.caisse.id, identite?.id || null, identite?.nom || '', identite?.role || '', ts, ts, ts]
  );

  const ligne = await interrogerUne('SELECT * FROM depenses WHERE id = ?', [id]);
  const depenseCreee = versFormatApiDepense(ligne);
  await ajouterAOutbox('depenses', 'create', id, depenseCreee, identite?.id);
  return { ok: true, status: 201, data: depenseCreee };
}

export async function modifierDepense(id, corps) {
  const identite = identiteActuelle();
  const existant = await interrogerUne('SELECT * FROM depenses WHERE id = ? AND is_deleted = 0', [id]);
  if (!existant) return { ok: false, status: 404, data: { message: 'Dépense introuvable.' } };
  if (identite?.role === 'admin' && existant.boutique_id !== identite.boutiqueId) {
    return { ok: false, status: 403, data: { message: 'Accès refusé.' } };
  }

  let montant = existant.montant;
  if (corps.montant !== undefined) {
    montant = Number(corps.montant);
    if (!montant || montant <= 0) return { ok: false, status: 400, data: { message: 'Montant invalide.' } };
  }
  let motif = existant.motif;
  if (corps.motif !== undefined) {
    motif = String(corps.motif).trim();
    if (!motif) return { ok: false, status: 400, data: { message: 'Le motif est requis.' } };
  }
  const note = corps.note !== undefined ? corps.note : existant.note;
  const ts = maintenant();

  await lancer('UPDATE depenses SET montant = ?, motif = ?, note = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [montant, motif, note, ts, id]);

  const ligne = await interrogerUne('SELECT * FROM depenses WHERE id = ?', [id]);
  const depenseModifiee = versFormatApiDepense(ligne);
  await ajouterAOutbox('depenses', 'update', id, depenseModifiee, identite?.id);
  return { ok: true, status: 200, data: depenseModifiee };
}

export async function supprimerDepense(id) {
  const identite = identiteActuelle();
  const existant = await interrogerUne('SELECT * FROM depenses WHERE id = ? AND is_deleted = 0', [id]);
  if (!existant) return { ok: false, status: 404, data: { message: 'Dépense introuvable.' } };
  if (identite?.role === 'admin' && existant.boutique_id !== identite.boutiqueId) {
    return { ok: false, status: 403, data: { message: 'Accès refusé.' } };
  }

  await lancer('UPDATE depenses SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?', [maintenant(), id]);
  await ajouterAOutbox('depenses', 'delete', id, null, identite?.id);
  return { ok: true, status: 200, data: { message: '✅ Dépense supprimée' } };
}

// ===================== Versements =====================

export async function listerVersements({ caisseId } = {}) {
  const identite = identiteActuelle();
  const { sql: clause, params } = clauseFiltreLecture(identite);
  let sql = 'SELECT * FROM versements WHERE is_deleted = 0';
  if (clause) sql += ' AND ' + clause;
  if (caisseId) { sql += ' AND caisse_id = ?'; params.push(caisseId); }
  sql += ' ORDER BY date DESC LIMIT 300';
  const lignes = await interroger(sql, params);
  return { ok: true, status: 200, data: lignes.map(versFormatApiVersement) };
}

export async function versementsEnAttenteNombre() {
  const identite = identiteActuelle();
  let sql = "SELECT COUNT(*) AS n FROM versements WHERE is_deleted = 0 AND statut = 'en_attente'";
  const params = [];
  if (identite?.role !== 'superadmin') { sql += ' AND boutique_id = ?'; params.push(identite?.boutiqueId); }
  const { n } = await interrogerUne(sql, params);
  return { ok: true, status: 200, data: { nombre: n } };
}

export async function creerVersement(corps) {
  const identite = identiteActuelle();
  if (identite?.role !== 'vendeur') return { ok: false, status: 403, data: { message: 'Accès refusé.' } };
  const montant = Number(corps.montant);
  if (!montant || montant <= 0) return { ok: false, status: 400, data: { message: 'Montant invalide.' } };

  const r = await resoudreCaisse(identite, corps);
  if (r.erreur) return { ok: false, status: r.statut, data: { message: r.erreur } };

  const id = nouvelId();
  const ts = maintenant();
  // Le statut n'est jamais lu depuis `corps` : un vendeur ne peut pas
  // s'auto-valider un versement.
  await lancer(
    `INSERT INTO versements (id, montant, note, statut, boutique_id, comptoir_id, caisse_id, auteur, nom_auteur, date, created_at, updated_at, is_dirty, is_deleted)
     VALUES (?, ?, ?, 'en_attente', ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [id, montant, corps.note || '', r.comptoir.boutique_id, r.comptoir.id, r.caisse.id, identite?.id || null, identite?.nom || '', ts, ts, ts]
  );

  const ligne = await interrogerUne('SELECT * FROM versements WHERE id = ?', [id]);
  const versementCree = versFormatApiVersement(ligne);
  await ajouterAOutbox('versements', 'create', id, versementCree, identite?.id);
  return { ok: true, status: 201, data: versementCree };
}

async function decider(id, statut, motifRefus) {
  const identite = identiteActuelle();
  if (identite?.role !== 'admin' && identite?.role !== 'superadmin') {
    return { ok: false, status: 403, data: { message: 'Accès refusé.' } };
  }
  const existant = await interrogerUne("SELECT * FROM versements WHERE id = ? AND is_deleted = 0 AND statut = 'en_attente'", [id]);
  if (!existant) return { ok: false, status: 409, data: { message: 'Versement introuvable ou déjà traité.' } };
  if (identite.role !== 'superadmin' && existant.boutique_id !== identite.boutiqueId) {
    return { ok: false, status: 409, data: { message: 'Versement introuvable ou déjà traité.' } };
  }

  const ts = maintenant();
  await lancer(
    `UPDATE versements SET statut = ?, motif_refus = ?, decide_par = ?, nom_decide_par = ?, date_decision = ?, updated_at = ?, is_dirty = 1 WHERE id = ?`,
    [statut, motifRefus || '', identite.id, identite.nom || '', ts, ts, id]
  );

  const ligne = await interrogerUne('SELECT * FROM versements WHERE id = ?', [id]);
  const versementDecide = versFormatApiVersement(ligne);
  // Poussé via une entrée dédiée : la route en ligne correspondante
  // (PUT /:id/valider ou /refuser) n'attend pas un objet versement complet.
  await ajouterAOutbox('decisions_versement', 'update', id, { statut, motifRefus: motifRefus || '' }, identite.id);
  return { ok: true, status: 200, data: versementDecide };
}

export const validerVersement = (id) => decider(id, 'valide');
export const refuserVersement = (id, corps) => decider(id, 'refuse', String(corps?.motif || '').slice(0, 300));

export async function modifierVersement(id, corps) {
  const identite = identiteActuelle();
  const existant = await interrogerUne('SELECT * FROM versements WHERE id = ? AND is_deleted = 0', [id]);
  if (!existant) return { ok: false, status: 404, data: { message: 'Versement introuvable.' } };
  if (identite?.role === 'admin' && existant.boutique_id !== identite.boutiqueId) {
    return { ok: false, status: 403, data: { message: 'Accès refusé.' } };
  }

  let montant = existant.montant;
  if (corps.montant !== undefined) {
    montant = Number(corps.montant);
    if (!montant || montant <= 0) return { ok: false, status: 400, data: { message: 'Montant invalide.' } };
  }
  const note = corps.note !== undefined ? corps.note : existant.note;
  const ts = maintenant();

  await lancer('UPDATE versements SET montant = ?, note = ?, updated_at = ?, is_dirty = 1 WHERE id = ?', [montant, note, ts, id]);

  const ligne = await interrogerUne('SELECT * FROM versements WHERE id = ?', [id]);
  const versementModifie = versFormatApiVersement(ligne);
  await ajouterAOutbox('versements', 'update', id, versementModifie, identite?.id);
  return { ok: true, status: 200, data: versementModifie };
}

export async function supprimerVersement(id) {
  const identite = identiteActuelle();
  const existant = await interrogerUne('SELECT * FROM versements WHERE id = ? AND is_deleted = 0', [id]);
  if (!existant) return { ok: false, status: 404, data: { message: 'Versement introuvable.' } };
  if (identite?.role === 'admin' && existant.boutique_id !== identite.boutiqueId) {
    return { ok: false, status: 403, data: { message: 'Accès refusé.' } };
  }

  await lancer('UPDATE versements SET is_deleted = 1, is_dirty = 1, updated_at = ? WHERE id = ?', [maintenant(), id]);
  await ajouterAOutbox('versements', 'delete', id, null, identite?.id);
  return { ok: true, status: 200, data: { message: '✅ Versement supprimé' } };
}
