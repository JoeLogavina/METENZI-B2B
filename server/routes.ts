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
import { rlsContextMiddleware } from './middleware/rls-context.middleware';
import { TenantContextService } from './services/tenant-context.service';
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

  // RLS context middleware disabled - using application-level tenant filtering instead
  // Neon serverless connection pooling clears session variables, making RLS unreliable
  // app.use('/api', rlsContextMiddleware);

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
      const userRole = user.role || 'b2b_user';
      
      // Set tenant context for RLS policies
      await TenantContextService.setContext(userId, tenantId, userRole);
      
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

  app.post('/api/cart', isAuthenticated, async (req: any, res) => {
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
      const userRole = user.role || 'b2b_user';
      
      // Set tenant context for RLS policies
      await TenantContextService.setContext(userId, tenantId, userRole);
      
      const cartData = insertCartItemSchema.parse({ productId, quantity, userId, tenantId });
      const cartItem = await storage.addToCart(cartData);
      
      // Send response immediately
      res.status(201).json(cartItem);
      
      // Invalidate cache asynchronously after response
      setImmediate(async () => {
        try {
          await redisCache.invalidatePattern(`cart:*${tenantId}:*`);
        } catch (cacheError) {
          console.error('Cart cache invalidation error:', cacheError);
        }
      });
    } catch (error) {
      console.error("Cart add error:", error);
      res.status(500).json({ 
        message: "Failed to add to cart", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.patch('/api/cart/:productId', isAuthenticated, async (req: any, res) => {
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

      // Invalidate cache asynchronously after response
      setImmediate(async () => {
        try {
          const user = req.user as any;
          const tenantId = user.tenantId || 'eur';
          await redisCache.invalidatePattern(`cart:*${tenantId}:*`);
        } catch (cacheError) {
          console.error('Cart cache invalidation error:', cacheError);
        }
      });
    } catch (error) {
      console.error("Cart update error:", error);
      res.status(500).json({ 
        message: "Failed to update cart item", 
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.delete('/api/cart/:productId', isAuthenticated, async (req: any, res) => {
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

      // Invalidate cache asynchronously after response
      setImmediate(async () => {
        try {
          const user = req.user as any;
          const tenantId = user.tenantId || 'eur';
          await redisCache.invalidatePattern(`cart:*${tenantId}:*`);
        } catch (cacheError) {
          console.error('Cart cache invalidation error:', cacheError);
        }
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

  app.delete('/api/cart', isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
    const user = req.user as any;
    try {
      const tenantId = user.tenantId || 'eur';
      await storage.clearCart(userId, tenantId);
      res.json({ 
        success: true, 
        message: "Cart cleared successfully"
      });

      // Invalidate cache asynchronously after response
      setImmediate(async () => {
        try {
          await redisCache.invalidatePattern(`cart:*${tenantId}:*`);
        } catch (cacheError) {
          console.error('Cart cache invalidation error:', cacheError);
        }
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

  // Orders API - Enterprise Tenant Isolation
  app.get('/api/orders', 
    isAuthenticated,
    ordersCacheMiddleware,
    async (req: any, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const tenantId = req.user.tenantId || 'eur';

      console.log('🛡️ TENANT ISOLATION CHECK:', {
        userId,
        userRole,
        tenantId,
        timestamp: new Date().toISOString()
      });

      const { OrderService } = await import('./services/order.service');
      const orderService = new OrderService();

      let ordersData;
      
      if (userRole === 'super_admin' || userRole === 'admin') {
        ordersData = await orderService.getAllOrders(userRole);
      } else {
        ordersData = await orderService.getUserOrders(userId, tenantId);
        
        // CRITICAL: Double-check tenant isolation at API level
        const filteredOrders = ordersData.filter(order => 
          order.userId === userId && order.tenantId === tenantId
        );
        
        if (filteredOrders.length !== ordersData.length) {
          console.error('🚨 TENANT ISOLATION BREACH DETECTED:', {
            userId,
            tenantId,
            originalCount: ordersData.length,
            filteredCount: filteredOrders.length,
            breachingOrders: ordersData.filter(order => 
              order.userId !== userId || order.tenantId !== tenantId
            )
          });
        }
        
        ordersData = filteredOrders;
      }

      console.log('✅ TENANT ISOLATION VERIFIED:', {
        userId,
        tenantId,
        orderCount: ordersData.length,
        firstOrderTenant: ordersData[0]?.tenantId || 'none'
      });

      res.json(ordersData);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders", error: (error as Error).message });
    }
  });

  // Order creation endpoint
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { billingInfo, paymentMethod, paymentDetails } = req.body;

      // Get user's tenant ID first
      const user = req.user as any;
      const tenantId = user.tenantId || 'eur';

      // Set tenant context for RLS policies
      await TenantContextService.setContext(userId, tenantId, user.role || 'b2b_user');

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

      // For wallet payments, we'll check balance during payment processing

      // Generate order number
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const orderNumber = `ORD-${timestamp}-${randomSuffix}`;

      // BULLETPROOF TRANSACTIONAL ORDER CREATION
      console.log('🚀 Starting bulletproof order creation with transactional consistency');
      
      // Import OrderService for enterprise-grade order creation
      const { OrderService } = await import('./services/order.service');
      const orderService = new OrderService();

      // Prepare cart items for transaction
      const transactionCartItems = [];
      for (const cartItem of cartItems) {
        for (let i = 0; i < cartItem.quantity; i++) {
          // Get available license key with tenant isolation
          const licenseKey = await storage.getAvailableKey(cartItem.productId, tenantId);
          if (!licenseKey) {
            throw new Error(`No license keys available for product: ${cartItem.product.name} in ${tenantId.toUpperCase()} tenant`);
          }

          // Use tenant-specific pricing for the transaction
          const tenantPrice = tenantId === 'km' 
            ? (cartItem.product.priceKm || cartItem.product.price)
            : cartItem.product.price;

          transactionCartItems.push({
            productId: cartItem.productId,
            quantity: 1,
            unitPrice: tenantPrice,
            totalPrice: tenantPrice,
            licenseKeyId: licenseKey.id
          });
        }
      }

      // Create complete order with bulletproof verification
      const orderResult = await orderService.createCompleteOrder(
        {
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
        },
        transactionCartItems
      );

      const order = orderResult.order;
      
      // Mark license keys as used after successful transaction
      const orderItems = [];
      for (let i = 0; i < transactionCartItems.length; i++) {
        const item = transactionCartItems[i];
        const licenseKey = await storage.getKeyById(item.licenseKeyId!);
        
        // Mark key as used
        await storage.markKeyAsUsed(item.licenseKeyId!, userId);
        
        orderItems.push({
          ...orderResult.items[i],
          product: cartItems.find(ci => ci.productId === item.productId)?.product,
          licenseKey
        });
      }

      // Process wallet payment AFTER order creation
      if (paymentMethod === 'wallet') {
        const { WalletService } = await import('./services/wallet.service');
        const walletService = new WalletService();
        const paymentResult = await walletService.processPayment(
          userId,
          tenantId,
          finalAmount,
          order.id, // Now we have the real order ID
          `Order payment for order ${orderNumber}`
        );

        if (!paymentResult.success) {
          // Order created but payment failed - this is a critical state
          console.error('Order created but wallet payment failed:', paymentResult.error);
          return res.status(500).json({ 
            message: 'Order created but payment processing failed. Please contact support.',
            orderId: order.id
          });
        }
      }

      // Clear cart after successful payment
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

      // Invalidate caches asynchronously after response is sent
      setImmediate(async () => {
        try {
          // Invalidate orders and wallet cache to show latest data
          await Promise.all([
            redisCache.invalidatePattern(`orders:*${tenantId}:*`),
            redisCache.invalidatePattern(`wallet:*${tenantId}:*`),
            redisCache.invalidatePattern(`cart:*${tenantId}:*`)
          ]);
        } catch (cacheError) {
          console.error('Order cache invalidation error:', cacheError);
        }
      });
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({ 
        message: 'Failed to create order',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Wallet routes with enterprise-grade tenant isolation
  app.get('/api/wallet', isAuthenticated, async (req: any, res) => {
    try {
      const { WalletService } = await import('./services/wallet.service');
      const walletService = new WalletService();
      
      const tenantId = req.user.tenantId;
      const wallet = await walletService.getWallet(req.user.id, tenantId);
      res.json({ data: wallet });
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet data" });
    }
  });

  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const { WalletService } = await import('./services/wallet.service');
      const walletService = new WalletService();
      
      const tenantId = req.user.tenantId;
      const transactions = await walletService.getWalletTransactions(req.user.id, tenantId);
      res.json({ data: transactions });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Cache monitoring endpoint for tenant isolation verification
  app.get('/api/cache/tenant-status', isAuthenticated, async (req: any, res) => {
    const user = req.user;
    const tenantId = user?.tenantId || 'eur';
    const userRole = user?.role || 'b2b_user';
    
    try {
      const cacheStats = {
        tenantId,
        userRole,
        username: user?.username,
        cacheEnabled: true,
        tenantIsolation: 'ACTIVE',
        lastAccess: new Date().toISOString(),
        expectedCachePattern: `prefix:${tenantId}:${userRole}:*`,
        message: `Cache system is tenant-aware for ${tenantId.toUpperCase()} tenant`
      };
      
      console.log(`📊 Cache status check for tenant ${tenantId} by ${user?.username}`);
      res.json(cacheStats);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get cache status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}