/**
 * Sauvegarde COMPLÈTE du poste desktop — pour retrouver ses données sur une
 * nouvelle machine, même sans internet.
 *
 * Contrairement à la sauvegarde JSON du serveur en ligne (sans les comptes),
 * le fichier est une copie de toute la base SQLite locale : produits, stocks,
 * ventes, caisses... mais aussi les comptes (mots de passe hachés bcrypt,
 * jamais en clair) et les opérations pas encore synchronisées (sync_outbox).
 * Après import, admin et vendeurs se connectent avec leurs mots de passe
 * habituels, et la synchro reprend là où elle en était.
 *
 * Les deux routes sont réservées à la fenêtre de l'application (secret du
 * poste + requête venant de ce PC, voir main/secret-poste.js).
 *  - GET  /export   : télécharge la sauvegarde (utilisateur connecté).
 *  - POST /importer : remplace la base de ce poste par une sauvegarde, puis
 *    redémarre l'application — possible depuis l'écran de connexion, puisque
 *    sur une machine neuve personne ne peut encore s'y connecter.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { app: electronApp } = require('electron');
const db = require('../local-db/db');
const secretPoste = require('../main/secret-poste');

const ADRESSES_LOCALES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const ENTETE_SQLITE = Buffer.from('SQLite format 3\0', 'latin1');
const TABLES_REQUISES = ['users', 'produits', 'ventes', 'sync_outbox'];

function reserveAuPoste(req, res, next) {
  if (!ADRESSES_LOCALES.has(req.socket.remoteAddress) || req.get('X-Poste-Secret') !== secretPoste) {
    return res.status(403).json({ message: "Action réservée à l'application desktop de ce poste." });
  }
  next();
}

router.get('/export', reserveAuPoste, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ message: 'Connectez-vous pour sauvegarder ce poste.' });
  // backup() écrit un instantané cohérent de la base (WAL compris) dans un
  // fichier temporaire. Pas db.serialize() : sous Electron, le buffer qu'il
  // crée hors du "sandbox" mémoire de V8 fait planter toute l'application.
  const cheminTemp = path.join(os.tmpdir(), `bs-sauvegarde-poste-${Date.now()}.bsdb`);
  try {
    await db.backup(cheminTemp);
    const jour = new Date().toISOString().slice(0, 10);
    res.download(cheminTemp, `sauvegarde-poste-${jour}.bsdb`, () => fs.rm(cheminTemp, { force: true }, () => {}));
  } catch (err) {
    fs.rm(cheminTemp, { force: true }, () => {});
    res.status(500).json({ message: err.message });
  }
});

router.post('/importer', reserveAuPoste, express.raw({ type: 'application/octet-stream', limit: '1gb' }), (req, res) => {
  const cheminAttente = `${db.name}.import-en-attente`;
  const contenu = req.body;
  if (!Buffer.isBuffer(contenu) || contenu.length < 100 || !contenu.subarray(0, 16).equals(ENTETE_SQLITE)) {
    return res.status(400).json({ message: "Ce fichier n'est pas une sauvegarde de poste Boutique Stock." });
  }

  // Vérifie le fichier AVANT de toucher à quoi que ce soit : lisible, intact,
  // et contenant bien les tables d'une base Boutique Stock.
  let bilan;
  try {
    fs.writeFileSync(cheminAttente, contenu);
    const candidate = new Database(cheminAttente, { readonly: true, fileMustExist: true });
    try {
      const controle = candidate.pragma('quick_check', { simple: true });
      if (controle !== 'ok') throw new Error('fichier endommagé');
      const tables = new Set(candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name));
      if (!TABLES_REQUISES.every(t => tables.has(t))) throw new Error('pas une base Boutique Stock');
      bilan = {
        comptes: candidate.prepare('SELECT COUNT(*) AS n FROM users WHERE is_deleted = 0').get().n,
        produits: candidate.prepare('SELECT COUNT(*) AS n FROM produits WHERE is_deleted = 0').get().n,
        ventes: candidate.prepare('SELECT COUNT(*) AS n FROM ventes WHERE is_deleted = 0').get().n,
        nonSynchronises: candidate.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get().n,
      };
    } finally {
      candidate.close();
    }
  } catch (err) {
    fs.rmSync(cheminAttente, { force: true });
    return res.status(400).json({ message: `Sauvegarde invalide (${err.message}).` });
  }

  // La mise en place se fait au redémarrage (voir local-db/db.js) : on ferme
  // proprement la base actuelle (ce qui intègre son journal WAL), puis on
  // relance l'application.
  res.json({ message: 'Sauvegarde vérifiée. Redémarrage de l\'application...', bilan });
  res.on('finish', () => {
    setTimeout(() => {
      try { db.close(); } catch { /* déjà fermée */ }
      electronApp.relaunch();
      electronApp.exit(0);
    }, 500);
  });
});

module.exports = router;
