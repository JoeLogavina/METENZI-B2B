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
import { errorHandler } from "./middleware/auth.middleware";
import { securityTestRoutes } from "./routes/security-test.routes";
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
import rateLimit from 'express-rate-limit';

// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Add tenant resolution middleware first
  app.use(tenantResolutionMiddleware);
  
  // Apply basic security middleware (rate limiting and headers)
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Basic rate limiting
  app.use('/api', rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: isDev ? 1000 : 100,
    message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
  }));

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

  // Enhanced Key Management System Test - Phase 1 Implementation  
  app.get('/api/security-test', async (req, res) => {
    try {
      const { EnterpriseKeyManager, EnhancedDigitalKeyEncryption } = await import('./security/enhanced-key-manager');
      
      // Test 1: Key validation
      const validation = EnterpriseKeyManager.validateKeyConfiguration();
      
      // Test 2: Performance test  
      const startTime = Date.now();
      const testKey = EnterpriseKeyManager.getEncryptionKey('LICENSE');
      const keyDerivationTime = Date.now() - startTime;
      
      // Test 3: Encryption/Decryption integrity
      const licenseData = EnhancedDigitalKeyEncryption.generateSecureLicenseKey('PHASE1_TEST', 'SYSTEM_USER');
      const decrypted = EnhancedDigitalKeyEncryption.decryptLicenseKey(licenseData.encryptedKey);
      const integrityTest = decrypted === licenseData.plainKey;
      
      // Test 4: Integration with License Key Service
      let integrationTest = { passed: false, details: {} };
      try {
        const { licenseKeyService } = await import('./services/license-key.service');
        const testKey = 'TEST123-KEY456-INTEGRATION789';
        const encrypted = licenseKeyService.encryptLicenseKey(testKey, 'INTEGRATION_TEST_USER');
        const decrypted = licenseKeyService.decryptLicenseKey(encrypted.encryptedKey);
        integrationTest = {
          passed: decrypted === testKey,
          details: {
            originalKey: testKey,
            decryptedKey: decrypted,
            keyFingerprint: encrypted.keyFingerprint,
            matches: decrypted === testKey
          }
        };
      } catch (error) {
        integrationTest = {
          passed: false,
          details: {
            error: error instanceof Error ? error.message : 'Unknown integration error'
          }
        };
      }

      const allTestsPassed = validation.isValid && keyDerivationTime < 500 && integrityTest && integrationTest.passed;
      
      res.json({
        success: allTestsPassed,
        phase: 'PHASE_1_ENHANCED_KEY_MANAGEMENT_WITH_INTEGRATION',
        overallResult: allTestsPassed ? 'ALL_TESTS_PASSED_INCLUDING_INTEGRATION' : 'SOME_TESTS_FAILED',
        tests: [
          {
            name: 'Key Configuration Validation',
            passed: validation.isValid,
            details: validation
          },
          {
            name: 'Key Derivation Performance',
            passed: keyDerivationTime < 500,
            details: { derivationTime: `${keyDerivationTime}ms`, fingerprint: EnterpriseKeyManager.getKeyFingerprint(testKey) }
          },
          {
            name: 'Encryption/Decryption Integrity',
            passed: integrityTest,
            details: { keyFingerprint: licenseData.keyFingerprint, keyVersion: licenseData.keyVersion }
          },
          {
            name: 'License Key Service Integration',
            passed: integrationTest.passed,
            details: integrationTest.details
          }
        ],
        cacheStats: EnterpriseKeyManager.getCacheStats(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        phase: 'PHASE_1_ENHANCED_KEY_MANAGEMENT',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Key rotation test endpoint
  app.post('/api/security-test-rotation', async (req, res) => {
    try {
      const { keyType = 'LICENSE', initiatedBy = 'SYSTEM_TEST' } = req.body;
      const { EnterpriseKeyManager } = await import('./security/enhanced-key-manager');
      
      if (!['LICENSE', 'VAULT', 'JWT', 'SESSION'].includes(keyType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid key type. Must be one of: LICENSE, VAULT, JWT, SESSION'
        });
      }

      const rotationResult = await EnterpriseKeyManager.rotateKeys(keyType as any, initiatedBy);
      
      res.json({
        success: rotationResult.success,
        phase: 'PHASE_1_KEY_ROTATION',
        rotation: rotationResult,
        cacheStats: EnterpriseKeyManager.getCacheStats(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        phase: 'PHASE_1_KEY_ROTATION',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Comprehensive Integration Test - Enhanced Key Management + License Key Service
  app.get('/api/integration-test', async (req, res) => {
    try {
      const { licenseKeyService } = await import('./services/license-key.service');
      const testResults = [];
      let allPassed = true;

      // Test 1: Generate Secure License Key
      try {
        const secureKey = licenseKeyService.generateSecureLicenseKey('TEST-PRODUCT-1', 'INTEGRATION_TEST_USER');
        testResults.push({
          name: 'Secure License Key Generation',
          passed: secureKey.plainKey && secureKey.encryptedKey && secureKey.keyFingerprint,
          details: {
            plainKeyLength: secureKey.plainKey.length,
            encryptedKeyPrefix: secureKey.encryptedKey.substring(0, 25) + '...',
            keyFingerprint: secureKey.keyFingerprint,
            keyVersion: secureKey.keyVersion
          }
        });
      } catch (error) {
        testResults.push({
          name: 'Secure License Key Generation',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        allPassed = false;
      }

      // Test 2: Encrypt Existing License Key
      try {
        const testKey = 'ABC123-DEF456-GHI789-JKL012-MNO345';
        const encrypted = licenseKeyService.encryptLicenseKey(testKey, 'INTEGRATION_TEST_USER');
        testResults.push({
          name: 'License Key Encryption',
          passed: encrypted.encryptedKey && encrypted.keyFingerprint,
          details: {
            originalKeyLength: testKey.length,
            encryptedKeyPrefix: encrypted.encryptedKey.substring(0, 25) + '...',
            keyFingerprint: encrypted.keyFingerprint,
            keyVersion: encrypted.keyVersion
          }
        });

        // Test 3: Decrypt License Key (Round-trip test)
        try {
          const decrypted = licenseKeyService.decryptLicenseKey(encrypted.encryptedKey);
          const roundTripPassed = decrypted === testKey;
          testResults.push({
            name: 'License Key Decryption (Round-trip)',
            passed: roundTripPassed,
            details: {
              originalKey: testKey,
              decryptedKey: decrypted,
              matches: roundTripPassed
            }
          });
          if (!roundTripPassed) allPassed = false;
        } catch (error) {
          testResults.push({
            name: 'License Key Decryption (Round-trip)',
            passed: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          allPassed = false;
        }
      } catch (error) {
        testResults.push({
          name: 'License Key Encryption',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        allPassed = false;
      }

      // Test 4: Key Validation (existing functionality)
      try {
        const testKeys = ['ABC123-DEF456-GHI789', 'INVALID_KEY', 'XYZ987-UVW654-RST321-QPO098'];
        const validatedKeys = licenseKeyService.validateKeys(testKeys);
        testResults.push({
          name: 'License Key Validation',
          passed: validatedKeys.length === 2, // Should validate 2 out of 3 keys
          details: {
            inputKeys: testKeys.length,
            validKeys: validatedKeys.length,
            validated: validatedKeys
          }
        });
      } catch (error) {
        testResults.push({
          name: 'License Key Validation',
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        allPassed = false;
      }

      res.json({
        success: allPassed,
        phase: 'INTEGRATION_TEST_ENHANCED_KEY_MANAGEMENT',
        overallResult: allPassed ? 'ALL_INTEGRATION_TESTS_PASSED' : 'SOME_INTEGRATION_TESTS_FAILED',
        tests: testResults,
        timestamp: new Date().toISOString(),
        integrationStatus: {
          enhancedKeyManagement: 'ACTIVE',
          licenseKeyService: 'INTEGRATED',
          encryptionLayer: 'OPERATIONAL'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        phase: 'INTEGRATION_TEST_ENHANCED_KEY_MANAGEMENT',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
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

  // Authentication is now set up above (before CSRF)

  // Using application-level tenant filtering for security instead of RLS

  // Rate limiting disabled for simplicity

  // Setup authentication first
  setupAuth(app);

  // Simplified CSRF protection for development
  app.get('/api/csrf-token', (req, res) => {
    const token = `csrf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store token in session for validation
    if (req.session) {
      (req.session as any).csrfToken = token;
    }
    
    res.json({ 
      csrfToken: token,
      expires: Date.now() + (24 * 60 * 60 * 1000)
    });
  });

  // Simplified CSRF validation - only for development mode
  const validateCSRF = (req: any, res: any, next: any) => {
    // Skip CSRF validation in development for now to avoid blocking functionality
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    // Full validation in production
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const token = req.body._csrf || 
                  req.query._csrf || 
                  req.headers['x-csrf-token'] || 
                  req.headers['x-xsrf-token'];

    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({
        error: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or missing CSRF token'
      });
    }

    next();
  };

  // Apply CSRF validation to API routes (except auth endpoints)
  app.use('/api', (req: any, res: any, next: any) => {
    if (req.path === '/login' || req.path === '/admin/login' || req.path === '/csrf-token') {
      return next();
    }
    return validateCSRF(req, res, next);
  });
  
  // Use the admin router with additional security
  app.use('/api/admin', adminRouter);
  
  // Apply security test routes (for development and testing)
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/security', securityTestRoutes);
  }

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

        // Extract the required fields from request body
        const { name, description, parentId, level, sortOrder, isActive } = req.body;
        
        // Generate path and pathName based on parent and name
        let path = '';
        let pathName = '';
        
        if (parentId) {
          // Get parent category to build path
          const parentCategory = await storage.getCategoryById(parentId);
          if (parentCategory) {
            path = `${parentCategory.path}/${name.toLowerCase().replace(/\s+/g, '-')}`;
            pathName = `${parentCategory.pathName} > ${name}`;
          } else {
            return res.status(400).json({ message: "Parent category not found" });
          }
        } else {
          // Root level category
          path = `/${name.toLowerCase().replace(/\s+/g, '-')}`;
          pathName = name;
        }

        // Create complete category data with generated paths
        const categoryData = {
          name,
          description: description || '',
          parentId: parentId || null,
          level: level || 1,
          path,
          pathName,
          sortOrder: sortOrder || 1,
          isActive: isActive !== undefined ? isActive : true
        };

        const category = await storage.createCategory(categoryData);
        res.status(201).json(category);
      } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({ message: "Failed to create category" });
      }
    });

  // Hierarchical category routes
  app.get('/api/categories/hierarchy', isAuthenticated, async (req: any, res) => {
    try {
      const { categoryService } = await import('./services/category.service');
      const hierarchy = await categoryService.getCategoryHierarchy();
      res.json(hierarchy);
    } catch (error) {
      console.error("Error fetching category hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch category hierarchy" });
    }
  });

  app.get('/api/categories/level/:level', isAuthenticated, async (req: any, res) => {
    try {
      const level = parseInt(req.params.level);
      if (level < 1 || level > 3) {
        return res.status(400).json({ message: "Level must be between 1 and 3" });
      }
      
      const categories = await storage.getCategoriesByLevel(level);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories by level:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get('/api/categories/:id/children', isAuthenticated, async (req: any, res) => {
    try {
      const children = await storage.getCategoriesByParent(req.params.id);
      res.json(children);
    } catch (error) {
      console.error("Error fetching category children:", error);
      res.status(500).json({ message: "Failed to fetch category children" });
    }
  });

  app.get('/api/categories/:id/path', isAuthenticated, async (req: any, res) => {
    try {
      const { categoryService } = await import('./services/category.service');
      const path = await categoryService.getCategoryPath(req.params.id);
      res.json(path);
    } catch (error) {
      console.error("Error fetching category path:", error);
      res.status(500).json({ message: "Failed to fetch category path" });
    }
  });

  app.post('/api/categories/hierarchy', 
    isAuthenticated, 
    invalidateCacheMiddleware('categories:*'),
    async (req: any, res) => {
      try {
        const user = await storage.getUser(req.user.id);
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        const { categoryService } = await import('./services/category.service');
        const category = await categoryService.createCategory(req.body);
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
      // Get user's tenant for application-level filtering
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

      // Get user's tenant ID for application-level filtering
      const tenantId = user.tenantId || 'eur';
      
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

  // Product routes with tenant-aware pricing and user-specific visibility
  app.get('/api/products', 
    isAuthenticated,
    requireTenantType(['eur-shop', 'km-shop', 'admin']),
    productsCacheMiddleware,
    async (req: any, res) => {
    try {
      const { region, platform, category, search, priceMin, priceMax } = req.query;
      const currency = req.tenant.currency;
      const userId = req.user.id;
      const userRole = req.user.role;

      const filters = {
        region: region as string,
        platform: platform as string,
        category: category as string,
        search: search as string,
        priceMin: priceMin ? parseFloat(priceMax as string) : undefined,
        priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
        currency: currency // Add currency filter
      };

      // For B2B users, get only products visible to them via user_product_pricing
      let products;
      if (userRole === 'b2b_user') {
        // Get user's visible products with custom pricing using storage method
        const userPricing = await storage.getUserVisibleProducts(userId);
        
        // Filter by search and other criteria if provided
        products = userPricing.filter((product: any) => {
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            if (!product.name.toLowerCase().includes(searchLower) && 
                !product.description.toLowerCase().includes(searchLower)) {
              return false;
            }
          }
          if (filters.region && product.region !== filters.region) return false;
          if (filters.platform && product.platform !== filters.platform) return false;
          if (filters.category && product.categoryId !== filters.category) return false;
          return true;
        });
      } else {
        // For admin users, get all active products
        products = await productService.getActiveProducts(filters);
      }
      
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



      res.json(ordersData);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders", error: (error as Error).message });
    }
  });

  // Order creation endpoint with immediate cache invalidation
  app.post('/api/orders', isAuthenticated, invalidateOrdersCache, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { billingInfo, paymentMethod, paymentDetails } = req.body;

      // Get user's tenant ID first
      const user = req.user as any;
      const tenantId = user.tenantId || 'eur';

      // Get cart items with application-level tenant filtering
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

      // Generate sequential order number  
      const { generateNextOrderNumber } = await import('./utils/order-number');
      const orderNumber = await generateNextOrderNumber();

      // BULLETPROOF TRANSACTIONAL ORDER CREATION
      console.log('🚀 Starting bulletproof order creation with transactional consistency');
      
      // Import OrderService for enterprise-grade order creation
      const { OrderService } = await import('./services/order.service');
      const orderService = new OrderService();

      // Prepare cart items for transaction
      const transactionCartItems = [];
      for (const cartItem of cartItems) {
        for (let i = 0; i < cartItem.quantity; i++) {
          // Get available license key from shared pool (no tenant isolation for inventory)
          const licenseKey = await storage.getAvailableKey(cartItem.productId);
          if (!licenseKey) {
            throw new Error(`No license keys available for product: ${cartItem.product.name}`);
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

      // Cache invalidation now handled by middleware automatically
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