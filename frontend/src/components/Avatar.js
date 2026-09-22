// Avatar d'un compte : sa photo de profil si elle existe, sinon l'initiale de
// son nom sur un fond de couleur (comportement d'origine, conservé en repli).
export default function Avatar({ nom, photo, size = 36, fond = '#2563eb', style = {} }) {
  if (photo) {
    return (
      <img src={photo} alt={nom || 'Photo de profil'} style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: fond,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '700', fontSize: Math.round(size * 0.42), flexShrink: 0, ...style
    }}>{(nom || '?').charAt(0).toUpperCase()}</div>
  );
}
