const mongoose = require('mongoose');

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

const missionCriterionSchema = new mongoose.Schema(
  {
    criterion_id: { type: String, default: '', trim: true },
    section_title: { type: String, default: '', trim: true },
    section_comment: { type: String, default: '', trim: true },
    page_title: { type: String, default: '', trim: true },
    page_comment: { type: String, default: '', trim: true },
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
    comment: { type: String, default: '', trim: true },
    criteria: { type: [missionCriterionSchema], default: [] },
    last_saved_at: { type: Date, default: null },
  },
  { _id: false }
);

const associateManagerReviewSchema = new mongoose.Schema(
  {
    cycle_label: { type: String, required: true, trim: true },
    associate_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    manager_department: { type: String, default: '', trim: true },
    sections: { type: [reviewSectionSchema], default: [] },
    mission_reviews: { type: [missionReviewSchema], default: [] },
    associate_note: { type: String, default: '', trim: true },
    status: { type: String, default: 'En cours', trim: true },
    submitted_at: { type: Date, default: null },
    last_saved_at: { type: Date, default: null },
  },
  {
    collection: 'associate_manager_reviews',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

associateManagerReviewSchema.index({ cycle_label: 1, associate_id: 1, manager_id: 1 }, { unique: true });

module.exports = mongoose.model('AssociateManagerReview', associateManagerReviewSchema);
