import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportProduitsPDF = (produits) => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor('#e94560');
  doc.text('Boutique Stock - Rapport des Produits', 14, 20);

  doc.setFontSize(11);
  doc.setTextColor('#888888');
  doc.text(`Genere le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);

  autoTable(doc, {
    startY: 38,
    head: [['Nom', 'Categorie', 'Prix (FCFA)', 'Quantite', 'Statut']],
    body: produits.map(p => [
      p.nom,
      p.categorie,
      p.prix,
      p.quantite,
      p.quantite <= p.seuilAlerte ? 'Stock bas' : 'OK'
    ]),
    headStyles: { fillColor: [26, 26, 46] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { fontSize: 11 }
  });

  doc.save('rapport-produits.pdf');
};

export const exportVentesPDF = (ventes) => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor('#e94560');
  doc.text('Boutique Stock - Rapport des Ventes', 14, 20);

  doc.setFontSize(11);
  doc.setTextColor('#888888');
  doc.text(`Genere le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);

  const totalCA = ventes.reduce((acc, v) => acc + v.montantTotal, 0);

  doc.setFontSize(13);
  doc.setTextColor(46, 196, 182);
  doc.text(`Chiffre d'affaires total : ${totalCA} FCFA`, 14, 42);

  autoTable(doc, {
    startY: 50,
    head: [['Produit', 'Quantite', 'Montant (FCFA)', 'Type', 'Date']],
    body: ventes.map(v => [
      v.produits.map(p => p.produit?.nom || 'Supprime').join(', '),
      v.produits.reduce((a, p) => a + p.quantite, 0),
      v.montantTotal,
      v.typeVente === 'en_ligne' ? 'En ligne' : 'En boutique',
      new Date(v.dateVente).toLocaleDateString('fr-FR')
    ]),
    headStyles: { fillColor: [26, 26, 46] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { fontSize: 11 }
  });

  doc.save('rapport-ventes.pdf');
};