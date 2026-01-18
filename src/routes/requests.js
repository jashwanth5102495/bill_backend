const express = require('express');
const router = express.Router();
const ConnectRequest = require('../models/ConnectRequest');
const { auth, isAdmin } = require('../middleware/auth');

// Submit a new connect request
router.post('/connect', async (req, res) => {
  try {
    const { brand, purchaseDate, contactPerson, contactNumber, address, images } = req.body;

    // Validation
    if (!brand || !purchaseDate || !contactPerson || !contactNumber || !address) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    const newRequest = new ConnectRequest({
      brand,
      purchaseDate,
      contactPerson,
      contactNumber,
      address,
      images: images || []
    });

    await newRequest.save();

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully',
      request: {
        _id: newRequest._id,
        brand: newRequest.brand,
        status: newRequest.status
      }
    });
  } catch (error) {
    console.error('Submit connect request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while submitting request' 
    });
  }
});

// Get all connect requests (Admin only)
router.get('/connect', auth, isAdmin, async (req, res) => {
  console.log('GET /requests/connect called');
  try {
    const requests = await ConnectRequest.find().sort({ createdAt: -1 });
    console.log('Found requests:', requests.length);
    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Get connect requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching requests' 
    });
  }
});

// Update request status (Admin only)
router.put('/connect/:id', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const request = await ConnectRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.json({ success: true, request });
  } catch (error) {
    console.error('Update connect request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating request' 
    });
  }
});

module.exports = router;
