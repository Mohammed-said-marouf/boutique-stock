// Détecte un vrai téléphone (Android/iPhone/iPad/iPod), via le user-agent —
// pas via la largeur de fenêtre (window.innerWidth, voir useIsMobile dans les
// layouts) : une fenêtre de bureau ou l'appli desktop redimensionnée en
// petit ne doit pas être prise pour un téléphone. Utilisé pour réserver le
// scan QR à la vente (CaisseVendeur) aux téléphones — jamais à un ordinateur.
export function estTelephone() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent || '');
}
