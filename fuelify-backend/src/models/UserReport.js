// fuelify-backend/src/models/UserReport.js
const mongoose = require('mongoose');

const UserReportSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true, index: true },
    type: {
      type: String,
      enum: ['PRICE_UPDATE', 'WRONG_LOCATION', 'CLOSED', 'WRONG_INFO'],
      required: true,
    },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    reporterIp: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserReport', UserReportSchema);
