import { Request, Response } from 'express';
import { z } from 'zod';
import { productService } from '../../services/product.service';
import { insertProductSchema } from '@shared/schema';
import { isServiceError, formatErrorResponse } from '../../services/errors';

// Request validation schemas
const getProductsQuerySchema = z.object({
  region: z.string().optional(),
  platform: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const productParamsSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
});

const updateProductSchema = insertProductSchema.partial();

export class AdminProductsController {
  // GET /api/admin/products
  async getAllProducts(req: Request, res: Response) {
    try {
      const query = getProductsQuerySchema.parse(req.query);
      const { page, limit, ...filters } = query;
      
      const products = await productService.getAllProducts(filters);
      
      // Implement pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProducts = products.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedProducts,
        pagination: {
          page,
          limit,
          total: products.length,
          totalPages: Math.ceil(products.length / limit),
          hasNext: endIndex < products.length,
          hasPrev: page > 1,
        },
        meta: {
          totalValue: products.reduce((sum, p) => {
            const price = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
            return sum + price;
          }, 0),
          activeProducts: products.filter(p => p.isActive).length,
          inactiveProducts: products.filter(p => !p.isActive).length,
        }
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch products'
      });
    }
  }

  // GET /api/admin/products/:id
  async getProductById(req: Request, res: Response) {
    try {
      const { id } = productParamsSchema.parse(req.params);
      const product = await productService.getProductById(id);
      res.json({ data: product });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch product'
      });
    }
  }

  // POST /api/admin/products
  async createProduct(req: Request, res: Response) {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await productService.createProduct(productData);
      
      res.status(201).json({
        data: product,
        message: 'Product created successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create product'
      });
    }
  }

  // PUT /api/admin/products/:id
  async updateProduct(req: Request, res: Response) {
    try {
      const { id } = productParamsSchema.parse(req.params);
      console.log('Update product request - ID:', id);
      console.log('Update product request - Body:', req.body);
      
      const updateData = updateProductSchema.parse(req.body);
      console.log('Parsed update data:', updateData);
      
      const product = await productService.updateProduct(id, updateData);
      
      res.json({
        data: product,
        message: 'Product updated successfully'
      });
    } catch (error) {
      console.error('Product update error:', error);
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update product'
      });
    }
  }

  // DELETE /api/admin/products/:id
  async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = productParamsSchema.parse(req.params);
      await productService.deleteProduct(id);
      
      res.json({
        message: 'Product deleted successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete product'
      });
    }
  }

  // PATCH /api/admin/products/:id/toggle-status
  async toggleProductStatus(req: Request, res: Response) {
    try {
      const { id } = productParamsSchema.parse(req.params);
      const product = await productService.toggleProductStatus(id);
      
      res.json({
        data: product,
        message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to toggle product status'
      });
    }
  }

  // GET /api/admin/products/analytics
  async getProductAnalytics(req: Request, res: Response) {
    try {
      const productId = req.query.productId as string;
      const analytics = await productService.getProductAnalytics(productId);
      
      res.json({
        data: analytics,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get product analytics'
      });
    }
  }

  // GET /api/admin/products/low-stock
  async getLowStockProducts(req: Request, res: Response) {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 10;
      const products = await productService.getLowStockProducts(threshold);
      
      res.json({
        data: products,
        count: products.length,
        threshold
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get low stock products'
      });
    }
  }

  // POST /api/admin/products/:id/upload-image
  async uploadProductImage(req: Request, res: Response) {
    try {
      const { id } = productParamsSchema.parse(req.params);
      
      if (!req.file) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'No image file provided'
        });
      }

      // Generate the URL path for the uploaded image
      const imageUrl = `/uploads/products/${req.file.filename}`;
      
      // Update the product with the new image URL
      const updatedProduct = await productService.updateProduct(id, { 
        imageUrl 
      });

      res.json({
        data: {
          imageUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          product: updatedProduct
        },
        message: 'Image uploaded successfully'
      });
    } catch (error) {
      if (isServiceError(error)) {
        return res.status(error.statusCode).json(formatErrorResponse(error));
      }
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to upload image'
      });
    }
  }
}

export const adminProductsController = new AdminProductsController();