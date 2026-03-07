// fuelify-backend/src/models/PriceHistory.js
const mongoose = require('mongoose');

const PriceEntrySchema = new mongoose.Schema(
  {
    regular: { type: Number, default: null },
    midgrade: { type: Number, default: null },
    premium: { type: Number, default: null },
    diesel: { type: Number, default: null },
    e85: { type: Number, default: null },
  },
  { _id: false }
);

const PriceHistorySchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', default: null },
    sourceType: { type: String, enum: ['OWNER', 'USER', 'AI_OCR', 'FLEET'], required: true },
    prices: { type: PriceEntrySchema, required: true },
    confidenceScore: { type: Number, default: 0.8, min: 0, max: 1 },
    reportedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('PriceHistory', PriceHistorySchema);
