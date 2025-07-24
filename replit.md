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
- **Story 2 - Database Setup**: ✅ COMPLETED (July 22, 2025)
  - SQLite3 database with comprehensive schema design  
  - Driver management with CRUD operations
  - Connection pooling and health monitoring
  - Database seeding with test data
- **Story 3 - JWT Authentication**: ✅ COMPLETED (July 23, 2025)
  - JWT-based authentication with 24-hour token expiration
  - bcryptjs password hashing with 10+ rounds security
  - Flexible identifier support (phone, email, name)
  - Auto-registration for new users with proper password storage
  - Protected route middleware with Bearer token validation
  - Complete authentication endpoints: login, register, me, create-test-account
  - Test account: +1234567890 / password123
  - CRITICAL SECURITY BUGS FIXED (July 23, 2025):
    ★ Password storage failure - all new users now properly store password_hash
    ★ Duplicate user creation - identifiers now properly authenticate existing users
    ★ Auto-registration logic - creates user once, authenticates thereafter
    ★ Database pollution prevention - no more infinite user duplication
    ★ Security vulnerabilities eliminated - all users have password protection
- **Story 4 - Driver Dashboard & Status**: ✅ COMPLETED (July 23, 2025)
  - HTML dashboard at root route (/) with Material Design-inspired UI
  - GET /api/driver/status endpoint with shift detection logic
  - Active shift detection (checks clock_out_time IS NULL)
  - Real-time status display (clocked_in/clocked_out)
  - Authentication integration with JWT token validation
  - Mobile-friendly responsive design with auto-refresh
  - Comprehensive error handling for unauthorized access
  - Driver profile and status information display
- **Story 5 - Clock In Functionality**: ✅ COMPLETED (July 23, 2025)
  - POST /api/driver/clock-in endpoint with comprehensive validation
  - Odometer reading validation against previous shifts (continuity)
  - Active shift prevention (one shift per driver validation)
  - Dynamic dashboard forms (show/hide clock-in/clock-out)
  - IST timestamp recording with proper error handling
  - Shift tracking with database integration and business logic
- **Story 6 - Clock Out Functionality**: ✅ COMPLETED (July 23, 2025)
  - POST /api/driver/clock-out endpoint with validation and calculations
  - End odometer validation (required, numeric, ≥ start odometer)
  - Automatic shift duration calculation (IST timestamps in minutes)
  - Total distance calculation (end - start odometer)
  - Shift completion (clock_out_time, status = 'completed')
  - Only active shift can be clocked out validation
  - Dynamic UI forms switching between clock-in/clock-out
  - Dashboard status updates automatically after clock-out
  - Complete shift tracking cycle with proper error handling
- **Story 7 - Shift History & Reports**: ✅ COMPLETED (July 24, 2025)
  - Daily shift filtering: GET /api/driver/shifts/daily/:date with pagination
  - Weekly shift filtering: GET /api/driver/shifts/weekly/:year/:week with date range
  - Monthly shift filtering: GET /api/driver/shifts/monthly/:year/:month with comprehensive stats
  - Export functionality: JSON and CSV formats with date range filtering
  - Pagination system: 20-50 items per page with next/prev navigation
  - Summary statistics: total shifts, hours, distance, working days, averages
  - Complete frontend UI: date filters, sortable tables, export buttons
  - CRITICAL BUG FIXED: Database connection issues resolved (dbConnection.all → dbConnection.query)
  - Real-time data display with proper IST formatting and comprehensive error handling
- **Story 9 - Payroll Configuration**: ✅ COMPLETED (July 24, 2025)
  - Complete payroll database with audit trail and change tracking
  - Admin API endpoints: GET/POST /api/admin/payroll-config, history, impact analysis
  - Professional admin panel at /admin with Material Design interface and tabbed navigation
  - Configuration validation: salary ₹1,000-₹5,00,000, overtime ₹10-₹1,000, fuel ₹1-₹500
  - Real-time Preview Impact feature with percentage change calculation and significance flagging (>20%)
  - Complete audit trail system with timestamps, user tracking, and mandatory change notes
  - Enhanced validation: Notes field becomes mandatory when configuration values change
  - Client and server-side validation with proper error handling and user feedback
  - Mobile-responsive design with real-time form validation and visual feedback
  - IST timezone conversion: All timestamps properly display in Indian Standard Time (UTC+5:30)
  - Professional timestamp formatting: DD/MM/YYYY, HH:MM:SS AM/PM IST format using Intl.DateTimeFormat
  - Ready for integration with payroll calculation systems
- **Real-time Features**: Polling-based updates, WebSocket ready for enhancement
- **Production Deployment**: Build configuration complete, hosting platform TBD

### Recent Changes
- **July 24, 2025**: Comprehensive Driver Dashboard Enhancement
  - **IST Timezone Fix**: Universal convertToIST() functions added to all driver endpoints
  - **Enhanced Table Design**: Scrollable table (max-height: 400px) with sticky headers
  - **Advanced Pagination**: 10/20/50 per page with comprehensive navigation controls
  - **Filter System**: Today/Week/Month/All filters with dynamic UI controls
  - **Status Badges**: Color-coded badges for active/completed shifts
  - **Loading States**: Professional spinner and error handling
  - **Mobile Responsive**: Enhanced mobile layout with horizontal scroll
  - **Auto-refresh**: 30-second dashboard updates with intelligent shift data refresh
  - **Export Enhancement**: CSV/JSON export with proper IST timestamps
  - All timestamps now display in IST format with proper AM/PM notation
- **July 22, 2025**: Enhanced index.js server foundation
  - Added comprehensive CORS configuration supporting development and production origins
  - Implemented enhanced request/response logging with color-coded status codes
  - Added robust error handling middleware with detailed error responses
  - Configured body parsing with increased limits (10mb)
  - Added graceful shutdown handlers for SIGTERM and SIGINT
  - Implemented enhanced health check endpoint with system metrics
  - Added server error handling and port conflict detection