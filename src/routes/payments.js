const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Booking = require('../models/Booking');

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Razorpay order
router.post('/create-order', [
  auth,
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').optional().isIn(['INR']).withMessage('Currency must be INR'),
  body('bookingId').notEmpty().withMessage('Booking ID is required')
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

    const { amount, currency = 'INR', bookingId } = req.body;
    const userId = req.userId;

    // Verify booking exists and belongs to user
    const booking = await Booking.findOne({ _id: bookingId, userId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking is already paid
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already paid'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: `booking_${bookingId}_${Date.now()}`,
      notes: {
        bookingId: bookingId.toString(),
        userId: userId.toString(),
        bookingType: booking.bookingType
      }
    };

    const order = await razorpay.orders.create(options);

    // Update booking with order ID
    booking.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
});

// Verify payment
router.post('/verify-payment', [
  auth,
  body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
  body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
  body('razorpay_signature').notEmpty().withMessage('Signature is required'),
  body('bookingId').notEmpty().withMessage('Booking ID is required')
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

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId
    } = req.body;
    const userId = req.userId;

    // Verify booking exists and belongs to user
    const booking = await Booking.findOne({ _id: bookingId, userId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status === 'captured') {
      // Update booking with payment details
      booking.paymentStatus = 'paid';
      booking.razorpayPaymentId = razorpay_payment_id;
      booking.paymentId = razorpay_payment_id;
      booking.status = 'confirmed';
      await booking.save();

      res.json({
        success: true,
        message: 'Payment verified successfully',
        booking: {
          id: booking._id,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          paymentId: booking.paymentId
        }
      });
    } else {
      booking.paymentStatus = 'failed';
      await booking.save();

      res.status(400).json({
        success: false,
        message: 'Payment not captured'
      });
    }

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
});

// Get payment details
router.get('/payment/:paymentId', auth, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Verify booking belongs to user
    const booking = await Booking.findOne({ 
      razorpayPaymentId: paymentId, 
      userId: req.userId 
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(paymentId);

    res.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100, // Convert from paise
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        createdAt: new Date(payment.created_at * 1000),
        description: payment.description
      }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment details'
    });
  }
});

// Refund payment
router.post('/refund', [
  auth,
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('reason').optional().isString().withMessage('Reason must be a string')
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

    const { paymentId, amount, reason } = req.body;
    const userId = req.userId;

    // Verify booking belongs to user
    const booking = await Booking.findOne({ 
      razorpayPaymentId: paymentId, 
      userId 
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
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
    const refundAmount = amount || booking.calculateRefund();

    if (refundAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No refund available for this booking'
      });
    }

    // Create refund
    const refund = await razorpay.payments.refund(paymentId, {
      amount: Math.round(refundAmount * 100), // Convert to paise
      notes: {
        reason: reason || 'Booking cancellation',
        bookingId: booking._id.toString()
      }
    });

    // Update booking
    booking.status = 'cancelled';
    booking.paymentStatus = 'refunded';
    booking.refundAmount = refundAmount;
    booking.refundedAt = new Date();
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date();
    await booking.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });

  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
});

// Webhook for payment status updates
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = JSON.parse(body);

    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case 'refund.processed':
        await handleRefundProcessed(event.payload.refund.entity);
        break;
      default:
        console.log('Unhandled webhook event:', event.event);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

// Helper functions for webhook handlers
async function handlePaymentCaptured(payment) {
  try {
    const booking = await Booking.findOne({ razorpayOrderId: payment.order_id });
    if (booking) {
      booking.paymentStatus = 'paid';
      booking.razorpayPaymentId = payment.id;
      booking.paymentId = payment.id;
      booking.status = 'confirmed';
      await booking.save();
    }
  } catch (error) {
    console.error('Handle payment captured error:', error);
  }
}

async function handlePaymentFailed(payment) {
  try {
    const booking = await Booking.findOne({ razorpayOrderId: payment.order_id });
    if (booking) {
      booking.paymentStatus = 'failed';
      await booking.save();
    }
  } catch (error) {
    console.error('Handle payment failed error:', error);
  }
}

async function handleRefundProcessed(refund) {
  try {
    const booking = await Booking.findOne({ razorpayPaymentId: refund.payment_id });
    if (booking) {
      booking.paymentStatus = 'refunded';
      booking.refundAmount = refund.amount / 100;
      booking.refundedAt = new Date();
      await booking.save();
    }
  } catch (error) {
    console.error('Handle refund processed error:', error);
  }
}

module.exports = router;