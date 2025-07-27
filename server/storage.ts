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
import { eq, and, desc, sql, count } from "drizzle-orm";

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
  getCartItems(userId: string): Promise<(CartItem & { product: Product })[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<void>;
  removeFromCart(id: string): Promise<void>;
  clearCart(userId: string): Promise<void>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
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
  }): Promise<ProductWithStock[]> {
    let whereConditions = [eq(products.isActive, true)];
    
    // Apply filters if provided
    if (filters?.region && filters.region !== 'all') {
      whereConditions.push(eq(products.region, filters.region));
    }
    if (filters?.platform && filters.platform !== 'all') {
      whereConditions.push(eq(products.platform, filters.platform));
    }

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
    console.log('Storage.updateProduct - ID:', id);
    console.log('Storage.updateProduct - Data:', product);
    
    try {
      const [updatedProduct] = await db
        .update(products)
        .set({ ...product, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      
      console.log('Storage.updateProduct - Success:', updatedProduct);
      return updatedProduct;
    } catch (error) {
      console.error('Storage.updateProduct - Database Error:', error);
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

  // Cart operations
  async getCartItems(userId: string): Promise<(CartItem & { product: Product })[]> {
    return await db
      .select()
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId))
      .then(rows => 
        rows.map(row => ({
          id: row.cart_items.id,
          userId: row.cart_items.userId,
          productId: row.cart_items.productId,
          quantity: row.cart_items.quantity,
          createdAt: row.cart_items.createdAt,
          product: row.products
        }))
      );
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    // Check if item already exists
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, item.userId), eq(cartItems.productId, item.productId)));

    if (existingItem) {
      // Update quantity
      const [updatedItem] = await db
        .update(cartItems)
        .set({ quantity: existingItem.quantity + item.quantity })
        .where(eq(cartItems.id, existingItem.id))
        .returning();
      return updatedItem;
    } else {
      // Add new item
      const [newItem] = await db.insert(cartItems).values(item).returning();
      return newItem;
    }
  }

  async updateCartItem(id: string, quantity: number): Promise<void> {
    await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, id));
  }

  async removeFromCart(id: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
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
      console.log('Getting orders with raw SQL for user:', userId);
      
      // Use direct pool connection to bypass Drizzle completely
      const orderQuery = userId 
        ? `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`
        : `SELECT * FROM orders ORDER BY created_at DESC`;
      
      const orderParams = userId ? [userId] : [];
      const orderResult = await pool.query(orderQuery, orderParams);
      const orderRows = orderResult.rows;
      
      console.log('Found orders:', orderRows.length);

      // Get order items with products and license keys for each order
      const ordersWithDetails = await Promise.all(
        orderRows.map(async (order: any) => {
          console.log('Processing order:', order.id);
          
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
          
          console.log('Found items for order', order.id, ':', itemRows.length);

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

      console.log('Returning orders:', ordersWithDetails.length);
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
}

export const storage = new DatabaseStorage();
