const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  nom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  motDePasse: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin', 'vendeur'], default: 'vendeur' },
  boutiqueId: { type: String, ref: 'Boutique', default: null },
  // Photo de profil (URL Cloudinary). null = pas de photo, l'appli affiche
  // alors l'initiale du nom — voir routes/users.js pour la modifier.
  photo: { type: String, default: null },
  // Assignation fixe d'un vendeur à une Caisse précise (au sein d'une
  // Boutique) — décidée par l'admin, le vendeur ne choisit pas. Non
  // pertinent pour les rôles admin/superadmin.
  caisseId: { type: String, ref: 'Caisse', default: null },
  actif: { type: Boolean, default: true },
  // Vrai après une réinitialisation par le super admin : l'utilisateur doit
  // remplacer le mot de passe temporaire par le sien dès sa connexion.
  doitChangerMotDePasse: { type: Boolean, default: false }
}, { timestamps: true });

// Format d'un hash bcrypt : $2a$10$... / $2b$10$... / $2y$10$..., toujours
// 60 caractères. Un mot de passe en clair ne matche quasiment jamais ce
// format par hasard, donc ce test permet de distinguer de façon fiable
// "mot de passe déjà haché" (ex: reçu du desktop, hors-ligne) de "mot de
// passe en clair à hacher" (ex: saisi dans un formulaire web).
const REGEX_HASH_BCRYPT = /^\$2[aby]\$\d{2}\$.{53}$/;

userSchema.pre('save', async function() {
  if (!this.isModified('motDePasse')) return;
  if (REGEX_HASH_BCRYPT.test(this.motDePasse)) return; // déjà haché, ne pas re-hacher
  this.motDePasse = await bcrypt.hash(this.motDePasse, 10);
});

userSchema.methods.verifierMotDePasse = async function(mdp) {
  return await bcrypt.compare(mdp, this.motDePasse);
};

module.exports = mongoose.model('User', userSchema);