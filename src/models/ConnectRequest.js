const mongoose = require('mongoose');

const connectRequestSchema = new mongoose.Schema({
  brand: {
    type: String,
    required: true,
    trim: true
  },
  purchaseDate: {
    type: String,
    required: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    type: String // URL or base64
  }],
  status: {
    type: String,
    enum: ['Pending', 'Contacted', 'Verified', 'Rejected'],
    default: 'Pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ConnectRequest', connectRequestSchema);
