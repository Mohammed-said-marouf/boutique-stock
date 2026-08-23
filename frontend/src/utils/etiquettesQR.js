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
function dessinerEtiquette(doc, x, y, largeurEtiquette, hauteurEtiquette, dataUrlQR, produit) {
  const tailleQR = Math.min(hauteurEtiquette - 4, largeurEtiquette * 0.42);
  const padding = 1.5;

  doc.addImage(dataUrlQR, 'PNG', x + padding, y + (hauteurEtiquette - tailleQR) / 2, tailleQR, tailleQR);

  const xTexte = x + padding + tailleQR + 2;
  const largeurTexte = (x + largeurEtiquette) - xTexte - padding;
  const centreY = y + hauteurEtiquette / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(produit.nom, largeurTexte), xTexte, centreY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  if (produit.ref) doc.text(`Ref: ${produit.ref}`, xTexte, centreY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(`${Number(produit.prix || 0).toLocaleString()} FCFA`, xTexte, centreY + 5);
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