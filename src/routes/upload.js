const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/videos');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /mp4|mov|avi|mkv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Videos Only!');
    }
  }
});

// Mock AI Analysis Function
const runAIAnalysis = async (filePath) => {
  return new Promise((resolve) => {
    // Simulate processing delay
    setTimeout(() => {
      // Mock logic: 90% chance of approval
      const isApproved = Math.random() > 0.1;
      resolve({
        status: isApproved ? 'approved' : 'rejected',
        notes: isApproved ? 'Content meets community guidelines.' : 'Content flagged for potential policy violations.'
      });
    }, 2000);
  });
};

// Upload Video Endpoint
router.post('/video', auth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file uploaded'
      });
    }

    // Generate public URL (assuming server is serving 'uploads' static folder)
    // Adjust logic if using S3 or other storage
    const fileUrl = `/uploads/videos/${req.file.filename}`;
    
    // Run Mock AI Analysis
    const aiResult = await runAIAnalysis(req.file.path);

    res.json({
      success: true,
      url: fileUrl,
      moderationStatus: aiResult.status,
      moderationNotes: aiResult.notes,
      fileName: req.file.filename
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Video upload failed'
    });
  }
});

module.exports = router;
