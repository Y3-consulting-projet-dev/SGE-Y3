const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actor_name: { type: String, default: '', trim: true },
    cycle_label: { type: String, default: '', trim: true },
    entity_type: { type: String, default: '', trim: true },
    entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    link: { type: String, default: '', trim: true },
    is_read: { type: Boolean, default: false, index: true },
    read_at: { type: Date, default: null },
  },
  {
    collection: 'notifications',
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

notificationSchema.index({ recipient_id: 1, is_read: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
