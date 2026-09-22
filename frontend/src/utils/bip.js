// Bips de retour pour le scan QR — générés via Web Audio API, pas de fichier audio à charger.
// Un seul AudioContext réutilisé (les navigateurs limitent le nombre d'instances).
let contexteAudio = null;
function getContexte() {
  if (!contexteAudio) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    contexteAudio = new AudioCtx();
  }
  // Sur mobile, le contexte peut démarrer "suspendu" tant qu'aucune interaction n'a eu lieu.
  if (contexteAudio.state === 'suspended') contexteAudio.resume();
  return contexteAudio;
}

function jouerTon(frequence, dureeMs, volume = 0.2) {
  try {
    const ctx = getContexte();
    const oscillateur = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillateur.type = 'sine';
    oscillateur.frequency.value = frequence;
    gain.gain.value = volume;
    oscillateur.connect(gain);
    gain.connect(ctx.destination);
    oscillateur.start();
    // Léger fondu de sortie pour éviter un "clic" audio en fin de bip
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dureeMs / 1000);
    oscillateur.stop(ctx.currentTime + dureeMs / 1000);
  } catch (e) {
    // Environnement sans Web Audio (rare) — on ignore silencieusement, le scan reste fonctionnel.
  }
}

// Bip de succès : un ton aigu et bref, comme une caisse de supermarché.
export function bipSucces() {
  jouerTon(1500, 120);
}

// Bip d'erreur : deux tons graves, pour être reconnaissable sans regarder l'écran.
export function bipErreur() {
  jouerTon(300, 150);
  setTimeout(() => jouerTon(220, 200), 160);
}

// À appeler UNE FOIS, directement dans le gestionnaire d'un clic réel
// (ex: le bouton "Scanner un QR"), avant de démarrer le scan. Sur mobile, un
// AudioContext créé/débloqué en dehors d'un geste utilisateur direct reste
// "suspendu" pour de bon : ses bips restent alors inaudibles, sans erreur
// (jouerTon avale les échecs en silence) — car le premier bip arrivait
// jusqu'ici depuis le callback asynchrone de la caméra, plus lié au clic.
// Le ton est réellement joué (pas juste resume()) : certains navigateurs
// n'y débloquent l'audio qu'à ce prix.
export function debloquerAudio() {
  jouerTon(200, 20, 0.001);
}