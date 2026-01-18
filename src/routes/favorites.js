const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Favorite = require('../models/Favorite');

const router = express.Router();

// Add to favorites
router.post('/', [
  auth,
  body('itemId').notEmpty().withMessage('Item ID is required'),
  body('itemType').isIn(['billboard', 'location', 'service']).withMessage('Invalid item type'),
  body('itemData.title').notEmpty().withMessage('Item title is required')
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
    const { itemId, itemType, itemData } = req.body;

    // Check if already favorited
    const existingFavorite = await Favorite.findOne({ userId, itemId });
    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: 'Item already in favorites'
      });
    }

    const favorite = new Favorite({
      userId,
      itemId,
      itemType,
      itemData
    });

    await favorite.save();

    res.status(201).json({
      success: true,
      message: 'Added to favorites successfully',
      favorite
    });

  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to favorites'
    });
  }
});

// Get user favorites
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, itemType } = req.query;

    // Check if user is accessing their own favorites
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const filter = { userId };
    if (itemType) filter.itemType = itemType;

    const favorites = await Favorite.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Favorite.countDocuments(filter);

    res.json({
      success: true,
      favorites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get favorites'
    });
  }
});

// Remove from favorites
router.delete('/user/:userId/item/:itemId', auth, async (req, res) => {
  try {
    const { userId, itemId } = req.params;

    // Check if user is accessing their own favorites
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const favorite = await Favorite.findOneAndDelete({ userId, itemId });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    res.json({
      success: true,
      message: 'Removed from favorites successfully'
    });

  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from favorites'
    });
  }
});

// Check if item is favorited
router.get('/user/:userId/check/:itemId', auth, async (req, res) => {
  try {
    const { userId, itemId } = req.params;

    // Check if user is accessing their own favorites
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const isFavorited = await Favorite.isFavorited(userId, itemId);

    res.json({
      success: true,
      isFavorited
    });

  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check favorite status'
    });
  }
});

// Get favorites by type
router.get('/user/:userId/type/:itemType', auth, async (req, res) => {
  try {
    const { userId, itemType } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if user is accessing their own favorites
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate item type
    if (!['billboard', 'location', 'service'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item type'
      });
    }

    const favorites = await Favorite.findByUserAndType(userId, itemType)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Favorite.countDocuments({ userId, itemType });

    res.json({
      success: true,
      favorites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get favorites by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get favorites'
    });
  }
});

// Clear all favorites
router.delete('/user/:userId/clear', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is accessing their own favorites
    if (req.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const result = await Favorite.deleteMany({ userId });

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} favorites successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Clear favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear favorites'
    });
  }
});

module.exports = router;