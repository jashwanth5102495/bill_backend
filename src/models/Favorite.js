const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemId: {
    type: String,
    required: true,
    trim: true
  },
  itemType: {
    type: String,
    required: true,
    enum: ['billboard', 'location', 'service']
  },
  itemData: {
    title: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    priceRange: {
      type: String,
      trim: true
    },
    rating: {
      type: Number,
      min: 0,
      max: 5
    },
    reviews: {
      type: Number,
      min: 0,
      default: 0
    },
    image: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    features: [{
      type: String,
      trim: true
    }],
    availability: {
      type: Boolean,
      default: true
    }
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

// Compound index to ensure user can't favorite the same item twice
favoriteSchema.index({ userId: 1, itemId: 1 }, { unique: true });

// Other indexes
favoriteSchema.index({ userId: 1 });
favoriteSchema.index({ itemType: 1 });
favoriteSchema.index({ createdAt: -1 });

// Static methods
favoriteSchema.statics.findByUserAndType = function(userId, itemType) {
  return this.find({ userId, itemType }).sort({ createdAt: -1 });
};

favoriteSchema.statics.isFavorited = async function(userId, itemId) {
  const favorite = await this.findOne({ userId, itemId });
  return !!favorite;
};

module.exports = mongoose.model('Favorite', favoriteSchema);