import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["b2b_user", "admin", "super_admin"]);

// Order counter table for sequential order numbers
export const orderCounters = pgTable("order_counters", {
  id: varchar("id").primaryKey().default("main"),
  lastOrderNumber: integer("last_order_number").default(99999).notNull(), // Start from 99999, so first order is 100000
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default("b2b_user").notNull(),
  tenantId: varchar("tenant_id").notNull().default("eur"), // EUR or KM tenant
  isActive: boolean("is_active").default(true).notNull(),
  
  // B2B Company Information
  companyName: varchar("company_name"),
  contactPerson: varchar("contact_person"),
  companyDescription: text("company_description"),
  phone: varchar("phone"),
  country: varchar("country"),
  city: varchar("city"),
  address: varchar("address"),
  vatOrRegistrationNo: varchar("vat_or_registration_no"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: varchar("sku").unique().notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // EUR price for B2B shop
  priceKm: decimal("price_km", { precision: 10, scale: 2 }), // KM (Bosnian Mark) price for future tenant
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  b2bPrice: decimal("b2b_price", { precision: 10, scale: 2 }),
  retailPrice: decimal("retail_price", { precision: 10, scale: 2 }),
  purchasePriceKm: decimal("purchase_price_km", { precision: 10, scale: 2 }),
  resellerPriceKm: decimal("reseller_price_km", { precision: 10, scale: 2 }),
  retailerPriceKm: decimal("retailer_price_km", { precision: 10, scale: 2 }),
  categoryId: varchar("category_id").references(() => categories.id),
  region: varchar("region").notNull(), // Global, EU, US, etc.
  platform: varchar("platform").notNull(), // Windows, Mac, Both
  stockCount: integer("stock_count").default(0).notNull(),
  imageUrl: varchar("image_url"),
  warranty: text("warranty"), // Warranty information
  htmlDescription: text("html_description"), // Rich HTML description
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// License keys table
export const licenseKeys = pgTable("license_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  tenantId: varchar("tenant_id").notNull().default("eur"), // EUR or KM tenant
  keyValue: text("key_value").notNull().unique(),
  isUsed: boolean("is_used").default(false).notNull(),
  usedBy: varchar("used_by").references(() => users.id),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tenantId: varchar("tenant_id").notNull(), // EUR or KM tenant
  orderNumber: varchar("order_number").notNull().unique(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").default("pending").notNull(), // pending, completed, cancelled
  
  // Billing Information
  companyName: varchar("company_name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  email: varchar("email"),
  phone: varchar("phone"),
  
  // Billing Address
  address: varchar("address"),
  city: varchar("city"),
  postalCode: varchar("postal_code"),
  country: varchar("country"),
  
  // Payment Information
  paymentMethod: varchar("payment_method"), // credit_card, bank_transfer, purchase_order
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, failed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  licenseKeyId: varchar("license_key_id").references(() => licenseKeys.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

// Shopping cart table
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tenantId: varchar("tenant_id").notNull(), // EUR or KM tenant
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Event sourcing: Cart events table
export const cartEvents = pgTable("cart_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tenantId: varchar("tenant_id").notNull(), // EUR or KM tenant
  eventType: varchar("event_type").notNull(), // 'ITEM_ADDED', 'ITEM_UPDATED', 'ITEM_REMOVED', 'CART_CLEARED'
  productId: varchar("product_id").references(() => products.id),
  quantity: integer("quantity"),
  eventData: jsonb("event_data"), // Additional event metadata
  timestamp: timestamp("timestamp").defaultNow(),
  sequenceNumber: integer("sequence_number").notNull(), // For ordering events
}, (table) => [
  index("idx_cart_events_user_sequence").on(table.userId, table.sequenceNumber),
  index("idx_cart_events_timestamp").on(table.timestamp),
  index("idx_cart_events_user_timestamp").on(table.userId, table.timestamp),
]);

// Materialized cart view for instant reads
export const cartView = pgTable("cart_view", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  lastEventId: varchar("last_event_id").notNull().references(() => cartEvents.id),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("idx_cart_view_user").on(table.userId),
  index("idx_cart_view_user_product").on(table.userId, table.productId),
]);

// Admin permissions table
export const adminPermissions = pgTable("admin_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  canManageUsers: boolean("can_manage_users").default(false),
  canManageProducts: boolean("can_manage_products").default(false),
  canManageKeys: boolean("can_manage_keys").default(false),
  canViewReports: boolean("can_view_reports").default(false),
  canManageOrders: boolean("can_manage_orders").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
  usedKeys: many(licenseKeys),
  permissions: one(adminPermissions, {
    fields: [users.id],
    references: [adminPermissions.userId],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  licenseKeys: many(licenseKeys),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const licenseKeysRelations = relations(licenseKeys, ({ one }) => ({
  product: one(products, {
    fields: [licenseKeys.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [licenseKeys.usedBy],
    references: [users.id],
  }),
}));

// Wallet transaction types enum
export const transactionTypeEnum = pgEnum("transaction_type", [
  "deposit",      // Admin adds money to wallet
  "payment",      // B2B user makes purchase
  "credit_limit", // Admin sets credit limit
  "credit_payment", // Admin records payment towards credit debt
  "refund",       // Admin issues refund
  "adjustment"    // Admin manual adjustment
]);

// User wallets table
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tenantId: varchar("tenant_id").notNull(), // EUR or KM tenant
  depositBalance: decimal("deposit_balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }).default("0.00").notNull(),
  creditUsed: decimal("credit_used", { precision: 10, scale: 2 }).default("0.00").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wallet transactions table
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").references(() => wallets.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  orderId: varchar("order_id").references(() => orders.id), // For payment transactions
  adminId: varchar("admin_id").references(() => users.id), // Who performed admin action
  createdAt: timestamp("created_at").defaultNow(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  licenseKey: one(licenseKeys, {
    fields: [orderItems.licenseKeyId],
    references: [licenseKeys.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(walletTransactions),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletTransactions.walletId],
    references: [wallets.id],
  }),
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [walletTransactions.orderId],
    references: [orders.id],
  }),
  admin: one(users, {
    fields: [walletTransactions.adminId],
    references: [users.id],
  }),
}));

export const adminPermissionsRelations = relations(adminPermissions, ({ one }) => ({
  user: one(users, {
    fields: [adminPermissions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  price: z.union([z.string(), z.number()]).transform(val => String(val)),
  priceKm: z.union([z.string(), z.number(), z.null()]).transform(val => val ? String(val) : null).optional(),
  purchasePrice: z.union([z.string(), z.number(), z.null()]).transform(val => val ? String(val) : null).optional(),
  retailPrice: z.union([z.string(), z.number(), z.null()]).transform(val => val ? String(val) : null).optional(),
  purchasePriceKm: z.union([z.string(), z.number(), z.null()]).transform(val => val ? String(val) : null).optional(),
  resellerPriceKm: z.union([z.string(), z.number(), z.null()]).transform(val => val ? String(val) : null).optional(),
  retailerPriceKm: z.union([z.string(), z.number(), z.null()]).transform(val => val ? String(val) : null).optional(),
  warranty: z.string().optional(),
  htmlDescription: z.string().optional(),
  stockCount: z.union([z.string(), z.number()]).transform(val => val ? Number(val) : 0).optional(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertLicenseKeySchema = createInsertSchema(licenseKeys).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});

// Event sourcing schemas
export const insertCartEventSchema = createInsertSchema(cartEvents).omit({
  id: true,
  timestamp: true,
  sequenceNumber: true,
});

export const insertCartViewSchema = createInsertSchema(cartView).omit({
  id: true,
  lastUpdated: true,
});

export const insertAdminPermissionsSchema = createInsertSchema(adminPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type LicenseKey = typeof licenseKeys.$inferSelect;
export type InsertLicenseKey = z.infer<typeof insertLicenseKeySchema>;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;
export type AdminPermissions = typeof adminPermissions.$inferSelect;
export type InsertAdminPermissions = z.infer<typeof insertAdminPermissionsSchema>;

// Event sourcing types
export type CartEvent = typeof cartEvents.$inferSelect;
export type InsertCartEvent = z.infer<typeof insertCartEventSchema>;
export type CartView = typeof cartView.$inferSelect;
export type InsertCartView = z.infer<typeof insertCartViewSchema>;

// Extend product with stock count
export type ProductWithStock = Product & {
  stockCount: number;
};

// Extend product with license keys
export type ProductWithKeys = Product & {
  licenseKeys: LicenseKey[];
  totalKeys: number;
  usedKeys: number;
  availableKeys: number;
};
