const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Billboard = require('../models/Billboard');
const Booking = require('../models/Booking');
const { auth, isAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const SLOT_DURATION_SECONDS = 21600; // 6 hours

// Helper to sanitize booking price if corrupted
async function sanitizeBooking(booking) {
  try {
    // If price is unreasonably high (e.g. > 100,000), try to recalculate
    if (booking.price > 100000) {
      // Handle populated billboardId
      const billboardId = booking.billboardId._id || booking.billboardId;
      const billboard = await Billboard.findById(billboardId);
      
      if (billboard) {
        let slotPrice = 0;
        const hour = parseInt(booking.startTime.split(':')[0]);
        
        if (hour >= 6 && hour < 12) slotPrice = billboard.slotPricing?.morning;
        else if (hour >= 12 && hour < 18) slotPrice = billboard.slotPricing?.afternoon;
        else if (hour >= 18) slotPrice = billboard.slotPricing?.evening;
        else slotPrice = billboard.slotPricing?.night;

        if (!slotPrice) slotPrice = billboard.price || 12000;

        const start = new Date(booking.startDate);
        const end = new Date(booking.endDate);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        const oneDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.round(Math.abs((end - start) / oneDay)) + 1;
        
        const videoDuration = booking.videoDuration || 15;
        const reputation = booking.reputation || 40;
        
        const costPerSecond = slotPrice / SLOT_DURATION_SECONDS;
        const dailyConsumedSeconds = videoDuration * reputation;
        const correctPrice = Math.round(costPerSecond * dailyConsumedSeconds * diffDays);

        if (correctPrice < booking.price) {
            console.log(`Sanitizing booking ${booking._id}: ${booking.price} -> ${correctPrice}`);
            booking.price = correctPrice;
            await booking.save();
        }
      }
    }
  } catch (err) {
    console.error(`Error sanitizing booking ${booking._id}:`, err);
  }
  return booking;
}

// Create Billboard Owner
router.post('/create-owner', auth, isAdmin, async (req, res) => {
  try {
    const { username, password, name, phoneNumber, email } = req.body;

    // Build query conditions
    const orConditions = [];
    if (username) orConditions.push({ username });
    if (phoneNumber) orConditions.push({ phoneNumber });

    if (orConditions.length > 0) {
      // Check if user already exists
      let user = await User.findOne({ 
        $or: orConditions
      });

      if (user) {
        return res.status(400).json({ 
          success: false, 
          message: 'User with this username or phone number already exists' 
        });
      }
    }

    const userData = {
      username,
      password, // Password will be hashed by pre-save hook
      name,
      role: 'billboard_owner'
    };

    if (phoneNumber) userData.phoneNumber = phoneNumber;
    if (email) userData.email = email;

    user = new User(userData);

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Billboard Owner created successfully',
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Create owner error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating owner' 
    });
  }
});

// List Billboard Owners
router.get('/owners', auth, isAdmin, async (req, res) => {
  try {
    const owners = await User.find({ role: 'billboard_owner' })
      .select('-password')
      .sort({ createdAt: -1 });
      
    res.json({
      success: true,
      owners
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching owners' 
    });
  }
});

// List Business Owners
router.get('/business-owners', auth, isAdmin, async (req, res) => {
  try {
    const owners = await User.find({ role: 'business' })
      .select('-password')
      .sort({ createdAt: -1 });
      
    res.json({
      success: true,
      owners
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching business owners' 
    });
  }
});

// Update Billboard Owner
router.put('/owners/:id', auth, isAdmin, async (req, res) => {
  try {
    const { name, phoneNumber, email, username } = req.body;
    
    // Check if username/phone already exists for OTHER users
    if (username || phoneNumber) {
      const existingUser = await User.findOne({
        _id: { $ne: req.params.id },
        $or: [
          { username: username || '' },
          { phoneNumber: phoneNumber || '' }
        ]
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or phone number already in use'
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { name, phoneNumber, email, username } },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update owner error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Billboards for a specific Owner
router.get('/owners/:id/billboards', auth, isAdmin, async (req, res) => {
  try {
    const billboards = await Billboard.find({ ownerId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, billboards });
  } catch (error) {
    console.error('Get owner billboards error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add Billboard for a specific Owner
router.post('/owners/:id/billboards', auth, isAdmin, async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'Owner not found' });
    }

    // Remove id/ID field from body to prevent CastError
    const { id, _id, ...billboardData } = req.body;

    const billboard = new Billboard({
      ...billboardData,
      ownerId: owner._id
    });

    await billboard.save();
    res.status(201).json({ success: true, billboard });
  } catch (error) {
    console.error('Add owner billboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// Update Billboard for a specific Owner
router.put('/owners/:id/billboards/:billboardId', auth, isAdmin, async (req, res) => {
  try {
    const billboard = await Billboard.findOne({ 
      _id: req.params.billboardId,
      ownerId: req.params.id 
    });

    if (!billboard) {
      return res.status(404).json({ success: false, message: 'Billboard not found' });
    }

    Object.assign(billboard, req.body);
    await billboard.save();

    res.json({ success: true, billboard });
  } catch (error) {
    console.error('Update owner billboard error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// Get all bookings (Admin)
router.get('/bookings', auth, isAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('userId', 'name email phoneNumber')
      .populate('billboardId', 'name location')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Fetch all bookings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// Get running ads (Admin)
router.get('/running-ads', auth, isAdmin, async (req, res) => {
  try {
    const now = new Date();
    const bookings = await Booking.find({
      $or: [
        { status: 'active' },
        { 
          startDate: { $lte: now },
          endDate: { $gte: now },
          status: { $in: ['confirmed', 'paid'] }
        }
      ]
    })
    .populate('userId', 'name email phoneNumber')
    .populate('billboardId', 'name location')
    .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Fetch running ads error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch running ads' });
  }
});

// Get availability (Admin)
router.get('/availability', auth, isAdmin, async (req, res) => {
  try {
    const billboards = await Billboard.find().populate('ownerId', 'name');
    const now = new Date();
    
    const availabilityData = await Promise.all(billboards.map(async (billboard) => {
      const activeBooking = await Booking.findOne({
        billboardId: billboard._id,
        startDate: { $lte: now },
        endDate: { $gte: now },
        status: { $in: ['confirmed', 'paid', 'active'] }
      });
      
      return {
        ...billboard.toObject(),
        isBooked: !!activeBooking,
        currentBooking: activeBooking ? {
          startDate: activeBooking.startDate,
          endDate: activeBooking.endDate,
          status: activeBooking.status
        } : null
      };
    }));

    res.json({ success: true, billboards: availabilityData });
  } catch (error) {
    console.error('Fetch availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch availability' });
  }
});

module.exports = router;
