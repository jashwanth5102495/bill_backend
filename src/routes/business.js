const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const BusinessProfile = require('../models/BusinessProfile');

const router = express.Router();

// Create business profile
router.post('/', [
  auth,
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
  body('businessType').trim().notEmpty().withMessage('Business type is required'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pincode').matches(/^\d{6}$/).withMessage('Valid 6-digit PIN code is required')
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

    const userId = req.userId;

    // Check if business profile already exists
    const existingProfile = await BusinessProfile.findOne({ userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Business profile already exists'
      });
    }

    const profileData = {
      userId,
      ...req.body
    };

    const businessProfile = new BusinessProfile(profileData);
    await businessProfile.save();

    res.status(201).json({
      success: true,
      message: 'Business profile created successfully',
      profile: businessProfile
    });

  } catch (error) {
    console.error('Create business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create business profile'
    });
  }
});

// Get business profile by user ID
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is accessing their own profile
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const businessProfile = await BusinessProfile.findOne({ userId }).populate('userId', 'phoneNumber name email');

    if (!businessProfile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }

    res.json({
      success: true,
      profile: businessProfile
    });

  } catch (error) {
    console.error('Get business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get business profile'
    });
  }
});

// Update business profile
router.put('/user/:userId', [
  auth,
  body('businessName').optional().trim().notEmpty().withMessage('Business name cannot be empty'),
  body('businessType').optional().trim().notEmpty().withMessage('Business type cannot be empty'),
  body('ownerName').optional().trim().notEmpty().withMessage('Owner name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('address').optional().trim().notEmpty().withMessage('Address cannot be empty'),
  body('city').optional().trim().notEmpty().withMessage('City cannot be empty'),
  body('state').optional().trim().notEmpty().withMessage('State cannot be empty'),
  body('pincode').optional().matches(/^\d{6}$/).withMessage('Valid 6-digit PIN code is required'),
  body('gstNumber').optional().matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).withMessage('Invalid GST number'),
  body('panNumber').optional().matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Invalid PAN number'),
  body('website').optional().isURL().withMessage('Invalid website URL')
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

    // Check if user is updating their own profile
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const businessProfile = await BusinessProfile.findOne({ userId });

    if (!businessProfile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        if (key === 'socialMedia') {
          businessProfile.socialMedia = { ...businessProfile.socialMedia, ...req.body[key] };
        } else {
          businessProfile[key] = req.body[key];
        }
      }
    });

    await businessProfile.save();

    res.json({
      success: true,
      message: 'Business profile updated successfully',
      profile: businessProfile
    });

  } catch (error) {
    console.error('Update business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update business profile'
    });
  }
});

// Delete business profile
router.delete('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is deleting their own profile
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const businessProfile = await BusinessProfile.findOneAndDelete({ userId });

    if (!businessProfile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }

    res.json({
      success: true,
      message: 'Business profile deleted successfully'
    });

  } catch (error) {
    console.error('Delete business profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete business profile'
    });
  }
});

// Get all business profiles (admin only - for future use)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, businessType, city, state } = req.query;

    const filter = {};
    if (businessType) filter.businessType = businessType;
    if (city) filter.city = new RegExp(city, 'i');
    if (state) filter.state = new RegExp(state, 'i');

    const profiles = await BusinessProfile.find(filter)
      .populate('userId', 'phoneNumber name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await BusinessProfile.countDocuments(filter);

    res.json({
      success: true,
      profiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get business profiles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get business profiles'
    });
  }
});

module.exports = router;