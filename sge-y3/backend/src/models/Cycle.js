const mongoose = require('mongoose');

const cycleSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true, trim: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    is_active: { type: Boolean, default: false },
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
