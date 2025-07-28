# Enterprise Multi-Tenant Wallet Architecture Options

## Current Situation Analysis

### **What's Currently Implemented**
- **Hybrid approach**: Same API routes (`/api/wallet`) but tenant-aware data queries
- **Database schema**: Proper `wallets` table with `tenantId` field exists
- **Implementation gap**: Currently calculating balances from orders instead of using wallet records
- **Security**: Fixed tenant isolation (user can only see their tenant's data)

### **Current Issues Identified**
1. **Not using the `wallets` table**: Calculating balances from orders instead of proper wallet records
2. **No actual wallet transactions table usage**: Using mock/calculated data instead of `walletTransactions`
3. **In-memory balance calculation**: Business logic mixed with data access
4. **No proper wallet initialization**: Users don't have actual wallet records

---

## **ENTERPRISE-LEVEL OPTIONS**

### **OPTION 1: Database-First Wallet System** ⭐ **RECOMMENDED**
**Architecture**: Proper enterprise wallet system using existing database schema

#### **Implementation**
- **Wallet Records**: Each user gets actual wallet records in `wallets` table per tenant
- **Transaction Ledger**: All money movements tracked in `walletTransactions` table
- **Balance Calculation**: Real-time balance from transaction history (not order calculations)
- **Audit Trail**: Complete financial audit trail with transaction types

#### **Database Structure**
```sql
wallets: userId + tenantId + depositBalance + creditLimit + creditUsed
walletTransactions: walletId + type + amount + balanceAfter + orderId + adminId
```

#### **API Behavior**
- Same routes (`/api/wallet`, `/api/wallet/transactions`)
- Tenant isolation via database queries
- Real wallet operations (deposit, payment, refund, adjustment)

#### **Pros**
- ✅ Enterprise-grade financial tracking
- ✅ Complete audit trail for compliance
- ✅ Proper double-entry bookkeeping
- ✅ Scalable to multiple currencies/tenants
- ✅ Real-time accurate balances

#### **Cons**
- 🔄 Requires wallet initialization for existing users
- 🔄 Need to migrate from calculated to actual balances

---

### **OPTION 2: Tenant-Specific API Routes**
**Architecture**: Separate API endpoints per tenant

#### **Implementation**
```
EUR Tenant: /api/eur/wallet, /api/eur/wallet/transactions
KM Tenant:  /api/km/wallet, /api/km/wallet/transactions
Admin:      /api/admin/wallets (cross-tenant view)
```

#### **Route Structure**
- **Frontend**: Different API calls based on tenant context
- **Backend**: Tenant-specific route handlers
- **Middleware**: Route-level tenant enforcement

#### **Pros**
- ✅ Explicit tenant separation in URLs
- ✅ Clear API documentation per tenant
- ✅ Easy to add tenant-specific features
- ✅ Natural rate limiting per tenant

#### **Cons**
- ❌ API proliferation (more endpoints to maintain)
- ❌ Frontend complexity (different URLs per tenant)
- ❌ Code duplication in route handlers

---

### **OPTION 3: Microservices-Based Wallet Service**
**Architecture**: Dedicated wallet microservice with tenant context

#### **Implementation**
- **Wallet Service**: Dedicated service handling all wallet operations
- **Multi-tenant**: Service handles tenant context internally
- **Event-driven**: Wallet events (payment, deposit) via message queues
- **API Gateway**: Route `/api/wallet/*` to wallet service

#### **Service Structure**
```
Main App → API Gateway → Wallet Service → Tenant-specific DB
```

#### **Pros**
- ✅ Complete separation of financial logic
- ✅ Independent scaling of wallet operations
- ✅ Event-driven architecture for real-time updates
- ✅ Service-level security and compliance

#### **Cons**
- ❌ High complexity for current scale
- ❌ Infrastructure overhead (messaging, service discovery)
- ❌ Network latency between services

---

### **OPTION 4: Schema-Based Multi-tenancy**
**Architecture**: Database schemas per tenant with unified API

#### **Implementation**
- **Database**: Separate schemas (`eur_schema`, `km_schema`) in same DB
- **Connection**: Dynamic schema switching based on tenant context
- **API**: Same routes, different database schemas
- **Isolation**: Complete database-level separation

#### **Schema Structure**
```
Database:
├── eur_schema (wallets, wallet_transactions, orders)
├── km_schema  (wallets, wallet_transactions, orders)
└── shared     (users, products, categories)
```

#### **Pros**
- ✅ Complete data isolation at database level
- ✅ Same API routes (clean frontend)
- ✅ Easy to backup/restore per tenant
- ✅ Natural compliance boundaries

#### **Cons**
- ❌ Complex migration from current single-schema setup  
- ❌ Schema management overhead
- ❌ Potential connection pool complications

---

### **OPTION 5: Row-Level Security (RLS)**
**Architecture**: PostgreSQL row-level security for tenant isolation

#### **Implementation**
- **RLS Policies**: Database-enforced tenant filtering
- **Security Context**: Set tenant context in database session
- **Automatic Filtering**: All queries automatically tenant-filtered
- **Zero Trust**: Database enforces isolation, not application code

#### **RLS Policy Example**
```sql
CREATE POLICY tenant_isolation ON wallets 
FOR ALL TO app_user 
USING (tenant_id = current_setting('app.current_tenant'));
```

#### **Pros**
- ✅ Database-enforced security (unhackable tenant isolation)
- ✅ Same API routes and application code
- ✅ Automatic tenant filtering on all queries
- ✅ Zero possibility of cross-tenant data leaks

#### **Cons**
- ❌ PostgreSQL-specific feature
- ❌ Debugging complexity (invisible filtering)
- ❌ Performance considerations with complex policies

---

## **COMPARISON MATRIX**

| Option | Complexity | Security | Scalability | Maintenance | Enterprise Ready |
|--------|------------|----------|-------------|-------------|------------------|
| **Database-First** | Medium | High | High | Low | ⭐⭐⭐⭐⭐ |
| **Tenant Routes** | Low | High | Medium | High | ⭐⭐⭐ |
| **Microservices** | Very High | Very High | Very High | High | ⭐⭐⭐⭐ |
| **Schema-Based** | High | Very High | High | Medium | ⭐⭐⭐⭐ |
| **Row-Level Security** | Medium | Very High | High | Low | ⭐⭐⭐⭐⭐ |

---

## **RECOMMENDATION: OPTION 1 + OPTION 5 HYBRID**

### **Why This Combination**
1. **Database-First Wallet System**: Proper enterprise financial tracking
2. **Row-Level Security**: Bulletproof tenant isolation enforced by database
3. **Same API Routes**: Clean architecture, no frontend changes needed
4. **Enterprise-Grade**: Audit trails, compliance-ready, scalable

### **Implementation Path**
1. **Phase 1**: Create actual wallet records for existing users
2. **Phase 2**: Implement proper wallet transactions table usage  
3. **Phase 3**: Add RLS policies for additional security layer
4. **Phase 4**: Migration from calculated to transaction-based balances

### **Migration Strategy**
- Keep current API routes (no breaking changes)
- Gradually migrate from calculated to actual wallet records
- Maintain backward compatibility during transition
- Add RLS as additional security layer

---

## **DECISION POINTS**

### **Critical Questions**
1. **Data Migration**: How to handle existing user balances during migration?
2. **Currency Handling**: Should KM and EUR have different starting balances/limits?
3. **Admin Access**: Should admins see unified view or tenant-specific views?
4. **Audit Requirements**: What level of financial audit trail is needed?
5. **Performance**: What's the expected transaction volume per tenant?

### **Business Considerations**
- **Compliance**: Are there financial regulations requiring specific audit trails?
- **Multi-Currency**: Will you add more currencies beyond EUR/KM?
- **Scaling**: How many tenants are expected in the future?
- **Integration**: Will wallets integrate with external payment systems?

Please let me know which option resonates with your enterprise requirements, and I'll implement the chosen solution.