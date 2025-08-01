# B2B Software License Management Portal

## Overview
This is a full-stack B2B software license management platform. It provides enterprise customers with an interface to browse, purchase, and manage software licenses, and offers administrators tools for inventory and user management. The system uses custom username/password authentication and displays all prices in EUR currency. Key capabilities include a 3-level hierarchical category system, comprehensive B2B client management with custom pricing, and robust order processing with sequential numbering and shared license key pools. The project aims to provide a streamlined, high-performance, and secure solution for B2B software distribution.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a responsive design with a sidebar navigation. The color scheme uses Corporate Gray (#6E6F71) and Spanish Yellow (#FFB20F) for accents, prices, buttons, and active states. Sidebar text and icon sizes are increased for visibility, and text color is white for improved contrast. Tables use Corporate Gray backgrounds for headers.

### Technical Implementations
The system is built with a layered architecture, separating concerns into Controller, Service, and Repository layers for improved testability and maintainability. It incorporates advanced security features, comprehensive error handling with typed error hierarchies, and a middleware-based validation pipeline for consistent data validation.

Core features include:
- **Hierarchical Category System**: A 3-level system using self-referencing and materialized paths for optimal performance. Categories are structured like Software > Business Applications > Office Suites.
- **B2B Client Management**: Extended user profiles with B2B-specific fields, custom per-client product pricing, real-time wallet management, and comprehensive transaction tracking.
- **Order Management**: Sequential order numbering, robust tenant isolation at the application level, and precise license key display and management.
- **Wallet Payment System**: Fully functional wallet deduction logic, prioritizing deposit balance before credit limits, and detailed transaction history.
- **Authentication**: Custom username/password authentication with Passport.js, PostgreSQL-backed sessions, and role-based access control.

### Feature Specifications
- **Multi-Tenant Support**: URL-based tenant resolution supporting EUR and KM shops with currency-specific pricing and unified admin panel management.
- **Performance Optimizations**: Aggressive caching strategies (Redis with in-memory fallback, Cache-Aside pattern), optimized database queries with composite indexes, response compression (gzip/brotli), request batching, and React component memoization.
- **Code Splitting & Lazy Loading**: Route-based lazy loading for all private routes and heavy components, with intelligent preloading and professional loading states for faster initial load times.
- **Production Readiness**: Extensive code cleanup, removal of debug logs and temporary files, and resolution of all TypeScript errors.

### System Design Choices
- **Frontend**: React 18 with TypeScript, Wouter for routing, and TanStack Query for server state management.
- **Backend**: Express.js with TypeScript, following a RESTful API design.
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations. Utilizes Neon serverless driver for scalability.
- **Testing**: Comprehensive automated test suite covering unit, integration, and end-to-end workflows, including security and permission testing.
- **Containerization**: Production-ready Docker containerization with multi-stage builds and Docker Compose orchestration.

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
- `ESBuild`: Fast JavaScript bundler for production