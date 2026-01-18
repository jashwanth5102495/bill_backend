const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Booking = require('../models/Booking');
const Billboard = require('../models/Billboard');
const User = require('../models/User');

const SLOT_DURATION_SECONDS = 21600; // 6 hours

// Helper to sanitize booking price if corrupted
async function sanitizeBooking(booking) {
  try {
    // If price is unreasonably high (e.g. > 100,000), try to recalculate
    if (booking.price > 100000) {
      const billboard = await Billboard.findById(booking.billboardId);
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

const router = express.Router();

// Get bookings for Billboard Owner
router.get('/owner', auth, async (req, res) => {
  try {
    const { billboardId } = req.query;

    // 1. Find all billboards owned by this user
    const billboards = await Billboard.find({ ownerId: req.user._id });
    
    if (!billboards.length) {
      return res.json({ success: true, bookings: [] });
    }

    let targetBillboardIds = billboards.map(b => b._id.toString());

    // Filter by specific billboard if provided
    if (billboardId) {
      if (!targetBillboardIds.includes(billboardId)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied to this billboard bookings' 
        });
      }
      targetBillboardIds = [billboardId];
    }

    // 2. Find bookings for these billboards
    const bookings = await Booking.find({
      billboardId: { $in: targetBillboardIds }
    })
    .populate('userId', 'name email phoneNumber') // Get Business Owner details
    .sort({ createdAt: -1 });

    // Sanitize prices
    await Promise.all(bookings.map(sanitizeBooking));

    res.json({
      success: true,
      bookings
    });
  } catch (error) {
    console.error('Get owner bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bookings'
    });
  }
});

// Check availability
router.get('/check-availability', async (req, res) => {
  try {
    const { billboardId, date } = req.query;

    if (!billboardId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Billboard ID and date are required'
      });
    }

    const queryDate = new Date(date);
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    // Find bookings that overlap with this date
    const bookings = await Booking.find({
      billboardId,
      status: { $in: ['confirmed', 'pending', 'paid', 'active'] }, // Include pending to avoid double booking
      $or: [
        {
          // Booking starts today
          startDate: { $gte: startOfDay, $lte: endOfDay }
        },
        {
          // Booking ends today
          endDate: { $gte: startOfDay, $lte: endOfDay }
        },
        {
          // Booking covers today (starts before and ends after)
          startDate: { $lt: startOfDay },
          endDate: { $gt: endOfDay }
        }
      ]
    }).select('startDate endDate startTime endTime status videoDuration reputation');

    // Calculate slot usage
    const slotUsage = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0
    };

    bookings.forEach(booking => {
      // Determine slot based on start time
      const hour = parseInt(booking.startTime.split(':')[0]);
      let slot = '';
      
      // Standard 6-hour slots
      if (hour >= 6 && hour < 12) slot = 'morning';
      else if (hour >= 12 && hour < 18) slot = 'afternoon';
      else if (hour >= 18) slot = 'evening';
      else slot = 'night'; // 0-6

      if (slot) {
        const duration = booking.videoDuration || 15;
        const reputation = booking.reputation || 40;
        const consumed = duration * reputation;
        slotUsage[slot] += consumed;
      }
    });

    res.json({
      success: true,
      bookings,
      slotUsage
    });

  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability'
    });
  }
});

// Create new booking
router.post('/', [
  auth,
  body('bookingType').isIn(['personal-wishes', 'public-wishes', 'play-ad']).withMessage('Invalid booking type'),
  body('billboardId').notEmpty().withMessage('Billboard ID is required'),
  body('billboardName').trim().notEmpty().withMessage('Billboard name is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required (HH:MM)'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time is required (HH:MM)'),
  body('duration').isNumeric().withMessage('Duration must be a number'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('content.type').isIn(['image', 'video', 'text']).withMessage('Invalid content type')
], async (req, res) => {
  try {
    // console.log('Received booking request:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const userId = req.userId;
    const bookingData = {
      userId,
      ...req.body
    };

    // Validate date range
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    
    // Check if end date is before start date (allow same day)
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after or same as start date'
      });
    }

    // Check if start date is in the past (allow today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkStartDate = new Date(startDate);
    checkStartDate.setHours(0, 0, 0, 0);

    if (checkStartDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be in the past'
      });
    }

    const booking = new Booking(bookingData);
    await booking.save();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking'
    });
  }
});

// Get user bookings
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status, bookingType } = req.query;

    // Check if user is accessing their own bookings
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filter = { userId };
    if (status) filter.status = status;
    if (bookingType) filter.bookingType = bookingType;

    const bookings = await Booking.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Booking.countDocuments(filter);

    res.json({
      success: true,
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bookings'
    });
  }
});

// Get specific booking
router.get('/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await sanitizeBooking(booking);

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get booking'
    });
  }
});

// Update booking
router.put('/:bookingId', [
  auth,
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required (HH:MM)'),
  body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time is required (HH:MM)'),
  body('content.moderationStatus').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid moderation status')
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

    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking can be modified
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify completed or cancelled booking'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        if (key === 'content') {
          booking.content = { ...booking.content, ...req.body[key] };
        } else if (key === 'customerDetails') {
          booking.customerDetails = { ...booking.customerDetails, ...req.body[key] };
        } else {
          booking[key] = req.body[key];
        }
      }
    });

    await booking.save();

    res.json({
      success: true,
      message: 'Booking updated successfully',
      booking
    });

  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking'
    });
  }
});

// Cancel booking
router.post('/:bookingId/cancel', [
  auth,
  body('reason').optional().isString().withMessage('Cancellation reason must be a string')
], async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if booking can be cancelled
    if (!booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled at this time'
      });
    }

    // Calculate refund amount
    const refundAmount = booking.calculateRefund();

    // Update booking
    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date();
    booking.refundAmount = refundAmount;

    // Update payment status if refund is due
    if (refundAmount > 0 && booking.paymentStatus === 'paid') {
      booking.paymentStatus = 'partial'; // Will be updated to 'refunded' after actual refund
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        refundAmount,
        cancelledAt: booking.cancelledAt
      }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
});

// Get booking history with pagination
router.get('/user/:userId/history', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    // Check if user is accessing their own history
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filter = { userId };

    // Add date range filter if provided
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    // Sanitize prices
    await Promise.all(bookings.map(sanitizeBooking));

    const total = await Booking.countDocuments(filter);

    // Group bookings by status for summary
    const summary = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$price' }
        }
      }
    ]);

    res.json({
      success: true,
      bookings,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    });

  } catch (error) {
    console.error('Get booking history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get booking history'
    });
  }
});

module.exports = router;