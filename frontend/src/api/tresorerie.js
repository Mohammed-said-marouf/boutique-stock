import { appelJson } from './client';

// Dépenses & versements — voir backend/routes/tresorerie.js, depenses.js,
// versements.js. Solde d'une caisse = ventes en espèces - dépenses -
// versements validés.

export const soldes = () => appelJson('GET', '/api/tresorerie/soldes');
export const versementsEnAttenteNombre = () => appelJson('GET', '/api/versements/en-attente/nombre');

export const listerDepenses = () => appelJson('GET', '/api/depenses');
export const listerVersements = () => appelJson('GET', '/api/versements');

export const creerDepense = (corps) => appelJson('POST', '/api/depenses', corps);
export const modifierDepense = (id, corps) => appelJson('PUT', `/api/depenses/${id}`, corps);
export const supprimerDepense = (id) => appelJson('DELETE', `/api/depenses/${id}`);

export const creerVersement = (corps) => appelJson('POST', '/api/versements', corps);
export const modifierVersement = (id, corps) => appelJson('PUT', `/api/versements/${id}`, corps);
export const supprimerVersement = (id) => appelJson('DELETE', `/api/versements/${id}`);
export const validerVersement = (id) => appelJson('PUT', `/api/versements/${id}/valider`);
export const refuserVersement = (id, corps) => appelJson('PUT', `/api/versements/${id}/refuser`, corps);
