CREATE TYPE "public"."branch_type" AS ENUM('main_company', 'branch');--> statement-breakpoint
CREATE TYPE "public"."chat_message_type" AS ENUM('text', 'image', 'file', 'system');--> statement-breakpoint
CREATE TYPE "public"."chat_status" AS ENUM('active', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."kb_category" AS ENUM('getting_started', 'technical', 'billing', 'troubleshooting', 'api', 'integration', 'general');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('technical', 'billing', 'general', 'feature_request', 'bug_report');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'pending', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."image_size_type" AS ENUM('original', 'large', 'medium', 'small', 'thumbnail', 'icon');--> statement-breakpoint
CREATE TYPE "public"."image_status" AS ENUM('uploading', 'processing', 'active', 'archived', 'failed');--> statement-breakpoint
CREATE TYPE "public"."image_storage_type" AS ENUM('local', 's3', 'hybrid');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"message_type" "chat_message_type" DEFAULT 'text' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"assigned_to_id" varchar,
	"status" "chat_status" DEFAULT 'active' NOT NULL,
	"tenant_id" varchar DEFAULT 'eur' NOT NULL,
	"title" varchar(255) DEFAULT 'Chat Session',
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chat_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" varchar(500) NOT NULL,
	"answer" text NOT NULL,
	"category" "kb_category" DEFAULT 'general' NOT NULL,
	"is_published" boolean DEFAULT false,
	"tenant_id" varchar DEFAULT 'eur' NOT NULL,
	"order" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"helpful_count" integer DEFAULT 0,
	"not_helpful_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_articles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"category" "kb_category" DEFAULT 'getting_started' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_published" boolean DEFAULT false,
	"tenant_id" varchar DEFAULT 'eur' NOT NULL,
	"author_id" varchar NOT NULL,
	"view_count" integer DEFAULT 0,
	"helpful_count" integer DEFAULT 0,
	"not_helpful_count" integer DEFAULT 0,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "knowledge_base_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" varchar NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"category" "ticket_category" DEFAULT 'general' NOT NULL,
	"user_id" varchar NOT NULL,
	"assigned_to_id" varchar,
	"tenant_id" varchar DEFAULT 'eur' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"last_response_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "ticket_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "image_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_id" varchar NOT NULL,
	"access_type" varchar(20) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"referer" text,
	"response_time" integer,
	"cache_hit" boolean DEFAULT false,
	"user_id" varchar,
	"session_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_processing_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_id" varchar NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "image_storage_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" varchar(20) NOT NULL,
	"storage_type" "image_storage_type" NOT NULL,
	"local_base_path" text,
	"local_url_prefix" text,
	"s3_bucket" varchar(100),
	"s3_region" varchar(50),
	"s3_endpoint" text,
	"cdn_url" text,
	"max_file_size" integer DEFAULT 5242880,
	"allowed_mime_types" text DEFAULT 'image/jpeg,image/png,image/webp,image/gif',
	"generate_thumbnails" boolean DEFAULT true,
	"thumbnail_sizes" text DEFAULT '{"small": {"width": 150, "height": 150}, "medium": {"width": 300, "height": 300}, "large": {"width": 600, "height": 600}}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"storage_type" "image_storage_type" DEFAULT 'local' NOT NULL,
	"bucket_name" varchar(100),
	"s3_key" text,
	"has_variants" boolean DEFAULT false,
	"parent_image_id" varchar,
	"size_type" "image_size_type" DEFAULT 'original' NOT NULL,
	"status" "image_status" DEFAULT 'active' NOT NULL,
	"is_main" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"alt_text" text,
	"caption" text,
	"uploaded_by" varchar,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"last_accessed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_fingerprint" varchar(64) NOT NULL,
	"product_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_type" varchar(50) DEFAULT 'license' NOT NULL,
	"algorithm" varchar(50) DEFAULT 'aes-256-gcm' NOT NULL,
	"version" varchar(10) DEFAULT 'v2' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_uses" integer DEFAULT 1,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" text,
	CONSTRAINT "digital_keys_key_fingerprint_unique" UNIQUE("key_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "download_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"success" boolean NOT NULL,
	"error_reason" varchar(500),
	"downloaded_bytes" integer DEFAULT 0,
	"duration" integer DEFAULT 0,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "download_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(128) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"filename" varchar(500),
	"filesize" integer,
	"checksum_sha256" varchar(64),
	"max_downloads" integer DEFAULT 1 NOT NULL,
	"current_downloads" integer DEFAULT 0 NOT NULL,
	"ip_whitelist" jsonb DEFAULT '[]'::jsonb,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"is_consumed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "download_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "key_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"action" varchar(50) NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_lockouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(500) NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"first_attempt" timestamp DEFAULT now() NOT NULL,
	"last_attempt" timestamp DEFAULT now() NOT NULL,
	"locked_until" timestamp,
	"is_locked" boolean DEFAULT false NOT NULL,
	"lock_reason" varchar(200),
	"unlock_reason" varchar(200),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "authentication_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(255) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"success" boolean NOT NULL,
	"failure_reason" varchar(200),
	"risk_score" integer DEFAULT 0,
	"fraud_flags" jsonb DEFAULT '[]'::jsonb,
	"mfa_required" boolean DEFAULT false,
	"mfa_completed" boolean DEFAULT false,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"session_id" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "mfa_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"challenge_type" varchar(50) DEFAULT 'totp' NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "mfa_challenges_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "permission_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_role" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(100) NOT NULL,
	"granted" boolean NOT NULL,
	"reason" varchar(200),
	"permission_id" uuid,
	"conditions_checked" jsonb DEFAULT '[]'::jsonb,
	"failed_conditions" jsonb DEFAULT '[]'::jsonb,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"request_path" varchar(500),
	"request_method" varchar(10),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"audit_data" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"action" varchar(100) NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"scope" varchar(50) DEFAULT 'tenant' NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inheritance" jsonb DEFAULT '[]'::jsonb,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"tenant_specific" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role_id" uuid NOT NULL,
	"tenant_id" varchar(100) NOT NULL,
	"assigned_by" varchar(255) NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tenant_id" varchar(100) NOT NULL,
	"role" varchar(100) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"device_fingerprint" varchar(64),
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"mfa_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "user_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "api_key_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer NOT NULL,
	"response_time" numeric(8, 2),
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"request_size" integer,
	"response_size" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rate_limit" integer DEFAULT 1000 NOT NULL,
	"tenant_id" varchar(100) NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"last_used" timestamp,
	"request_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_request_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"blocked_count" integer DEFAULT 0 NOT NULL,
	"avg_response_time" numeric(8, 2),
	"min_response_time" numeric(8, 2),
	"max_response_time" numeric(8, 2),
	"error_count" integer DEFAULT 0 NOT NULL,
	"unique_ips" integer DEFAULT 0 NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"aggregated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ddos_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"request_count" integer NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"threshold" integer NOT NULL,
	"severity" varchar(20) NOT NULL,
	"blocked" boolean DEFAULT true NOT NULL,
	"mitigation_action" varchar(100),
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "ip_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"cidr_range" varchar(50),
	"reason" varchar(200) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"blocked_by" varchar(255) NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_permanent" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 0,
	"last_attempt" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "rate_limit_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"method" varchar(10) DEFAULT '*',
	"window_ms" integer NOT NULL,
	"max_requests" integer NOT NULL,
	"identifier" varchar(50) NOT NULL,
	"skip_successful" boolean DEFAULT false,
	"skip_failed" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "rate_limit_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid,
	"identifier" varchar(200) NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"method" varchar(10) NOT NULL,
	"request_count" integer NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"user_id" varchar(255),
	"blocked" boolean DEFAULT true NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "security_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"setting" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"source" varchar(100) NOT NULL,
	"endpoint" varchar(200),
	"method" varchar(10),
	"user_agent" text,
	"user_id" varchar(255),
	"session_id" varchar(128),
	"blocked" boolean DEFAULT false NOT NULL,
	"risk_score" integer DEFAULT 0,
	"details" jsonb DEFAULT '{}'::jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "parent_id" varchar;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "path" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "path_name" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "license_keys" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "parent_company_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch_type" "branch_type" DEFAULT 'main_company' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch_name" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "branch_code" varchar;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base_articles" ADD CONSTRAINT "knowledge_base_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_responses" ADD CONSTRAINT "ticket_responses_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_responses" ADD CONSTRAINT "ticket_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_usage_logs" ADD CONSTRAINT "key_usage_logs_key_id_digital_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."digital_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_usage" ADD CONSTRAINT "api_key_usage_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_violations" ADD CONSTRAINT "rate_limit_violations_rule_id_rate_limit_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rate_limit_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_user_idx" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_idx" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_assigned_idx" ON "chat_sessions" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_status_idx" ON "chat_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_sessions_tenant_idx" ON "chat_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "faqs_category_idx" ON "faqs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "faqs_published_idx" ON "faqs" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "faqs_tenant_idx" ON "faqs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "faqs_order_idx" ON "faqs" USING btree ("order");--> statement-breakpoint
CREATE INDEX "kb_articles_category_idx" ON "knowledge_base_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "kb_articles_published_idx" ON "knowledge_base_articles" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "kb_articles_tenant_idx" ON "knowledge_base_articles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "kb_articles_author_idx" ON "knowledge_base_articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_assigned_idx" ON "support_tickets" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "support_tickets_tenant_idx" ON "support_tickets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "support_tickets_created_idx" ON "support_tickets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ticket_responses_ticket_idx" ON "ticket_responses" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_responses_user_idx" ON "ticket_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ticket_responses_created_idx" ON "ticket_responses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_level_idx" ON "categories" USING btree ("level");--> statement-breakpoint
CREATE INDEX "categories_path_idx" ON "categories" USING btree ("path");--> statement-breakpoint
CREATE INDEX "categories_sort_order_idx" ON "categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "users_parent_company_idx" ON "users" USING btree ("parent_company_id");--> statement-breakpoint
CREATE INDEX "users_branch_type_idx" ON "users" USING btree ("branch_type");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");