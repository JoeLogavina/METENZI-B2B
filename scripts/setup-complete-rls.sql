-- Enterprise Complete RLS Coverage Setup
-- This script implements bulletproof tenant isolation for ALL tenant-aware tables

-- First, ensure tenant context function exists
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id TEXT, user_role TEXT DEFAULT 'b2b_user')
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.tenant_id', tenant_id, true);
  PERFORM set_config('app.user_role', user_role, true);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PRODUCTS TABLE RLS (CRITICAL PRIORITY)
-- =============================================================================

-- Enable RLS on products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_products ON products;

-- Products policy: Show all products but admin can manage tenant-specific pricing
CREATE POLICY tenant_isolation_products ON products
  FOR ALL
  TO PUBLIC
  USING (
    CASE
      -- Admin users can see all products across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can see all products (products are shared, only pricing differs)
      -- This allows EUR users to see products with EUR pricing, KM users with KM pricing
      ELSE is_active = true
    END
  )
  WITH CHECK (
    CASE
      -- Only admin users can modify products
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users cannot modify products
      ELSE false
    END
  );

-- =============================================================================
-- CATEGORIES TABLE RLS
-- =============================================================================

-- Enable RLS on categories table
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_categories ON categories;

-- Categories policy: All users can see categories, only admins can modify
CREATE POLICY tenant_isolation_categories ON categories
  FOR ALL
  TO PUBLIC
  USING (
    CASE
      -- Admin users can see all categories
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can see all categories (categories are shared across tenants)
      ELSE true
    END
  )
  WITH CHECK (
    CASE
      -- Only admin users can modify categories
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users cannot modify categories
      ELSE false
    END
  );

-- =============================================================================
-- LICENSE KEYS TABLE RLS (HIGH PRIORITY)
-- =============================================================================

-- Add tenant_id column to license_keys if it doesn't exist
ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS tenant_id varchar DEFAULT 'eur';

-- Update existing license keys to have proper tenant association
-- This assumes existing keys should be EUR tenant (adjust as needed)
UPDATE license_keys SET tenant_id = 'eur' WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after setting defaults
ALTER TABLE license_keys ALTER COLUMN tenant_id SET NOT NULL;

-- Enable RLS on license_keys table
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_license_keys ON license_keys;

-- License keys policy: Strict tenant isolation
CREATE POLICY tenant_isolation_license_keys ON license_keys
  FOR ALL
  TO PUBLIC
  USING (
    CASE
      -- Admin users can see all license keys across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can only see license keys from their tenant
      ELSE tenant_id = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE
      -- Admin users can modify license keys across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users cannot directly modify license keys
      ELSE false
    END
  );

-- =============================================================================
-- CART ITEMS TABLE RLS
-- =============================================================================

-- Enable RLS on cart_items table
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_cart_items ON cart_items;

-- Cart items policy: Users can only access their own cart items from their tenant
CREATE POLICY tenant_isolation_cart_items ON cart_items
  FOR ALL
  TO PUBLIC
  USING (
    CASE
      -- Admin users can see all cart items across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can only see their own cart items from their tenant
      ELSE user_id = current_setting('app.user_id', true) 
        AND tenant_id = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE
      -- Admin users can modify cart items across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can only modify their own cart items from their tenant
      ELSE user_id = current_setting('app.user_id', true) 
        AND tenant_id = current_setting('app.tenant_id', true)
    END
  );

-- =============================================================================
-- PERFORMANCE INDEXES FOR RLS QUERIES
-- =============================================================================

-- Create indexes to optimize RLS policy queries
CREATE INDEX IF NOT EXISTS idx_license_keys_tenant_product ON license_keys(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_tenant_used ON license_keys(tenant_id, is_used);
CREATE INDEX IF NOT EXISTS idx_cart_items_tenant_user ON cart_items(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- =============================================================================
-- ENHANCED TENANT CONTEXT FUNCTION
-- =============================================================================

-- Enhanced function to set user context as well
CREATE OR REPLACE FUNCTION set_user_tenant_context(user_id TEXT, tenant_id TEXT, user_role TEXT DEFAULT 'b2b_user')
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.user_id', user_id, true);
  PERFORM set_config('app.tenant_id', tenant_id, true);
  PERFORM set_config('app.user_role', user_role, true);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VERIFICATION QUERIES (FOR TESTING)
-- =============================================================================

-- Test EUR tenant isolation
-- SELECT set_user_tenant_context('test-user-eur', 'eur', 'b2b_user');
-- SELECT COUNT(*) as eur_products FROM products;
-- SELECT COUNT(*) as eur_cart_items FROM cart_items;
-- SELECT COUNT(*) as eur_license_keys FROM license_keys;

-- Test KM tenant isolation  
-- SELECT set_user_tenant_context('test-user-km', 'km', 'b2b_user');
-- SELECT COUNT(*) as km_products FROM products;
-- SELECT COUNT(*) as km_cart_items FROM cart_items;
-- SELECT COUNT(*) as km_license_keys FROM license_keys;

-- Test admin access
-- SELECT set_user_tenant_context('admin-user', 'admin', 'admin');
-- SELECT COUNT(*) as admin_all_products FROM products;
-- SELECT COUNT(*) as admin_all_cart_items FROM cart_items;
-- SELECT COUNT(*) as admin_all_license_keys FROM license_keys;

-- =============================================================================
-- POLICY DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY tenant_isolation_products ON products IS 
'RLS policy for products: Allows all users to see active products, only admins can modify. Products are shared but tenant-specific pricing applied at application level.';

COMMENT ON POLICY tenant_isolation_categories ON categories IS 
'RLS policy for categories: Shared across tenants for viewing, only admins can modify.';

COMMENT ON POLICY tenant_isolation_license_keys ON license_keys IS 
'RLS policy for license keys: Strict tenant isolation. Users only see keys from their tenant, admins see all.';

COMMENT ON POLICY tenant_isolation_cart_items ON cart_items IS 
'RLS policy for cart items: Users only see their own cart items from their tenant. Complete user+tenant isolation.';