import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertProductSchema, insertCategorySchema, insertLicenseKeySchema, insertCartItemSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { adminRouter } from "./routes/admin";
import { errorHandler, rateLimit } from "./middleware/auth.middleware";

// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
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
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    }
  });

  app.get('/ready', async (req, res) => {
    try {
      // More comprehensive readiness check
      await storage.getProducts({ search: 'readiness-check' });
      
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          application: 'running'
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        services: {
          database: 'disconnected',
          application: 'running'
        }
      });
    }
  });

  app.get('/metrics', (req, res) => {
    const memUsage = process.memoryUsage();
    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      },
      cpu: process.cpuUsage(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // Auth middleware
  setupAuth(app);

  // Global rate limiting for API routes (temporarily disabled for debugging)
  // app.use('/api', rateLimit(15 * 60 * 1000, 300)); // 300 requests per 15 minutes

  // Debug middleware for admin routes
  app.use('/api/admin', (req, res, next) => {
    console.log('Main admin route hit:', req.method, req.path, 'User authenticated:', !!req.user);
    next();
  });

  // Mount enterprise admin routes
  app.use('/api/admin', adminRouter);

  // Direct wallet balance endpoint (bypass auth issues) using raw SQL
  app.get('/api/wallet-balance/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log('Direct wallet balance requested for user:', userId);
      
      // Use raw SQL to avoid schema import issues
      const result = await db.execute(sql`
        SELECT type, amount FROM wallet_transactions 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC
      `);
      
      const transactions = result.rows;
      console.log('Transactions found:', transactions.length);

      // Calculate balances from transactions
      let depositBalance = 0;
      let creditLimit = 0;
      let creditUsed = 0;

      transactions.forEach(tx => {
        const amount = parseFloat(tx.amount);
        switch (tx.type) {
          case 'deposit':
            depositBalance += amount;
            break;
          case 'credit_limit':
            creditLimit = amount; // Set to latest credit limit
            break;
          case 'payment':
            creditUsed += amount;
            break;
          case 'refund':
            creditUsed = Math.max(0, creditUsed - amount);
            break;
        }
      });

      const availableCredit = Math.max(0, creditLimit - creditUsed);
      const totalAvailable = depositBalance + availableCredit;
      const isOverlimit = creditUsed > creditLimit;

      const balance = {
        depositBalance: depositBalance.toFixed(2),
        creditLimit: creditLimit.toFixed(2),
        creditUsed: creditUsed.toFixed(2),
        availableCredit: availableCredit.toFixed(2),
        totalAvailable: totalAvailable.toFixed(2),
        isOverlimit
      };

      console.log('Calculated balance:', balance);
      res.json({ data: { balance } });
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ message: "Failed to get wallet balance", error: error.message });
    }
  });

  // Debug endpoint to help with login issues
  app.get('/api/debug-session', (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user || null,
      sessionID: req.sessionID || null,
      session: req.session || null
    });
  });

  // Mount wallet routes for B2B users
  const walletRouter = await import('./routes/wallet.routes');
  app.use('/api/wallet', (req, res, next) => {
    console.log('Wallet route hit:', req.method, req.path, 'User:', req.user?.username, 'ID:', req.user?.id);
    if (!req.user) {
      console.log('No user found, authentication failed');
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  }, walletRouter.default);

  // Auth routes

  // Product routes
  app.get('/api/products', async (req, res) => {
    try {
      const { region, platform, category, search, priceMin, priceMax } = req.query;
      const filters = {
        region: region as string,
        platform: platform as string,
        category: category as string,
        search: search as string,
        priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
        priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
      };
      
      const products = await storage.getProducts(filters);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

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

  app.post('/api/products', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
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

  // Cart routes
  app.get('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cartItems = await storage.getCartItems(userId);
      res.json(cartItems);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Failed to fetch cart" });
    }
  });

  app.post('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cartData = insertCartItemSchema.parse({ ...req.body, userId });
      const cartItem = await storage.addToCart(cartData);
      res.status(201).json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

  app.put('/api/cart/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { quantity } = req.body;
      await storage.updateCartItem(req.params.id, quantity);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.patch('/api/cart/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { quantity } = req.body;
      await storage.updateCartItem(req.params.id, quantity);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating cart item:", error);
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  app.delete('/api/cart/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeFromCart(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove from cart" });
    }
  });

  app.delete('/api/cart', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.clearCart(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // Order routes
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { billingInfo, paymentMethod, paymentDetails } = req.body;
      
      const cartItems = await storage.getCartItems(userId);
      
      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      // Calculate totals
      const totalAmount = cartItems.reduce((sum, item) => 
        sum + (parseFloat(item.product.price) * item.quantity), 0
      );
      const taxAmount = totalAmount * 0.21; // 21% tax
      const finalAmount = totalAmount + taxAmount;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Create order with billing information
      const orderData = {
        userId,
        orderNumber,
        totalAmount: totalAmount.toString(),
        taxAmount: taxAmount.toString(),
        finalAmount: finalAmount.toString(),
        status: 'pending',
        paymentMethod,
        paymentStatus: 'pending',
        ...billingInfo, // Includes companyName, firstName, lastName, email, phone, address, city, postalCode, country
      };

      const order = await storage.createOrder(orderData);

      // Create order items and assign license keys
      for (const cartItem of cartItems) {
        for (let i = 0; i < cartItem.quantity; i++) {
          const availableKey = await storage.getAvailableKey(cartItem.productId);
          if (!availableKey) {
            return res.status(400).json({ 
              message: `Insufficient stock for ${cartItem.product.name}` 
            });
          }

          await storage.createOrderItem({
            orderId: order.id,
            productId: cartItem.productId,
            licenseKeyId: availableKey.id,
            quantity: 1,
            unitPrice: cartItem.product.price,
            totalPrice: cartItem.product.price,
          });

          await storage.markKeyAsUsed(availableKey.id, userId);
        }
      }

      // Clear cart
      await storage.clearCart(userId);
      
      // Simulate payment processing based on payment method
      let updatedOrder = order;
      if (paymentMethod === 'credit_card') {
        // In a real app, this would integrate with Stripe, Square, etc.
        // For demo purposes, we'll simulate successful payment
        await storage.updateOrderStatus(order.id, 'completed');
        await storage.updatePaymentStatus(order.id, 'paid');
        updatedOrder = { ...order, status: 'completed', paymentStatus: 'paid' };
      } else if (paymentMethod === 'purchase_order') {
        // PO orders stay pending until manual approval
        updatedOrder = { ...order, status: 'pending', paymentStatus: 'pending' };
      } else if (paymentMethod === 'bank_transfer') {
        // Bank transfer orders stay pending until payment received
        updatedOrder = { ...order, status: 'pending', paymentStatus: 'pending' };
      }

      res.status(201).json({ ...updatedOrder, orderNumber });
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      let orders;
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        orders = await storage.getOrders(); // Admin can see all orders
      } else {
        orders = await storage.getOrders(userId); // Users see only their orders
      }
      
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Admin routes
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/admin/users/:id/role', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ message: "Super admin access required" });
      }

      const { role } = req.body;
      await storage.updateUserRole(req.params.id, role);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.get('/api/admin/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Admin product management routes
  app.get("/api/admin/products", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const products = await storage.getAllProducts(); // Get ALL products for admin
      res.json(products);
    } catch (error) {
      console.error("Error fetching admin products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.put("/api/admin/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const productData = req.body;
      
      console.log("Updating product with data:", productData);
      
      const updatedProduct = await storage.updateProduct(id, productData);
      console.log("Product updated successfully:", updatedProduct);
      
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.post("/api/admin/products", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const productData = req.body;
      
      console.log("Creating product with data:", productData);
      
      const newProduct = await storage.createProduct(productData);
      console.log("Product created successfully:", newProduct);
      
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/admin/products/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { isActive } = req.body;
      
      const updatedProduct = await storage.updateProduct(id, { isActive });
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product status:", error);
      res.status(500).json({ message: "Failed to update product status" });
    }
  });

  // Import wallet routes
  const walletRoutes = await import("./routes/wallet.routes");
  app.use("/api/wallet", walletRoutes.default);

  // Global error handler (must be last middleware)
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
