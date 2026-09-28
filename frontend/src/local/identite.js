// Identifie l'utilisateur actuellement connecté à partir du token stocké
// (localStorage 'token', posé par AuthContext lors du login). Port de
// desktop/middleware/identifierUtilisateur.js — mêmes deux formats de token
// gérés, mais appelé explicitement par chaque fonction de service locale
// (frontend/src/local/services/*) : il n'y a pas de pipeline middleware à
// brancher côté mobile, chaque fonction n'a qu'un objet {params} en entrée,
// pas de req/res.
//
// On ne VÉRIFIE jamais la signature d'un vrai JWT (le mobile, comme le
// desktop, ne connaît pas le secret du backend) — on se contente de le
// décoder, dans un contexte de confiance locale (même raisonnement que
// desktop/routes/auth.js).

function decoderBase64Url(segment) {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(base64);
  const octets = Uint8Array.from(brut, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(octets));
}

export function decoderToken(token) {
  if (!token) return null;

  // Un vrai JWT a 3 segments séparés par des points (header.payload.signature).
  if (token.split('.').length === 3) {
    try {
      const payload = decoderBase64Url(token.split('.')[1]);
      if (payload) {
        return {
          id: payload.id,
          role: payload.role,
          boutiqueId: (payload.boutique && payload.boutique._id) || payload.boutiqueId || null,
          caisseId: (payload.caisse && payload.caisse._id) || payload.caisseId || null,
        };
      }
    } catch {
      // Tombe sur la tentative de décodage au format local ci-dessous.
    }
  }

  // Format local léger : base64 d'un objet JSON (même format que
  // genererTokenLocal côté desktop — voir desktop/routes/auth.js).
  try {
    const payload = decoderBase64Url(token);
    return {
      id: payload.id,
      role: payload.role,
      boutiqueId: payload.boutiqueId || null,
      caisseId: payload.caisseId || null,
    };
  } catch {
    return null;
  }
}

// Identité de l'utilisateur actuellement connecté sur cet appareil. Chaque
// fonction de frontend/src/local/services/* l'appelle en tout premier pour
// savoir qui agit (filtrage par boutique/caisse, auteur d'une mutation...).
export function identiteActuelle() {
  return decoderToken(localStorage.getItem('token'));
}
