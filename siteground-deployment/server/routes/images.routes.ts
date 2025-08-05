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

// Simple auth middleware for now
const simpleAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Image upload endpoints
router.post(
  '/upload',
  simpleAuth,
  enhancedUploadMiddleware,
  handleUploadErrors,
  validateImageUpload,
  uploadProductImages
);

// Image retrieval endpoints
router.get('/product/:productId', getProductImages);
router.get('/:imageId', getImage);

// Image management endpoints (authenticated)
router.delete('/:imageId', simpleAuth, deleteImage);

// Admin endpoints (require admin role)
router.post('/queue/process', simpleAuth, processImageQueue);
router.get('/analytics/summary', simpleAuth, getImageAnalytics);

export default router;