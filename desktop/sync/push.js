/**
 * Moteur de push — parcourt la file d'attente (sync_outbox) et envoie
 * chaque entrée non encore synchronisée vers l'API en ligne.
 *
 * Étape actuelle : ventes, boutiques, fournisseurs, mouvements_stock, logs,
 * icones, produits (AVEC image, lue depuis le disque local et attachée au
 * FormData) et users sont gérés. "clients" reste volontairement ignoré
 * (déjà géré indirectement via la synchro des ventes).
 *
 * Toute entrée dont la collection/opération n'est pas encore prise en charge
 * est laissée telle quelle dans la file (non marquée "synced"), pour être
 * traitée plus tard sans perte de données.
 */

const db = require('../local-db/db');
const fs = require('fs');
const path = require('path');
const { app: electronApp } = require('electron');
const { estEnLigne, API_EN_LIGNE } = require('./connectivite');
const { lireSession } = require('./token-store');

// Effectue un appel HTTP vers l'API en ligne et lève une erreur lisible en cas d'échec.
async function appelApi(url, method, headers, body) {
  const reponse = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!reponse.ok) {
    // On lit le texte brut d'abord (au lieu de .json() directement) pour ne
    // jamais perdre le vrai message d'erreur du backend, même si le corps
    // n'est pas du JSON valide ou si le parsing échoue silencieusement.
    const texteBrut = await reponse.text().catch(() => '');
    console.log(`--- Réponse brute erreur (${method} ${url}, statut ${reponse.status}) ---`);
    console.log(texteBrut);

    let erreur = {};
    try {
      erreur = texteBrut ? JSON.parse(texteBrut) : {};
    } catch {
      // Corps non-JSON : on garde erreur = {} et on retombera sur le message générique.
    }

    throw new Error(erreur.message || `Erreur HTTP ${reponse.status}`);
  }

  return reponse.json().catch(() => null);
}

// Variante de appelApi pour l'envoi de FormData (multipart/form-data).
// On ne met surtout PAS de header 'Content-Type' manuel : fetch le fixe
// lui-même avec la bonne "boundary" quand le body est un FormData. Le
// fixer à la main casserait le parsing du multipart côté serveur (multer).
async function appelApiMultipart(url, method, token, formData) {
  const reponse = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!reponse.ok) {
    const texteBrut = await reponse.text().catch(() => '');
    let messagePrecis = '';
    try {
      const erreur = texteBrut ? JSON.parse(texteBrut) : {};
      messagePrecis = erreur.message || '';
    } catch {
      messagePrecis = texteBrut;
    }
    throw new Error(`HTTP ${reponse.status} — ${messagePrecis || '(réponse vide)'}`);
  }

  return reponse.json().catch(() => null);
}

// Remet is_dirty = 0 sur la ligne locale correspondante après un push
// réussi. Sans ça, une ligne déjà synchronisée reste marquée "sale" pour
// toujours, ce qui bloque ensuite le pull de la mettre à jour (le pull
// ignore volontairement les lignes is_dirty pour ne pas écraser un
// travail local pas encore poussé — mais ici il l'est déjà).
function marquerNonDirty(collection, recordId) {
  try {
    db.prepare(`UPDATE ${collection} SET is_dirty = 0 WHERE id = ?`).run(recordId);
  } catch {
    // Table sans colonne is_dirty, ou ligne introuvable : pas bloquant
    // pour le résultat du push lui-même, on ignore silencieusement.
  }
}

