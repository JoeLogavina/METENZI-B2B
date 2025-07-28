-- Enterprise Wallet System with Row-Level Security Setup
-- This script creates proper RLS policies for bulletproof tenant isolation

-- Enable RLS on wallets table
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wallet_transactions table  
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on orders table for wallet calculations
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for wallets table
-- Policy: Users can only access their own tenant's wallet data
CREATE POLICY tenant_wallet_isolation ON wallets
    FOR ALL TO public
    USING (
        tenant_id = current_setting('app.current_tenant', true)
        OR current_setting('app.current_tenant', true) = 'admin'
    );

-- Policy: Admin users can access all wallets
CREATE POLICY admin_wallet_access ON wallets  
    FOR ALL TO public
    USING (
        current_setting('app.user_role', true) IN ('admin', 'super_admin')
    );

-- Create RLS policies for wallet_transactions table
-- Policy: Users can only access transactions for their tenant
CREATE POLICY tenant_transaction_isolation ON wallet_transactions
    FOR ALL TO public
    USING (
        wallet_id IN (
            SELECT id FROM wallets 
            WHERE tenant_id = current_setting('app.current_tenant', true)
        )
        OR current_setting('app.current_tenant', true) = 'admin'
    );

-- Policy: Admin users can access all transactions
CREATE POLICY admin_transaction_access ON wallet_transactions
    FOR ALL TO public  
    USING (
        current_setting('app.user_role', true) IN ('admin', 'super_admin')
    );

-- Create RLS policies for orders table (for wallet balance calculations)
-- Policy: Users can only access orders for their tenant
CREATE POLICY tenant_order_isolation ON orders
    FOR ALL TO public
    USING (
        tenant_id = current_setting('app.current_tenant', true)
        OR current_setting('app.current_tenant', true) = 'admin'
    );

-- Policy: Admin users can access all orders
CREATE POLICY admin_order_access ON orders
    FOR ALL TO public
    USING (
        current_setting('app.user_role', true) IN ('admin', 'super_admin')
    );

-- Create indexes for performance with RLS
CREATE INDEX IF NOT EXISTS idx_wallets_tenant_user ON wallets(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_tenant ON wallet_transactions(wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_user_status ON orders(tenant_id, user_id, status, created_at);

-- Create function to set tenant context in database session
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id text, user_role text)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant', tenant_id, true);
    PERFORM set_config('app.user_role', user_role, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to initialize wallet for user
CREATE OR REPLACE FUNCTION initialize_user_wallet(
    p_user_id text,
    p_tenant_id text,
    p_initial_deposit decimal(10,2) DEFAULT 5000.00,
    p_credit_limit decimal(10,2) DEFAULT 5000.00
)
RETURNS uuid AS $$
DECLARE
    wallet_id uuid;
    transaction_id uuid;
BEGIN
    -- Check if wallet already exists
    SELECT id INTO wallet_id
    FROM wallets 
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
    
    IF wallet_id IS NOT NULL THEN
        RETURN wallet_id;
    END IF;
    
    -- Create new wallet record
    INSERT INTO wallets (user_id, tenant_id, deposit_balance, credit_limit, credit_used)
    VALUES (p_user_id, p_tenant_id, p_initial_deposit, p_credit_limit, 0.00)
    RETURNING id INTO wallet_id;
    
    -- Create initial deposit transaction
    INSERT INTO wallet_transactions (
        wallet_id, user_id, type, amount, balance_after, description
    ) VALUES (
        wallet_id, p_user_id, 'deposit', p_initial_deposit, p_initial_deposit,
        'Initial account deposit for ' || p_tenant_id || ' tenant'
    );
    
    RETURN wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;