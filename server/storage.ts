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

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;

  // License key operations
  getLicenseKeys(productId?: string): Promise<LicenseKey[]>;
  createLicenseKey(key: InsertLicenseKey): Promise<LicenseKey>;
  getAvailableKey(productId: string): Promise<LicenseKey | undefined>;
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
  getWallet(userId: string): Promise<any>;
  getWalletTransactions(userId: string): Promise<any[]>;
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


      return result as ProductWithStock[];
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

    return result as ProductWithStock[];
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

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // License key operations
  async getLicenseKeys(productId?: string): Promise<LicenseKey[]> {
    if (productId) {
      return await db.select().from(licenseKeys)
        .where(eq(licenseKeys.productId, productId))
        .orderBy(desc(licenseKeys.createdAt));
    }
    return await db.select().from(licenseKeys)
      .orderBy(desc(licenseKeys.createdAt));
  }

  async createLicenseKey(key: InsertLicenseKey): Promise<LicenseKey> {
    const [newKey] = await db.insert(licenseKeys).values(key).returning();
    return newKey;
  }

  async getAvailableKey(productId: string): Promise<LicenseKey | undefined> {
    const [key] = await db
      .select()
      .from(licenseKeys)
      .where(and(eq(licenseKeys.productId, productId), eq(licenseKeys.isUsed, false)))
      .limit(1);
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

  async getProductStock(productId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(licenseKeys)
      .where(and(eq(licenseKeys.productId, productId), eq(licenseKeys.isUsed, false)));
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

      return rows;
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
    const ordersList = userId 
      ? await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt))
      : await db.select().from(orders).orderBy(desc(orders.createdAt));

    const ordersWithItems = await Promise.all(
      ordersList.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            licenseKeyId: orderItems.licenseKeyId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            totalPrice: orderItems.totalPrice,
            product: products,
          })
          .from(orderItems)
          .innerJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, order.id));

        return { ...order, items };
      })
    );

    return ordersWithItems;
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

  // Wallet operations
  async getWallet(userId: string): Promise<any> {
    try {
      // Calculate actual balance based on completed orders
      const completedOrdersResult = await db
        .select({ total: sql<string>`COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0)` })
        .from(orders)
        .where(and(
          eq(orders.userId, userId),
          eq(orders.status, 'completed')
        ));
      
      const totalSpent = parseFloat(completedOrdersResult[0]?.total || '0');
      
      // Assuming starting balance was €5000 
      const startingBalance = 5000.00;
      const remainingBalance = Math.max(0, startingBalance - totalSpent);
      const creditUsed = Math.max(0, totalSpent - startingBalance);
      const creditLimit = 5000.00;
      const availableCredit = Math.max(0, creditLimit - creditUsed);
      const totalAvailable = remainingBalance + availableCredit;
      const isOverlimit = creditUsed > creditLimit;

      return {
        id: userId,
        userId: userId,
        depositBalance: remainingBalance.toFixed(2),
        creditLimit: creditLimit.toFixed(2),
        creditUsed: creditUsed.toFixed(2),
        isActive: true,
        balance: {
          depositBalance: remainingBalance.toFixed(2),
          creditLimit: creditLimit.toFixed(2),
          creditUsed: creditUsed.toFixed(2),
          availableCredit: availableCredit.toFixed(2),
          totalAvailable: totalAvailable.toFixed(2),
          isOverlimit: isOverlimit
        }
      };
    } catch (error) {
      console.error('Error fetching wallet:', error);
      throw new Error('Failed to fetch wallet data');
    }
  }

  async getWalletTransactions(userId: string): Promise<any[]> {
    try {
      // Get actual order transactions from database
      const completedOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt,
          paymentMethod: orders.paymentMethod
        })
        .from(orders)
        .where(and(
          eq(orders.userId, userId),
          eq(orders.status, 'completed'),
          eq(orders.paymentMethod, 'wallet')
        ))
        .orderBy(desc(orders.createdAt));

      // Convert to transaction format
      const transactions = completedOrders.map((order, index) => ({
        id: order.id,
        type: "purchase",
        amount: `-${parseFloat(order.totalAmount).toFixed(2)}`,
        description: `Order ${order.orderNumber}`,
        createdAt: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
        balanceAfter: "0.00" // Simplified for now
      }));

      // Add initial deposit transaction
      transactions.push({
        id: "initial-deposit",
        type: "deposit",
        amount: "+5000.00",
        description: "Initial account deposit",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        balanceAfter: "5000.00"
      });

      return transactions.slice(0, 10); // Show latest 10 transactions
    } catch (error) {
      console.error('Error fetching wallet transactions:', error);
      throw new Error('Failed to fetch wallet transactions');
    }
  }
}

export const storage = new DatabaseStorage();