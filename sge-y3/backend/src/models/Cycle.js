const mongoose = require('mongoose');

const cycleSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true, trim: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    is_active: { type: Boolean, default: false },
    // À partir de cette date, plus personne ne peut enregistrer ni soumettre son auto-évaluation.
    self_evaluation_deadline: { type: Date, default: null },
  },
  {
    collection: 'cycles',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

module.exports = mongoose.model('Cycle', cycleSchema);
