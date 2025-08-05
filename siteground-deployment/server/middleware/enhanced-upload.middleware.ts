import multer from 'multer';
import path from 'path';
import { ImageStorageService } from '../services/image-storage.service';

// Enhanced upload middleware with future S3 compatibility
const imageStorageService = new ImageStorageService();

// Use memory storage for processing before organized storage
const storage = multer.memoryStorage();

// Enhanced file filter with better validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed MIME types
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'image/avif' // Modern format support
  ];
  
  // Allowed extensions (double-check)
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} images are allowed.`));
  }
};

// Enhanced multer configuration
export const enhancedUploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (increased for high-quality product images)
    files: 5, // Maximum 5 files per upload
  },
  // Enhanced error handling
}).fields([
  { name: 'productImage', maxCount: 1 }, // Main product image
  { name: 'productImages', maxCount: 4 }, // Additional product images
  { name: 'thumbnail', maxCount: 1 }, // Custom thumbnail (optional)
]);

// Validation middleware for image uploads
export const validateImageUpload = (req: any, res: any, next: any) => {
  // Check if files were uploaded
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({
      error: 'No files uploaded',
      details: 'At least one image file is required'
    });
  }

  // Validate file count
  const fileCount = Object.values(req.files).reduce((total: number, files: any) => {
    return total + (Array.isArray(files) ? files.length : 1);
  }, 0);

  if (fileCount > 5) {
    return res.status(400).json({
      error: 'Too many files',
      details: 'Maximum 5 images allowed per upload'
    });
  }

  // Additional validation can be added here
  next();
};

// Error handling middleware for multer errors
export const handleUploadErrors = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File too large',
          details: 'Maximum file size is 10MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          details: 'Maximum 5 files allowed'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected field',
          details: 'Invalid field name for file upload'
        });
      default:
        return res.status(400).json({
          error: 'Upload error',
          details: error.message
        });
    }
  }

  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      details: error.message
    });
  }

  // Other errors
  console.error('Upload error:', error);
  return res.status(500).json({
    error: 'Internal server error',
    details: 'An unexpected error occurred during upload'
  });
};

// S3-compatible response format (for future migration)
export const formatImageResponse = (images: any[]) => {
  return images.map(image => ({
    id: image.id,
    url: imageStorageService.getImageUrl(image),
    filename: image.fileName,
    originalName: image.originalFileName,
    size: image.fileSize,
    mimeType: image.mimeType,
    dimensions: {
      width: image.width,
      height: image.height
    },
    // S3-compatible fields for future migration
    key: image.filePath,
    bucket: 'local', // Will be actual bucket name when migrating to S3
    etag: `"${image.id}"`, // Simplified ETag
    location: imageStorageService.getImageUrl(image)
  }));
};