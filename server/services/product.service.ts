import { storage } from '../storage';
import { 
  type Product, 
  type ProductWithStock, 
  type InsertProduct,
  insertProductSchema 
} from '@shared/schema';
import { ServiceError, ValidationError, NotFoundError } from './errors';

export interface ProductFilters {
  region?: string;
  platform?: string;
  category?: string;
  search?: string;
  priceMin?: number;
  priceMax?: number;
  isActive?: boolean;
}

export interface ProductService {
  // Public methods (for B2B users)
  getActiveProducts(filters?: ProductFilters): Promise<ProductWithStock[]>;
  getProductById(id: string): Promise<Product>;
  
  // Admin methods
  getAllProducts(filters?: ProductFilters): Promise<ProductWithStock[]>;
  createProduct(productData: InsertProduct): Promise<Product>;
  updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  toggleProductStatus(id: string): Promise<Product>;
  
  // Analytics methods
  getProductAnalytics(productId?: string): Promise<any>;
  getLowStockProducts(threshold: number): Promise<ProductWithStock[]>;
}

class ProductServiceImpl implements ProductService {
  async getActiveProducts(filters?: ProductFilters): Promise<ProductWithStock[]> {
    try {
      const activeFilters = { ...filters, isActive: true };
      return await storage.getProducts(activeFilters);
    } catch (error) {
      throw new ServiceError('Failed to fetch active products', error);
    }
  }

  async getProductById(id: string): Promise<Product> {
    if (!id) {
      throw new ValidationError('Product ID is required');
    }

    try {
      const product = await storage.getProduct(id);
      if (!product) {
        throw new NotFoundError('Product not found');
      }
      return product;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ServiceError('Failed to fetch product', error);
    }
  }

  async getAllProducts(filters?: ProductFilters): Promise<ProductWithStock[]> {
    try {
      return await storage.getAllProducts();
    } catch (error) {
      throw new ServiceError('Failed to fetch all products', error);
    }
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    try {
      // Validate input data
      const validatedData = insertProductSchema.parse(productData);
      
      // Business rules validation
      await this.validateProductRules(validatedData);
      
      // Generate SKU if not provided
      if (!validatedData.sku) {
        validatedData.sku = await this.generateSKU(validatedData);
      }
      
      return await storage.createProduct(validatedData);
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ServiceError('Failed to create product', error);
    }
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product> {
    if (!id) {
      throw new ValidationError('Product ID is required');
    }

    try {
      // Check if product exists
      await this.getProductById(id);
      
      // Validate update data if provided
      if (Object.keys(updateData).length > 0) {
        const partialSchema = insertProductSchema.partial();
        partialSchema.parse(updateData);
      }
      
      // Business rules validation for updates
      if (updateData.price !== undefined) {
        await this.validatePriceUpdate(id, updateData.price);
      }
      
      return await storage.updateProduct(id, updateData);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to update product', error);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError('Product ID is required');
    }

    try {
      // Check if product exists
      await this.getProductById(id);
      
      // Check if product has pending orders
      const hasOrders = await this.checkProductHasOrders(id);
      if (hasOrders) {
        throw new ValidationError('Cannot delete product with existing orders');
      }
      
      await storage.deleteProduct(id);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to delete product', error);
    }
  }

  async toggleProductStatus(id: string): Promise<Product> {
    if (!id) {
      throw new ValidationError('Product ID is required');
    }

    try {
      const product = await this.getProductById(id);
      return await storage.updateProduct(id, { isActive: !product.isActive });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceError('Failed to toggle product status', error);
    }
  }

  async getProductAnalytics(productId?: string): Promise<any> {
    try {
      // Implement analytics logic
      const analytics = {
        totalProducts: 0,
        activeProducts: 0,
        totalValue: 0,
        topSellingProducts: [],
        categoryDistribution: {},
        regionDistribution: {},
      };
      
      // Add implementation based on requirements
      return analytics;
    } catch (error) {
      throw new ServiceError('Failed to get product analytics', error);
    }
  }

  async getLowStockProducts(threshold: number = 10): Promise<ProductWithStock[]> {
    try {
      const allProducts = await storage.getAllProducts();
      return allProducts.filter(product => product.stock < threshold);
    } catch (error) {
      throw new ServiceError('Failed to get low stock products', error);
    }
  }

  // Private helper methods
  private async validateProductRules(productData: InsertProduct): Promise<void> {
    // Check for duplicate SKU
    if (productData.sku) {
      const existingProduct = await storage.getProductBySKU(productData.sku);
      if (existingProduct) {
        throw new ValidationError('SKU already exists');
      }
    }
    
    // Validate price
    if (productData.price <= 0) {
      throw new ValidationError('Price must be greater than 0');
    }
    
    // Validate category if provided
    if (productData.categoryId) {
      const category = await storage.getCategory(productData.categoryId);
      if (!category) {
        throw new ValidationError('Invalid category ID');
      }
    }
  }

  private async generateSKU(productData: InsertProduct): Promise<string> {
    const prefix = productData.name.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  private async validatePriceUpdate(productId: string, newPrice: number): Promise<void> {
    if (newPrice <= 0) {
      throw new ValidationError('Price must be greater than 0');
    }
    
    // Additional business rules for price updates
    const product = await storage.getProduct(productId);
    if (product && newPrice < product.price * 0.5) {
      throw new ValidationError('Price reduction cannot exceed 50%');
    }
  }

  private async checkProductHasOrders(productId: string): Promise<boolean> {
    // Implement logic to check if product has orders
    try {
      // This would be implemented based on your order system
      return false;
    } catch (error) {
      return false;
    }
  }
}

export const productService = new ProductServiceImpl();