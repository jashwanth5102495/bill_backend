const express = require('express');
const router = express.Router();
const Billboard = require('../models/Billboard');
const { auth } = require('../middleware/auth');

// GET all billboards (for Business Owners / Map)
router.get('/', async (req, res) => {
  try {
    const billboards = await Billboard.find({ status: 'Active' }); // Only show active ones
    res.json(billboards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET my billboards (for Billboard Owners)
router.get('/my', auth, async (req, res) => {
  try {
    if (req.user.role !== 'billboard_owner') {
      return res.status(403).json({ message: 'Access denied. Only billboard owners can view their billboards.' });
    }
    const billboards = await Billboard.find({ ownerId: req.user._id });
    res.json(billboards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST add billboard
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'billboard_owner') {
      return res.status(403).json({ message: 'Only billboard owners can add billboards' });
    }

    const billboard = new Billboard({
      ...req.body,
      ownerId: req.user._id
    });

    await billboard.save();
    res.status(201).json(billboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single billboard
router.get('/:id', async (req, res) => {
  try {
    const billboard = await Billboard.findById(req.params.id);
    if (!billboard) {
      return res.status(404).json({ message: 'Billboard not found' });
    }
    res.json(billboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
