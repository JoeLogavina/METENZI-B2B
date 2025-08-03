# B2B Software License Management Portal

## Overview
This project is a full-stack B2B software license management platform. Its purpose is to provide enterprise customers with an interface to browse, purchase, and manage software licenses, while offering administrators tools for inventory and user management. Key capabilities include a 3-level hierarchical category system, comprehensive B2B client management with custom pricing, and robust order processing with sequential numbering and shared license key pools. The platform aims to be a streamlined, high-performance, and secure solution for B2B software distribution, using custom username/password authentication and displaying all prices in EUR.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a responsive design with a sidebar navigation. The color scheme uses Corporate Gray (#6E6F71) and Spanish Yellow (#FFB20F) for accents, prices, buttons, and active states. Sidebar text and icon sizes are increased for visibility, and text color is white for improved contrast. Tables use Corporate Gray backgrounds for headers.

### Technical Implementations
The system is built with a layered architecture (Controller, Service, Repository) for improved testability and maintainability. It incorporates advanced security features, comprehensive error handling with typed error hierarchies, and a middleware-based validation pipeline.

Core features include:
- **Hierarchical Category System**: A 3-level system using self-referencing and materialized paths.
- **B2B Client Management**: Extended user profiles with B2B-specific fields, custom per-client product pricing, real-time wallet management, and comprehensive transaction tracking.
- **Order Management**: Sequential order numbering, robust tenant isolation, and precise license key display and management.
- **Wallet Payment System**: Fully functional wallet deduction logic, prioritizing deposit balance before credit limits, and detailed transaction history.
- **Authentication**: Custom username/password authentication with Passport.js, PostgreSQL-backed sessions, and role-based access control.

Advanced security framework features:
- **Enhanced Key Management**: Enterprise-grade encryption key derivation and management using PBKDF2 with AES-256-GCM encryption for license keys.
- **Token Management**: Multi-type JWT tokens (Session, API, Refresh, CSRF, Admin, B2B) with Redis persistence, device fingerprinting, and IP tracking.
- **Advanced Security Features**: Fraud detection system with real-time threat analysis, IP-based rate limiting, and behavioral pattern recognition. Enterprise-grade 2FA for admin.
- **Secure Downloads**: One-time use download tokens with fraud protection and IP whitelisting.
- **Authentication & Authorization**: Multi-factor authentication with TOTP, account lockout, device fingerprinting, and comprehensive Role-Based Access Control (RBAC).
- **API Security & Rate Limiting**: Multi-layer protection with DDoS detection, request validation, payload size limits, and Redis-backed distributed rate limiting.
- **SSL/TLS Security & Audit Logging**: HTTPS enforcement, HSTS, CSP, comprehensive security headers, and a 10-category audit system with 7-year retention.

Other technical implementations:
- **Enterprise Image Management System**: Hybrid database and file system for image storage with metadata tracking, organized file structure, and automatic thumbnail generation.
- **Multi-Tenant Support**: URL-based tenant resolution supporting EUR and KM shops with currency-specific pricing.
- **Performance Optimizations**: Critical performance indexes, single-query JSON aggregation, multi-layer caching with Redis, and optimized API endpoints.
- **Code Splitting & Lazy Loading**: Route-based lazy loading for private routes and heavy components.
- **Production Readiness**: Enterprise-grade structured logging with Winston, and comprehensive performance monitoring.
- **SKU Format Enhancement**: SKU generation uses "SKU-12345" format.

### System Design Choices
- **Frontend**: React 18 with TypeScript, Wouter for routing, and TanStack Query for server state management.
- **Backend**: Express.js with TypeScript, following a RESTful API design.
- **Database**: PostgreSQL with Drizzle ORM, utilizing Neon serverless driver.
- **Testing**: Comprehensive automated test suite covering unit, integration, and end-to-end workflows.
- **Containerization**: Production-ready Docker containerization with multi-stage builds and Docker Compose.

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
- `redis`: Caching layer

### Development Tools
- `Vite`: Build tool and development server
- `TypeScript`: Static type checking
- `Tailwind CSS`: Utility-first CSS framework
- `ESBuild`: Fast JavaScript bundler for production