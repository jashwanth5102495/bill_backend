const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const BusinessProfile = require('../models/BusinessProfile');
const Booking = require('../models/Booking');
const Favorite = require('../models/Favorite');

const router = express.Router();

// Get user profile
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is accessing their own profile or is admin
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Update user profile
router.put('/:userId', [
  auth,
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('email').optional().isEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { name, email } = req.body;

    // Check if user is updating their own profile
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user profile'
    });
  }
});

// Delete user account
router.delete('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is deleting their own account
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete - mark as inactive
    user.isActive = false;
    await user.save();

    // TODO: Handle cleanup of related data (bookings, favorites, etc.)
    // For now, we'll keep the data for audit purposes

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account'
    });
  }
});

// Get user statistics
router.get('/:userId/stats', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is accessing their own stats
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const [bookings, favorites] = await Promise.all([
      Booking.find({ userId }),
      Favorite.find({ userId })
    ]);

    const stats = {
      totalBookings: bookings.length,
      completedBookings: bookings.filter(b => b.status === 'completed').length,
      totalSpent: bookings
        .filter(b => b.paymentStatus === 'paid')
        .reduce((sum, b) => sum + b.price, 0),
      favoriteCount: favorites.length,
      bookingsByType: {
        'personal-wishes': bookings.filter(b => b.bookingType === 'personal-wishes').length,
        'public-wishes': bookings.filter(b => b.bookingType === 'public-wishes').length,
        'play-ad': bookings.filter(b => b.bookingType === 'play-ad').length
      },
      recentActivity: {
        lastBooking: bookings.length > 0 ? bookings.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt : null,
        lastFavorite: favorites.length > 0 ? favorites.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt : null
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
});

module.exports = router;