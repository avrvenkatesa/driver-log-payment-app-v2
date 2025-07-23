const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced logging function
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// CORS configuration for cross-origin requests
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://your-domain.com'
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
  if (process.env.NODE_ENV === 'development') {
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
      
      if (process.env.NODE_ENV === 'development') {
        // Color-coded status codes for better debugging
        const statusColor = statusCode >= 500 ? '\x1b[31m' : // Red for 5xx
                           statusCode >= 400 ? '\x1b[33m' : // Yellow for 4xx  
                           statusCode >= 300 ? '\x1b[36m' : // Cyan for 3xx
                           '\x1b[32m'; // Green for 2xx
        const resetColor = '\x1b[0m';
        
        log(`${statusColor}${logLine}${resetColor}`);
      } else {
        log(logLine);
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
  console.log(`[${timestamp}] 📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[${timestamp}] 🌐 Server running on http://0.0.0.0:${PORT}`);
  console.log(`[${timestamp}] 🔗 Health check available at: http://0.0.0.0:${PORT}/api/health`);
  console.log(`[${timestamp}] ⚡ CORS enabled for cross-origin requests`);
  console.log(`[${timestamp}] 🛡️  Error handling middleware active`);
  console.log(`[${timestamp}] 📝 Enhanced logging enabled`);
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
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    log('🔄 Replit keep-alive ping');
  }, 10 * 60 * 1000); // Every 10 minutes
}

module.exports = app;