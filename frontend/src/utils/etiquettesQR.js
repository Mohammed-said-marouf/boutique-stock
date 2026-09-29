import QRCode from 'qrcode';
import jsPDF from 'jspdf';

// ============================================================================
// Configuration de la grille d'étiquettes — à AJUSTER pour correspondre
// exactement à votre feuille d'étiquettes autocollantes pré-découpées (A4).
// Si les QR ne tombent pas pile sur les étiquettes physiques à l'impression,
// c'est ici qu'il faut corriger : nombre de lignes, marges, espacement.
// ============================================================================
export const GRILLE_ETIQUETTES = {
  colonnes: 4,
  lignes: 10,            // nombre de rangées d'étiquettes sur la feuille — à vérifier sur votre paquet
  margeExterieureMm: 8,  // marge entre le bord de la feuille A4 et la première étiquette
  espacementMm: 2,       // espace entre deux étiquettes (horizontal et vertical)
};

const PAGE_MM = { largeur: 210, hauteur: 297 }; // A4

function dimensionsEtiquette() {
  const { colonnes, lignes, margeExterieureMm, espacementMm } = GRILLE_ETIQUETTES;
  const largeurUtile = PAGE_MM.largeur - 2 * margeExterieureMm;
  const hauteurUtile = PAGE_MM.hauteur - 2 * margeExterieureMm;
  const largeurEtiquette = (largeurUtile - (colonnes - 1) * espacementMm) / colonnes;
  const hauteurEtiquette = (hauteurUtile - (lignes - 1) * espacementMm) / lignes;
  return { largeurEtiquette, hauteurEtiquette };
}

// Construit le contenu encodé dans le QR : identifiant du produit (source de vérité pour la
// vente) + infos d'affichage. Le prix affiché est celui du moment de l'impression ; le vendeur
// verra toujours le prix réel du produit au moment du scan (relu depuis la liste des produits
// chargée en direct), donc un changement de prix après impression n'entraîne aucune erreur de
// facturation, juste un affichage d'étiquette obsolète.
function contenuQR(produit) {
  return JSON.stringify({
    id: produit._id,
    nom: produit.nom,
    prix: produit.prix,
    ref: produit.ref || '',
  });
}

/**
 * Étape 1 : génère juste l'image du QR (data URL), pour affichage en aperçu avant impression.
 */
