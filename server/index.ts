import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration for cross-origin requests
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://your-domain.com'
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging middleware for debugging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const method = req.method;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  // Log incoming request
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${method} ${path} - IP: ${ip}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`[${new Date().toISOString()}] Request Body:`, JSON.stringify(req.body, null, 2));
    }
  }

  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    // Enhanced logging with status code colors in development
    if (path.startsWith("/api")) {
      let logLine = `${method} ${path} ${statusCode} in ${duration}ms`;
      
      if (process.env.NODE_ENV === 'development') {
        // Color-coded status codes for better debugging
        const statusColor = statusCode >= 500 ? '\x1b[31m' : // Red for 5xx
                           statusCode >= 400 ? '\x1b[33m' : // Yellow for 4xx  
                           statusCode >= 300 ? '\x1b[36m' : // Cyan for 3xx
                           '\x1b[32m'; // Green for 2xx
        const resetColor = '\x1b[0m';
        
        console.log(`[${new Date().toISOString()}] ${statusColor}${logLine}${resetColor}`);
        
        if (capturedJsonResponse && statusCode >= 400) {
          console.log(`[${new Date().toISOString()}] Error Response:`, JSON.stringify(capturedJsonResponse, null, 2));
        }
      } else {
        // Production logging - simplified
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }
        
        log(logLine);
      }
    }
  });

  next();
});

(async () => {
  // Register API routes
  const server = await registerRoutes(app);

  // 404 handler for unmatched routes
  app.use('*', (req: Request, res: Response) => {
    const message = `Route ${req.method} ${req.originalUrl} not found`;
    console.log(`[${new Date().toISOString()}] 404 - ${message}`);
    res.status(404).json({ 
      error: 'Not Found',
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  });

  // Global error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
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
      (errorResponse as any).stack = err.stack;
    }

    res.status(status).json(errorResponse);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Enhanced server startup with error handling
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🚀 Server started successfully`);
    console.log(`[${timestamp}] 📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[${timestamp}] 🌐 Server running on http://0.0.0.0:${port}`);
    console.log(`[${timestamp}] 🔗 Health check available at: http://0.0.0.0:${port}/api/health`);
    console.log(`[${timestamp}] ⚡ CORS enabled for cross-origin requests`);
    log(`serving on port ${port}`);
  });

  // Handle server errors
  server.on('error', (error: any) => {
    console.error(`[${new Date().toISOString()}] ❌ Server error:`, error);
    if (error.code === 'EADDRINUSE') {
      console.error(`[${new Date().toISOString()}] ❌ Port ${port} is already in use`);
      process.exit(1);
    }
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    console.log(`[${new Date().toISOString()}] 🛑 SIGTERM received, shutting down gracefully`);
    server.close(() => {
      console.log(`[${new Date().toISOString()}] ✅ Server closed successfully`);
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log(`[${new Date().toISOString()}] 🛑 SIGINT received, shutting down gracefully`);
    server.close(() => {
      console.log(`[${new Date().toISOString()}] ✅ Server closed successfully`);
      process.exit(0);
    });
  });
})();
