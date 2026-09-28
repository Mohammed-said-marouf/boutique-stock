// Service local "clients" pour l'APK Android hors-ligne.
//
// NOTE : ce fichier suit le comportement du VRAI backend en ligne
// (backend/routes/clients.js : boutiqueId TOUJOURS dérivé de l'identité,
// jamais du corps/de la query envoyés par l'appelant), PAS celui de
// desktop/routes/clients.js, qui a un écart non lié à ce chantier : ce
// dernier lit boutiqueId depuis req.query/req.body au lieu de req.user,
// alors qu'aucun appel réel du frontend (VendeurLayout.js) n'envoie jamais
// ce paramètre — sur desktop, GET /api/clients renvoie donc TOUS les
// clients (aucun filtre) et POST échoue toujours ("boutiqueId requis").
// À corriger séparément côté desktop ; non reproduit ici.

import { interroger, lancer, interrogerUne } from '../../local-db/db';
import { identiteActuelle } from '../identite';

const maintenant = () => new Date().toISOString();
const nouvelId = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function versFormatApi(ligne) {
  if (!ligne) return null;
  return {
    _id: ligne.id,
    nom: ligne.nom,
    telephone: ligne.telephone,
    email: ligne.email,
    boutiqueId: ligne.boutique_id,
    achats: ligne.achats,
    total: ligne.total,
    createdAt: ligne.created_at,
    updatedAt: ligne.updated_at,
  };
}

// GET équivalent — clients de la boutique de l'appelant.
export async function listerClients() {
  const identite = identiteActuelle();
  const filtre = (identite?.role === 'admin' || identite?.role === 'vendeur') ? identite.boutiqueId : null;
  let sql = 'SELECT * FROM clients WHERE is_deleted = 0';
  const params = [];
  if (filtre) { sql += ' AND boutique_id = ?'; params.push(filtre); }
  sql += ' ORDER BY created_at DESC';
  const lignes = await interroger(sql, params);
  return { data: lignes.map(versFormatApi) };
}

// POST équivalent — client rattaché automatiquement à la boutique de l'appelant.
export async function creerClient(corps) {
  const identite = identiteActuelle();
  if (!identite?.boutiqueId) {
    const err = new Error('Aucune boutique associée à ce compte.');
    err.response = { data: { message: err.message } };
    throw err;
  }

  const id = nouvelId();
  const ts = maintenant();
  await lancer(
    `INSERT INTO clients (id, nom, telephone, email, boutique_id, achats, total, created_at, updated_at, is_dirty, is_deleted)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, 1, 0)`,
    [id, corps.nom, corps.telephone || null, corps.email || null, identite.boutiqueId, ts, ts]
  );

  const ligne = await interrogerUne('SELECT * FROM clients WHERE id = ?', [id]);
  const cree = versFormatApi(ligne);
  await lancer(
    'INSERT INTO sync_outbox (collection, operation, record_id, payload, auteur_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['clients', 'create', id, JSON.stringify(cree), identite.id, ts]
  );
  return { data: cree };
}
