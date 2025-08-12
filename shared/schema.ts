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
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import image schemas
export * from './image-schema';

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

// Branch type enum
export const branchTypeEnum = pgEnum("branch_type", ["main_company", "branch"]);

// Support system enums
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "pending", "resolved", "closed"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketCategoryEnum = pgEnum("ticket_category", ["technical", "billing", "general", "feature_request", "bug_report"]);
export const chatMessageTypeEnum = pgEnum("chat_message_type", ["text", "image", "file", "system"]);
export const chatStatusEnum = pgEnum("chat_status", ["active", "closed", "archived"]);
export const knowledgeBaseCategoryEnum = pgEnum("kb_category", ["getting_started", "technical", "billing", "troubleshooting", "api", "integration", "general"]);

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
  // B2B Client Required Fields
  companyName: varchar("company_name"),
  phone: varchar("phone"),
  country: varchar("country"),
  city: varchar("city"),
  address: text("address"),
  vatOrRegistrationNo: varchar("vat_or_registration_no"),
  // Optional B2B Client Fields
  contactPerson: varchar("contact_person"),
  companyDescription: text("company_description"),
  // Branch/Hierarchy Fields
  parentCompanyId: varchar("parent_company_id"), // References parent company user ID
  branchType: branchTypeEnum("branch_type").default("main_company").notNull(),
  branchName: varchar("branch_name"), // Name of the branch (e.g., "Poslovnica Centar")
  branchCode: varchar("branch_code"), // Unique code for branch identification
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("users_parent_company_idx").on(table.parentCompanyId),
  index("users_branch_type_idx").on(table.branchType),
  index("users_tenant_idx").on(table.tenantId),
]);

// Product categories with hierarchy support
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  parentId: varchar("parent_id"),
  level: integer("level").default(1).notNull(), // 1, 2, or 3
  path: varchar("path").notNull(), // Materialized path like "/software/business/office"
  pathName: varchar("path_name").notNull(), // Human readable path like "Software > Business Applications > Office Suites"
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("categories_parent_id_idx").on(table.parentId),
  index("categories_level_idx").on(table.level),
  index("categories_path_idx").on(table.path),
  index("categories_sort_order_idx").on(table.sortOrder),
]);

// Add foreign key constraint after table definition
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  products: many(products),
}));

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
  isActive: boolean("is_active").default(true).notNull(),
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

// ===============================
// SUPPORT SYSTEM TABLES
// ===============================

// Support tickets table
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number").unique().notNull(), // Auto-generated: SPT-2025-001
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").default("open").notNull(),
  priority: ticketPriorityEnum("priority").default("medium").notNull(),
  category: ticketCategoryEnum("category").default("general").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(), // User who created the ticket
  assignedToId: varchar("assigned_to_id").references(() => users.id), // Admin user assigned to handle ticket
  tenantId: varchar("tenant_id").notNull().default("eur"), // Tenant isolation
  tags: jsonb("tags").default([]), // Array of tag strings
  attachments: jsonb("attachments").default([]), // Array of file URLs
  lastResponseAt: timestamp("last_response_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("support_tickets_user_idx").on(table.userId),
  index("support_tickets_assigned_idx").on(table.assignedToId),
  index("support_tickets_status_idx").on(table.status),
  index("support_tickets_tenant_idx").on(table.tenantId),
  index("support_tickets_created_idx").on(table.createdAt),
]);

// Ticket responses/comments table
export const ticketResponses = pgTable("ticket_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTickets.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(), // User who posted the response
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false), // Internal admin notes
  attachments: jsonb("attachments").default([]), // Array of file URLs
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ticket_responses_ticket_idx").on(table.ticketId),
  index("ticket_responses_user_idx").on(table.userId),
  index("ticket_responses_created_idx").on(table.createdAt),
]);

// Live chat sessions table
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").unique().notNull(), // Chat session identifier
  userId: varchar("user_id").references(() => users.id).notNull(), // User in the chat
  assignedToId: varchar("assigned_to_id").references(() => users.id), // Admin handling the chat
  status: chatStatusEnum("status").default("active").notNull(),
  tenantId: varchar("tenant_id").notNull().default("eur"), // Tenant isolation
  title: varchar("title", { length: 255 }).default("Chat Session"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("chat_sessions_user_idx").on(table.userId),
  index("chat_sessions_assigned_idx").on(table.assignedToId),
  index("chat_sessions_status_idx").on(table.status),
  index("chat_sessions_tenant_idx").on(table.tenantId),
]);

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => chatSessions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(), // User who sent the message
  message: text("message").notNull(),
  messageType: chatMessageTypeEnum("message_type").default("text").notNull(),
  attachments: jsonb("attachments").default([]), // Array of file URLs
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("chat_messages_session_idx").on(table.sessionId),
  index("chat_messages_user_idx").on(table.userId),
  index("chat_messages_created_idx").on(table.createdAt),
]);

