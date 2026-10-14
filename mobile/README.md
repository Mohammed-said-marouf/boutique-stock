# Application Android (APK) — Boutique Stock

Enveloppe [Capacitor](https://capacitorjs.com) autour du frontend React (`../frontend`).

## En ligne et hors-ligne

Comme la version desktop, l'espace **vendeur** travaille toujours sur une base SQLite du
téléphone (`@capacitor-community/sqlite`), avec ou sans internet : vente, encaissement,
catalogue, clients, dépenses et versements. La synchronisation avec le serveur en ligne
(`https://boutique-stock-api.onrender.com`) est automatique : à la connexion, toutes les
5 minutes, au retour de l'appli au premier plan et juste après chaque vente.

- Code : `frontend/src/local/` (services, synchro) et `frontend/src/local-db/` (schéma) ;
  l'aiguillage se fait dans `frontend/src/api/*` via `local/mode.js`.
- Connexion hors-ligne : possible pour un vendeur qui s'est déjà connecté **une fois avec
  internet** sur ce téléphone (empreinte PBKDF2 du mot de passe, jamais le mot de passe en clair).
- Après une longue période hors-ligne (token de plus de 24h), la synchro ramène à l'écran de
  connexion dès que le serveur est joignable ; rien n'est perdu, la file d'attente repart.
- Restent en ligne uniquement : l'espace admin, la photo de profil, le changement de mot de passe.

## Obtenir l'APK (sans rien installer)

1. Sur GitHub : onglet **Actions** → **Build APK Android** → **Run workflow**
   (ou pousser un tag : `git tag apk-2 && git push origin apk-2`).
2. Attendre la fin (~5-8 min), ouvrir l'exécution, télécharger l'artifact **boutique-stock-apk**
   (un `.zip` contenant `app-release.apk`).
3. Envoyer l'APK aux vendeurs (WhatsApp, lien...). Sur le téléphone : ouvrir le fichier et
   autoriser l'installation depuis cette source.

Les mises à jour s'installent par-dessus la version existante (même clé de signature,
`versionCode` = numéro d'exécution GitHub).

## Compiler en local (optionnel)

Nécessite Java 21 et le SDK Android (Android Studio).

```
cd frontend && npm run build
cd ../mobile && npx cap sync android && cd android && ./gradlew assembleRelease
```

## Notes

- La clé de signature (`android/app/boutique-stock.keystore`) est dans le dépôt : suffisant pour
  distribuer l'APK en interne. Pour une publication sur le Play Store, la remplacer par une clé
  privée gardée hors du dépôt.
- Permission caméra déclarée pour le scan QR / code-barres à la caisse.
- L'icône est l'icône Capacitor par défaut (à personnaliser plus tard).
