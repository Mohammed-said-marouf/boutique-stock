const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

/**
 * Génère un certificat auto-signé pour l'adresse IP locale du poste (nécessaire
 * pour que les navigateurs mobiles autorisent l'accès à la caméra — ils
 * bloquent getUserMedia sur une origine http:// non sécurisée).
 *
 * Le certificat est mis en cache dans le dossier utilisateur de l'app et
 * régénéré uniquement si l'adresse IP du poste a changé (nouveau réseau
 * Wi-Fi, etc.) ou si les fichiers sont absents/corrompus.
 */
async function obtenirCertificat(userDataPath, ip) {
  const dossierCerts = path.join(userDataPath, 'certs');
  const cheminCert = path.join(dossierCerts, 'cert.pem');
  const cheminCle = path.join(dossierCerts, 'key.pem');
  const cheminMeta = path.join(dossierCerts, 'meta.json');

  if (fs.existsSync(cheminCert) && fs.existsSync(cheminCle) && fs.existsSync(cheminMeta)) {
    try {
      const meta = JSON.parse(fs.readFileSync(cheminMeta, 'utf8'));
      if (meta.ip === ip) {
        return {
          cert: fs.readFileSync(cheminCert, 'utf8'),
          key: fs.readFileSync(cheminCle, 'utf8'),
        };
      }
    } catch (e) {
      // meta.json corrompu ou illisible — on régénère ci-dessous.
    }
  }

  const attributs = [{ name: 'commonName', value: ip }];
  const pems = await selfsigned.generate(attributs, {
    days: 3650, // 10 ans — évite d'avoir à refaire confiance au certificat régulièrement
    keySize: 2048,
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 7, ip }, // type 7 = adresse IP
          { type: 2, value: 'localhost' },
        ],
      },
    ],
  });

  fs.mkdirSync(dossierCerts, { recursive: true });
  fs.writeFileSync(cheminCert, pems.cert);
  fs.writeFileSync(cheminCle, pems.private);
  fs.writeFileSync(cheminMeta, JSON.stringify({ ip, genereLe: new Date().toISOString() }));

  return { cert: pems.cert, key: pems.private };
}

module.exports = { obtenirCertificat };