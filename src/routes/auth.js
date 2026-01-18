const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const BusinessProfile = require('../models/BusinessProfile');

const router = express.Router();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Send OTP
router.post('/send-otp', [
  body('phoneNumber')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please enter a valid phone number')
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

    const { phoneNumber } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // Check if OTP was sent recently (rate limiting)
    const recentOtp = await OtpVerification.findOne({
      phoneNumber,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // 1 minute ago
    });

    if (recentOtp) {
      return res.status(429).json({
        success: false,
        message: 'OTP already sent. Please wait before requesting again.'
      });
    }

    // Generate OTP
    const otp = process.env.SKIP_OTP_IN_DEV === 'true' ? process.env.DEV_OTP : generateOTP();

    // Save OTP to database
    const otpVerification = new OtpVerification({
      phoneNumber,
      otp,
      ipAddress,
      userAgent
    });

    await otpVerification.save();

    // In development, skip actual SMS sending
    if (process.env.SKIP_OTP_IN_DEV === 'true') {
      console.log(`📱 OTP for ${phoneNumber}: ${otp}`);
      return res.json({
        success: true,
        message: 'OTP sent successfully',
        ...(process.env.NODE_ENV === 'development' && { otp }) // Include OTP in response for dev
      });
    }

    // TODO: Implement actual SMS sending service (Twilio, AWS SNS, etc.)
    // For now, just log the OTP
    console.log(`📱 OTP for ${phoneNumber}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// Verify OTP and login
router.post('/verify-otp', [
  body('phoneNumber')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Please enter a valid phone number'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
  // This endpoint is kept for backward compatibility or specific verify actions
  // The main login flow should use /login
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { phoneNumber, otp } = req.body;

    // Check OTP
    const otpRecord = await OtpVerification.findOne({
      phoneNumber,
      otp,
      createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } // 10 minutes expiry
    });

    if (!otpRecord && process.env.SKIP_OTP_IN_DEV !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Find or create user (Business Owner)
    let user = await User.findOne({ phoneNumber, role: 'business' });
    
    if (!user) {
      user = new User({
        role: 'business',
        phoneNumber
      });
      await user.save();
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user._id);

    // Get business profile if exists
    const businessProfile = await BusinessProfile.findOne({ userId: user._id });

    // Clean up used OTP
    if (process.env.SKIP_OTP_IN_DEV !== 'true') {
      await OtpVerification.deleteOne({ _id: otpRecord._id });
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        name: user.name,
        email: user.email
      },
      businessProfile
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

// Unified Login Endpoint
router.post('/login', async (req, res) => {
  try {
    const { type, identifier, password, otp } = req.body;
    
    console.log('Login request:', { type, identifier, hasPassword: !!password, hasOtp: !!otp });

    if (type === 'billboard' || type === 'admin') {
      // Billboard Owner or Admin Login (Username + Password)
      if (!identifier || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
      }

      // Check for user with either role
      const user = await User.findOne({ 
        username: identifier, 
        role: type === 'admin' ? 'admin' : 'billboard_owner' 
      }).select('+password');
      
      if (!user || !(await user.checkPassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const token = generateToken(user._id);
      await user.updateLastLogin();

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          name: user.name,
          email: user.email
        }
      });

    } else {
      // Business Owner Login (Phone + OTP)
      // Reuse logic from verify-otp or implement here
      const phoneNumber = identifier;
      
      if (!phoneNumber || !otp) {
        return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
      }

      // Check OTP
      const otpRecord = await OtpVerification.findOne({
        phoneNumber,
        otp,
        createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } // 10 minutes expiry
      });

      if (!otpRecord && process.env.SKIP_OTP_IN_DEV !== 'true') {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }

      let user = await User.findOne({ phoneNumber, role: 'business' });
      
      if (!user) {
        user = new User({
          role: 'business',
          phoneNumber
        });
        await user.save();
      }

      await user.updateLastLogin();
      const token = generateToken(user._id);
      const businessProfile = await BusinessProfile.findOne({ userId: user._id });

      if (process.env.SKIP_OTP_IN_DEV !== 'true' && otpRecord) {
        await OtpVerification.deleteOne({ _id: otpRecord._id });
      }

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          role: user.role,
          name: user.name,
          email: user.email
        },
        businessProfile
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Register Billboard Owner
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const user = new User({
      role: 'billboard_owner',
      username,
      password,
      name,
      email
    });

    await user.save();
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});



// Refresh token
router.post('/refresh-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    // Generate new token
    const newToken = generateToken(user._id);

    res.json({
      success: true,
      token: newToken
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Skip OTP (Development only)
router.post('/skip-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    console.log('Skipping OTP for:', phoneNumber);

    // Find or create user (Business Owner)
    let user = await User.findOne({ phoneNumber, role: 'business' });
    
    if (!user) {
      user = new User({
        role: 'business',
        phoneNumber
      });
      await user.save();
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user._id);

    // Get business profile if exists
    const businessProfile = await BusinessProfile.findOne({ userId: user._id });

    res.json({
      success: true,
      message: 'Login successful (OTP Skipped)',
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        name: user.name,
        email: user.email
      },
      businessProfile
    });

  } catch (error) {
    console.error('Skip OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to skip OTP'
    });
  }
});

module.exports = router;