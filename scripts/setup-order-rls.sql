-- PostgreSQL RLS (Row Level Security) setup for Orders and Order Items
-- This provides enterprise-level tenant isolation following the same pattern as the wallet system

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Enable RLS on order_items table
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running the script)
DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
DROP POLICY IF EXISTS tenant_isolation_order_items ON order_items;

-- Create tenant isolation policy for orders
-- This policy ensures users can only see orders from their own tenant
CREATE POLICY tenant_isolation_orders ON orders
  FOR ALL
  TO PUBLIC
  USING (
    CASE 
      -- Admin users can see all orders across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can only see orders from their tenant
      ELSE tenant_id = current_setting('app.tenant_id', true)
    END
  )
  WITH CHECK (
    CASE
      -- Admin users can modify orders across all tenants  
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can only modify orders from their tenant
      ELSE tenant_id = current_setting('app.tenant_id', true)
    END
  );

-- Create tenant isolation policy for order_items
-- This policy ensures order items are also properly isolated by tenant
CREATE POLICY tenant_isolation_order_items ON order_items
  FOR ALL
  TO PUBLIC
  USING (
    CASE
      -- Admin users can see all order items across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can only see order items from orders in their tenant
      ELSE EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND orders.tenant_id = current_setting('app.tenant_id', true)
      )
    END
  )
  WITH CHECK (
    CASE
      -- Admin users can modify order items across all tenants
      WHEN current_setting('app.user_role', true) IN ('admin', 'super_admin') THEN true
      -- Regular users can only modify order items from orders in their tenant
      ELSE EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND orders.tenant_id = current_setting('app.tenant_id', true)
      )
    END
  );

-- Verification queries to test tenant isolation
-- These can be used to verify the RLS policies are working correctly

-- Test 1: Verify EUR tenant can only see EUR orders
-- SELECT set_tenant_context('eur', 'b2b_user');
-- SELECT order_number, tenant_id, final_amount FROM orders;

-- Test 2: Verify KM tenant can only see KM orders  
-- SELECT set_tenant_context('km', 'b2b_user');
-- SELECT order_number, tenant_id, final_amount FROM orders;

-- Test 3: Verify admin can see all orders
-- SELECT set_tenant_context('admin', 'admin');
-- SELECT order_number, tenant_id, final_amount FROM orders;

-- Create indexes for performance optimization
-- These indexes will improve query performance for tenant-filtered queries
CREATE INDEX IF NOT EXISTS idx_orders_tenant_user ON orders(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order ON order_items(order_id);

COMMENT ON POLICY tenant_isolation_orders ON orders IS 
'Enterprise RLS policy ensuring orders are isolated by tenant. Admin users can access all tenants, regular users only see their tenant.';

COMMENT ON POLICY tenant_isolation_order_items ON order_items IS 
'Enterprise RLS policy ensuring order items are isolated by tenant through their parent order relationship.';