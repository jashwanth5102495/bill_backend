const mongoose = require('mongoose');

const otpVerificationSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  otp: {
    type: String,
    required: true,
    length: 6
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
  },
  verified: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0,
    max: [5, 'Maximum 5 verification attempts allowed']
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
otpVerificationSchema.index({ phoneNumber: 1 });
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
otpVerificationSchema.index({ createdAt: -1 });

// Instance methods
otpVerificationSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

otpVerificationSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

otpVerificationSchema.methods.markAsVerified = function() {
  this.verified = true;
  return this.save();
};

// Static methods
otpVerificationSchema.statics.findValidOtp = function(phoneNumber, otp) {
  return this.findOne({
    phoneNumber,
    otp,
    verified: false,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 5 }
  });
};

otpVerificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

module.exports = mongoose.model('OtpVerification', otpVerificationSchema);