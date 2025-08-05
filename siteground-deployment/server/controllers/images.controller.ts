import { Request, Response } from 'express';
import { ImageStorageService } from '../services/image-storage.service';
import { formatImageResponse } from '../middleware/enhanced-upload.middleware';
import { z } from 'zod';

const imageStorageService = new ImageStorageService();

// Validation schemas
const uploadImageSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  categoryId: z.string().optional(),
  isMain: z.boolean().default(false),
  altText: z.string().optional(),
  caption: z.string().optional(),
});

const getImageSchema = z.object({
  imageId: z.string().uuid('Invalid image ID'),
  size: z.enum(['original', 'large', 'medium', 'small', 'thumbnail']).default('original'),
});

/**
 * Upload product images with enhanced processing
 */
export const uploadProductImages = async (req: Request, res: Response) => {
  try {
    const validatedData = uploadImageSchema.parse(req.body);
    const files = req.files as any;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES'
      });
    }

    const uploadedImages = [];

    // Handle main product image
    if (files.productImage && files.productImage.length > 0) {
      const mainImage = await imageStorageService.storeImage(
        validatedData.productId,
        files.productImage[0],
        {
          categoryId: validatedData.categoryId,
          isMain: true,
          altText: validatedData.altText,
          caption: validatedData.caption,
          uploadedBy: req.user?.id,
        }
      );
      uploadedImages.push(mainImage);
    }

    // Handle additional product images
    if (files.productImages && files.productImages.length > 0) {
      for (const file of files.productImages) {
        const image = await imageStorageService.storeImage(
          validatedData.productId,
          file,
          {
            categoryId: validatedData.categoryId,
            isMain: false,
            altText: validatedData.altText,
            uploadedBy: req.user?.id,
          }
        );
        uploadedImages.push(image);
      }
    }

    // Format response for S3 compatibility
    const response = {
      success: true,
      images: formatImageResponse(uploadedImages),
      message: `Successfully uploaded ${uploadedImages.length} image(s)`,
      metadata: {
        totalSize: uploadedImages.reduce((total, img) => total + img.fileSize, 0),
        thumbnailsQueued: uploadedImages.length,
      }
    };

    res.status(201).json(response);

  } catch (error) {
    console.error('Image upload error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      error: 'Failed to upload images',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'UPLOAD_ERROR'
    });
  }
};

/**
 * Get product images with variants
 */
export const getProductImages = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { includeVariants = 'false', size = 'original' } = req.query;

    if (!productId) {
      return res.status(400).json({
        error: 'Product ID is required',
        code: 'MISSING_PRODUCT_ID'
      });
    }

    const images = await imageStorageService.getProductImages(
      productId,
      includeVariants === 'true'
    );

    // If specific size requested, get thumbnails
    const responseImages = [];
    for (const image of images) {
      if (size !== 'original' && image.sizeType === 'original') {
        const thumbnail = await imageStorageService.getImage(image.id, size as string);
        responseImages.push(thumbnail || image);
      } else {
        responseImages.push(image);
      }
    }

    const response = {
      success: true,
      images: formatImageResponse(responseImages.filter(Boolean)),
      metadata: {
        productId,
        totalImages: responseImages.length,
        size: size as string,
        includeVariants: includeVariants === 'true'
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching product images:', error);
    res.status(500).json({
      error: 'Failed to fetch images',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'FETCH_ERROR'
    });
  }
};

/**
 * Get single image with size options
 */
export const getImage = async (req: Request, res: Response) => {
  try {
    const validatedParams = getImageSchema.parse({
      imageId: req.params.imageId,
      size: req.query.size || 'original'
    });

    const image = await imageStorageService.getImage(
      validatedParams.imageId,
      validatedParams.size
    );

    if (!image) {
      return res.status(404).json({
        error: 'Image not found',
        code: 'IMAGE_NOT_FOUND'
      });
    }

    const response = {
      success: true,
      image: formatImageResponse([image])[0],
      metadata: {
        imageId: validatedParams.imageId,
        size: validatedParams.size,
        hasVariants: image.hasVariants
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching image:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch image',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'FETCH_ERROR'
    });
  }
};

/**
 * Delete image and its variants
 */
export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;

    if (!imageId) {
      return res.status(400).json({
        error: 'Image ID is required',
        code: 'MISSING_IMAGE_ID'
      });
    }

    await imageStorageService.deleteImage(imageId);

    res.json({
      success: true,
      message: 'Image and variants deleted successfully',
      metadata: {
        imageId,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      error: 'Failed to delete image',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'DELETE_ERROR'
    });
  }
};

/**
 * Process image queue (admin endpoint)
 */
export const processImageQueue = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    await imageStorageService.processImageQueue(Number(limit));

    res.json({
      success: true,
      message: 'Image queue processed successfully',
      metadata: {
        processedAt: new Date().toISOString(),
        limit: Number(limit)
      }
    });

  } catch (error) {
    console.error('Error processing image queue:', error);
    res.status(500).json({
      error: 'Failed to process image queue',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'QUEUE_ERROR'
    });
  }
};

/**
 * Get image analytics (admin endpoint)
 */
export const getImageAnalytics = async (req: Request, res: Response) => {
  try {
    // This would connect to image analytics from the schema
    // Implementation depends on specific analytics requirements
    
    res.json({
      success: true,
      analytics: {
        totalImages: 0,
        totalSize: 0,
        topAccessedImages: [],
        storageDistribution: {},
        thumbnailGenerationStats: {}
      },
      message: 'Analytics endpoint ready for implementation'
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'ANALYTICS_ERROR'
    });
  }
};