const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Production environment detection
const isProduction = NODE_ENV === 'production';

// Enhanced logging function
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// CORS configuration for cross-origin requests
const corsOptions = {
  origin: isProduction 
    ? process.env.FRONTEND_URL || function(origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        // Allow any origin for Replit deployments
        if (origin.includes('.replit.app') || origin.includes('.repl.co')) {
          return callback(null, true);
        }
        callback(null, false);
      }
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware with enhanced limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging middleware for debugging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const method = req.method;
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  // Log incoming request in development
  if (!isProduction) {
    log(`${method} ${path} - IP: ${ip}`);
    if (req.body && Object.keys(req.body).length > 0) {
      log(`Request Body: ${JSON.stringify(req.body, null, 2)}`);
    }
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    if (path.startsWith("/api")) {
      let logLine = `${method} ${path} ${statusCode} in ${duration}ms`;
      
      if (!isProduction) {
        // Color-coded status codes for better debugging
        const statusColor = statusCode >= 500 ? '\x1b[31m' : // Red for 5xx
                           statusCode >= 400 ? '\x1b[33m' : // Yellow for 4xx  
                           statusCode >= 300 ? '\x1b[36m' : // Cyan for 3xx
                           '\x1b[32m'; // Green for 2xx
        const resetColor = '\x1b[0m';
        
        log(`${statusColor}${logLine}${resetColor}`);
      } else {
        // Simplified logging for production (only errors)
        if (statusCode >= 400) {
          log(logLine);
        }
      }
    }
  });

  next();
});

// Serve static files from public directory
app.use(express.static('public'));

// Dashboard route - serve the HTML dashboard
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

// Admin panel route - serve the admin HTML
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Health check endpoint with enhanced response
app.get('/api/health', (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      message: '🚗 Driver Log App Server is running!',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: true, // Will be updated when database is connected
      uptime: process.uptime(),
      port: PORT
    };
    
    log(`Health check accessed from ${req.ip || 'unknown'}`);
    res.status(200).json(healthData);
  } catch (error) {
    log(`Health check error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Load database and authentication modules
try {
  const { driverHelpers } = require('./src/database/index.js');
  log('✅ Database module loaded successfully');
  
  const { authMiddleware } = require('./src/auth/auth.js');
  log('✅ Authentication module loaded successfully');
  
  // Authentication routes
  const authRoutes = require('./src/routes/auth.js');
  log(`✅ Auth routes type: ${typeof authRoutes}, middleware: ${typeof authMiddleware}`);
  app.use('/api/auth', authRoutes);
  log('✅ Authentication routes registered at /api/auth');
  
  // Driver routes
  const driverRoutes = require('./src/routes/driver.js');
  app.use('/api/driver', driverRoutes);
  log('✅ Driver routes registered at /api/driver');
  
  // Admin routes (Story 9: Payroll Configuration)
  const { router: adminRoutes, initializePayrollSystem } = require('./src/routes/admin.js');
  app.use('/api/admin', adminRoutes);
  log('✅ Admin routes registered at /api/admin');
  
  // Payroll calculation routes (Story 10: Basic Payroll Calculation)
  const payrollRoutes = require('./src/routes/payroll.js');
  app.use('/api/admin/payroll', payrollRoutes);
  log('✅ Payroll calculation routes registered at /api/admin/payroll');
  
  // Leave management routes (Story 12: Leave Management Foundation)
  const leaveRoutes = require('./src/routes/leave.js');
  app.use('/api/driver', leaveRoutes);
  log('✅ Leave management routes registered at /api/driver');
  
  // Analytics routes (Story 14: Shift Analytics)
  const analyticsRoutes = require('./src/routes/analytics.js');
  app.use('/api/admin', analyticsRoutes);
  log('✅ Analytics routes registered at /api/admin');

  // Admin Leave Management routes (Story 15: Leave Management Admin)
  const adminLeaveRoutes = require('./src/routes/admin_leave.js');
  app.use('/api/admin', adminLeaveRoutes);
  log('✅ Admin leave management routes registered at /api/admin');

  // Manual Shift Management routes (Story 17: Manual Shift Management)
  const adminShiftManagementRoutes = require('./src/routes/adminShiftManagement.js');
  app.use('/api/admin', adminShiftManagementRoutes);
  log('✅ Manual shift management routes registered at /api/admin');
  
  // PDF Payroll Export routes (Story 18: PDF Payroll Reports)
  const payrollPDFRoutes = require('./src/routes/payrollPDFRoutes.js');
  app.use('/api/admin', payrollPDFRoutes);
  log('✅ PDF payroll export routes registered at /api/admin');

  // Test Data Management routes (Story 20: Test Data Management)
  const testDataRoutes = require('./src/routes/testDataRoutes.js');
  app.use('/api/admin', testDataRoutes);
  log('✅ Test data management routes registered at /api/admin');
  
  // Advance Payment routes (Story 19: Advance Payment Management)
  const advancePaymentRoutes = require('./src/routes/advancePaymentRoutes.js');
  app.use('/api/driver', advancePaymentRoutes);
  log('✅ Advance payment routes registered at /api/driver');
  
  const adminAdvanceRoutes = require('./src/routes/adminAdvanceRoutes.js');
  app.use('/api/admin', adminAdvanceRoutes);
  log('✅ Admin advance payment routes registered at /api/admin');
  
  // Initialize payroll configuration system
  initializePayrollSystem().then(() => {
    log('✅ Payroll configuration system initialized successfully');
  }).catch(err => {
    log(`❌ Error initializing payroll system: ${err.message}`);
  });
  
  // Initialize leave management system (Story 12)
  const leaveDatabase = require('./src/database/leave.js');
  leaveDatabase.initializeLeaveTable().then(async () => {
    // Run migration for cancellation columns (Story 12 Enhancement)
    await leaveDatabase.migrateCancellationColumns();
    log('✅ Leave management system initialized successfully');
  }).catch(err => {
    log(`❌ Error initializing leave management system: ${err.message}`);
  });
  
  // Initialize advance payment system (Story 19)
  const { createAdvancePaymentTables } = require('./src/database/advancePaymentSchema.js');
  createAdvancePaymentTables().then(() => {
    log('✅ Advance payment system initialized successfully');
  }).catch(err => {
    log(`❌ Error initializing advance payment system: ${err.message}`);
  });
  
  // Test database availability
  if (driverHelpers) {
    log('✅ Database available - registering driver API routes');
    
    // Additional driver management routes if database is available
    app.get('/api/drivers', authMiddleware, async (req, res) => {
      try {
        const drivers = await driverHelpers.getAllDrivers({ limit: 100 });
        res.json({
          success: true,
          data: drivers,
          count: drivers.length
        });
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error fetching drivers:`, error.message);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch drivers',
          message: error.message
        });
      }
    });
    
    log('✅ Driver management API routes registered successfully');
  }
  
  log('✅ Additional routes registered successfully');
  
} catch (error) {
  console.error(`[${new Date().toISOString()}] ❌ Error loading modules:`, error.message);
  log('⚠️  Some features may not be available due to module loading errors');
}

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  const message = `Route ${req.method} ${req.originalUrl} not found`;
  log(`404 - ${message}`);
  res.status(404).json({
    error: 'Not Found',
    message,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  // Enhanced error logging
  console.error(`[${new Date().toISOString()}] ERROR ${status}:`, {
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress
  });

  // Send appropriate error response
  const errorResponse = {
    error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
    message,
    path: req.path,
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && status >= 500) {
    errorResponse.stack = err.stack;
  }

  res.status(status).json(errorResponse);
});

