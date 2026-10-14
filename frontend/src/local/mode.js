// Aiguillage des appels de frontend/src/api/* : dans l'APK Android, un
// vendeur travaille TOUJOURS sur la base SQLite du téléphone (comme le
// desktop sur la sienne), avec ou sans réseau — la synchro avec le serveur en
// ligne se fait en arrière-plan (local/sync/scheduler.js).
//
// Hors APK (web, desktop), ou pour un admin/superadmin dans l'APK (périmètre
// hors-ligne limité au vendeur), les appels partent comme avant vers API_URL.

import { estDisponible } from '../local-db/db';
import { identiteActuelle } from './identite';

export const estApk = estDisponible;

export function modeLocalActif() {
  return estApk() && identiteActuelle()?.role === 'vendeur';
}