// Knowledge base articles table
export const knowledgeBaseArticles = pgTable("knowledge_base_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt"), // Brief summary
  category: knowledgeBaseCategoryEnum("category").default("getting_started").notNull(),
  tags: jsonb("tags").default([]), // Array of tag strings
  isPublished: boolean("is_published").default(false),
  tenantId: varchar("tenant_id").notNull().default("eur"), // Tenant isolation
  authorId: varchar("author_id").references(() => users.id).notNull(), // Admin who wrote the article
  viewCount: integer("view_count").default(0),
  helpfulCount: integer("helpful_count").default(0),
  notHelpfulCount: integer("not_helpful_count").default(0),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("kb_articles_category_idx").on(table.category),
  index("kb_articles_published_idx").on(table.isPublished),
  index("kb_articles_tenant_idx").on(table.tenantId),
  index("kb_articles_author_idx").on(table.authorId),
]);

// FAQ table
export const faqs = pgTable("faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: varchar("question", { length: 500 }).notNull(),
  answer: text("answer").notNull(),
  category: knowledgeBaseCategoryEnum("category").default("general").notNull(),
  isPublished: boolean("is_published").default(false),
  tenantId: varchar("tenant_id").notNull().default("eur"), // Tenant isolation
  order: integer("order").default(0), // Display order
  viewCount: integer("view_count").default(0),
  helpfulCount: integer("helpful_count").default(0),
  notHelpfulCount: integer("not_helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("faqs_category_idx").on(table.category),
  index("faqs_published_idx").on(table.isPublished),
  index("faqs_tenant_idx").on(table.tenantId),
  index("faqs_order_idx").on(table.order),
]);

// User-specific product pricing table for per-client pricing
export const userProductPricing = pgTable("user_product_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }).notNull(),
  isVisible: boolean("is_visible").default(true).notNull(), // Whether user can see this product
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_product_pricing_user").on(table.userId),
  index("idx_user_product_pricing_product").on(table.productId),
  index("idx_user_product_pricing_user_product").on(table.userId, table.productId),
]);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  orders: many(orders),
  cartItems: many(cartItems),
  usedKeys: many(licenseKeys),
  permissions: one(adminPermissions, {
    fields: [users.id],
    references: [adminPermissions.userId],
  }),
  customPricing: many(userProductPricing),
  // Hierarchical relations
  parentCompany: one(users, {
    fields: [users.parentCompanyId],
    references: [users.id],
  }),
  branches: many(users),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  licenseKeys: many(licenseKeys),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  userPricing: many(userProductPricing),
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

export const userProductPricingRelations = relations(userProductPricing, ({ one }) => ({
  user: one(users, {
    fields: [userProductPricing.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [userProductPricing.productId],
    references: [products.id],
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

// Support system relations
export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [supportTickets.assignedToId],
    references: [users.id],
  }),
  responses: many(ticketResponses),
}));

export const ticketResponsesRelations = relations(ticketResponses, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketResponses.ticketId],
    references: [supportTickets.id],
  }),
  user: one(users, {
    fields: [ticketResponses.userId],
    references: [users.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  assignedTo: one(users, {
    fields: [chatSessions.assignedToId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const knowledgeBaseArticlesRelations = relations(knowledgeBaseArticles, ({ one }) => ({
  author: one(users, {
    fields: [knowledgeBaseArticles.authorId],
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

export const insertUserProductPricingSchema = createInsertSchema(userProductPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  customPrice: z.union([z.string(), z.number()]).transform(val => String(val)),
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

// Support system insert schemas
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ticketNumber: true, // Auto-generated
});

export const insertTicketResponseSchema = createInsertSchema(ticketResponses).omit({
  id: true,
  createdAt: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  sessionId: true, // Auto-generated
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertKnowledgeBaseArticleSchema = createInsertSchema(knowledgeBaseArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type CategoryWithChildren = Category & {
  children?: CategoryWithChildren[];
  productCount?: number;
};
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
export type UserProductPricing = typeof userProductPricing.$inferSelect;
export type InsertUserProductPricing = z.infer<typeof insertUserProductPricingSchema>;

// Support system types
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketResponse = typeof ticketResponses.$inferSelect;
export type InsertTicketResponse = z.infer<typeof insertTicketResponseSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type KnowledgeBaseArticle = typeof knowledgeBaseArticles.$inferSelect;
export type InsertKnowledgeBaseArticle = z.infer<typeof insertKnowledgeBaseArticleSchema>;
export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;

// Event sourcing types
export type CartEvent = typeof cartEvents.$inferSelect;
export type InsertCartEvent = z.infer<typeof insertCartEventSchema>;
export type CartView = typeof cartView.$inferSelect;
export type InsertCartView = z.infer<typeof insertCartViewSchema>;

// Extend product with stock count
export type ProductWithStock = Product & {
  stockCount: number;
  categoryName?: string;
};

// Extend product with license keys
export type ProductWithKeys = Product & {
  licenseKeys: LicenseKey[];
  totalKeys: number;
  usedKeys: number;
  availableKeys: number;
};

// Export all schemas and types
export * from './digital-key-schema';
export * from './advanced-auth-schema';
export * from './api-security-schema';
