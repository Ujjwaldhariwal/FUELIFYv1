// fuelify-backend/src/models/Station.js
const mongoose = require('mongoose');

const PricesSchema = new mongoose.Schema(
  {
    regular: { type: Number, default: null },
    midgrade: { type: Number, default: null },
    premium: { type: Number, default: null },
    diesel: { type: Number, default: null },
    e85: { type: Number, default: null },
    lastUpdated: { type: Date, default: null },
    updatedBy: { type: String, enum: ['OWNER', 'USER', 'AI'], default: null },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    street:  { type: String, default: null },
    city:    { type: String, default: null },
    state:   { type: String, required: true, default: 'OH' },
    zip:     { type: String, default: null },
    country: { type: String, required: true, default: 'US' },
  },
  { _id: false }
);

const CoordinatesSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const ServicesSchema = new mongoose.Schema(
  {
    carWash:   { type: Boolean, default: false },
    airPump:   { type: Boolean, default: false },
    atm:       { type: Boolean, default: false },
    restrooms: { type: Boolean, default: false },
    convenience: { type: Boolean, default: false },
    diesel:    { type: Boolean, default: false },
    evCharging:{ type: Boolean, default: false },
  },
  { _id: false }
);

const StationSchema = new mongoose.Schema(
  {
    osmId:   { type: String, default: null },
    placeId: { type: String, default: null },
    slug:    { type: String, required: true },
    name:    { type: String, required: true },
    brand: {
      type: String,
      enum: [
        'marathon', 'shell', 'bp', 'exxon', 'chevron',
        'arco', 'speedway', 'sunoco', 'citgo', 'gulf',
        'valero', 'costco', 'wawa', 'sheetz', 'caseys',
        'pilot', 'loves', 'ta', 'circle_k', 'kwik_trip',
        'texaco', '76', 'phillips66', 'conoco', 'petro',
        'thorntons', 'racetrac', 'holiday', 'maverik',
        'sinclair', 'cenex', 'quiktrip', 'bucees',
        'independent', 'default',
      ],
      default: 'default',
    },
    address:     { type: AddressSchema, required: true },
    coordinates: { type: CoordinatesSchema, required: true },
    phone:   { type: String, default: null },
    website: { type: String, default: null },
    hours:   { type: String, default: null },
    status: {
      type: String,
      enum: ['UNCLAIMED', 'CLAIMED', 'VERIFIED'],
      default: 'UNCLAIMED',
      index: true,
    },
    claimedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', default: null },
    claimedAt:  { type: Date, default: null },
    prices:     { type: PricesSchema, default: () => ({}) },
    confidenceScore: { type: Number, default: 0.5, min: 0, max: 1 },
    services:   { type: ServicesSchema, default: () => ({}) },
    metaDescription:  { type: String, default: '' },
    viewCount:        { type: Number, default: 0 },
    searchAppearances:{ type: Number, default: 0 },
    dataSource: {
      type: String,
      enum: ['OSM', 'GOOGLE_PLACES', 'MANUAL'],
      default: 'MANUAL',
    },
  },
  { timestamps: true }
);

// Indexes
StationSchema.index({ coordinates: '2dsphere' });
StationSchema.index({ 'address.state': 1, status: 1 });
StationSchema.index({ brand: 1 });
StationSchema.index({ slug: 1 },    { unique: true });
StationSchema.index({ placeId: 1 }, { unique: true, sparse: true });
StationSchema.index({ osmId: 1 },   { unique: true, sparse: true });
StationSchema.index({ name: 'text', 'address.city': 'text' });

module.exports = mongoose.model('Station', StationSchema);
