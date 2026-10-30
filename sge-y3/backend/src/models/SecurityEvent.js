const mongoose = require('mongoose');

// Journal des événements liés au code de secours. Ne contient jamais le code.
const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'recovery_code_generated',
        'recovery_code_regenerated',
        'recovery_success',
        'recovery_failed',
        'recovery_locked',
      ],
    },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    ip: { type: String, default: '' },
  },
  {
    collection: 'security_events',
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
  }
);

securityEventSchema.index({ created_at: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
