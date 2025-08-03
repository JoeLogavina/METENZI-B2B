import { db } from '../db';
import { products, productImages } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { ProductWithStock } from '../../shared/schema';

/**
 * Service to integrate the new Enterprise Image Management System with existing products
 */
export class ProductImageService {
  /**
   * Get the main image URL for a product using the new image management system
   */
  async getProductMainImageUrl(productId: string): Promise<string | null> {
    try {
      const [productImage] = await db
        .select({
          filePath: productImages.filePath,
        })
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, productId),
            eq(productImages.isMain, true),
            eq(productImages.status, 'active')
          )
        )
        .limit(1);

      if (productImage) {
        // Return the URL for serving the image through our image system
        // Ensure proper URL format with /uploads prefix if not already present
        const filePath = productImage.filePath;
        if (filePath.startsWith('/uploads/')) {
          return filePath;
        } else if (filePath.startsWith('uploads/')) {
          return `/${filePath}`;
        } else if (filePath.startsWith('/products/')) {
          return `/uploads${filePath}`;
        } else if (filePath.startsWith('products/')) {
          return `/uploads/${filePath}`;
        } else {
          // Fallback for legacy paths
          return `/uploads/${filePath}`;
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching product main image:', error);
      return null;
    }
  }

  /**
   * Get all image URLs for a product
   */
  async getProductImageUrls(productId: string): Promise<string[]> {
    try {
      const images = await db
        .select({
          filePath: productImages.filePath,
        })
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, productId),
            eq(productImages.status, 'active')
          )
        )
        .orderBy(desc(productImages.isMain), desc(productImages.createdAt))
        .limit(1);

      return images.map(img => {
        const filePath = img.filePath;
        if (filePath.startsWith('/uploads/')) {
          return filePath;
        } else if (filePath.startsWith('uploads/')) {
          return `/${filePath}`;
        } else if (filePath.startsWith('/products/')) {
          return `/uploads${filePath}`;
        } else if (filePath.startsWith('products/')) {
          return `/uploads/${filePath}`;
        } else {
          // Fallback for legacy paths
          return `/uploads/${filePath}`;
        }
      });
    } catch (error) {
      console.error('Error fetching product images:', error);
      return [];
    }
  }

  /**
   * Enhance products with image URLs from the new image management system
   */
  async enhanceProductsWithImages(products: ProductWithStock[]): Promise<ProductWithStock[]> {
    const enhancedProducts = await Promise.all(
      products.map(async (product) => {
        // DEBUG: Log what we're processing
        console.log(`🔍 Processing product ${product.name} (${product.id}):`);
        console.log(`  - Original imageUrl: ${product.imageUrl}`);
        
        // First try to get image from new image management system
        const imageUrl = await this.getProductMainImageUrl(product.id);
        console.log(`  - New system imageUrl: ${imageUrl}`);
        
        // If new image system has an image, use it; otherwise fall back to existing imageUrl
        const finalImageUrl = imageUrl || product.imageUrl;
        console.log(`  - Final imageUrl: ${finalImageUrl}`);

        return {
          ...product,
          imageUrl: finalImageUrl,
        };
      })
    );

    return enhancedProducts;
  }

  /**
   * Update a product's legacy imageUrl to work with new system
   */
  async migrateLegacyImageToNewSystem(productId: string, legacyImagePath: string): Promise<boolean> {
    try {
      // Check if this product already has images in the new system
      const [existingImage] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .limit(1);

      if (existingImage) {
        // Product already has images in new system
        return true;
      }

      // Extract filename from legacy path
      const filename = legacyImagePath.split('/').pop() || 'unknown';
      
      // Create a migration entry in the new image system
      await db.insert(productImages).values({
        productId,
        originalFileName: filename,
        fileName: filename,
        filePath: legacyImagePath.startsWith('/') ? legacyImagePath.substring(1) : legacyImagePath,
        mimeType: 'image/jpeg', // Default assumption
        fileSize: 0, // Unknown for legacy images
        width: 400,
        height: 300,
        isMain: true,
        altText: `Legacy image for product ${productId}`,
        status: 'active'
      });

      console.log(`✅ Migrated legacy image for product ${productId}: ${legacyImagePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to migrate legacy image for product ${productId}:`, error);
      return false;
    }
  }
}

export const productImageService = new ProductImageService();