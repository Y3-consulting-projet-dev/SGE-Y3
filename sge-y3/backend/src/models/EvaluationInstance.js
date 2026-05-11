const mongoose = require('mongoose');

const criterionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    score: { type: Number, default: null, min: 1, max: 5 },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    section_id: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
    comment: { type: String, default: '', trim: true },
    criteria: { type: [criterionSchema], default: [] },
  },
  { _id: false, id: false }
);

const evaluationInstanceSchema = new mongoose.Schema(
  {
    cycle_label: { type: String, required: true, trim: true },
    evalue_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      default: 'En cours',
      enum: ['Brouillon', 'En cours', 'Soumis a RH', 'Soumis aux Managers', 'Valide RH', 'En correction', 'Cloture'],
    },
    template_type: { type: String, default: 'assistant-self-evaluation', trim: true },
    submitted_to_role: { type: String, default: 'admin', trim: true },
    submitted_to_managers: {
      type: [
        {
          department: { type: String, trim: true },
          manager: { type: String, trim: true },
        },
      ],
      default: [],
    },
    sections: { type: [sectionSchema], default: [] },
    submitted_at: { type: Date, default: null },
    last_saved_at: { type: Date, default: null },
  },
  {
    collection: 'evaluation_instances',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

evaluationInstanceSchema.index({ cycle_label: 1, evalue_id: 1, template_type: 1 }, { unique: true });

module.exports = mongoose.model('EvaluationInstance', evaluationInstanceSchema);