async function pousserEntree(entree, token) {
  const payload = entree.payload ? JSON.parse(entree.payload) : null;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const { collection, operation, record_id } = entree;

  switch (collection) {
    case 'ventes':
      if (operation === 'create') {
        await appelApi(`${API_EN_LIGNE}/api/ventes`, 'POST', headers, payload);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    case 'boutiques':
      if (operation === 'create') {
        await appelApi(`${API_EN_LIGNE}/api/boutiques`, 'POST', headers, payload);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      if (operation === 'update') {
        await appelApi(`${API_EN_LIGNE}/api/boutiques/${record_id}`, 'PUT', headers, payload);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    case 'fournisseurs':
      if (operation === 'create') {
        await appelApi(`${API_EN_LIGNE}/api/fournisseurs`, 'POST', headers, payload);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      if (operation === 'delete') {
        await appelApi(`${API_EN_LIGNE}/api/fournisseurs/${record_id}`, 'DELETE', headers);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    case 'produits':
      if (operation === 'create' || operation === 'update') {
        // Le backend attend du multipart/form-data (middleware multer côté
        // route produits, même sans fichier joint). On construit un FormData
        // au lieu d'envoyer du JSON — d'où l'appel à appelApiMultipart plutôt
        // qu'à appelApi.
        const formData = new FormData();

        // _id explicite : indispensable pour que le produit garde le MÊME id
        // en ligne qu'en local (cohérent avec le principe de la migration
        // UUID). Sans ça, Mongoose génère son propre _id côté serveur et les
        // deux bases divergent sur cet enregistrement.
        if (payload?._id) formData.append('_id', payload._id);

        const champsTexte = ['nom', 'description', 'prix', 'quantite', 'categorie', 'fournisseur', 'boutiqueId', 'seuilAlerte', 'ref'];
        for (const champ of champsTexte) {
          const valeur = payload?.[champ];
          if (valeur !== null && valeur !== undefined) {
            formData.append(champ, String(valeur));
          }
        }

        // Si le produit a une image locale (chemin /uploads/produits/xxx.png
        // sur le disque local), on lit le fichier et on l'attache au
        // FormData — le backend en ligne (multer + Cloudinary) le recevra
        // comme un vrai upload, exactement comme s'il avait été envoyé
        // depuis le site web.
        if (payload?.image && payload.image.startsWith('/uploads/')) {
          const cheminAbsolu = path.join(electronApp.getPath('userData'), payload.image);
          const nomFichier = path.basename(payload.image);
          const extension = path.extname(nomFichier).toLowerCase();
          // Le backend (fileFilter côté multer) n'accepte QUE ces formats —
          // toute autre extension serait rejetée avec "Format non supporté"
          // à chaque tentative, en boucle infinie via la sync automatique.
          // On ne tente donc d'attacher le fichier que si le format est
          // reconnu ; sinon on pousse les champs texte seuls, le backend
          // conservera l'image existante inchangée plutôt que d'échouer.
          const TYPES_MIME_ACCEPTES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
          const typeMime = TYPES_MIME_ACCEPTES[extension];

          if (typeMime) {
            try {
              const octets = fs.readFileSync(cheminAbsolu);
              formData.append('image', new Blob([octets], { type: typeMime }), nomFichier);
            } catch {
              // Fichier introuvable sur le disque (ex: supprimé manuellement) —
              // on pousse le produit sans image plutôt que de faire échouer
              // tout le push.
            }
          }
          // Extension non supportée (ex: .gif, .bmp, .heic...) : on ignore
          // silencieusement l'image pour cette entrée, le reste des champs
          // texte est quand même poussé normalement.
        }
        // Si l'image est déjà une URL complète (http...), c'est qu'elle a
        // déjà été uploadée sur Cloudinary par un pull précédent — rien à
        // renvoyer, le backend la conservera telle quelle si on ne touche
        // pas au champ image.

        const url = operation === 'create'
          ? `${API_EN_LIGNE}/api/produits`
          : `${API_EN_LIGNE}/api/produits/${record_id}`;
        const method = operation === 'create' ? 'POST' : 'PUT';

        await appelApiMultipart(url, method, token, formData);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    case 'mouvements_stock':
      if (operation === 'create') {
        await appelApi(`${API_EN_LIGNE}/api/mouvements-stock`, 'POST', headers, payload);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    case 'logs':
      if (operation === 'create') {
        await appelApi(`${API_EN_LIGNE}/api/logs`, 'POST', headers, payload);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    case 'icones':
      if (operation === 'update' && payload?.cle) {
        await appelApi(`${API_EN_LIGNE}/api/icones/${payload.cle}`, 'PUT', headers, { valeur: payload.valeur });
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    case 'users':
      if (operation === 'create') {
        // Le payload contient déjà motDePasse pré-haché (bcrypt) — le
        // backend (models/User.js) doit détecter ce hash et ne pas le
        // re-hacher, sinon la connexion de ce compte casserait.
        await appelApi(`${API_EN_LIGNE}/api/users`, 'POST', headers, payload);
        marquerNonDirty(collection, record_id);
        return 'synchronisee';
      }
      break;

    // "clients" : déjà géré côté serveur via la création de la vente associée — volontairement ignoré ici.
  }

  return 'ignoree';
}

/**
 * Point d'entrée principal : tente de synchroniser toute la file d'attente.
 * Retourne un résumé de ce qui a été fait, sans jamais lever d'exception.
 */
async function pousserOutbox() {
  const enLigne = await estEnLigne();
  if (!enLigne) {
    return { statut: 'hors_ligne', message: 'Serveur en ligne injoignable — synchronisation annulée.' };
  }

  const session = lireSession();
  if (!session || !session.token) {
    return { statut: 'non_connecte', message: 'Aucune session active — connectez-vous d\'abord.' };
  }

  const entrees = db.prepare('SELECT * FROM sync_outbox WHERE synced = 0 ORDER BY created_at ASC').all();

  let synchronisees = 0;
  let ignorees = 0;
  let echouees = 0;
  const details = [];

  for (const entree of entrees) {
    try {
      const resultat = await pousserEntree(entree, session.token);
      if (resultat === 'ignoree') {
        ignorees++;
        details.push({ id: entree.id, collection: entree.collection, operation: entree.operation, resultat: 'ignoree (pas encore prise en charge)' });
        continue;
      }
      db.prepare('UPDATE sync_outbox SET synced = 1 WHERE id = ?').run(entree.id);
      synchronisees++;
      details.push({ id: entree.id, collection: entree.collection, operation: entree.operation, resultat: 'synchronisee' });
    } catch (err) {
      db.prepare('UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?').run(err.message, entree.id);
      echouees++;
      details.push({ id: entree.id, collection: entree.collection, operation: entree.operation, resultat: 'echec', erreur: err.message });
    }
  }

  return {
    statut: 'termine',
    total_traite: entrees.length,
    synchronisees,
    ignorees,
    echouees,
    details,
  };
}

module.exports = { pousserOutbox };