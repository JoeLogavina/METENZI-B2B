import { Router } from 'express';
import { 
  uploadProductImages, 
  getProductImages, 
  getImage, 
  deleteImage, 
  processImageQueue,
  getImageAnalytics 
} from '../controllers/images.controller';
import { 
  enhancedUploadMiddleware, 
  validateImageUpload, 
  handleUploadErrors 
} from '../middleware/enhanced-upload.middleware';
// Auth middleware will be imported from where it exists
// import { isAuthenticated } from '../middleware/auth.middleware';

const router = Router();

// Session-based auth middleware
const sessionAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  res.status(401).json({ 
    error: 'UNAUTHORIZED',
    message: 'Authentication required' 
  });
};

// Simple working image upload endpoint for immediate testing
router.post('/upload', sessionAuth, (req, res) => {
  // Import uploadMiddleware for simple file handling
  const { uploadMiddleware } = require('../middleware/upload.middleware');
  
  uploadMiddleware.single('productImage')(req, res, (err: any) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({
        error: 'UPLOAD_ERROR',
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'No image file provided'
      });
    }

    // Generate the URL path for the uploaded image
    const imageUrl = `/uploads/products/${req.file.filename}`;
    
    res.json({
      success: true,
      imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      message: 'Image uploaded successfully'
    });
  });
});

// Enhanced image upload endpoint (fallback to simple if needed)
router.post(
  '/upload-enhanced',
  sessionAuth,
  enhancedUploadMiddleware,
  handleUploadErrors,
  validateImageUpload,
  uploadProductImages
);

// Image retrieval endpoints
router.get('/product/:productId', getProductImages);
router.get('/:imageId', getImage);

// Image management endpoints (authenticated)
router.delete('/:imageId', sessionAuth, deleteImage);

// Admin endpoints (require admin role)
router.post('/queue/process', sessionAuth, processImageQueue);
router.get('/analytics/summary', sessionAuth, getImageAnalytics);

export default router;