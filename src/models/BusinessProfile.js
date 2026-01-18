const mongoose = require('mongoose');

const businessProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    maxlength: [200, 'Business name cannot exceed 200 characters']
  },
  businessType: {
    type: String,
    required: [true, 'Business type is required'],
    trim: true,
    maxlength: [100, 'Business type cannot exceed 100 characters']
  },
  ownerName: {
    type: String,
    required: [true, 'Owner name is required'],
    trim: true,
    maxlength: [100, 'Owner name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [100, 'City cannot exceed 100 characters']
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    maxlength: [100, 'State cannot exceed 100 characters']
  },
  pincode: {
    type: String,
    required: [true, 'PIN code is required'],
    trim: true,
    match: [/^\d{6}$/, 'Please enter a valid 6-digit PIN code']
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please enter a valid GST number']
  },
  panNumber: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN number']
  },
  businessDescription: {
    type: String,
    trim: true,
    maxlength: [1000, 'Business description cannot exceed 1000 characters']
  },
  website: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid website URL']
  },
  socialMedia: {
    facebook: {
      type: String,
      trim: true
    },
    instagram: {
      type: String,
      trim: true
    },
    twitter: {
      type: String,
      trim: true
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [{
    type: {
      type: String,
      enum: ['GST', 'PAN', 'Business License', 'Other']
    },
    url: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
businessProfileSchema.index({ userId: 1 });
businessProfileSchema.index({ businessName: 1 });
businessProfileSchema.index({ city: 1, state: 1 });
businessProfileSchema.index({ businessType: 1 });
businessProfileSchema.index({ createdAt: -1 });

// Virtual for full address
businessProfileSchema.virtual('fullAddress').get(function() {
  return `${this.address}, ${this.city}, ${this.state} - ${this.pincode}`;
});

module.exports = mongoose.model('BusinessProfile', businessProfileSchema);