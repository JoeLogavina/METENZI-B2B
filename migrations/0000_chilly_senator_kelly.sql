CREATE TYPE "public"."transaction_type" AS ENUM('deposit', 'payment', 'credit_limit', 'credit_payment', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('b2b_user', 'admin', 'super_admin');--> statement-breakpoint
CREATE TABLE "admin_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"can_manage_users" boolean DEFAULT false,
	"can_manage_products" boolean DEFAULT false,
	"can_manage_keys" boolean DEFAULT false,
	"can_view_reports" boolean DEFAULT false,
	"can_manage_orders" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cart_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"product_id" varchar,
	"quantity" integer,
	"event_data" jsonb,
	"timestamp" timestamp DEFAULT now(),
	"sequence_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cart_view" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"last_event_id" varchar NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "license_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"tenant_id" varchar DEFAULT 'eur' NOT NULL,
	"key_value" text NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"used_by" varchar,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "license_keys_key_value_unique" UNIQUE("key_value")
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"id" varchar PRIMARY KEY DEFAULT 'main' NOT NULL,
	"last_order_number" integer DEFAULT 99999 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"license_key_id" varchar,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"order_number" varchar NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"final_amount" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"company_name" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"email" varchar,
	"phone" varchar,
	"address" varchar,
	"city" varchar,
	"postal_code" varchar,
	"country" varchar,
	"payment_method" varchar,
	"payment_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"price_km" numeric(10, 2),
	"purchase_price" numeric(10, 2),
	"b2b_price" numeric(10, 2),
	"retail_price" numeric(10, 2),
	"purchase_price_km" numeric(10, 2),
	"reseller_price_km" numeric(10, 2),
	"retailer_price_km" numeric(10, 2),
	"category_id" varchar,
	"region" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"stock_count" integer DEFAULT 0 NOT NULL,
	"image_url" varchar,
	"warranty" text,
	"html_description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_product_pricing" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"custom_price" numeric(10, 2) NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar NOT NULL,
	"password" varchar NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" "user_role" DEFAULT 'b2b_user' NOT NULL,
	"tenant_id" varchar DEFAULT 'eur' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_name" varchar,
	"phone" varchar,
	"country" varchar,
	"city" varchar,
	"address" text,
	"vat_or_registration_no" varchar,
	"contact_person" varchar,
	"company_description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"description" text,
	"order_id" varchar,
	"admin_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"deposit_balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"credit_limit" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"credit_used" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "admin_permissions" ADD CONSTRAINT "admin_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_events" ADD CONSTRAINT "cart_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_events" ADD CONSTRAINT "cart_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_view" ADD CONSTRAINT "cart_view_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_view" ADD CONSTRAINT "cart_view_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_view" ADD CONSTRAINT "cart_view_last_event_id_cart_events_id_fk" FOREIGN KEY ("last_event_id") REFERENCES "public"."cart_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_keys" ADD CONSTRAINT "license_keys_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_keys" ADD CONSTRAINT "license_keys_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_license_key_id_license_keys_id_fk" FOREIGN KEY ("license_key_id") REFERENCES "public"."license_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_pricing" ADD CONSTRAINT "user_product_pricing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_pricing" ADD CONSTRAINT "user_product_pricing_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cart_events_user_sequence" ON "cart_events" USING btree ("user_id","sequence_number");--> statement-breakpoint
CREATE INDEX "idx_cart_events_timestamp" ON "cart_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_cart_events_user_timestamp" ON "cart_events" USING btree ("user_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_cart_view_user" ON "cart_view" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cart_view_user_product" ON "cart_view" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_user_product_pricing_user" ON "user_product_pricing" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_product_pricing_product" ON "user_product_pricing" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_user_product_pricing_user_product" ON "user_product_pricing" USING btree ("user_id","product_id");