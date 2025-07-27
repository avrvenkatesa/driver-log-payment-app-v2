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
- **Story 12 - Leave Management Foundation**: ✅ COMPLETED & FULLY VERIFIED (July 26, 2025)
  - Comprehensive leave management system with database schema and API endpoints
  - Annual leave balance tracking (12 days per year) with used/remaining calculations
  - Leave request submission with validation (annual, sick, emergency types)
  - Leave history retrieval by year with status tracking (pending, approved, rejected, cancelled)
  - Professional UI integration with Material Design-inspired leave management section
  - Database-driven leave tracking with IST timezone support and proper RBAC security
  - Complete CRUD operations: submit requests, view balance, track history, validation rules
  - Real-time balance updates and comprehensive leave request management workflow
  - **UI Integration Verified**: Professional leave management interface with balance cards, submission forms, and history display working perfectly
  - **Validation Enhancement**: Reason field now mandatory with both client-side and server-side validation for proper leave documentation
  - **Cancellation System Enhancement**: ✅ COMPLETED & TESTED (July 26, 2025)
    - Driver 24-hour cancellation window with automatic eligibility checking
    - Admin override cancellation capability for any leave request regardless of timing
    - Complete admin cancellation API endpoint with proper RBAC security
    - Database support for cancellation tracking with timestamps and reasons
    - UI cancel buttons with confirmation dialogs and proper error handling
    - Automatic leave balance restoration for cancelled annual leave requests
    - Comprehensive cancellation logging and audit trail
- **Story 11 - Overtime Calculation**: ✅ COMPLETED (July 26, 2025)
  - Sophisticated overtime detection rules with Sunday/early morning/late evening calculations
  - Enhanced PayrollCalculator with comprehensive overtime analysis and detailed breakdowns
  - Professional API responses with overtime rules documentation and shift analysis
  - Complete integration with existing Story 10 basic payroll calculation system
  - Sunday work (all hours overtime), early morning (<8AM), and late evening (>8PM) detection
  - Detailed overtime breakdown with earnings calculation using configurable overtime rates
- **Story 10 - Basic Payroll Calculation**: ✅ COMPLETED (July 26, 2025)
  - Individual driver payroll calculation with comprehensive business logic
  - Bulk payroll processing for all drivers with parallel calculation support
  - Payroll summary analytics with detailed statistics and breakdowns
  - RBAC-secured admin endpoints with proper access control
  - Database integration with existing shift data and payroll configuration
  - IST timezone conversion and professional JSON API responses
  - Real-time calculation processing with graceful error handling
  - Integration with existing authentication and configuration systems
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
- **July 27, 2025**: Deployment Configuration Fixes - COMPLETED
  - **Production Environment Detection**: Added robust production/development environment detection with `isProduction` flag
  - **Enhanced CORS Configuration**: Added support for Replit deployment domains (.replit.app, .repl.co) with fallback policies
  - **Production Logging Optimization**: Reduced logging verbosity in production (errors only) while maintaining full debug logging in development
  - **Server Binding Fix**: Confirmed server properly listens on `0.0.0.0:PORT` for external access (required for deployment)
  - **Production Monitoring**: Added memory usage monitoring for production with high usage alerts (>400MB)
  - **Start Script Validation**: Verified package.json has proper "start" script: `"start": "node index.js"`
  - **TypeScript Error Resolution**: Fixed health check endpoint type errors by properly typing database status object
  - **Production Readiness Check**: Added production environment logging with system metrics on startup
  - **Deployment Configuration**: .replit file properly configured with `run = ["npm", "run", "start"]` for autoscale deployment
  - **Environment Variable Support**: Enhanced environment detection and production-specific optimizations
  - **Error Handling Enhancement**: Improved production error handling with minimal logging and graceful degradation
- **July 26, 2025**: Admin Interface UI Optimization - COMPLETED
  - **Removed Redundant Driver Management Buttons**: Eliminated duplicate "👥 Driver Management" and "📊 View All Drivers" buttons from admin controls
  - **Streamlined Navigation**: Single, clear path to driver management through Admin Panel → Driver Management tab
  - **Cleaner Admin Interface**: Reduced UI clutter with professional admin controls showing only essential buttons (Admin Panel, Logout)
  - **Improved User Experience**: Clear navigation pattern following standard admin panel design principles
  - **Code Cleanup**: Removed redundant JavaScript functions (viewAllDrivers, toggleDriverManagement) and associated HTML elements
  - **Preserved Functionality**: All driver management features remain fully functional through the primary Admin Panel interface
