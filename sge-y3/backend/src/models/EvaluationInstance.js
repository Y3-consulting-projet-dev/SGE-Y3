const mongoose = require('mongoose');

const criterionSchema = new mongoose.Schema(
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

const pageThemeSchema = new mongoose.Schema(
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

const pageSchema = new mongoose.Schema(
  {
    page_id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    source_sheet: { type: String, default: '', trim: true },
    source_label: { type: String, default: '', trim: true },
    comment: { type: String, default: '', trim: true },
    themes: { type: [pageThemeSchema], default: [] },
  },
  { _id: false, id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    section_id: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
    comment: { type: String, default: '', trim: true },
    pages: { type: [pageSchema], default: [] },
    criteria: { type: [criterionSchema], default: [] },
  },
  { _id: false, id: false }
);

const missionCriterionSchema = new mongoose.Schema(
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

const missionRecipientSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    grade: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const missionEvaluationSchema = new mongoose.Schema(
  {
    mission_id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    period: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    member_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    member_name: { type: String, default: '', trim: true },
    member_grade: { type: String, default: '', trim: true },
    member_department: { type: String, default: '', trim: true },
    created_by_role: { type: String, default: 'self', trim: true },
    assigned_by_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assigned_by_name: { type: String, default: '', trim: true },
    assigned_by_grade: { type: String, default: '', trim: true },
    assigned_at: { type: Date, default: null },
    primary_recipient_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    primary_recipient_name: { type: String, default: '', trim: true },
    primary_recipient_grade: { type: String, default: '', trim: true },
    primary_recipient_department: { type: String, default: '', trim: true },
    recipients: { type: [missionRecipientSchema], default: [] },
    criteria: { type: [missionCriterionSchema], default: [] },
    comment: { type: String, default: '', trim: true },
    status: { type: String, default: 'Brouillon', trim: true },
    submitted_at: { type: Date, default: null },
  },
  { _id: false }
);

const evaluationInstanceSchema = new mongoose.Schema(
  {
    cycle_label: { type: String, required: true, trim: true },
    evalue_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      default: 'En cours',
      enum: ['Brouillon', 'En cours', 'Soumis au Manager', 'Soumis aux Managers', 'Soumis a RH', 'Soumis aux Associes', 'Valide RH', 'Transmis a l associe', 'En correction', 'Cloture'],
    },
    template_type: { type: String, default: 'assistant-self-evaluation', trim: true },
    submitted_to_role: { type: String, default: 'admin', trim: true },
    submitted_to_user_ids: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    submitted_to_names: { type: [String], default: [] },
    submitted_to_managers: {
      type: [
        {
          department: { type: String, trim: true },
          manager: { type: String, trim: true },
        },
      ],
      default: [],
    },
    mission_evaluations: { type: [missionEvaluationSchema], default: [] },
    sections: { type: [sectionSchema], default: [] },
    rh_validation_selected: { type: Boolean, default: false },
    rh_validation_selected_at: { type: Date, default: null },
    rh_validated_at: { type: Date, default: null },
    peer_review_comment: { type: String, default: '', trim: true },
    peer_review_comment_by_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    peer_review_comment_by_name: { type: String, default: '', trim: true },
    peer_review_comment_saved_at: { type: Date, default: null },
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
