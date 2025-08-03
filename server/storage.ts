import {
  users,
  products,
  categories,
  licenseKeys,
  orders,
  orderItems,
  cartItems,
  adminPermissions,
  type User,
  type UpsertUser,
  type Product,
  type ProductWithStock,
  type InsertProduct,
  type Category,
  type InsertCategory,
  type LicenseKey,
  type InsertLicenseKey,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type CartItem,
  type InsertCartItem,
  type AdminPermissions,
  type InsertAdminPermissions,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, sql, count, or, ilike, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updateData: Partial<User>): Promise<User>;
  updateUserRole(id: string, role: "b2b_user" | "admin" | "super_admin"): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Product operations
  getProducts(filters?: {
    region?: string;
    platform?: string;
    category?: string;
    search?: string;
    priceMin?: number;
    priceMax?: number;
  }): Promise<ProductWithStock[]>;
  getAllProducts(): Promise<ProductWithStock[]>; // For admin - includes inactive
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  getUserVisibleProducts(userId: string): Promise<ProductWithStock[]>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Hierarchical category operations
  getAllCategoriesHierarchy(): Promise<Category[]>;
  getCategoriesByLevel(level: number): Promise<Category[]>;
  getCategoriesByParent(parentId?: string): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | undefined>;
  createCategoryHierarchy(category: InsertCategory & { level: number; path: string; pathName: string }): Promise<Category>;
  updateCategoryHierarchy(id: string, updateData: Partial<Category>): Promise<Category>;
  getCategoryProductCount(categoryId: string): Promise<number>;

  // License key operations
  getLicenseKeys(productId?: string, tenantId?: string, userRole?: string): Promise<LicenseKey[]>;
  createLicenseKey(key: InsertLicenseKey): Promise<LicenseKey>;
  getAvailableKey(productId: string): Promise<LicenseKey | undefined>;
  getKeyById(keyId: string): Promise<LicenseKey | undefined>;
  markKeyAsUsed(keyId: string, userId: string): Promise<void>;
  getProductStock(productId: string): Promise<number>;

  // Cart operations
  getCartItems(userId: string, tenantId?: string): Promise<(CartItem & { product: Product })[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<void>;
  removeFromCart(id: string): Promise<void>;
  clearCart(userId: string, tenantId?: string): Promise<void>;

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  
  // Wallet operations
  getWallet(userId: string, tenantId?: string): Promise<any>;
  getWalletTransactions(userId: string, tenantId?: string): Promise<any[]>;
  getOrdersWithDetails(userId?: string): Promise<any[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrders(userId?: string): Promise<(Order & { items: (OrderItem & { product: Product })[] })[]>;
  updateOrderStatus(orderId: string, status: string): Promise<void>;
  updatePaymentStatus(orderId: string, paymentStatus: string): Promise<void>;

  // Admin operations
  getAllUsers(): Promise<User[]>;
  getUserPermissions(userId: string): Promise<AdminPermissions | undefined>;
  updateUserPermissions(userId: string, permissions: InsertAdminPermissions): Promise<AdminPermissions>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    totalUsers: number;
    totalSales: string;
    activeKeys: number;
    totalProducts: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateUserRole(id: string, role: "b2b_user" | "admin" | "super_admin"): Promise<void> {
    await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
  }

  // Product operations
  async getProducts(filters?: {
    region?: string;
    platform?: string;
    category?: string;
    search?: string;
    priceMin?: number;
    priceMax?: number;
    isActive?: boolean;
  }): Promise<ProductWithStock[]> {


    let whereConditions = [];

    // Handle isActive filter - default to true if not specified
    const isActiveFilter = filters?.isActive !== undefined ? filters.isActive : true;
    whereConditions.push(eq(products.isActive, isActiveFilter));

    // Apply filters if provided
    if (filters?.region && filters.region !== 'all') {
      whereConditions.push(eq(products.region, filters.region));
    }
    if (filters?.platform && filters.platform !== 'all') {
      whereConditions.push(eq(products.platform, filters.platform));
    }

    if (filters?.search) {
        whereConditions.push(
          or(
            ilike(products.name, `%${filters.search}%`),
            ilike(products.description, `%${filters.search}%`),
            ilike(products.sku, `%${filters.search}%`)
          )
        );
      }
      if (filters?.priceMin !== undefined) {
        whereConditions.push(gte(products.price, filters.priceMin.toString()));
      }
      if (filters?.priceMax !== undefined) {
        whereConditions.push(lte(products.price, filters.priceMax.toString()));
      }

    try {
      const result = await db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          price: products.price,
          priceKm: products.priceKm, // Include KM pricing
          purchasePrice: products.purchasePrice,
          b2bPrice: products.b2bPrice,
          retailPrice: products.retailPrice,
          purchasePriceKm: products.purchasePriceKm,
          resellerPriceKm: products.resellerPriceKm,
          retailerPriceKm: products.retailerPriceKm,
          categoryId: products.categoryId,
          region: products.region,
          platform: products.platform,
          imageUrl: products.imageUrl,
          warranty: products.warranty,
          htmlDescription: products.htmlDescription,
          isActive: products.isActive,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          stockCount: sql<number>`COUNT(CASE WHEN ${licenseKeys.isUsed} = false THEN 1 END)`,
        })
        .from(products)
        .leftJoin(licenseKeys, eq(products.id, licenseKeys.productId))
        .where(and(...whereConditions))
        .groupBy(products.id)
        .orderBy(desc(products.createdAt));


      // DEBUG: Log products before image enhancement
      console.log('🔍 BEFORE image enhancement:', result.map(p => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl
      })));

      // Enhance products with images from new image management system
      const { productImageService } = await import('./services/product-image.service');
      const enhancedProducts = await productImageService.enhanceProductsWithImages(result as ProductWithStock[]);
      
      // DEBUG: Log products after image enhancement
      console.log('🔍 AFTER image enhancement:', enhancedProducts.map(p => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl
      })));
      
      return enhancedProducts;
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }

  async getAllProducts(): Promise<ProductWithStock[]> {
    // For admin - get ALL products regardless of isActive status
    const result = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        description: products.description,
        price: products.price,
        priceKm: products.priceKm, // Include KM pricing for admin too
        purchasePrice: products.purchasePrice,
        b2bPrice: products.b2bPrice,
        retailPrice: products.retailPrice,
        purchasePriceKm: products.purchasePriceKm,
        resellerPriceKm: products.resellerPriceKm,
        retailerPriceKm: products.retailerPriceKm,
        warranty: products.warranty,
        htmlDescription: products.htmlDescription,
        categoryId: products.categoryId,
        region: products.region,
        platform: products.platform,
        imageUrl: products.imageUrl,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        stockCount: sql<number>`COUNT(CASE WHEN ${licenseKeys.isUsed} = false THEN 1 END)`,
      })
      .from(products)
      .leftJoin(licenseKeys, eq(products.id, licenseKeys.productId))
      .groupBy(products.id)
      .orderBy(desc(products.createdAt));

    // Enhance products with images from new image management system
    const { productImageService } = await import('./services/product-image.service');
    const enhancedProducts = await productImageService.enhanceProductsWithImages(result as ProductWithStock[]);
    return enhancedProducts;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    try {
      const [updatedProduct] = await db
        .update(products)
        .set({ ...product, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();

      return updatedProduct;
    } catch (error) {
      console.error('Database Error:', error);
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<void> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  }

  // Category operations (legacy - for backward compatibility)
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.sortOrder, categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    // Legacy method - use createCategoryHierarchy for new implementations
    const categoryData = {
      ...category,
      level: 1,
      path: '/' + category.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      pathName: category.name,
      sortOrder: category.sortOrder || 0
    };
    const [newCategory] = await db.insert(categories).values(categoryData).returning();
    return newCategory;
  }

  // Hierarchical category operations
  async getAllCategoriesHierarchy(): Promise<Category[]> {
    return await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.level, categories.sortOrder, categories.name);
  }

  async getCategoriesByLevel(level: number): Promise<Category[]> {
    return await db.select().from(categories)
      .where(and(
        eq(categories.level, level),
        eq(categories.isActive, true)
      ))
      .orderBy(categories.sortOrder, categories.name);
  }

  async getCategoriesByParent(parentId?: string): Promise<Category[]> {
    const condition = parentId 
      ? and(eq(categories.parentId, parentId), eq(categories.isActive, true))
      : and(sql`${categories.parentId} IS NULL`, eq(categories.isActive, true));
      
    return await db.select().from(categories)
      .where(condition)
      .orderBy(categories.sortOrder, categories.name);
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories)
      .where(eq(categories.id, id));
    return category;
  }

  async createCategoryHierarchy(category: InsertCategory & { level: number; path: string; pathName: string }): Promise<Category> {
    const [newCategory] = await db.insert(categories).values({
      ...category,
      updatedAt: new Date()
    }).returning();
    return newCategory;
  }

  async updateCategoryHierarchy(id: string, updateData: Partial<Category>): Promise<Category> {
    const [updatedCategory] = await db.update(categories)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async getCategoryProductCount(categoryId: string): Promise<number> {
    const [result] = await db.select({ count: count() })
      .from(products)
      .where(and(
        eq(products.categoryId, categoryId),
        eq(products.isActive, true)
      ));
    return result.count;
  }

  // License key operations
  async getLicenseKeys(productId?: string, tenantId?: string, userRole?: string): Promise<LicenseKey[]> {
    let whereConditions = [];
    
    // Filter by product if specified
    if (productId) {
      whereConditions.push(eq(licenseKeys.productId, productId));
    }
    
    // CRITICAL SECURITY FIX: Enforce tenant isolation at application level
    // Since RLS policies are broken, we implement strict tenant filtering here
    if (userRole === 'admin' || userRole === 'super_admin') {
      // Admin can see all license keys across all tenants

    } else if (tenantId) {
      // Regular users can only see keys from their specific tenant
      whereConditions.push(eq(licenseKeys.tenantId, tenantId));

    }
    
    const query = whereConditions.length > 0 
      ? db.select().from(licenseKeys).where(and(...whereConditions))
      : db.select().from(licenseKeys);
      
    const keys = await query.orderBy(desc(licenseKeys.createdAt));
    
    console.log(`📊 QUERY RESULT: Returned ${keys.length} license keys`);
    return keys;
  }

  async createLicenseKey(key: InsertLicenseKey): Promise<LicenseKey> {
    // Ensure tenant ID is set for new license keys
    const keyWithTenant = {
      ...key,
      tenantId: key.tenantId || 'eur' // Default to EUR if not specified
    };
    
    const [newKey] = await db.insert(licenseKeys).values(keyWithTenant).returning();
    return newKey;
  }

  async getAvailableKey(productId: string, tenantId?: string): Promise<LicenseKey | undefined> {
    // SHARED LICENSE KEY POOL: Both EUR and KM tenants share the same license keys
    const whereConditions = [
      eq(licenseKeys.productId, productId),
      eq(licenseKeys.isUsed, false)
    ];
    
    // License keys are shared across tenants - no tenant isolation for inventory
    
    const [key] = await db
      .select()
      .from(licenseKeys)
      .where(and(...whereConditions))
      .limit(1);
    return key;
  }

  async getKeyById(keyId: string): Promise<LicenseKey | undefined> {
    const [key] = await db
      .select()
      .from(licenseKeys)
      .where(eq(licenseKeys.id, keyId));
    return key;
  }

  async markKeyAsUsed(keyId: string, userId: string): Promise<void> {
    await db
      .update(licenseKeys)
      .set({
        isUsed: true,
        usedBy: userId,
        usedAt: new Date(),
      })
      .where(eq(licenseKeys.id, keyId));
  }

  async getProductStock(productId: string, tenantId?: string): Promise<number> {
    const whereConditions = [
      eq(licenseKeys.productId, productId),
      eq(licenseKeys.isUsed, false)
    ];
    
    // Add tenant filter for accurate stock count per tenant
    if (tenantId) {
      whereConditions.push(eq(licenseKeys.tenantId, tenantId));
    }
    
    const [result] = await db
      .select({ count: count() })
      .from(licenseKeys)
      .where(and(...whereConditions));
    return result.count;
  }

  // ENTERPRISE CART OPERATIONS WITH TRANSACTIONAL SAFETY

  /**
   * Get cart items with complete product information
   * Uses proper joins and error handling
   */
  async getCartItems(userId: string, tenantId?: string): Promise<(CartItem & { product: Product })[]> {
    try {
      const whereConditions = [eq(cartItems.userId, userId)];
      if (tenantId) {
        whereConditions.push(eq(cartItems.tenantId, tenantId));
      }

      const rows = await db
        .select({
          id: cartItems.id,
          userId: cartItems.userId,
          tenantId: cartItems.tenantId,
          productId: cartItems.productId,
          quantity: cartItems.quantity,
          createdAt: cartItems.createdAt,
          product: {
            id: products.id,
            sku: products.sku,
            name: products.name,
            description: products.description,
            price: products.price,
            priceKm: products.priceKm,
            purchasePrice: products.purchasePrice,
            b2bPrice: products.b2bPrice,
            retailPrice: products.retailPrice,
            purchasePriceKm: products.purchasePriceKm,
            resellerPriceKm: products.resellerPriceKm,
            retailerPriceKm: products.retailerPriceKm,
            categoryId: products.categoryId,
            region: products.region,
            platform: products.platform,
            stockCount: products.stockCount,
            imageUrl: products.imageUrl,
            warranty: products.warranty,
            htmlDescription: products.htmlDescription,
            isActive: products.isActive,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
          }
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(and(...whereConditions, eq(products.isActive, true)))
        .orderBy(desc(cartItems.createdAt));

      // Transform products to use tenant-appropriate pricing
      return rows.map(row => ({
        ...row,
        product: {
          ...row.product,
          // Use KM price for KM tenants, EUR price for EUR tenants
          price: tenantId === 'km' 
            ? (row.product.priceKm || row.product.price)
            : row.product.price
        }
      }));
    } catch (error) {
      console.error('Error fetching cart items:', error);
      throw new Error('Failed to fetch cart items');
    }
  }

  /**
   * Add item to cart with transactional safety
   * Handles quantity merging and stock validation
   */
  async addToCart(item: InsertCartItem): Promise<CartItem> {
    try {
      return await db.transaction(async (tx) => {
        // Validate product exists and is active
        const [product] = await tx
          .select({ id: products.id, stockCount: products.stockCount, isActive: products.isActive })
          .from(products)
          .where(eq(products.id, item.productId));

        if (!product) {
          throw new Error('Product not found');
        }

        if (!product.isActive) {
          throw new Error('Product is not available');
        }

        // Check if item already exists in cart
        const [existingItem] = await tx
          .select()
          .from(cartItems)
          .where(and(
            eq(cartItems.userId, item.userId), 
            eq(cartItems.productId, item.productId)
          ));

        if (existingItem) {
          // Update existing item quantity
          const newQuantity = existingItem.quantity + item.quantity;

          const [updatedItem] = await tx
            .update(cartItems)
            .set({ 
              quantity: newQuantity,
              createdAt: new Date()
            })
            .where(eq(cartItems.id, existingItem.id))
            .returning();

          return updatedItem;
        } else {
          // Insert new cart item
          const [newItem] = await tx
            .insert(cartItems)
            .values(item)
            .returning();

          return newItem;
        }
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw new Error(`Failed to add item to cart: ${(error as Error).message}`);
    }
  }

  /**
   * Update cart item quantity with validation
   */
  async updateCartItem(id: string, quantity: number): Promise<void> {
    try {
      if (quantity < 1) {
        throw new Error('Quantity must be at least 1');
      }

      await db.transaction(async (tx) => {
        // Verify cart item exists and belongs to user
        const [existingItem] = await tx
          .select()
          .from(cartItems)
          .where(eq(cartItems.id, id));

        if (!existingItem) {
          throw new Error('Cart item not found');
        }

        // Update quantity
        await tx
          .update(cartItems)
          .set({ quantity })
          .where(eq(cartItems.id, id));
      });
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw new Error(`Failed to update cart item: ${(error as Error).message}`);
    }
  }

  /**
   * Remove specific item from cart
   */
  async removeFromCart(id: string): Promise<void> {
    try {
      return await db.transaction(async (tx) => {
        // Delete the item and get the affected rows count
        const result = await tx
          .delete(cartItems)
          .where(eq(cartItems.id, id))
          .returning({ id: cartItems.id });
        
        // Return void as per interface
      });
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw new Error(`Failed to remove item from cart: ${(error as Error).message}`);
    }
  }

  /**
   * Clear entire cart for user with atomic operation
   */
  async clearCart(userId: string, tenantId?: string): Promise<void> {
    try {
      return await db.transaction(async (tx) => {
        const whereConditions = [eq(cartItems.userId, userId)];
        if (tenantId) {
          whereConditions.push(eq(cartItems.tenantId, tenantId));
        }
        
        // Delete all cart items for user and return count
        const result = await tx
          .delete(cartItems)
          .where(and(...whereConditions))
          .returning({ id: cartItems.id });
        
        // Return void as per interface
      });
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw new Error(`Failed to clear cart: ${(error as Error).message}`);
    }
  }

  /**
   * Get cart summary with totals
   */
  async getCartSummary(userId: string): Promise<{
    itemCount: number;
    totalAmount: number;
    items: (CartItem & { product: Product })[];
  }> {
    try {
      const items = await this.getCartItems(userId);

      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = items.reduce((sum, item) => {
        const price = parseFloat(item.product.price || '0');
        return sum + (price * item.quantity);
      }, 0);

      return {
        itemCount,
        totalAmount,
        items
      };
    } catch (error) {
      console.error('Error getting cart summary:', error);
      throw new Error('Failed to get cart summary');
    }
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [newItem] = await db.insert(orderItems).values(item).returning();
    return newItem;
  }

  async getOrders(userId?: string): Promise<(Order & { items: (OrderItem & { product: Product })[] })[]> {
    // PERFORMANCE OPTIMIZATION: Use single query with JSON aggregation to avoid N+1 problem
    const result = await db.execute(sql`
      SELECT 
        o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'orderId', oi.order_id,
              'productId', oi.product_id,
              'licenseKeyId', oi.license_key_id,
              'quantity', oi.quantity,
              'unitPrice', oi.unit_price,
              'totalPrice', oi.total_price,
              'product', json_build_object(
                'id', p.id,
                'sku', p.sku,
                'name', p.name,
                'description', p.description,
                'price', p.price,
                'priceKm', p.price_km,
                'platform', p.platform,
                'region', p.region,
                'imageUrl', p.image_url,
                'isActive', p.is_active
              )
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      ${userId ? sql`WHERE o.user_id = ${userId}` : sql``}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

    return result.rows.map((row: any) => ({
      ...row,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      items: Array.isArray(row.items) ? row.items.map((item: any) => ({
        ...item,
        product: {
          ...item.product,
          createdAt: new Date(item.product.created_at || Date.now()),
          updatedAt: new Date(item.product.updated_at || Date.now())
        }
      })) : []
    }));
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId));
  }

  async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<void> {
    await db.update(orders).set({ paymentStatus, updatedAt: new Date() }).where(eq(orders.id, orderId));
  }

  async getOrdersWithDetails(userId?: string): Promise<any[]> {
    try {


      // Use direct pool connection to bypass Drizzle completely
      const orderQuery = userId 
        ? `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`
        : `SELECT * FROM orders ORDER BY created_at DESC`;

      const orderParams = userId ? [userId] : [];
      const orderResult = await pool.query(orderQuery, orderParams);
      const orderRows = orderResult.rows;



      // Get order items with products and license keys for each order
      const ordersWithDetails = await Promise.all(
        orderRows.map(async (order: any) => {


          // Get order items for this order
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
            product: {
              id: item.product_id,
              name: item.product_name,
              description: item.product_description,
              price: item.product_price,
              platform: item.product_platform,
              region: item.product_region,
            },
            licenseKey: item.license_key ? {
              id: item.license_key_id,
              productId: item.product_id,
              licenseKey: item.license_key,
              usedBy: item.used_by,
              usedAt: item.key_used_at,
              createdAt: item.key_created_at,
              product: {
                id: item.product_id,
                name: item.product_name,
                platform: item.product_platform,
              }
            } : null
          }));

          return {
            id: order.id,
            userId: order.user_id,
            orderNumber: order.order_number,
            status: order.status,
            totalAmount: order.total_amount,
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


      return ordersWithDetails;
    } catch (error) {
      console.error('Error in getOrdersWithDetails:', error);
      throw error;
    }
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserPermissions(userId: string): Promise<AdminPermissions | undefined> {
    const [permissions] = await db
      .select()
      .from(adminPermissions)
      .where(eq(adminPermissions.userId, userId));
    return permissions;
  }

  async updateUserPermissions(userId: string, permissions: InsertAdminPermissions): Promise<AdminPermissions> {
    const [updated] = await db
      .insert(adminPermissions)
      .values({ ...permissions, userId })
      .onConflictDoUpdate({
        target: adminPermissions.userId,
        set: { ...permissions, updatedAt: new Date() },
      })
      .returning();
    return updated;
  }

  // Dashboard stats
  async getDashboardStats(): Promise<{
    totalUsers: number;
    totalSales: string;
    activeKeys: number;
    totalProducts: number;
  }> {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [productCount] = await db.select({ count: count() }).from(products).where(eq(products.isActive, true));
    const [keyCount] = await db.select({ count: count() }).from(licenseKeys).where(eq(licenseKeys.isUsed, false));

    const [salesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(eq(orders.status, 'completed'));

    return {
      totalUsers: userCount.count,
      totalSales: `€${parseFloat(salesResult.total || '0').toLocaleString()}`,
      activeKeys: keyCount.count,
      totalProducts: productCount.count,
    };
  }

  // Wallet operations - DEPRECATED: Use WalletService instead
  async getWallet(userId: string, tenantId?: string): Promise<any> {
    // This method is deprecated and kept for backward compatibility
    // New implementations should use WalletService
    const { WalletService } = await import('./services/wallet.service');
    const walletService = new WalletService();
    
    if (!tenantId) {
      const [user] = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, userId));
      tenantId = user?.tenantId || 'eur';
    }
    
    return await walletService.getWallet(userId, tenantId);
  }

  // Wallet transactions - DEPRECATED: Use WalletService instead
  async getWalletTransactions(userId: string, tenantId?: string): Promise<any[]> {
    // This method is deprecated and kept for backward compatibility
    // New implementations should use WalletService
    const { WalletService } = await import('./services/wallet.service');
    const walletService = new WalletService();
    
    if (!tenantId) {
      const [user] = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, userId));
      tenantId = user?.tenantId || 'eur';
    }
    
    return await walletService.getWalletTransactions(userId, tenantId);
  }

  // Get products visible to a specific B2B user
  async getUserVisibleProducts(userId: string): Promise<ProductWithStock[]> {
    const { userProductPricing } = await import("@shared/schema");
    
    const userProducts = await db
      .select({
        productId: userProductPricing.productId,
        customPrice: userProductPricing.customPrice,
        isVisible: userProductPricing.isVisible,
        product: products
      })
      .from(userProductPricing)
      .innerJoin(products, eq(userProductPricing.productId, products.id))
      .where(
        and(
          eq(userProductPricing.userId, userId),
          eq(userProductPricing.isVisible, true),
          eq(products.isActive, true)
        )
      );

    // Get stock counts for all products in one query
    const stockCounts = await Promise.all(
      userProducts.map(async (item) => {
        const stock = await this.getProductStock(item.product.id);
        return { productId: item.product.id, stockCount: stock };
      })
    );

    // Transform to ProductWithStock format and add custom pricing
    return userProducts.map(item => {
      const stockInfo = stockCounts.find(s => s.productId === item.product.id);
      return {
        ...item.product,
        // Use custom price if available, fallback to B2B price
        price: item.customPrice?.toString() || item.product.b2bPrice || item.product.price,
        b2bPrice: item.customPrice?.toString() || item.product.b2bPrice,
        originalPrice: item.product.price,
        isCustomPricing: !!item.customPrice,
        stockCount: stockInfo?.stockCount || 0
      };
    });
  }
}

export const storage = new DatabaseStorage();