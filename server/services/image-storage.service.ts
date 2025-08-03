import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { db } from '../db';
import { productImages, imageProcessingQueue, imageStorageConfig, type ProductImage, type ThumbnailSizes, type ImageSizeConfig } from '../../shared/image-schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export class ImageStorageService {
  private baseUploadPath: string;
  private urlPrefix: string;

  constructor() {
    this.baseUploadPath = path.join(process.cwd(), 'uploads');
    this.urlPrefix = '/uploads';
  }

  /**
   * Organize file path by year/month/category structure
   */
  private generateOrganizedPath(productId: string, categoryId?: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Structure: /uploads/products/2025/01/category-id/ or /uploads/products/2025/01/general/
    const category = categoryId || 'general';
    return path.join('products', String(year), month, category);
  }

  /**
   * Generate unique filename with enterprise naming convention
   */
  private generateFileName(originalName: string, productId: string, sizeType: string = 'original'): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1E9);
    
    if (sizeType === 'original') {
      return `product-${productId.slice(0, 8)}-${timestamp}-${random}${ext}`;
    } else {
      return `product-${productId.slice(0, 8)}-${timestamp}-${random}-${sizeType}${ext}`;
    }
  }

  /**
   * Ensure directory structure exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Store image with metadata in database
   */
  async storeImage(
    productId: string,
    file: Express.Multer.File,
    options: {
      categoryId?: string;
      isMain?: boolean;
      altText?: string;
      caption?: string;
      uploadedBy?: string;
    } = {}
  ): Promise<ProductImage> {
    const organizedPath = this.generateOrganizedPath(productId, options.categoryId);
    const fileName = this.generateFileName(file.originalname, productId);
    const fullPath = path.join(this.baseUploadPath, organizedPath);
    const filePath = path.join(organizedPath, fileName);
    const absoluteFilePath = path.join(fullPath, fileName);

    // Ensure directory exists
    await this.ensureDirectoryExists(fullPath);

    // Get image dimensions
    const metadata = await sharp(file.buffer).metadata();

    // Move file to organized location
    await fs.writeFile(absoluteFilePath, file.buffer);

    // Store metadata in database
    const [imageRecord] = await db.insert(productImages).values({
      productId,
      originalFileName: file.originalname,
      fileName,
      filePath: `/${filePath}`,
      mimeType: file.mimetype,
      fileSize: file.size,
      width: metadata.width,
      height: metadata.height,
      isMain: options.isMain || false,
      altText: options.altText,
      caption: options.caption,
      uploadedBy: options.uploadedBy,
      status: 'active',
      sizeType: 'original',
    }).returning();

    // Queue thumbnail generation
    await this.queueThumbnailGeneration(imageRecord.id);

    return imageRecord;
  }

  /**
   * Generate thumbnails for an image
   */
  async generateThumbnails(imageId: string): Promise<ProductImage[]> {
    const originalImage = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1);
    if (!originalImage.length) {
      throw new Error('Original image not found');
    }

    const original = originalImage[0];
    const originalPath = path.join(this.baseUploadPath, original.filePath.substring(1));

    // Default thumbnail sizes
    const thumbnailSizes: ThumbnailSizes = {
      thumbnail: { width: 64, height: 64, quality: 80 },
      small: { width: 150, height: 150, quality: 85 },
      medium: { width: 300, height: 300, quality: 90 },
      large: { width: 600, height: 600, quality: 95 }
    };

    const generatedThumbnails: ProductImage[] = [];

    for (const [sizeType, config] of Object.entries(thumbnailSizes)) {
      try {
        const thumbnailFileName = this.generateFileName(original.originalFileName, original.productId, sizeType);
        const thumbnailPath = path.dirname(original.filePath);
        const fullThumbnailPath = path.join(this.baseUploadPath, thumbnailPath.substring(1), thumbnailFileName);
        
        // Generate thumbnail using Sharp
        const thumbnailBuffer = await sharp(originalPath)
          .resize(config.width, config.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: config.quality || 85 })
          .toBuffer();

        await fs.writeFile(fullThumbnailPath, thumbnailBuffer);

        // Store thumbnail metadata
        const [thumbnailRecord] = await db.insert(productImages).values({
          productId: original.productId,
          originalFileName: original.originalFileName,
          fileName: thumbnailFileName,
          filePath: path.join(thumbnailPath, thumbnailFileName),
          mimeType: 'image/jpeg',
          fileSize: thumbnailBuffer.length,
          width: config.width,
          height: config.height,
          parentImageId: imageId,
          sizeType: sizeType as any,
          status: 'active',
          altText: original.altText,
          uploadedBy: original.uploadedBy,
        }).returning();

        generatedThumbnails.push(thumbnailRecord);
      } catch (error) {
        console.error(`Failed to generate ${sizeType} thumbnail:`, error);
      }
    }

    // Update original image to indicate it has variants
    await db.update(productImages)
      .set({ hasVariants: true, updatedAt: new Date() })
      .where(eq(productImages.id, imageId));

    return generatedThumbnails;
  }

  /**
   * Get image by ID with optional size
   */
  async getImage(imageId: string, sizeType?: string): Promise<ProductImage | null> {
    if (sizeType && sizeType !== 'original') {
      // Get thumbnail
      const thumbnail = await db.select().from(productImages)
        .where(and(
          eq(productImages.parentImageId, imageId),
          eq(productImages.sizeType, sizeType as any)
        ))
        .limit(1);
      
      return thumbnail.length > 0 ? thumbnail[0] : null;
    }

    // Get original image
    const images = await db.select().from(productImages)
      .where(eq(productImages.id, imageId))
      .limit(1);
    
    return images.length > 0 ? images[0] : null;
  }

  /**
   * Get all images for a product
   */
  async getProductImages(productId: string, includeVariants: boolean = false): Promise<ProductImage[]> {
    let query = db.select().from(productImages)
      .where(eq(productImages.productId, productId));

    if (!includeVariants) {
      query = query.where(and(
        eq(productImages.productId, productId),
        eq(productImages.sizeType, 'original')
      ));
    }

    return await query.orderBy(desc(productImages.isMain), asc(productImages.sortOrder));
  }

  /**
   * Get main product image
   */
  async getMainProductImage(productId: string, sizeType: string = 'original'): Promise<ProductImage | null> {
    if (sizeType === 'original') {
      const images = await db.select().from(productImages)
        .where(and(
          eq(productImages.productId, productId),
          eq(productImages.isMain, true),
          eq(productImages.sizeType, 'original')
        ))
        .limit(1);

      return images.length > 0 ? images[0] : null;
    } else {
      // Get main image and its thumbnail
      const mainImage = await this.getMainProductImage(productId, 'original');
      if (!mainImage) return null;

      return await this.getImage(mainImage.id, sizeType);
    }
  }

  /**
   * Generate public URL for image
   */
  getImageUrl(image: ProductImage): string {
    return `${this.urlPrefix}${image.filePath}`;
  }

  /**
   * Queue thumbnail generation
   */
  private async queueThumbnailGeneration(imageId: string): Promise<void> {
    await db.insert(imageProcessingQueue).values({
      imageId,
      taskType: 'thumbnail',
      priority: 3,
      metadata: JSON.stringify({ generateAll: true })
    });
  }

  /**
   * Process image queue (background job)
   */
  async processImageQueue(limit: number = 10): Promise<void> {
    const tasks = await db.select().from(imageProcessingQueue)
      .where(eq(imageProcessingQueue.status, 'pending'))
      .orderBy(asc(imageProcessingQueue.priority), asc(imageProcessingQueue.scheduledAt))
      .limit(limit);

    for (const task of tasks) {
      try {
        // Mark as started
        await db.update(imageProcessingQueue)
          .set({ 
            status: 'processing', 
            startedAt: new Date(),
            attempts: task.attempts + 1 
          })
          .where(eq(imageProcessingQueue.id, task.id));

        // Process based on task type
        switch (task.taskType) {
          case 'thumbnail':
            await this.generateThumbnails(task.imageId);
            break;
          case 'cleanup':
            await this.cleanupOrphanedFiles();
            break;
          default:
            throw new Error(`Unknown task type: ${task.taskType}`);
        }

        // Mark as completed
        await db.update(imageProcessingQueue)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(imageProcessingQueue.id, task.id));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (task.attempts >= task.maxAttempts) {
          // Mark as failed
          await db.update(imageProcessingQueue)
            .set({ 
              status: 'failed', 
              errorMessage,
              completedAt: new Date() 
            })
            .where(eq(imageProcessingQueue.id, task.id));
        } else {
          // Reset to pending for retry
          await db.update(imageProcessingQueue)
            .set({ 
              status: 'pending', 
              errorMessage,
              startedAt: null 
            })
            .where(eq(imageProcessingQueue.id, task.id));
        }
      }
    }
  }

  /**
   * Cleanup orphaned files (background job)
   */
  async cleanupOrphanedFiles(): Promise<void> {
    // Get all image records
    const dbImages = await db.select().from(productImages);
    const dbFilePaths = new Set(dbImages.map(img => path.join(this.baseUploadPath, img.filePath.substring(1))));

    // Scan file system
    const scanDirectory = async (dirPath: string): Promise<string[]> => {
      const files: string[] = [];
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            files.push(...await scanDirectory(fullPath));
          } else if (entry.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.error('Error scanning directory:', dirPath, error);
      }
      return files;
    };

    const fsFiles = await scanDirectory(path.join(this.baseUploadPath, 'products'));

    // Find orphaned files
    const orphanedFiles = fsFiles.filter(filePath => !dbFilePaths.has(filePath));

    // Delete orphaned files
    for (const filePath of orphanedFiles) {
      try {
        await fs.unlink(filePath);
        console.log('Deleted orphaned file:', filePath);
      } catch (error) {
        console.error('Failed to delete orphaned file:', filePath, error);
      }
    }
  }

  /**
   * Delete image and its variants
   */
  async deleteImage(imageId: string): Promise<void> {
    // Get image and its variants
    const images = await db.select().from(productImages)
      .where(eq(productImages.id, imageId));

    if (!images.length) return;

    const mainImage = images[0];

    // Get all variants if this is the main image
    const allImages = mainImage.sizeType === 'original' 
      ? await db.select().from(productImages).where(eq(productImages.parentImageId, imageId))
      : [mainImage];

    // Delete physical files
    for (const image of [mainImage, ...allImages]) {
      const filePath = path.join(this.baseUploadPath, image.filePath.substring(1));
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Failed to delete file:', filePath, error);
      }
    }

    // Delete from database
    await db.delete(productImages).where(eq(productImages.id, imageId));
    if (mainImage.sizeType === 'original') {
      await db.delete(productImages).where(eq(productImages.parentImageId, imageId));
    }
  }
}