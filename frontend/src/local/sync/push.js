// Moteur de push — parcourt la file d'attente (sync_outbox) et envoie chaque
// entrée non encore synchronisée vers l'API en ligne. Port de
// desktop/sync/push.js, restreint aux mutations qu'un VENDEUR peut réellement
// produire hors-ligne : ventes, dépenses, versements (+ décisions d'un
// admin/superadmin sur un versement, si l'appli tourne un jour pour eux
// aussi), clients.
//
// Non repris ici (hors périmètre vendeur, ou différé à la Phase 5) :
// boutiques/comptoirs/magasins/caisses/produits/fournisseurs/mouvements_stock/
// logs/icones/users (un vendeur ne les crée/modifie jamais depuis l'APK), et
// la photo de profil d'un vendeur (users update avec image) — Phase 5,
// nécessite le staging de fichier via @capacitor/filesystem, pas encore fait.
//
// Différence structurelle majeure avec le desktop, DÉLIBÉRÉE (voir
// local/sync/token-store.js) : le token utilisé pour pousser CHAQUE entrée
// est résolu via sync_outbox.auteur_id (colonne absente côté desktop),
// jamais via "la session active en ce moment". Sur desktop, une session
// unique partagée par tout le moteur de synchro a causé plusieurs bugs
// réels cette session (mutation poussée sous la mauvaise identité).

import { interroger, lancer } from '../../local-db/db';
import { estEnLigne, API_EN_LIGNE } from './connectivite';
import { lireSession } from './token-store';
import { identiteActuelle } from '../identite';

async function appelApi(url, method, headers, body) {
  const reponse = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!reponse.ok) {
    const texteBrut = await reponse.text().catch(() => '');
    let erreur = {};
    try { erreur = texteBrut ? JSON.parse(texteBrut) : {}; } catch { /* corps non-JSON */ }
    throw new Error(erreur.message || `Erreur HTTP ${reponse.status}`);
  }
  return reponse.json().catch(() => null);
}

// Résout le token à utiliser pour pousser UNE entrée précise, à partir de son
// auteur réel (entree.auteur_id) — jamais "la session active en ce moment".
// 1. Si l'auteur est l'utilisateur actuellement connecté sur cet appareil,
//    son token le plus frais est celui déjà en localStorage (AuthContext le
//    renouvelle toutes les 30 min tant que l'appli est en ligne).
// 2. Sinon (mutation faite par un autre utilisateur ayant utilisé cet
//    appareil avant), on cherche son dernier token connu dans sessions_sync.
// 3. À défaut (entrée ancienne sans auteur_id, ou auteur jamais connecté en
//    ligne depuis cet appareil), on retombe sur l'utilisateur actuel — même
//    comportement qu'avant, en dernier recours seulement.
async function resoudreToken(entree) {
  const identite = identiteActuelle();
  if (identite && entree.auteur_id && identite.id === entree.auteur_id) {
    return localStorage.getItem('token');
  }
  if (entree.auteur_id) {
    const session = await lireSession(entree.auteur_id);
    if (session?.token) return session.token;
  }
  return localStorage.getItem('token') || (await lireSession(identite?.id))?.token || null;
}

// Remet is_dirty = 0 sur la ligne locale correspondante après un push réussi.
async function marquerNonDirty(table, recordId) {
  try { await lancer(`UPDATE ${table} SET is_dirty = 0 WHERE id = ?`, [recordId]); }
  catch { /* table sans colonne is_dirty, ou ligne introuvable : pas bloquant */ }
}

