const mongoose = require('mongoose');

const committeeDecisionSchema = new mongoose.Schema(
  {
    cycle_label: { type: String, default: 'Cycle 2025-2026', trim: true },
    scope: { type: String, default: 'associate-final', trim: true, index: true },
    decisions: { type: mongoose.Schema.Types.Mixed, default: {} },
    submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submitted_by_name: { type: String, default: '', trim: true },
    submitted_at: { type: Date, default: Date.now },
  },
  {
    collection: 'committee_decisions',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

committeeDecisionSchema.index({ scope: 1, submitted_at: -1 });

module.exports = mongoose.model('CommitteeDecision', committeeDecisionSchema);
