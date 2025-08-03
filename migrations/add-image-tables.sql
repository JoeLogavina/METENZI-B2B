-- Add image-related enums
CREATE TYPE "image_storage_type" AS ENUM('local', 's3', 'hybrid');
CREATE TYPE "image_status" AS ENUM('uploading', 'processing', 'active', 'archived', 'failed');
CREATE TYPE "image_size_type" AS ENUM('original', 'large', 'medium', 'small', 'thumbnail', 'icon');

-- Product Images table
CREATE TABLE "product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" uuid NOT NULL,
  
  -- File system organization
  "original_file_name" varchar(255) NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "file_path" text NOT NULL,
  
  -- Image metadata
  "mime_type" varchar(100) NOT NULL,
  "file_size" integer NOT NULL,
  "width" integer,
  "height" integer,
  
  -- Storage information
  "storage_type" "image_storage_type" DEFAULT 'local' NOT NULL,
  "bucket_name" varchar(100),
  "s3_key" text,
  
  -- Image variants/thumbnails
  "has_variants" boolean DEFAULT false,
  "parent_image_id" uuid,
  "size_type" "image_size_type" DEFAULT 'original' NOT NULL,
  
  -- Status and metadata
  "status" "image_status" DEFAULT 'active' NOT NULL,
  "is_main" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  
  -- SEO and accessibility
  "alt_text" text,
  "caption" text,
  
  -- Tracking
  "uploaded_by" uuid,
  "processing_started_at" timestamp,
  "processing_completed_at" timestamp,
  "last_accessed_at" timestamp DEFAULT now(),
  
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Image processing queue
CREATE TABLE "image_processing_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "image_id" uuid NOT NULL,
  "task_type" varchar(50) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 5 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "error_message" text,
  "metadata" text,
  
  "scheduled_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Image access analytics
CREATE TABLE "image_access_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "image_id" uuid NOT NULL,
  
  -- Access details
  "access_type" varchar(20) NOT NULL,
  "user_agent" text,
  "ip_address" varchar(45),
  "referer" text,
  
  -- Performance metrics
  "response_time" integer,
  "cache_hit" boolean DEFAULT false,
  
  -- Context
  "user_id" uuid,
  "session_id" varchar(100),
  
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Storage configuration
CREATE TABLE "image_storage_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "environment" varchar(20) NOT NULL,
  "storage_type" "image_storage_type" NOT NULL,
  
  -- Local storage config
  "local_base_path" text,
  "local_url_prefix" text,
  
  -- S3 config
  "s3_bucket" varchar(100),
  "s3_region" varchar(50),
  "s3_endpoint" text,
  "cdn_url" text,
  
  -- Image processing settings
  "max_file_size" integer DEFAULT 5242880,
  "allowed_mime_types" text DEFAULT 'image/jpeg,image/png,image/webp,image/gif',
  "generate_thumbnails" boolean DEFAULT true,
  "thumbnail_sizes" text DEFAULT '{"small": {"width": 150, "height": 150}, "medium": {"width": 300, "height": 300}, "large": {"width": 600, "height": 600}}',
  
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");
CREATE INDEX "product_images_parent_image_id_idx" ON "product_images"("parent_image_id");
CREATE INDEX "product_images_status_idx" ON "product_images"("status");
CREATE INDEX "product_images_size_type_idx" ON "product_images"("size_type");
CREATE INDEX "product_images_is_main_idx" ON "product_images"("is_main");

CREATE INDEX "image_processing_queue_status_idx" ON "image_processing_queue"("status");
CREATE INDEX "image_processing_queue_priority_idx" ON "image_processing_queue"("priority");
CREATE INDEX "image_processing_queue_scheduled_at_idx" ON "image_processing_queue"("scheduled_at");

CREATE INDEX "image_access_logs_image_id_idx" ON "image_access_logs"("image_id");
CREATE INDEX "image_access_logs_created_at_idx" ON "image_access_logs"("created_at");

-- Add foreign key constraints
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" 
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;

ALTER TABLE "product_images" ADD CONSTRAINT "product_images_parent_image_id_fkey" 
  FOREIGN KEY ("parent_image_id") REFERENCES "product_images"("id") ON DELETE CASCADE;

ALTER TABLE "image_processing_queue" ADD CONSTRAINT "image_processing_queue_image_id_fkey" 
  FOREIGN KEY ("image_id") REFERENCES "product_images"("id") ON DELETE CASCADE;

ALTER TABLE "image_access_logs" ADD CONSTRAINT "image_access_logs_image_id_fkey" 
  FOREIGN KEY ("image_id") REFERENCES "product_images"("id") ON DELETE CASCADE;

-- Insert default configuration for development
INSERT INTO "image_storage_config" (
  "environment", 
  "storage_type", 
  "local_base_path", 
  "local_url_prefix",
  "max_file_size",
  "generate_thumbnails"
) VALUES (
  'development',
  'local',
  'uploads',
  '/uploads',
  10485760,
  true
);