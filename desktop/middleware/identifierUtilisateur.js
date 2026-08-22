/**
 * Identifie l'utilisateur appelant à partir du token (s'il y en a un), pour
 * permettre aux routes de filtrer leurs résultats par boutique — sans
 * jamais bloquer une requête (le serveur local fait confiance à la
 * machine locale, voir les notes de sécurité dans routes/auth.js).
 *
 * Deux formats de token possibles, gérés tous les deux :
 *  - Token léger local (base64 d'un JSON), généré par genererTokenLocal()
 *    dans routes/auth.js, lors d'une connexion directe contre la base
 *    locale.
 *  - Vrai JWT signé par le backend en ligne, reçu lors d'une première
 *    connexion relayée en ligne (voir le cas 2 de routes/auth.js). Le
 *    desktop ne connaît pas le secret JWT du backend et ne peut donc pas
 *    VÉRIFIER ce token — mais on peut le décoder sans risque pour lire
 *    son contenu, puisqu'on est déjà dans un contexte de confiance locale.
 */

const jwt = require('jsonwebtoken');

function decoderToken(token) {
  if (!token) return null;

  // Un vrai JWT a 3 segments séparés par des points (header.payload.signature).
  if (token.split('.').length === 3) {
    try {
      const payload = jwt.decode(token);
      if (payload) {
        return {
          id: payload.id,
          role: payload.role,
          boutiqueId: (payload.boutique && payload.boutique._id) || payload.boutique || null,
        };
      }
    } catch {
      // Tombe sur la tentative de décodage au format local ci-dessous.
    }
  }

  // Format local léger : base64 d'un objet JSON.
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    return {
      id: payload.id,
      role: payload.role,
      boutiqueId: payload.boutiqueId || null,
    };
  } catch {
    return null;
  }
}

function identifierUtilisateur(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  req.user = decoderToken(token); // peut être null si absent/invalide — jamais bloquant
  next();
}

module.exports = identifierUtilisateur;