async function pousserEntree(entree, token) {
  const payload = entree.payload ? JSON.parse(entree.payload) : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const { collection, operation, record_id: recordId } = entree;

  switch (collection) {
    case 'ventes':
      if (operation === 'create') {
        // Le backend en ligne exige un caisseId : pour un appelant "vendeur"
        // il force TOUJOURS req.user.caisseId (jamais une valeur du corps).
        // Le token résolu ci-dessus (par auteur_id) est déjà celui du VRAI
        // vendeur de cette vente : pas besoin d'injecter caisseId à la main
        // comme le fait desktop (dont le token de synchro appartient à un
        // seul compte du poste, pas forcément le vendeur de cette vente).
        const payloadEnvoye = { ...payload };
        // Le payload local (chargerVenteComplete) a chaque ligne avec un
        // produit PEUPLÉ ({_id, nom, categorie, prix, image}) — le backend
        // en ligne attend un simple id.
        if (Array.isArray(payloadEnvoye.produits)) {
          payloadEnvoye.produits = payloadEnvoye.produits.map(l => ({
            produit: l.produit?._id || l.produit,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
          }));
        }
        await appelApi(`${API_EN_LIGNE}/api/ventes`, 'POST', headers, payloadEnvoye);
        await marquerNonDirty('ventes', recordId);
        return 'synchronisee';
      }
      break;

    case 'depenses':
      if (operation === 'create') { await appelApi(`${API_EN_LIGNE}/api/depenses`, 'POST', headers, payload); await marquerNonDirty(collection, recordId); return 'synchronisee'; }
      if (operation === 'update') { await appelApi(`${API_EN_LIGNE}/api/depenses/${recordId}`, 'PUT', headers, payload); await marquerNonDirty(collection, recordId); return 'synchronisee'; }
      if (operation === 'delete') { await appelApi(`${API_EN_LIGNE}/api/depenses/${recordId}`, 'DELETE', headers); await marquerNonDirty(collection, recordId); return 'synchronisee'; }
      break;

    case 'versements':
      if (operation === 'create') { await appelApi(`${API_EN_LIGNE}/api/versements`, 'POST', headers, payload); await marquerNonDirty(collection, recordId); return 'synchronisee'; }
      if (operation === 'update') { await appelApi(`${API_EN_LIGNE}/api/versements/${recordId}`, 'PUT', headers, payload); await marquerNonDirty(collection, recordId); return 'synchronisee'; }
      if (operation === 'delete') { await appelApi(`${API_EN_LIGNE}/api/versements/${recordId}`, 'DELETE', headers); await marquerNonDirty(collection, recordId); return 'synchronisee'; }
      break;

    // Décision (approuver/refuser) d'un admin/superadmin sur un versement en
    // attente — entrée dédiée, la route en ligne (PUT /:id/valider ou
    // /refuser) n'attend pas un objet versement complet.
    case 'decisions_versement':
      if (operation === 'update') {
        const chemin = payload.statut === 'valide' ? 'valider' : 'refuser';
        const corps = payload.statut === 'refuse' ? { motif: payload.motifRefus } : undefined;
        await appelApi(`${API_EN_LIGNE}/api/versements/${recordId}/${chemin}`, 'PUT', headers, corps);
        await marquerNonDirty('versements', recordId);
        return 'synchronisee';
      }
      break;

    // Contrairement à desktop (qui ignore volontairement "clients", en
    // s'appuyant uniquement sur la création automatique via la vente
    // associée), on pousse ici aussi une création STANDALONE (bouton
    // "Nouveau client" de ClientsVendeur, voir local/services/clients.js) —
    // sans ce cas, un client ajouté ainsi ne remonterait jamais au backend.
    case 'clients':
      if (operation === 'create') {
        await appelApi(`${API_EN_LIGNE}/api/clients`, 'POST', headers, payload);
        await marquerNonDirty(collection, recordId);
        return 'synchronisee';
      }
      break;

    default:
      break;
  }

  return 'ignoree';
}

// Point d'entrée principal : tente de synchroniser toute la file d'attente.
// Ne lève jamais d'exception — retourne toujours un résumé de ce qui a été fait.
export async function pousserOutbox() {
  const enLigne = await estEnLigne();
  if (!enLigne) return { statut: 'hors_ligne', message: 'Serveur en ligne injoignable — synchronisation annulée.' };

  const identite = identiteActuelle();
  const tokenActuel = localStorage.getItem('token');
  if (!identite || !tokenActuel) return { statut: 'non_connecte', message: "Aucune session active — connectez-vous d'abord." };

  const entrees = await interroger('SELECT * FROM sync_outbox WHERE synced = 0 ORDER BY created_at ASC');

  let synchronisees = 0, ignorees = 0, echouees = 0;
  const details = [];

  for (const entree of entrees) {
    try {
      const token = await resoudreToken(entree);
      if (!token) {
        echouees++;
        details.push({ id: entree.id, collection: entree.collection, operation: entree.operation, resultat: 'echec', erreur: "Aucun token connu pour l'auteur de cette entrée." });
        continue;
      }
      const resultat = await pousserEntree(entree, token);
      if (resultat === 'ignoree') {
        ignorees++;
        details.push({ id: entree.id, collection: entree.collection, operation: entree.operation, resultat: 'ignoree (pas encore prise en charge)' });
        continue;
      }
      await lancer('UPDATE sync_outbox SET synced = 1 WHERE id = ?', [entree.id]);
      synchronisees++;
      details.push({ id: entree.id, collection: entree.collection, operation: entree.operation, resultat: 'synchronisee' });
    } catch (err) {
      await lancer('UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?', [err.message, entree.id]);
      echouees++;
      details.push({ id: entree.id, collection: entree.collection, operation: entree.operation, resultat: 'echec', erreur: err.message });
    }
  }

  return { statut: 'termine', total_traite: entrees.length, synchronisees, ignorees, echouees, details };
}
