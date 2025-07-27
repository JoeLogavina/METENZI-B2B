# B2B Software License Management Portal

## Overview

This is a full-stack B2B software license management platform built with React, Express, and PostgreSQL. The application provides enterprise customers with a streamlined interface to browse, purchase, and manage software licenses, while offering administrators comprehensive tools for inventory and user management. The system now uses custom username/password authentication and displays all prices in EUR currency.

## Recent Changes (January 2025)
- Migrated from Replit Auth to custom username/password authentication system
- Implemented EUR currency display throughout the application (€790, €1,890, €250, etc.)
- Created admin and B2B user test accounts (admin/Kalendar1, b2buser/Kalendar1)
- Fixed authentication infinite loop and 401 request issues
- Updated all user ID references to work with new authentication system
- Updated color scheme from Coffee Mist to Corporate Gray (#6E6F71) and Spanish Yellow (#FFB20F)
- Applied new color palette throughout admin portal and B2B shop interfaces
- Enhanced visual hierarchy with Spanish Yellow accents for prices, buttons, and active states
- Increased sidebar text and icon sizes by 35% for better visibility
- Changed sidebar text from gray to white for improved contrast
- Updated table headers with new Corporate Gray background color

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Style**: RESTful API with Express routes
- **Session Management**: Express sessions with PostgreSQL storage
- **Authentication**: Replit OpenID Connect (OIDC) integration

### Database Architecture
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: Shared schema definitions between client and server
- **Migrations**: Drizzle Kit for database migrations

## Key Components

### Authentication System
- **Provider**: Custom username/password authentication with Passport.js
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Authorization**: Role-based access control (b2b_user, admin, super_admin)
- **Security**: HTTP-only cookies with secure flags for production
- **Accounts**: admin/Kalendar1 (super_admin), b2buser/Kalendar1 (b2b_user)

### User Interface Components
- **Layout**: Responsive sidebar navigation with role-based menu items
- **Product Catalog**: Filterable product table with search and category filters
- **Shopping Cart**: Modal-based cart with quantity management
- **Admin Panel**: Comprehensive dashboard for administrators

### Data Models
- **Users**: Profile information with role-based permissions
- **Products**: Software licenses with pricing, regions, and platform support
- **Categories**: Product categorization system
- **Orders**: Purchase tracking and order history
- **License Keys**: Digital license key management
- **Cart Items**: Session-based shopping cart functionality

## Data Flow

### Client-Server Communication
- **API Requests**: RESTful endpoints with JSON payloads
- **Authentication**: Session-based auth with automatic redirect handling
- **Error Handling**: Centralized error handling with user-friendly messages
- **State Synchronization**: Optimistic updates with server-side validation

### Database Operations
- **CRUD Operations**: Type-safe database operations through Drizzle ORM
- **Connection Pooling**: Neon serverless connection pooling for scalability
- **Schema Validation**: Zod schemas for runtime type validation
- **Migrations**: Version-controlled schema changes

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **drizzle-orm**: Type-safe ORM for database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI component primitives
- **wouter**: Lightweight React router
- **express**: Web framework for Node.js

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Static type checking
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: Fast JavaScript bundler for production

### Authentication & Security
- **openid-client**: OpenID Connect client implementation
- **passport**: Authentication middleware
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

### Build Process
- **Client Build**: Vite builds React app to `dist/public`
- **Server Build**: ESBuild bundles server code to `dist/index.js`
- **Type Checking**: TypeScript compilation check before build

### Environment Configuration
- **Development**: Hot module replacement with Vite dev server
- **Production**: Static file serving with Express
- **Database**: PostgreSQL connection via DATABASE_URL environment variable
- **Sessions**: Secure session configuration with SESSION_SECRET

### Replit Integration
- **Development Banner**: Replit development environment indicator
- **Cartographer**: Replit-specific development tools integration
- **Runtime Error Overlay**: Development error reporting

The application follows a monorepo structure with shared TypeScript definitions, enabling type safety across the full stack while maintaining clear separation between client and server concerns.