export async function genererDataUrlQR(produit) {
  return QRCode.toDataURL(contenuQR(produit), {
    margin: 0,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Étape 2 : construit le document PDF — grille de `colonnes` × `lignes` étiquettes identiques
 * par page A4, pour une feuille d'étiquettes autocollantes pré-découpées. Ne télécharge rien —
 * c'est à l'appelant de décider (après validation de l'aperçu).
 */
// Espace des milliers avec un espace ASCII normal — jamais `.toLocaleString()`
// sans locale explicite : son séparateur (espace insécable fine, U+202F en
// fr-FR) n'existe pas dans la police de base "helvetica" de jsPDF (non
// Unicode) et s'affichait comme un caractère erroné ("50 /000 FCFA" au lieu
// de "50 000 FCFA"). Même formateur que la facture PDF (voir formatMontant
// dans AdminLayout.js) — à garder synchronisés.
function formaterPrixPdf(prix) {
  return Math.round(Number(prix) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Hauteur d'une ligne de texte en mm pour une taille de police donnée (en
// points) — jsPDF calcule ses propres sauts de ligne avec ~1.15x la taille
// de police convertie en mm (1 pt = 0.3528 mm).
function hauteurLigneMm(taillePt) {
  return taillePt * 0.3528 * 1.15;
}

function dessinerEtiquette(doc, x, y, largeurEtiquette, hauteurEtiquette, dataUrlQR, produit) {
  const tailleQR = Math.min(hauteurEtiquette - 4, largeurEtiquette * 0.42);
  const padding = 1.5;

  doc.addImage(dataUrlQR, 'PNG', x + padding, y + (hauteurEtiquette - tailleQR) / 2, tailleQR, tailleQR);

  const xTexte = x + padding + tailleQR + 2;
  const largeurTexte = (x + largeurEtiquette) - xTexte - padding;

  const TAILLE_NOM = 7, TAILLE_REF = 6, TAILLE_PRIX = 7;
  const ligneNomH = hauteurLigneMm(TAILLE_NOM);
  const ligneRefH = hauteurLigneMm(TAILLE_REF);
  const lignePrixH = hauteurLigneMm(TAILLE_PRIX);

  // Le nom peut ne pas tenir sur une ligne (étiquette étroite) : au plus 2
  // lignes, tronqué avec "…" au-delà — jamais de 3e ligne qui irait chevaucher
  // la référence/le prix comme avant (positions autrefois fixes, calculées
  // pour un nom tenant toujours sur une seule ligne).
  let lignesNom = doc.splitTextToSize(produit.nom || '', largeurTexte);
  if (lignesNom.length > 2) {
    lignesNom = [lignesNom[0], lignesNom[1].replace(/.{0,3}$/, '') + '…'];
  }

  const texteRef = produit.ref ? `Ref: ${produit.ref}` : '';
  const textePrix = `${formaterPrixPdf(produit.prix)} FCFA`;

  // Empile nom (1-2 lignes) + référence + prix, centré verticalement dans
  // l'étiquette. text() positionne sur la ligne de base : ligneNomH * 0.75
  // approxime la distance entre le haut du bloc et cette ligne de base.
  const hauteurBloc = lignesNom.length * ligneNomH + (texteRef ? ligneRefH : 0) + lignePrixH;
  let curY = y + (hauteurEtiquette - hauteurBloc) / 2 + ligneNomH * 0.75;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TAILLE_NOM);
  for (const ligne of lignesNom) {
    doc.text(ligne, xTexte, curY);
    curY += ligneNomH;
  }

  if (texteRef) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TAILLE_REF);
    doc.text(texteRef, xTexte, curY);
    curY += ligneRefH;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TAILLE_PRIX);
  doc.text(textePrix, xTexte, curY);
}

export function construirePdfEtiquettes(produit, nombre, dataUrlQR) {
  const n = Math.max(1, Math.floor(Number(nombre) || 1));
  const { colonnes, lignes, margeExterieureMm, espacementMm } = GRILLE_ETIQUETTES;
  const { largeurEtiquette, hauteurEtiquette } = dimensionsEtiquette();
  const parPage = colonnes * lignes;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let i = 0; i < n; i++) {
    const indexSurPage = i % parPage;
    if (i > 0 && indexSurPage === 0) doc.addPage('a4', 'portrait');

    const col = indexSurPage % colonnes;
    const ligne = Math.floor(indexSurPage / colonnes);
    const x = margeExterieureMm + col * (largeurEtiquette + espacementMm);
    const y = margeExterieureMm + ligne * (hauteurEtiquette + espacementMm);

    dessinerEtiquette(doc, x, y, largeurEtiquette, hauteurEtiquette, dataUrlQR, produit);
  }

  return doc;
}

/**
 * Variante "sélection multiple" : construit un seul PDF regroupant les
 * étiquettes de plusieurs produits à la suite (ex: 10 étiquettes du produit
 * A, puis 10 du produit B...), pratique pour tout imprimer en une fois après
 * une sélection groupée sur la page Produits.
 * `items` : [{ produit, nombre, dataUrl }, ...]
 */
export function construirePdfEtiquettesMultiples(items) {
  const { colonnes, lignes, margeExterieureMm, espacementMm } = GRILLE_ETIQUETTES;
  const { largeurEtiquette, hauteurEtiquette } = dimensionsEtiquette();
  const parPage = colonnes * lignes;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let indexGlobal = 0;

  for (const { produit, nombre, dataUrl } of items) {
    const n = Math.max(1, Math.floor(Number(nombre) || 1));
    for (let i = 0; i < n; i++) {
      const indexSurPage = indexGlobal % parPage;
      if (indexGlobal > 0 && indexSurPage === 0) doc.addPage('a4', 'portrait');

      const col = indexSurPage % colonnes;
      const ligne = Math.floor(indexSurPage / colonnes);
      const x = margeExterieureMm + col * (largeurEtiquette + espacementMm);
      const y = margeExterieureMm + ligne * (hauteurEtiquette + espacementMm);

      dessinerEtiquette(doc, x, y, largeurEtiquette, hauteurEtiquette, dataUrl, produit);
      indexGlobal++;
    }
  }

  return doc;
}

/**
 * Étape 3 : télécharge un document déjà construit.
 */
export function telechargerPdfEtiquettes(doc, produit) {
  doc.save(`Etiquettes-QR-${(produit.ref || produit.nom || 'produit').replace(/\s+/g, '-')}.pdf`);
}

/**
 * Raccourci "tout en un" (génère + construit + télécharge directement, sans aperçu).
 * Conservé pour compatibilité / usage éventuel hors interface d'aperçu.
 */
export async function genererEtImprimerEtiquettesQR(produit, nombre) {
  const dataUrlQR = await genererDataUrlQR(produit);
  const doc = construirePdfEtiquettes(produit, nombre, dataUrlQR);
  telechargerPdfEtiquettes(doc, produit);
}