- **July 26, 2025**: Story 12 Leave Management Foundation System - COMPLETED & UI VERIFIED
  - **Leave Database Schema**: Complete leave_requests table with proper foreign key relationships
  - **Leave Balance Tracking**: 12 annual leave days per year with used/remaining calculations
  - **Leave Request API**: POST /api/driver/leave-request with comprehensive validation
  - **Leave History API**: GET /api/driver/leave-requests/:year with status and type filtering
  - **Leave Balance API**: GET /api/driver/leave-balance/:year for real-time balance display
  - **Professional UI Integration**: Complete leave management section in dashboard with form submission
  - **Leave Types Support**: Annual, sick, and emergency leave types with proper categorization
  - **Validation Rules**: Past date prevention, duplicate date checking, maximum 1-year advance requests
  - **RBAC Security**: All leave endpoints secured with requireDriverOrAdmin middleware
  - **IST Timezone Support**: Proper timezone handling for leave request timestamps and display
  - **Material Design UI**: Leave balance cards, request forms, and history tables with color-coded status badges
  - **Real-time Updates**: Automatic balance refresh after request submission and comprehensive error handling
- **July 26, 2025**: Story 11 Overtime Calculation System - COMPLETED
  - **Enhanced Overtime Detection**: Sophisticated rules for Sunday work, early morning (<8 AM), and late evening (>8 PM)
  - **Detailed Overtime Analysis**: Comprehensive breakdown with Sunday/early/late hours tracking
  - **Professional API Responses**: Enhanced payroll responses with overtime rules documentation
  - **Overtime Rate Integration**: Seamless integration with Story 9 payroll configuration (₹110/hour overtime rate)
  - **Shift Analysis**: Detailed tracking of Sunday shifts, early morning shifts, and late evening shifts
  - **Business Logic Implementation**: Complete overtime calculation engine with precise time calculations
  - **Story 10 Integration**: Enhanced existing basic payroll calculation with sophisticated overtime features
  - **RBAC Security**: All overtime endpoints properly secured with admin-only access control
  - **IST Timezone Support**: Proper timezone handling for overtime calculations and reporting
  - **Error Handling**: Comprehensive error handling with graceful fallbacks for overtime calculations
- **July 26, 2025**: Story 10 Basic Payroll Calculation System - COMPLETED
  - **PayrollCalculator Class**: Complete payroll calculation engine with comprehensive business logic
  - **Individual Payroll Calculation**: GET /api/admin/payroll/driver/:id/:year/:month - calculates single driver payroll
  - **Bulk Payroll Processing**: GET /api/admin/payroll/:year/:month - processes all drivers simultaneously  
  - **Payroll Summary Analytics**: GET /api/admin/payroll/:year/:month/summary - comprehensive statistics and breakdowns
  - **Database Integration**: Fixed critical database connection issues, corrected column references (id vs driver_id)
  - **RBAC Security**: All payroll endpoints secured with requireAdminOnly middleware - drivers receive 403 Forbidden
  - **Business Logic**: Prorated salary calculation, overtime detection, fuel allowance per working day, leave impact
  - **IST Timezone**: All payroll timestamps properly converted to Indian Standard Time
  - **Error Handling**: Graceful error handling with detailed logging and fallback calculations
  - **Real Data Processing**: System processes actual shift data from existing 44 drivers in database
  - **API Responses**: Professional JSON responses with comprehensive payroll breakdowns and summaries
  - **Configuration Integration**: Seamless integration with Story 9 payroll configuration system
  - **Test Coverage**: Individual driver (₹14,073.39 for 15 working days), bulk processing (44 drivers), RBAC verification
- **July 24, 2025**: Complete Role-Based Access Control (RBAC) Implementation
  - **Backend Security**: All admin endpoints secured with requireAdminOnly middleware
  - **Admin Monitoring**: Driver endpoints use requireDriverOrAdmin for admin supervision
  - **JWT Tokens**: Enhanced tokens include user roles (driver/admin) for authorization
  - **Frontend Controls**: Dashboard shows role-based UI with admin controls only for admins
  - **Access Protection**: Admin panel blocks driver access with role validation
  - **Test Accounts**: Driver (+1234567890/password123), Admin (+1234567899/admin123)
  - **Security Fix**: Drivers can no longer access admin functions or payroll configuration
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