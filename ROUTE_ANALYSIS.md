# API Routes Analysis - Multi-Tenant B2B Platform

## Overview
This document analyzes all API routes used by the three main panels: Admin Panel, EUR B2B Panel, and KM B2B Panel.

## Current Route Structure

### 1. Health & Monitoring Routes
- `GET /health` - System health check
- `GET /ready` - Readiness probe  
- `GET /metrics` - Performance metrics
**Used by**: Infrastructure monitoring (not user panels)

### 2. Authentication Routes
- `POST /api/login` - User authentication
- `GET /api/user` - Get current user info
- `POST /api/logout` - User logout
**Used by**: All three panels (shared)

### 3. Product Management Routes
- `GET /api/products` - Get products list (tenant-aware)
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (admin only)
- `PUT /api/products/:id` - Update product (admin only)
- `PATCH /api/products/:id/status` - Toggle product status (admin only)
**Used by**: 
- EUR Panel: `GET /api/products` (with EUR pricing)
- KM Panel: `GET /api/products` (with KM pricing)  
- Admin Panel: All methods (full CRUD)

### 4. Category Management Routes
- `GET /api/categories` - Get categories list
- `POST /api/categories` - Create category (admin only)
**Used by**: All three panels for filtering

### 5. License Key Management Routes
- `GET /api/license-keys` - Get license keys for product (admin only)
- `POST /api/license-keys` - Create license key (admin only) 
- `DELETE /api/license-keys/:id` - Delete license key (admin only)
**Used by**: Admin Panel only

### 6. Cart Management Routes
- `GET /api/cart` - Get user's cart items (tenant-aware)
- `POST /api/cart` - Add item to cart (tenant-aware)
- `PATCH /api/cart/:productId` - Update cart item quantity
- `DELETE /api/cart/:productId` - Remove item from cart
- `DELETE /api/cart` - Clear entire cart (tenant-aware)
**Used by**: 
- EUR Panel: All methods (EUR tenant context)
- KM Panel: All methods (KM tenant context)
- Admin Panel: Not used

### 7. Order Management Routes
- `GET /api/orders` - Get user's orders (tenant-aware)
- `POST /api/orders` - Create new order (tenant-aware)
**Used by**:
- EUR Panel: Both methods (EUR tenant context)
- KM Panel: Both methods (KM tenant context)  
- Admin Panel: `GET /api/orders` (all orders, cross-tenant)

### 8. Wallet Management Routes
- `GET /api/wallet` - Get user's wallet balance
- `GET /api/wallet/transactions` - Get wallet transaction history
- `POST /api/wallet/transactions` - Create wallet transaction (admin only)
**Used by**:
- EUR Panel: GET methods (EUR wallet)
- KM Panel: GET methods (KM wallet)
- Admin Panel: All methods (wallet management)

### 9. Admin-Specific Routes (via /admin routes)
- `GET /api/admin/products` - Admin product management
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product  
- `GET /api/admin/users` - User management
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id/role` - Update user role
- `PATCH /api/admin/users/:id/status` - Toggle user status
**Used by**: Admin Panel only

## Issues Identified

### 1. **DUPLICATE ROUTE DEFINITIONS** ✅ **FIXED**
**Problem**: `GET /api/products` was defined twice in server/routes.ts
- Line 128: First definition (basic) - **REMOVED**
- Line 376: Second definition (with tenant middleware) - **KEPT**

**Impact**: The second definition was overriding the first, causing confusion

**Solution**: ✅ Removed the duplicate basic definition, keeping only the tenant-aware version

### 2. **UNUSED ROUTES** ⚠️
**Potentially Unused**:
- `GET /api/products/:id` - Single product view (not found in frontend)
- Some admin license key routes may have redundant endpoints

### 3. **INCONSISTENT TENANT HANDLING** ⚠️
**Problem**: Some routes handle tenant context differently
- Cart routes: Manual tenant ID extraction
- Product routes: Middleware-based tenant handling
- Order routes: Mixed approach

**Solution**: Standardize tenant handling approach

### 4. **MISSING ROUTE PROTECTION** ⚠️
**Problem**: Some admin routes may lack proper role validation
- License key routes check roles inline
- Other admin routes use middleware

**Solution**: Consistent middleware-based protection

## Panel-Specific Route Usage

### EUR B2B Panel Routes
```
Authentication: /api/login, /api/user, /api/logout
Products: GET /api/products (EUR pricing)
Categories: GET /api/categories  
Cart: /api/cart/* (EUR tenant)
Orders: /api/orders (EUR tenant)
Wallet: /api/wallet, /api/wallet/transactions (EUR)
```

### KM B2B Panel Routes  
```
Authentication: /api/login, /api/user, /api/logout
Products: GET /api/products (KM pricing)
Categories: GET /api/categories
Cart: /api/cart/* (KM tenant)  
Orders: /api/orders (KM tenant)
Wallet: /api/wallet, /api/wallet/transactions (KM)
```

### Admin Panel Routes
```
Authentication: /api/login, /api/user, /api/logout
Products: /api/admin/products/* (all methods)
Users: /api/admin/users/* (all methods)
License Keys: /api/admin/license-keys/* (all methods)
Orders: GET /api/orders (all tenants)
Wallet: /api/admin/wallets/* (all methods)
Categories: /api/categories (GET/POST)
```

## Recommendations

### 1. **Clean Up Duplicate Routes**
- Remove duplicate `GET /api/products` definition
- Consolidate route handling logic

### 2. **Standardize Tenant Middleware**
- Apply consistent tenant resolution across all routes
- Use middleware instead of inline tenant handling

### 3. **Optimize Route Structure**
- Group related routes by functionality
- Use consistent naming patterns
- Implement proper route versioning if needed

### 4. **Improve Route Protection**
- Standardize admin role checking via middleware
- Add tenant isolation validation where needed
- Implement consistent error handling

### 5. **Performance Optimization**
- Review cache middleware application
- Ensure proper cache invalidation patterns
- Optimize database queries for multi-tenant scenarios