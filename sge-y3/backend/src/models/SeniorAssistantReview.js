const mongoose = require('mongoose');

const reviewThemeSchema = new mongoose.Schema(
  {
    theme_id: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    statement: { type: String, default: '', trim: true },
    score: { type: Number, default: null, min: 1, max: 5 },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const reviewPageSchema = new mongoose.Schema(
  {
    page_id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    source_sheet: { type: String, default: '', trim: true },
    source_label: { type: String, default: '', trim: true },
    comment: { type: String, default: '', trim: true },
    themes: { type: [reviewThemeSchema], default: [] },
  },
  { _id: false }
);

const reviewCriterionSchema = new mongoose.Schema(
  {
    criterion_id: { type: String, default: '', trim: true },
    label: { type: String, required: true, trim: true },
    statement: { type: String, default: '', trim: true },
    page_id: { type: String, default: '', trim: true },
    page_title: { type: String, default: '', trim: true },
    theme_code: { type: String, default: '', trim: true },
    score: { type: Number, default: null, min: 1, max: 5 },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const reviewSectionSchema = new mongoose.Schema(
  {
    section_id: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
    comment: { type: String, default: '', trim: true },
    pages: { type: [reviewPageSchema], default: [] },
    criteria: { type: [reviewCriterionSchema], default: [] },
  },
  { _id: false }
);

const missionReviewCriterionSchema = new mongoose.Schema(
  {
    criterion_id: { type: String, default: '', trim: true },
    section_title: { type: String, default: '', trim: true },
    page_title: { type: String, default: '', trim: true },
    source_sheet: { type: String, default: '', trim: true },
    source_label: { type: String, default: '', trim: true },
    theme_code: { type: String, default: '', trim: true },
    label: { type: String, required: true, trim: true },
    statement: { type: String, default: '', trim: true },
    score: { type: Number, default: null, min: 1, max: 5 },
  },
  { _id: false }
);

const missionReviewSchema = new mongoose.Schema(
  {
    mission_id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    period: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    origin: { type: String, default: 'assistant-self', trim: true },
    assigned_at: { type: Date, default: null },
    assigned_by_name: { type: String, default: '', trim: true },
    assigned_by_grade: { type: String, default: '', trim: true },
    recipient_name: { type: String, default: '', trim: true },
    recipient_grade: { type: String, default: '', trim: true },
    recipient_department: { type: String, default: '', trim: true },
    assistant_submitted_at: { type: Date, default: null },
    status: { type: String, default: 'A demarrer', trim: true },
    comment: { type: String, default: '', trim: true },
    criteria: { type: [missionReviewCriterionSchema], default: [] },
    submitted_at: { type: Date, default: null },
  },
  { _id: false }
);

const seniorAssistantReviewSchema = new mongoose.Schema(
  {
    cycle_label: { type: String, required: true, trim: true },
    senior_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assistant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assistant_department: { type: String, default: '', trim: true },
    status: {
      type: String,
      default: 'En cours',
      enum: ['Brouillon', 'En cours', 'Soumis au Manager', 'Transmis au Manager', 'Cloture'],
    },
    template_type: { type: String, default: 'senior-assistant-evaluation', trim: true },
    submitted_to_user_ids: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    submitted_to_names: { type: [String], default: [] },
    mission_reviews: { type: [missionReviewSchema], default: [] },
    sections: { type: [reviewSectionSchema], default: [] },
    submitted_at: { type: Date, default: null },
    last_saved_at: { type: Date, default: null },
  },
  {
    collection: 'senior_assistant_reviews',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

seniorAssistantReviewSchema.index({ cycle_label: 1, senior_id: 1, assistant_id: 1 }, { unique: true });

module.exports = mongoose.model('SeniorAssistantReview', seniorAssistantReviewSchema);
