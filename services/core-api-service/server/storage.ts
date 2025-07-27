import {
  users,
  products,
  categories,
  orders,
  orderItems,
  licenseKeys,
  cartItems,
  type User,
  type Product,
  type Category,
  type Order,
  type OrderItem,
  type LicenseKey,
  type CartItem,
  type InsertUser,
  type InsertProduct,
  type InsertCategory,
  type InsertOrder,
  type InsertOrderItem,
  type InsertLicenseKey,
  type InsertCartItem,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, gte, lte, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUsers(): Promise<User[]>;
  getUserCount(): Promise<number>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;

  // Product operations
  getProducts(filters: any): Promise<Product[]>;
  getProductCount(): Promise<number>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(insertProduct: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // Category operations
  getCategories(): Promise<Category[]>;
  getActiveCategories(): Promise<Category[]>;
  createCategory(insertCategory: InsertCategory): Promise<Category>;

  // Order operations
  getOrders(): Promise<Order[]>;
  getUserOrders(userId: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderStats(): Promise<{ count: number; revenue: number }>;
  createOrder(orderData: any): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order>;

  // Cart operations
  getCartItems(userId: string): Promise<CartItem[]>;
  addToCart(insertCartItem: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, userId: string, quantity: number): Promise<CartItem>;
  removeFromCart(id: string, userId: string): Promise<void>;

  // License key operations
  getLicenseKeys(productId?: string): Promise<LicenseKey[]>;
  createLicenseKeys(productId: string, keys: string[]): Promise<LicenseKey[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0].count);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Product operations
  async getProducts(filters: any = {}): Promise<Product[]> {
    let query = db.select().from(products);
    const conditions = [];

    if (filters.isActive !== undefined) {
      conditions.push(eq(products.isActive, filters.isActive));
    }

    if (filters.category) {
      conditions.push(eq(products.categoryId, filters.category));
    }

    if (filters.region) {
      conditions.push(eq(products.region, filters.region));
    }

    if (filters.platform) {
      conditions.push(eq(products.platform, filters.platform));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.description, `%${filters.search}%`)
        )
      );
    }

    if (filters.priceMin !== undefined) {
      conditions.push(gte(products.price, filters.priceMin.toString()));
    }

    if (filters.priceMax !== undefined) {
      conditions.push(lte(products.price, filters.priceMax.toString()));
    }

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(desc(products.createdAt));
    return result;
  }

  async getProductCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(products);
    return Number(result[0].count);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.name));
  }

  async getActiveCategories(): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.name));
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  // Order operations
  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderStats(): Promise<{ count: number; revenue: number }> {
    const result = await db
      .select({
        count: sql<number>`count(*)`,
        revenue: sql<number>`sum(cast(final_amount as decimal))`,
      })
      .from(orders)
      .where(eq(orders.status, 'completed'));
    
    return {
      count: Number(result[0].count),
      revenue: Number(result[0].revenue) || 0,
    };
  }

  async createOrder(orderData: any): Promise<Order> {
    // Start transaction
    return await db.transaction(async (tx) => {
      // Get cart items
      const userCartItems = await tx
        .select()
        .from(cartItems)
        .where(eq(cartItems.userId, orderData.userId));

      if (userCartItems.length === 0) {
        throw new Error("Cart is empty");
      }

      // Calculate totals
      let totalAmount = 0;
      for (const item of userCartItems) {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId));
        totalAmount += parseFloat(product.price) * item.quantity;
      }

      const taxAmount = totalAmount * 0.21; // 21% VAT
      const finalAmount = totalAmount + taxAmount;

      // Create order
      const [order] = await tx
        .insert(orders)
        .values({
          userId: orderData.userId,
          totalAmount: totalAmount.toString(),
          taxAmount: taxAmount.toString(),
          finalAmount: finalAmount.toString(),
          status: 'pending',
          paymentMethod: orderData.paymentMethod,
          paymentStatus: 'pending',
          shippingAddress: orderData.shippingAddress,
          billingAddress: orderData.billingAddress,
        })
        .returning();

      // Create order items and assign license keys
      for (const cartItem of userCartItems) {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, cartItem.productId));

        // Get available license keys
        const availableKeys = await tx
          .select()
          .from(licenseKeys)
          .where(
            and(
              eq(licenseKeys.productId, cartItem.productId),
              eq(licenseKeys.isUsed, false)
            )
          )
          .limit(cartItem.quantity);

        if (availableKeys.length < cartItem.quantity) {
          throw new Error(`Not enough license keys for product ${product.name}`);
        }

        // Create order item
        const [orderItem] = await tx
          .insert(orderItems)
          .values({
            orderId: order.id,
            productId: cartItem.productId,
            quantity: cartItem.quantity,
            price: product.price,
            totalPrice: (parseFloat(product.price) * cartItem.quantity).toString(),
          })
          .returning();

        // Assign license keys
        for (const key of availableKeys) {
          await tx
            .update(licenseKeys)
            .set({
              isUsed: true,
              orderId: order.id,
              assignedAt: new Date(),
            })
            .where(eq(licenseKeys.id, key.id));
        }
      }

      // Clear cart
      await tx.delete(cartItems).where(eq(cartItems.userId, orderData.userId));

      return order;
    });
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  // Cart operations
  async getCartItems(userId: string): Promise<CartItem[]> {
    return await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.createdAt));
  }

  async addToCart(insertCartItem: InsertCartItem): Promise<CartItem> {
    // Check if item already in cart
    const [existing] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.userId, insertCartItem.userId),
          eq(cartItems.productId, insertCartItem.productId)
        )
      );

    if (existing) {
      // Update quantity
      const [updated] = await db
        .update(cartItems)
        .set({ 
          quantity: existing.quantity + insertCartItem.quantity,
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new cart item
      const [cartItem] = await db.insert(cartItems).values(insertCartItem).returning();
      return cartItem;
    }
  }

  async updateCartItem(id: string, userId: string, quantity: number): Promise<CartItem> {
    const [cartItem] = await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)))
      .returning();
    return cartItem;
  }

  async removeFromCart(id: string, userId: string): Promise<void> {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
  }

  // License key operations
  async getLicenseKeys(productId?: string): Promise<LicenseKey[]> {
    if (productId) {
      return await db
        .select()
        .from(licenseKeys)
        .where(eq(licenseKeys.productId, productId))
        .orderBy(desc(licenseKeys.createdAt));
    }
    return await db.select().from(licenseKeys).orderBy(desc(licenseKeys.createdAt));
  }

  async createLicenseKeys(productId: string, keys: string[]): Promise<LicenseKey[]> {
    const keysToInsert = keys.map(key => ({
      productId,
      key,
      isUsed: false,
    }));
    
    const createdKeys = await db.insert(licenseKeys).values(keysToInsert).returning();
    return createdKeys;
  }
}

export const storage = new DatabaseStorage();