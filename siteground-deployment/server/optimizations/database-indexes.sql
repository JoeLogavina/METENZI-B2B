-- TIER 1 ENTERPRISE OPTIMIZATION: Database Performance Indexes
-- Run these indexes to dramatically improve query performance

-- Products table indexes (most critical for performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_region 
ON products (is_active, region) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_active_platform 
ON products (is_active, platform) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search_gin 
ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || sku));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_price_range 
ON products (price) WHERE is_active = true;

-- Orders table indexes (critical for user experience)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_created 
ON orders (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created 
ON orders (status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status 
ON orders (payment_status, created_at DESC);

-- Order items indexes (for order details performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id 
ON order_items (order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id 
ON order_items (product_id);

-- License keys indexes (for stock counting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_keys_product_available 
ON license_keys (product_id, is_used) WHERE is_used = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_keys_product_used 
ON license_keys (product_id, is_used, created_at DESC);

-- Cart view indexes (for cart performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_view_user_updated 
ON cart_view (user_id, last_updated DESC);

-- Wallet transactions indexes (for financial data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_user_created 
ON wallet_transactions (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_type_created 
ON wallet_transactions (transaction_type, created_at DESC);

-- Users table indexes (for authentication and user management)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_active 
ON users (tenant_id, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_tenant 
ON users (role, tenant_id);

-- Categories indexes (for product categorization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_parent_active 
ON categories (parent_id, is_active) WHERE is_active = true;

-- Wallets indexes (for balance operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_id 
ON wallets (user_id);

-- Cart events indexes (for event sourcing performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_events_user_sequence 
ON cart_events (user_id, sequence_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_events_user_created 
ON cart_events (user_id, created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_region_platform_active 
ON products (region, platform, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status_created 
ON orders (user_id, status, created_at DESC);

-- Update table statistics for better query planning
ANALYZE products;
ANALYZE orders; 
ANALYZE order_items;
ANALYZE license_keys;
ANALYZE cart_view;
ANALYZE wallet_transactions;
ANALYZE users;
ANALYZE categories;
ANALYZE wallets;
ANALYZE cart_events;