const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  motDePasse: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin', 'vendeur'], default: 'vendeur' },
  boutiqueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Boutique', default: null },
  actif: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('save', async function() {
  if (!this.isModified('motDePasse')) return;
  this.motDePasse = await bcrypt.hash(this.motDePasse, 10);
});

userSchema.methods.verifierMotDePasse = async function(mdp) {
  return await bcrypt.compare(mdp, this.motDePasse);
};

module.exports = mongoose.model('User', userSchema);