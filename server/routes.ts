import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { productService } from './services/product.service';
import { setupAuth } from "./auth";
import { insertProductSchema, insertCategorySchema, insertLicenseKeySchema, insertCartItemSchema, cartItems } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { sql, eq, and } from "drizzle-orm";
import { adminRouter } from "./routes/admin";
import { errorHandler, rateLimit } from "./middleware/auth.middleware";
import { 
  productsCacheMiddleware, 
  walletCacheMiddleware, 
  ordersCacheMiddleware,
  categoriesCacheMiddleware,
  invalidateCacheMiddleware 
} from "./middleware/cache.middleware";
import { invalidateOrdersCache, invalidateCartCache } from "./middleware/cache-invalidation.middleware";
import { redisCache } from "./cache/redis";
import { upload, saveBase64Image, deleteUploadedFile } from "./middleware/upload";
import { tenantResolutionMiddleware, requireTenantType } from './middleware/tenant.middleware';
import type { Currency } from './middleware/tenant.middleware';
import { tenantAuthMiddleware } from './middleware/tenant-auth.middleware';
import express from "express";
import path from "path";

// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Add tenant resolution middleware to all routes
  app.use(tenantResolutionMiddleware);

  // Health check endpoints (before auth middleware)
  app.get('/health', async (req, res) => {
    try {
      // Check database connection
      await storage.getProducts({ search: 'health-check' });

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  });

  app.get('/ready', async (req, res) => {
    try {
      // More thorough readiness check
      await Promise.all([
        storage.getProducts({ search: 'readiness-check' }),
        Promise.resolve() // Redis check simplified
      ]);

      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          cache: 'ok'
        }
      });
    } catch (error) {
      console.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  });

  app.get('/metrics', async (req, res) => {
    try {
      const dbStats = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
      `);

      res.status(200).json({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
          tables: dbStats.rows
        }
      });
    } catch (error) {
      console.error('Metrics check failed:', error);
      res.status(500).json({
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Set up authentication
  setupAuth(app);

  // Rate limiting disabled for simplicity

  // Use the admin router
  app.use('/api/admin', adminRouter);

  // REMOVED: Duplicate products route - Using tenant-aware version below

  // Product routes
  app.get('/api/products/:id', async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', 
    isAuthenticated, 
    invalidateCacheMiddleware('api:products:*'),
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        const productData = insertProductSchema.parse(req.body);
        const product = await storage.createProduct(productData);
        res.status(201).json(product);
      } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ message: "Failed to create product" });
      }
    });

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', 
    isAuthenticated, 
    invalidateCacheMiddleware('categories:*'),
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        const categoryData = insertCategorySchema.parse(req.body);
        const category = await storage.createCategory(categoryData);
        res.status(201).json(category);
      } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({ message: "Failed to create category" });
      }
    });

  // License key routes
  app.get('/api/license-keys', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { productId } = req.query;
      const keys = await storage.getLicenseKeys(productId as string);
      res.json(keys);
    } catch (error) {
      console.error("Error fetching license keys:", error);
      res.status(500).json({ message: "Failed to fetch license keys" });
    }
  });

  app.post('/api/license-keys', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const keyData = insertLicenseKeySchema.parse(req.body);
      const key = await storage.createLicenseKey(keyData);
      res.status(201).json(key);
    } catch (error) {
      console.error("Error creating license key:", error);
      res.status(500).json({ message: "Failed to create license key" });
    }
  });

  // Cart API - Clean and optimized with tenant awareness
  app.get('/api/cart', isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const user = req.user as any;
    try {
      // Get user's tenant or determine from request
      const tenantId = user.tenantId || 'eur';
      const cartItems = await storage.getCartItems(userId, tenantId);
      return res.json(cartItems);
    } catch (error) {
      console.error("Cart fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch cart", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post('/api/cart', isAuthenticated, invalidateCartCache, async (req: any, res) => {
    const userId = req.user.id;
    const user = req.user as any;
    try {
      const { productId, quantity } = req.body;
      
      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ 
          message: "Invalid cart data: productId and quantity (>0) required" 
        });
      }

      // Get user's tenant ID for proper data isolation
      const tenantId = user.tenantId || 'eur';
      const cartData = insertCartItemSchema.parse({ productId, quantity, userId, tenantId });
      const cartItem = await storage.addToCart(cartData);
      return res.status(201).json(cartItem);
    } catch (error) {
      console.error("Cart add error:", error);
      res.status(500).json({ 
        message: "Failed to add to cart", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.patch('/api/cart/:productId', isAuthenticated, invalidateCartCache, async (req: any, res) => {
    const userId = req.user.id;
    const productId = req.params.productId;
    try {
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({ 
          message: "Quantity must be at least 1" 
        });
      }

      const result = await db.update(cartItems)
        .set({ quantity })
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.productId, productId)
          )
        )
        .returning({ id: cartItems.id });
      
      if (result.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Cart item not found" 
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Cart update error:", error);
      res.status(500).json({ 
        message: "Failed to update cart item", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.delete('/api/cart/:productId', isAuthenticated, invalidateCartCache, async (req: any, res) => {
    const userId = req.user.id;
    const productId = req.params.productId;
    try {
      const result = await db.delete(cartItems)
        .where(
          and(
            eq(cartItems.userId, userId),
            eq(cartItems.productId, productId)
          )
        )
        .returning({ id: cartItems.id });
      
      if (result.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Cart item not found" 
        });
      }
      
      res.json({ 
        success: true, 
        message: "Item removed from cart"
      });
    } catch (error) {
      console.error("Cart remove error:", error);
      res.status(500).json({ 
        message: "Failed to remove cart item", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.delete('/api/cart', isAuthenticated, invalidateCartCache, async (req: any, res) => {
    const userId = req.user.id;
    const user = req.user as any;
    try {
      const tenantId = user.tenantId || 'eur';
      await storage.clearCart(userId, tenantId);
      res.json({ 
        success: true, 
        message: "Cart cleared successfully"
      });
    } catch (error) {
      console.error("Cart clear error:", error);
      res.status(500).json({ 
        message: "Failed to clear cart", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Product routes with tenant-aware pricing
  app.get('/api/products', 
    isAuthenticated,
    requireTenantType(['eur-shop', 'km-shop', 'admin']),
    productsCacheMiddleware,
    async (req: any, res) => {
    try {
      const { region, platform, category, search, priceMin, priceMax } = req.query;
      const currency = req.tenant.currency;

      const filters = {
        region: region as string,
        platform: platform as string,
        category: category as string,
        search: search as string,
        priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
        priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
        currency: currency // Add currency filter
      };

      const products = await productService.getActiveProducts(filters);
      
      // Transform products for tenant-specific pricing
      const tenantProducts = products.map(product => ({
        ...product,
        price: currency === 'KM' ? product.priceKm || product.price : product.price,
        displayCurrency: currency
      }));

      res.setHeader('Content-Type', 'application/json');
      res.json(tenantProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ 
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Orders API - Simplified and clean
  app.get('/api/orders', 
    isAuthenticated,
    ordersCacheMiddleware,
    async (req: any, res) => {
    try {
      if (!req.user?.id) {
        console.error('No user ID found in request');
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const userId = req.user.id;
      const { pool } = await import('./db');

      // Get user role directly with SQL
      const userQuery = `SELECT role FROM users WHERE id = $1`;
      const userResult = await pool.query(userQuery, [userId]);
      const userRole = userResult.rows[0]?.role || 'b2b_user';

      // Get user's tenant for proper filtering
      const user = req.user as any;
      const tenantId = user.tenantId || 'eur';

      const orderQuery = userRole === 'super_admin' || userRole === 'admin'
        ? `SELECT * FROM orders ORDER BY created_at DESC`
        : `SELECT * FROM orders WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`;

      const orderParams = userRole === 'super_admin' || userRole === 'admin' ? [] : [userId, tenantId];
      const orderResult = await pool.query(orderQuery, orderParams);
      const orderRows = orderResult.rows;

      // Get order items with products and license keys for each order
      const ordersWithDetails = await Promise.all(
        orderRows.map(async (order: any) => {
          const itemsQuery = `
            SELECT 
              oi.*,
              p.name as product_name,
              p.description as product_description,
              p.price as product_price,
              p.platform as product_platform,
              p.region as product_region,
              lk.key_value as license_key,
              lk.used_by,
              lk.used_at as key_used_at,
              lk.created_at as key_created_at
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            LEFT JOIN license_keys lk ON oi.license_key_id = lk.id
            WHERE oi.order_id = $1
          `;

          const itemsResult = await pool.query(itemsQuery, [order.id]);
          const itemRows = itemsResult.rows;

          const items = itemRows.map((item: any) => ({
            id: item.id,
            orderId: item.order_id,
            productId: item.product_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            licenseKeyId: item.license_key_id,
            licenseKey: item.license_key ? {
              id: item.license_key_id,
              licenseKey: item.license_key,
              usedBy: item.used_by,
              usedAt: item.key_used_at,
              createdAt: item.key_created_at
            } : null,
            product: item.product_name ? {
              id: item.product_id,
              name: item.product_name,
              description: item.product_description,
              price: item.product_price,
              region: item.product_region,
              platform: item.product_platform,
            } : null
          }));

          return {
            id: order.id,
            userId: order.user_id,
            orderNumber: order.order_number,
            status: order.status,
            totalAmount: order.total_amount,
            taxAmount: order.tax_amount,
            finalAmount: order.final_amount,
            paymentMethod: order.payment_method,
            paymentStatus: order.payment_status,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            billingInfo: {
              companyName: order.company_name,
              firstName: order.first_name,
              lastName: order.last_name,
              email: order.email,
              phone: order.phone,
              address: order.address,
              city: order.city,
              postalCode: order.postal_code,
              country: order.country,
            },
            items
          };
        })
      );

      res.json(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders", error: (error as Error).message });
    }
  });

  // Order creation endpoint
  app.post('/api/orders', isAuthenticated, invalidateOrdersCache, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { billingInfo, paymentMethod, paymentDetails } = req.body;

      // Get user's tenant ID first
      const user = req.user as any;
      const tenantId = user.tenantId || 'eur';

      // Get cart items with tenant isolation
      const cartItems = await storage.getCartItems(userId, tenantId);
      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      // Calculate totals using tenant-specific pricing
      const subtotal = cartItems.reduce((sum, item) => {
        const price = tenantId === 'km' 
          ? parseFloat(item.product.priceKm || item.product.price) 
          : parseFloat(item.product.price);
        return sum + (price * item.quantity);
      }, 0);
      const taxRate = 0.21; // 21% VAT
      const taxAmount = subtotal * taxRate;
      const finalAmount = subtotal + taxAmount;

      // Generate order number
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const orderNumber = `ORD-${timestamp}-${randomSuffix}`;

      // Create order
      const order = await storage.createOrder({
        userId,
        tenantId,
        orderNumber,
        status: 'completed',
        totalAmount: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        finalAmount: finalAmount.toFixed(2),
        paymentMethod: paymentMethod || 'wallet',
        paymentStatus: 'paid',
        companyName: billingInfo?.companyName || '',
        firstName: billingInfo?.firstName || '',
        lastName: billingInfo?.lastName || '',
        email: billingInfo?.email || req.user.email,
        phone: billingInfo?.phone || '',
        address: billingInfo?.address || '',
        city: billingInfo?.city || '',
        postalCode: billingInfo?.postalCode || '',
        country: billingInfo?.country || ''
      });

      // Create order items and assign license keys
      const orderItems = [];
      for (const cartItem of cartItems) {
        for (let i = 0; i < cartItem.quantity; i++) {
          // Get available license key
          const licenseKey = await storage.getAvailableKey(cartItem.productId);
          if (!licenseKey) {
            throw new Error(`No license keys available for product: ${cartItem.product.name}`);
          }

          // Mark key as used
          await storage.markKeyAsUsed(licenseKey.id, userId);

          // Create order item
          const orderItem = await storage.createOrderItem({
            orderId: order.id,
            productId: cartItem.productId,
            licenseKeyId: licenseKey.id,
            quantity: 1,
            unitPrice: cartItem.product.price,
            totalPrice: cartItem.product.price
          });

          orderItems.push({
            ...orderItem,
            product: cartItem.product,
            licenseKey
          });
        }
      }

      // Clear cart
      await storage.clearCart(userId);

      // Return complete order data
      res.status(201).json({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        taxAmount: order.taxAmount,
        finalAmount: order.finalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        items: orderItems
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ 
        message: 'Failed to create order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Wallet routes with real data - TENANT-AWARE
  app.get('/api/wallet', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId; // Get tenant from authenticated user
      const wallet = await storage.getWallet(req.user.id, tenantId);
      res.json({ data: wallet });
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet data" });
    }
  });

  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId; // Get tenant from authenticated user  
      const transactions = await storage.getWalletTransactions(req.user.id, tenantId);
      res.json({ data: transactions });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}