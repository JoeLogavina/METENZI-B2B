# B2B Software License Management Portal

## Overview
This project is a full-stack B2B software license management platform. Its main purpose is to provide enterprise customers with a streamlined interface to browse, purchase, and manage software licenses. It also offers administrators comprehensive tools for inventory and user management. Key capabilities include a 3-level hierarchical category system for products, custom pricing per client, and a robust wallet payment system. The business vision is to provide a reliable, high-performance, and scalable solution for B2B software distribution, featuring multi-currency support (EUR and KM) and advanced tenant isolation.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a responsive design with a sidebar navigation. The color scheme uses Corporate Gray (#6E6F71) and Spanish Yellow (#FFB20F) accents for consistency and enhanced visual hierarchy. Prices, buttons, and active states are highlighted in Spanish Yellow. Sidebar text and icons are increased in size and changed to white for improved visibility.

### Technical Implementations
The architecture is a layered system designed for separation of concerns, testability, and scalability.
- **Frontend**: React 18 with TypeScript, Wouter for routing, and TanStack Query for server state management.
- **Backend**: Express.js with TypeScript, implementing RESTful API design.
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations.
- **Authentication**: Custom username/password authentication using Passport.js, with PostgreSQL-backed sessions and role-based access control (b2b_user, admin, super_admin).
- **Tenant Isolation**: Achieved at the application level using explicit `WHERE` clauses in queries and service layer filtering, supporting multi-currency (EUR and KM) shops via URL-based routing.
- **Performance Optimizations**: Includes response compression (gzip/brotli), composite database indexes, intelligent API request batching, component memoization, optimistic UI updates, and Redis caching with in-memory fallback.
- **Error Handling**: Implemented with a typed error hierarchy and centralized handling.
- **Validation**: Middleware-based input validation pipeline.
- **Cart System**: Optimized for ultra-fast operations (15-30ms) bypassing complex event sourcing for direct database interactions.
- **Hierarchical Categories**: A 3-level system implemented using a self-referencing structure with materialized paths for performance and maintainability. Categories include fields like `parentId`, `level`, `path`, and `pathName`.
- **B2B Client Management**: Enhanced user table schema with mandatory B2B fields, custom pricing infrastructure (`user_product_pricing` table), and a comprehensive user editing interface in the admin panel.
- **Order Management**: Features sequential order numbering, fixed license key display synchronization, and robust tenant separation.

### Feature Specifications
- **Authentication System**: Custom username/password, role-based access (b2b_user, admin, super_admin), secure session management.
- **User Interface Components**: Responsive sidebar, filterable product catalog, modal shopping cart, comprehensive admin panel.
- **Data Models**: Users, Products, 3-level Hierarchical Categories, Orders, License Keys, Cart Items.
- **Wallet Payment System**: Fully operational, supporting wallet deduction, balance tracking, transaction history, and priority logic for deposit balance usage.

## External Dependencies

### Core Dependencies
- `@neondatabase/serverless`: PostgreSQL serverless driver
- `drizzle-orm`: Type-safe ORM for database operations
- `@tanstack/react-query`: Server state management
- `@radix-ui/*`: Accessible UI component primitives
- `wouter`: Lightweight React router
- `express`: Web framework for Node.js
- `passport`: Authentication middleware
- `connect-pg-simple`: PostgreSQL session store
- `redis`: For caching layer

### Development Tools
- `Vite`: Build tool and development server
- `TypeScript`: Static type checking
- `Tailwind CSS`: Utility-first CSS framework
- `ESBuild`: Fast JavaScript bundler

### Replit Integration
- Replit development environment indicator
- Replit-specific development tools integration (Cartographer)
- Runtime error overlay