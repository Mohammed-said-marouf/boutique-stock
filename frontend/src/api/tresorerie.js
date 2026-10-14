import { appelJson } from './client';
import { modeLocalActif } from '../local/mode';
import * as tresorerieLocale from '../local/services/tresorerie';
import { declencherSynchronisation } from '../local/sync/scheduler';

// Dépenses & versements — voir backend/routes/tresorerie.js, depenses.js,
// versements.js. Solde d'une caisse = ventes en espèces - dépenses -
// versements validés. Dans l'APK, un vendeur passe par la base du téléphone
// (local/services/tresorerie.js, même contrat {ok, status, data}).

const local = (fn) => modeLocalActif() ? fn() : null;

// Écriture locale : on pousse au serveur sans attendre le prochain cycle.
const ecritureLocale = (fn) => {
  if (!modeLocalActif()) return null;
  return fn().then((res) => { if (res.ok) declencherSynchronisation(); return res; });
};

export const soldes = () => local(tresorerieLocale.soldes) || appelJson('GET', '/api/tresorerie/soldes');
export const versementsEnAttenteNombre = () => local(tresorerieLocale.versementsEnAttenteNombre) || appelJson('GET', '/api/versements/en-attente/nombre');

export const listerDepenses = () => local(() => tresorerieLocale.listerDepenses()) || appelJson('GET', '/api/depenses');
export const listerVersements = () => local(() => tresorerieLocale.listerVersements()) || appelJson('GET', '/api/versements');

export const creerDepense = (corps) => ecritureLocale(() => tresorerieLocale.creerDepense(corps)) || appelJson('POST', '/api/depenses', corps);
export const modifierDepense = (id, corps) => ecritureLocale(() => tresorerieLocale.modifierDepense(id, corps)) || appelJson('PUT', `/api/depenses/${id}`, corps);
export const supprimerDepense = (id) => ecritureLocale(() => tresorerieLocale.supprimerDepense(id)) || appelJson('DELETE', `/api/depenses/${id}`);

export const creerVersement = (corps) => ecritureLocale(() => tresorerieLocale.creerVersement(corps)) || appelJson('POST', '/api/versements', corps);
export const modifierVersement = (id, corps) => ecritureLocale(() => tresorerieLocale.modifierVersement(id, corps)) || appelJson('PUT', `/api/versements/${id}`, corps);
export const supprimerVersement = (id) => ecritureLocale(() => tresorerieLocale.supprimerVersement(id)) || appelJson('DELETE', `/api/versements/${id}`);
// Valider/refuser : réservé à l'admin, qui reste en ligne dans l'APK.
export const validerVersement = (id) => appelJson('PUT', `/api/versements/${id}/valider`);
export const refuserVersement = (id, corps) => appelJson('PUT', `/api/versements/${id}/refuser`, corps);
