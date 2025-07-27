-- Performance optimization indexes
-- Run these manually or through a migration system

-- Products table optimization
-- Index for region + active status filtering (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_region_active 
ON products (region, is_active) 
WHERE is_active = true;

-- Composite index for platform + category filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_platform_category 
ON products (platform, category_id) 
WHERE is_active = true;

-- Full-text search index for product names and descriptions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search 
ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Price range filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_price 
ON products (price) 
WHERE is_active = true;

-- Orders table optimization (this was slow - 1.3s query)
-- Index for user orders with date sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_date 
ON orders (user_id, created_at DESC);

-- Index for order status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_date 
ON orders (status, created_at DESC);

-- Index for payment status queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status 
ON orders (payment_status, created_at DESC);

-- Order items optimization
-- Index for product-order relationship queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product 
ON order_items (product_id, order_id);

-- Index for license key assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_license_key 
ON order_items (license_key_id);

-- Wallet transactions optimization
-- Index for user wallet queries with date sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_user_date 
ON wallet_transactions (user_id, created_at DESC);

-- Index for transaction type queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_type 
ON wallet_transactions (user_id, type, created_at DESC);

-- Index for order-related transactions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_transactions_order 
ON wallet_transactions (order_id) 
WHERE order_id IS NOT NULL;

-- Cart items optimization
-- Index for user cart queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_items_user 
ON cart_items (user_id, created_at DESC);

-- Index for product-cart relationship
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cart_items_product 
ON cart_items (product_id, user_id);

-- License keys optimization
-- Index for available keys by product
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_keys_product_available 
ON license_keys (product_id, is_used) 
WHERE is_used = false;

-- Index for assigned keys by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_license_keys_user 
ON license_keys (assigned_user_id, created_at DESC) 
WHERE assigned_user_id IS NOT NULL;

-- Users table optimization
-- Index for role-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active 
ON users (role, is_active) 
WHERE is_active = true;

-- Index for authentication queries (if not already exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username 
ON users (username) 
WHERE is_active = true;

-- Categories optimization
-- Index for active categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_active 
ON categories (is_active, name) 
WHERE is_active = true;

-- Sessions table optimization (if using PostgreSQL sessions)
-- Index for session cleanup and lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expire 
ON sessions (expire);

-- Wallets table optimization
-- Index for user wallet queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallets_user_active 
ON wallets (user_id, is_active) 
WHERE is_active = true;

-- Partial indexes for specific use cases
-- Index for high-value orders (for reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_high_value 
ON orders (final_amount, created_at DESC) 
WHERE final_amount::numeric > 100;

-- Index for recent orders (for dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_recent 
ON orders (created_at DESC, status) 
WHERE created_at > NOW() - INTERVAL '30 days';

-- Index for low stock products (for inventory management)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_low_stock 
ON products (stock_count, name) 
WHERE stock_count < 10 AND is_active = true;

-- Analyze tables after index creation to update statistics
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE wallet_transactions;
ANALYZE cart_items;
ANALYZE license_keys;
ANALYZE users;
ANALYZE categories;
ANALYZE wallets;