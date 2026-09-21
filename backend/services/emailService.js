const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const envoyerAlerteStock = async (produits) => {
  if (produits.length === 0) return;

  const listeProduits = produits.map(p =>
    `• ${p.nom} — Stock: ${p.quantite} (Seuil: ${p.seuilAlerte})`
  ).join('\n');

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_DEST,
    subject: '⚠️ Alerte Stock Bas — Boutique Stock',
    html: `
      <div style="font-family: Arial; padding: 20px; background: #f0f2f5;">
        <div style="background: white; border-radius: 12px; padding: 30px; max-width: 500px; margin: auto;">
          <h2 style="color: #e94560;">⚠️ Alerte Stock Bas</h2>
          <p>Les produits suivants ont un stock inférieur au seuil d'alerte :</p>
          <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
            ${produits.map(p => `
              <div style="margin-bottom: 10px;">
                <strong>📦 ${p.nom}</strong><br/>
                Stock actuel : <span style="color: #e94560;">${p.quantite}</span> unités<br/>
                Seuil d'alerte : ${p.seuilAlerte} unités
              </div>
            `).join('<hr/>')}
          </div>
          <p style="color: #888;">Connectez-vous sur <a href="https://boutique-stock.vercel.app">Boutique Stock</a> pour réapprovisionner.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email alerte stock envoyé !');
  } catch (err) {
    console.log('❌ Erreur envoi email :', err.message);
  }
};

// Email de test simple, déclenché depuis la page Maintenance du panneau
// Super Admin, pour vérifier que l'envoi fonctionne toujours.
const envoyerEmailTest = async (utilisateur) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_DEST || utilisateur?.email,
    subject: '✅ Test — Boutique Stock',
    html: `
      <div style="font-family: Arial; padding: 20px; background: #f0f2f5;">
        <div style="background: white; border-radius: 12px; padding: 30px; max-width: 500px; margin: auto;">
          <h2 style="color: #16a34a;">✅ Test d'envoi réussi</h2>
          <p>Cet email confirme que le service d'envoi de notifications de Boutique Stock fonctionne correctement.</p>
          <p style="color: #888; font-size: 13px;">Déclenché depuis la page Maintenance du panneau Super Admin.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Prévient les admins d'un compte qu'un vendeur vient de déclarer un versement
// à approuver. Ne lève jamais d'erreur : une panne d'envoi ne doit pas faire
// échouer l'enregistrement du versement.
const envoyerNotificationVersement = async (destinataires, { montant, nomAuteur, nomCaisse }) => {
  if (!destinataires || destinataires.length === 0) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  nomAuteur = esc(nomAuteur);
  nomCaisse = esc(nomCaisse);
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: destinataires.join(','),
      subject: `💰 Versement à approuver — ${Number(montant).toLocaleString('fr-FR')} FCFA`,
      html: `
        <div style="font-family: Arial; padding: 20px; background: #f0f2f5;">
          <div style="background: white; border-radius: 12px; padding: 30px; max-width: 500px; margin: auto;">
            <h2 style="color: #2563eb;">💰 Nouveau versement à approuver</h2>
            <p><strong>${nomAuteur || 'Un vendeur'}</strong> déclare vous avoir versé
              <strong>${Number(montant).toLocaleString('fr-FR')} FCFA</strong>
              (caisse « ${nomCaisse || '—'} »).</p>
            <p>Il ne sera pris en compte dans le solde de la caisse qu'une fois approuvé.</p>
            <p style="color: #888;">Connectez-vous sur <a href="https://boutique-stock.vercel.app">Boutique Stock</a> →
              Dépenses &amp; versements pour l'approuver ou le refuser.</p>
          </div>
        </div>
      `
    });
  } catch (err) {
    console.log('❌ Erreur envoi email versement :', err.message);
  }
};

module.exports = { envoyerAlerteStock, envoyerEmailTest, envoyerNotificationVersement };