// Enhanced server startup with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🚀 Server started successfully`);
  console.log(`[${timestamp}] 📡 Environment: ${NODE_ENV}`);
  console.log(`[${timestamp}] 🌐 Server running on http://0.0.0.0:${PORT}`);
  console.log(`[${timestamp}] 🔗 Health check available at: http://0.0.0.0:${PORT}/api/health`);
  console.log(`[${timestamp}] ⚡ CORS enabled for cross-origin requests`);
  console.log(`[${timestamp}] 🛡️  Error handling middleware active`);
  console.log(`[${timestamp}] 📝 Enhanced logging enabled`);
  
  // Production readiness check
  if (isProduction) {
    console.log(`[${timestamp}] 🚀 Production mode: Server ready for deployment`);
    console.log(`[${timestamp}] 📊 Memory usage: ${JSON.stringify(process.memoryUsage())}`);
    console.log(`[${timestamp}] 🔧 Node version: ${process.version}`);
    console.log(`[${timestamp}] 🏗️  Platform: ${process.platform}`);
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] ❌ Server error:`, error);
  if (error.code === 'EADDRINUSE') {
    console.error(`[${new Date().toISOString()}] ❌ Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    log('✅ Server closed successfully');
    process.exit(0);
  });
});

// Replit keep-alive (prevents sleeping in development)
if (!isProduction) {
  setInterval(() => {
    log('🔄 Replit keep-alive ping');
  }, 10 * 60 * 1000); // Every 10 minutes
}

// Production monitoring
if (isProduction) {
  // Log memory usage every 5 minutes in production
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const mbUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
    if (mbUsed > 400) { // Alert if memory usage is high
      log(`⚠️  High memory usage: ${mbUsed}MB`);
    }
  }, 5 * 60 * 1000);
}

module.exports = app;