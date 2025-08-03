import { pgTable, text, timestamp, integer, boolean, varchar, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Image storage types
export const imageStorageTypeEnum = pgEnum('image_storage_type', ['local', 's3', 'hybrid']);
export const imageStatusEnum = pgEnum('image_status', ['uploading', 'processing', 'active', 'archived', 'failed']);
export const imageSizeTypeEnum = pgEnum('image_size_type', ['original', 'large', 'medium', 'small', 'thumbnail', 'icon']);

// Product Images table - Enhanced metadata tracking
export const productImages = pgTable("product_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: varchar("product_id").notNull(),
  
  // File system organization
  originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(), // Organized path: /uploads/products/2025/01/category/
  
  // Image metadata
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  width: integer("width"),
  height: integer("height"),
  
  // Storage information
  storageType: imageStorageTypeEnum("storage_type").default('local').notNull(),
  bucketName: varchar("bucket_name", { length: 100}), // for future S3 compatibility
  s3Key: text("s3_key"), // for future S3 compatibility
  
  // Image variants/thumbnails
  hasVariants: boolean("has_variants").default(false),
  parentImageId: varchar("parent_image_id"), // References original image for thumbnails
  sizeType: imageSizeTypeEnum("size_type").default('original').notNull(),
  
  // Status and metadata
  status: imageStatusEnum("status").default('active').notNull(),
  isMain: boolean("is_main").default(false), // Primary product image
  sortOrder: integer("sort_order").default(0),
  
  // SEO and accessibility
  altText: text("alt_text"),
  caption: text("caption"),
  
  // Tracking
  uploadedBy: varchar("uploaded_by"),
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Image processing queue for background jobs
export const imageProcessingQueue = pgTable("image_processing_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageId: varchar("image_id").notNull(),
  taskType: varchar("task_type", { length: 50 }).notNull(), // 'thumbnail', 'optimize', 'cleanup', 'migrate'
  status: varchar("status", { length: 20 }).default('pending').notNull(),
  priority: integer("priority").default(5).notNull(), // 1 = highest, 10 = lowest
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  errorMessage: text("error_message"),
  metadata: text("metadata"), // JSON string for task-specific data
  
  scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Image access analytics for optimization
export const imageAccessLogs = pgTable("image_access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageId: varchar("image_id").notNull(),
  
  // Access details
  accessType: varchar("access_type", { length: 20 }).notNull(), // 'view', 'download', 'thumbnail'
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45}),
  referer: text("referer"),
  
  // Performance metrics
  responseTime: integer("response_time"), // in milliseconds
  cacheHit: boolean("cache_hit").default(false),
  
  // Context
  userId: varchar("user_id"),
  sessionId: varchar("session_id", { length: 100}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Storage configuration for different environments
export const imageStorageConfig = pgTable("image_storage_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  environment: varchar("environment", { length: 20 }).notNull(), // 'development', 'staging', 'production'
  storageType: imageStorageTypeEnum("storage_type").notNull(),
  
  // Local storage config
  localBasePath: text("local_base_path"),
  localUrlPrefix: text("local_url_prefix"),
  
  // S3 config
  s3Bucket: varchar("s3_bucket", { length: 100}),
  s3Region: varchar("s3_region", { length: 50}),
  s3Endpoint: text("s3_endpoint"),
  cdnUrl: text("cdn_url"),
  
  // Image processing settings
  maxFileSize: integer("max_file_size").default(5242880), // 5MB default
  allowedMimeTypes: text("allowed_mime_types").default('image/jpeg,image/png,image/webp,image/gif'),
  generateThumbnails: boolean("generate_thumbnails").default(true),
  thumbnailSizes: text("thumbnail_sizes").default('{"small": {"width": 150, "height": 150}, "medium": {"width": 300, "height": 300}, "large": {"width": 600, "height": 600}}'),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertProductImageSchema = createInsertSchema(productImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  processingStartedAt: true,
  processingCompletedAt: true,
  lastAccessedAt: true,
});

export const insertImageProcessingQueueSchema = createInsertSchema(imageProcessingQueue).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertImageStorageConfigSchema = createInsertSchema(imageStorageConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types
export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = z.infer<typeof insertProductImageSchema>;
export type ImageProcessingQueue = typeof imageProcessingQueue.$inferSelect;
export type InsertImageProcessingQueue = z.infer<typeof insertImageProcessingQueueSchema>;
export type ImageStorageConfig = typeof imageStorageConfig.$inferSelect;
export type InsertImageStorageConfig = z.infer<typeof insertImageStorageConfigSchema>;

// Image size configuration type
export type ImageSizeConfig = {
  width: number;
  height: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
};

export type ThumbnailSizes = {
  [key: string]: ImageSizeConfig;
};