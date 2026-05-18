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
    source_sheet: { type: String, default: '', trim: true },
    source_label: { type: String, default: '', trim: true },
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

const managerMemberReviewSchema = new mongoose.Schema(
  {
    cycle_label: { type: String, required: true, trim: true },
    manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    member_department: { type: String, default: '', trim: true },
    status: {
      type: String,
      default: 'En cours',
      enum: ['Brouillon', 'En cours', 'Soumis a RH', 'Valide RH', 'Cloture'],
    },
    template_type: { type: String, default: 'manager-member-evaluation', trim: true },
    submitted_to_user_ids: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    submitted_to_names: { type: [String], default: [] },
    rh_validation_selected: { type: Boolean, default: false },
    rh_validation_selected_at: { type: Date, default: null },
    rh_validated_at: { type: Date, default: null },
    mission_reviews: { type: [missionReviewSchema], default: [] },
    sections: { type: [reviewSectionSchema], default: [] },
    submitted_at: { type: Date, default: null },
    last_saved_at: { type: Date, default: null },
  },
  {
    collection: 'manager_member_reviews',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

managerMemberReviewSchema.index({ cycle_label: 1, manager_id: 1, member_id: 1 }, { unique: true });

module.exports = mongoose.model('ManagerMemberReview', managerMemberReviewSchema);
