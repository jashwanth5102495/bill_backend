const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingType: {
    type: String,
    required: true,
    enum: ['personal-wishes', 'public-wishes', 'play-ad']
  },
  billboardId: {
    type: String,
    required: true
  },
  billboardName: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter valid time format (HH:MM)']
  },
  endTime: {
    type: String,
    required: true,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter valid time format (HH:MM)']
  },
  duration: {
    type: Number,
    required: true,
    min: [1, 'Duration must be at least 1 hour']
  },
  videoDuration: {
    type: Number,
    min: [0, 'Video duration cannot be negative'],
    default: 0
  },
  reputation: {
    type: Number,
    min: [0, 'Reputation cannot be negative'],
    default: 40
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partial'],
    default: 'pending'
  },
  paymentId: {
    type: String,
    trim: true
  },
  razorpayOrderId: {
    type: String,
    trim: true
  },
  razorpayPaymentId: {
    type: String,
    trim: true
  },
  content: {
    type: {
      type: String,
      enum: ['image', 'video', 'text'],
      required: true
    },
    url: {
      type: String,
      trim: true
    },
    text: {
      type: String,
      trim: true,
      maxlength: [1000, 'Text content cannot exceed 1000 characters']
    },
    moderationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    moderationNotes: {
      type: String,
      trim: true
    },
    moderatedAt: {
      type: Date
    }
  },
  customerDetails: {
    name: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters']
    }
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    min: [0, 'Refund amount cannot be negative']
  },
  refundedAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
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
bookingSchema.index({ userId: 1 });
bookingSchema.index({ bookingType: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });
bookingSchema.index({ location: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ razorpayOrderId: 1 });
bookingSchema.index({ razorpayPaymentId: 1 });

// Virtual for total duration in hours
bookingSchema.virtual('totalHours').get(function() {
  const start = new Date(`1970-01-01T${this.startTime}:00`);
  const end = new Date(`1970-01-01T${this.endTime}:00`);
  return (end - start) / (1000 * 60 * 60);
});

// Virtual for booking status display
bookingSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': 'Pending Confirmation',
    'confirmed': 'Confirmed',
    'in-progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return statusMap[this.status] || this.status;
});

// Instance methods
bookingSchema.methods.canBeCancelled = function() {
  const now = new Date();
  const startDateTime = new Date(`${this.startDate.toISOString().split('T')[0]}T${this.startTime}:00`);
  const hoursUntilStart = (startDateTime - now) / (1000 * 60 * 60);
  
  return this.status === 'pending' || this.status === 'confirmed' && hoursUntilStart > 24;
};

bookingSchema.methods.calculateRefund = function() {
  if (!this.canBeCancelled()) return 0;
  
  const now = new Date();
  const startDateTime = new Date(`${this.startDate.toISOString().split('T')[0]}T${this.startTime}:00`);
  const hoursUntilStart = (startDateTime - now) / (1000 * 60 * 60);
  
  if (hoursUntilStart > 48) return this.price; // Full refund
  if (hoursUntilStart > 24) return this.price * 0.5; // 50% refund
  return 0; // No refund
};

module.exports = mongoose.model('Booking', bookingSchema);