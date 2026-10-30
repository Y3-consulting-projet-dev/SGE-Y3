const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: Buffer,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    grade: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    code_categorie: {
      type: String,
      required: true,
      trim: true,
    },
    // Réinitialisation du mot de passe : seule l'empreinte SHA-256 du jeton est stockée.
    password_reset_token_hash: {
      type: String,
      default: null,
    },
    password_reset_expires_at: {
      type: Date,
      default: null,
    },
    password_reset_requested_at: {
      type: Date,
      default: null,
    },
    // Les jetons de session émis avant cette date sont refusés (voir authMiddleware).
    password_changed_at: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'users',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    email: this.email,
    name: this.name,
    last_name: this.last_name,
    first_name: this.first_name,
    grade: this.grade,
    department: this.department,
    is_active: this.is_active,
    code_categorie: this.code_categorie,
  };
};

module.exports = mongoose.model('User', userSchema);

