# B2B License Management - Microservices Architecture

## Overview

This project has been refactored into a microservices architecture with three separate services:

1. **Admin Service** (Port 5001) - Dedicated admin portal for management
2. **B2B Service** (Port 5002) - Customer-facing B2B portal
3. **Core API Service** (Port 5003) - Shared business logic and database access

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Environment variables configured

## Setup Instructions

### 1. Install Dependencies

From the root project directory:
```bash
# Install main dependencies
npm install

# Install service dependencies
cd services/admin-service && npm install
cd ../b2b-service && npm install
cd ../core-api-service && npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` in the services directory:
```bash
cd services
cp .env.example .env
```

Update the following variables:
- `DATABASE_URL` - Your PostgreSQL connection string
- `INTERNAL_SERVICE_KEY` - Change from default in production
- Session secrets for both portals

### 3. Run Microservices

#### Option A: Run All Services (Recommended)
```bash
cd services
./run-all.sh
```

#### Option B: Run Individual Services
```bash
# Terminal 1 - Core API (must start first)
cd services/core-api-service
npm run dev

# Terminal 2 - Admin Service
cd services/admin-service
npm run dev

# Terminal 3 - B2B Service
cd services/b2b-service
npm run dev
```

## Service URLs

- **Admin Portal**: http://localhost:5001
- **B2B Portal**: http://localhost:5002
- **Core API**: http://localhost:5003/health

## Architecture Benefits

### 1. Complete Isolation
- Separate authentication systems
- Independent session management
- Isolated security contexts

### 2. Independent Scaling
- Scale admin and B2B services separately
- Core API can be scaled based on load
- Different resource allocation per service

### 3. Enhanced Security
- Admin portal completely separated from customer access
- Service-to-service authentication
- Role-based middleware per service

### 4. Independent Deployment
- Deploy admin updates without affecting B2B users
- Roll back individual services
- A/B testing per service

## API Structure

### Admin Service Routes
- `/api/admin/auth/*` - Admin authentication
- `/api/admin/dashboard/*` - Dashboard statistics
- `/api/admin/products/*` - Product management
- `/api/admin/users/*` - User management
- `/api/admin/orders/*` - Order management
- `/api/admin/license-keys/*` - License key management

### B2B Service Routes
- `/api/auth/*` - B2B user authentication
- `/api/products/*` - Product browsing
- `/api/cart/*` - Shopping cart
- `/api/checkout/*` - Checkout process
- `/api/orders/*` - Order history

### Core API Routes (Internal Only)
- `/api/core/products/*` - Product CRUD
- `/api/core/users/*` - User CRUD
- `/api/core/orders/*` - Order processing
- `/api/core/licenses/*` - License management
- `/api/core/categories/*` - Category management

## Security

1. **Inter-Service Authentication**: All requests between services require `X-Service-Auth` header
2. **Session Isolation**: Separate session stores for admin and B2B
3. **CORS Configuration**: Restricted to specific service origins
4. **Role-Based Access**: Enforced at service level

## Development Tips

1. Always start Core API service first
2. Check service health endpoints before testing
3. Use separate browser profiles for admin and B2B testing
4. Monitor all service logs during development

## Production Considerations

1. Use proper service discovery (Consul, etcd)
2. Implement API Gateway (Kong, Traefik)
3. Add rate limiting per service
4. Set up monitoring (Prometheus, Grafana)
5. Use container orchestration (Kubernetes, Docker Swarm)