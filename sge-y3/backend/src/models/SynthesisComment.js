const mongoose = require('mongoose');

// Commentaire d'un associé sur la synthèse RH d'un collaborateur (un commentaire par associé, par collaborateur et par cycle).
const synthesisCommentSchema = new mongoose.Schema(
  {
    cycle_label: { type: String, required: true, trim: true },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    author_name: { type: String, default: '', trim: true },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  {
    collection: 'synthesis_comments',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

synthesisCommentSchema.index({ cycle_label: 1, member_id: 1, author_id: 1 }, { unique: true });

module.exports = mongoose.model('SynthesisComment', synthesisCommentSchema);
