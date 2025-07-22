# Driver Log Pro - Enterprise System

## Overview

Driver Log Pro is a full-stack web application for managing driver time logs and payroll in a transportation/logistics company. The system provides real-time monitoring of driver status, automated time tracking, and comprehensive payroll management with a Material Design-inspired interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query (React Query) for server state
- **UI Framework**: Radix UI primitives with custom styling
- **Styling**: Tailwind CSS with Material Design-inspired design system
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API endpoints
- **Data Storage**: In-memory storage with interface for database abstraction
- **Session Management**: Express sessions with PostgreSQL store support

### Design System
- **Component Library**: Shadcn/ui components built on Radix UI
- **Theme**: Material Design 3 inspired with custom CSS variables
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Icons**: Lucide React icon library

## Key Components

### Data Models
- **Users**: Authentication and role management (driver, admin, manager)
- **Drivers**: Core driver information with status tracking
- **Driver Logs**: Time tracking entries with activity logging
- **Payroll Records**: Weekly payroll calculations with overtime support
- **System Metrics**: Dashboard analytics and system health monitoring

### Core Features
1. **Real-time Dashboard**: Live driver status monitoring with metrics grid
2. **Driver Management**: CRUD operations for driver profiles
3. **Time Logging**: Automatic and manual time entry with status tracking
4. **Payroll Processing**: Automated weekly payroll with overtime calculations
5. **System Health**: Monitoring and metrics for system performance

### UI Components
- **Navigation Drawer**: Persistent sidebar navigation with Material Design styling
- **Top App Bar**: Header with system status and action buttons
- **Data Tables**: Sortable, filterable tables for drivers and logs
- **Metrics Cards**: Real-time dashboard widgets with status indicators
- **Forms**: Accessible forms with validation using React Hook Form

## Data Flow

### Client-Server Communication
1. **API Requests**: RESTful endpoints with JSON payloads
2. **Error Handling**: Centralized error handling with toast notifications
3. **Loading States**: React Query manages loading and caching states
4. **Real-time Updates**: Polling-based updates for dashboard metrics

### State Management
- **Server State**: TanStack Query with automatic caching and invalidation
- **Local State**: React hooks for component-level state
- **Form State**: React Hook Form with Zod validation schemas
- **UI State**: Local component state for modals, dropdowns, etc.

## External Dependencies

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Connection**: Neon Database serverless PostgreSQL
- **Migrations**: Drizzle Kit for schema management
- **Session Store**: PostgreSQL-based session storage

### Authentication
- **Strategy**: Session-based authentication (prepared for implementation)
- **Password Security**: Bcrypt hashing (schema ready)
- **Role-based Access**: User roles with permission levels

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Feather-style icon library
- **Date-fns**: Date manipulation and formatting

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express backend
- **Hot Reload**: Automatic browser refresh on file changes
- **Type Checking**: TypeScript compilation with strict mode
- **Database**: Local PostgreSQL or Neon Database connection

### Production Build
- **Frontend**: Vite build with static asset optimization
- **Backend**: ESBuild compilation to single bundle
- **Environment**: Node.js production server
- **Database**: PostgreSQL with connection pooling

### Build Process
1. **Frontend Build**: `vite build` creates optimized static assets
2. **Backend Build**: `esbuild` bundles server code with external packages
3. **Type Checking**: `tsc` validates TypeScript without emitting files
4. **Database Migration**: `drizzle-kit push` applies schema changes

### Current Implementation Status
- **Story 1 - Project Setup**: ✅ COMPLETED (July 22, 2025)
  - Enhanced Express.js server with CORS, error handling, and comprehensive logging
  - Environment variable support with dotenv configuration
  - Health check endpoint with detailed system information
  - Global error middleware with development/production modes
  - 404 handling for unmatched routes
  - Graceful shutdown handling and server error management
- **Storage Layer**: In-memory implementation with database interface ready
- **Authentication**: Schema and routes prepared, implementation pending
- **Real-time Features**: Polling-based updates, WebSocket ready for enhancement
- **Production Deployment**: Build configuration complete, hosting platform TBD

### Recent Changes
- **July 22, 2025**: Enhanced index.js server foundation
  - Added comprehensive CORS configuration supporting development and production origins
  - Implemented enhanced request/response logging with color-coded status codes
  - Added robust error handling middleware with detailed error responses
  - Configured body parsing with increased limits (10mb)
  - Added graceful shutdown handlers for SIGTERM and SIGINT
  - Implemented enhanced health check endpoint with system metrics
  - Added server error handling and port conflict detection