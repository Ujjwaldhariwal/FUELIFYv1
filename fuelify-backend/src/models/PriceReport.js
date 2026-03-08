const mongoose = require('mongoose');

const FUEL_TYPES = ['petrol', 'diesel', 'premium', 'cng', 'ev'];

const PriceReportSchema = new mongoose.Schema(
  {
    stationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
      index: true,
    },
    fuelType: {
      type: String,
      enum: FUEL_TYPES,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 999.99,
    },
    reportedBy: {
      type: String,
      default: null,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    confirmedBy: {
      type: [String],
      default: () => [],
    },
    confirmCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

PriceReportSchema.index({ stationId: 1, fuelType: 1, reportedAt: -1 });

module.exports = mongoose.model('PriceReport', PriceReportSchema);
