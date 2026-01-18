const mongoose = require('mongoose');

const billboardSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    min: 0
  },
  slotPricing: {
    morning: Number,
    afternoon: Number,
    evening: Number,
    night: Number
  },
  image: {
    type: String // URL or base64
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  dailyFootfall: String,
  dimensions: String,
  type: {
    type: String,
    enum: ['Digital', 'Static'],
    default: 'Digital'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Billboard', billboardSchema);
