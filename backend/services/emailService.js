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

module.exports = { envoyerAlerteStock };