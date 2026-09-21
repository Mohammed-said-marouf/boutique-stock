# Application Android (APK) — Boutique Stock

Enveloppe [Capacitor](https://capacitorjs.com) autour du frontend React (`../frontend`).
L'appli parle à la même API que la version web (`https://boutique-stock-api.onrender.com`),
donc les ventes faites sur téléphone arrivent directement dans le système.

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
