# Active Routes List - All Three Panels

## System Health Routes (3)
```
GET /health
GET /ready  
GET /metrics
```

## Authentication Routes - Shared (3)
```
POST /api/login
POST /api/logout
GET  /api/user
```

## EUR B2B Panel Routes (11)
```
GET    /api/products
GET    /api/products/:id
GET    /api/categories
GET    /api/cart
POST   /api/cart
PATCH  /api/cart/:productId
DELETE /api/cart/:productId
DELETE /api/cart
GET    /api/orders
POST   /api/orders
GET    /api/wallet
GET    /api/wallet/transactions
```

## KM B2B Panel Routes (11) 
```
GET    /api/products
GET    /api/products/:id
GET    /api/categories
GET    /api/cart
POST   /api/cart
PATCH  /api/cart/:productId
DELETE /api/cart/:productId
DELETE /api/cart
GET    /api/orders
POST   /api/orders
GET    /api/wallet
GET    /api/wallet/transactions
```

## Admin Panel Routes (25+)
```
GET    /api/admin/dashboard
GET    /api/admin/products
GET    /api/admin/products/analytics
GET    /api/admin/products/low-stock
GET    /api/admin/products/:id
POST   /api/admin/products
PUT    /api/admin/products/:id
DELETE /api/admin/products/:id
PATCH  /api/admin/products/:id/toggle-status
POST   /api/admin/products/:id/upload-image
GET    /api/admin/users
GET    /api/admin/users/analytics
GET    /api/admin/users/:id
POST   /api/admin/users
PUT    /api/admin/users/:id/role
PATCH  /api/admin/users/:id/deactivate
PATCH  /api/admin/users/:id/reactivate
PATCH  /api/admin/users/:id/status
PATCH  /api/admin/users/:id
GET    /api/admin/license-keys/:productId
POST   /api/admin/license-keys/:productId
DELETE /api/admin/license-keys/key/:keyId
GET    /api/admin/license-keys/:productId/stats
GET    /api/admin/wallets
GET    /api/admin/wallets/:userId/transactions
POST   /api/admin/wallets/transaction
GET    /api/admin/wallets/analytics
GET    /api/categories
POST   /api/categories
```

## Summary
- **Total Active Routes**: 53+
- **EUR B2B**: 14 routes (3 auth + 11 specific)
- **KM B2B**: 14 routes (3 auth + 11 specific)  
- **Admin**: 28+ routes (3 auth + 25+ specific)
- **System**: 3 health monitoring routes