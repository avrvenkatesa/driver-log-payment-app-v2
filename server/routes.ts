import type { Express, Request, Response } from "express";
import { createServer } from "http";

// Import database functionality - fallback to null if not available
let database: any = null;
let driverHelpers: any = null;

try {
  const dbModule = require('../src/database/index.js');
  database = dbModule.database;
  driverHelpers = dbModule.driverHelpers;
} catch (error) {
  console.warn(`[${new Date().toISOString()}] ⚠️  Database module not available:`, error instanceof Error ? error.message : error);
}

export function registerRoutes(app: Express) {
  const server = createServer(app);

  /**
   * Enhanced Health Check with Database Status
   */
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      let databaseStatus = { status: 'unavailable', message: 'Database module not loaded' };
      
      if (database) {
        try {
          const healthCheck = await database.healthCheck();
          const stats = await database.getStats();
          
          databaseStatus = {
            status: 'connected',
            health: healthCheck,
            stats: stats
          };
        } catch (dbError) {
          databaseStatus = {
            status: 'error',
            message: dbError instanceof Error ? dbError.message : 'Unknown database error'
          };
        }
      }
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: databaseStatus,
        server: {
          pid: process.pid,
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Only register database routes if database is available
  if (database && driverHelpers) {
    console.log(`[${new Date().toISOString()}] ✅ Database available - registering driver API routes`);

    /**
     * DRIVERS ENDPOINTS
     */
    
    // Get all drivers with pagination and filtering
    app.get('/api/drivers', async (req: Request, res: Response) => {
      try {
        const {
          limit = '50',
          offset = '0',
          is_active,
          search,
          orderBy = 'created_at',
          orderDirection = 'DESC'
        } = req.query;

        const options = {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          is_active: is_active ? parseInt(is_active as string) : null,
          search: search as string,
          orderBy: orderBy as string,
          orderDirection: orderDirection as string
        };

        const result = await driverHelpers.getAllDrivers(options);
        
        console.log(`[${new Date().toISOString()}] ✅ API: Retrieved ${result.drivers.length} drivers`);
        res.json(result);
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ API error getting drivers:`, error);
        res.status(500).json({
          error: 'Failed to retrieve drivers',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get single driver by ID
    app.get('/api/drivers/:id', async (req: Request, res: Response) => {
      try {
        const driverId = parseInt(req.params.id);
        
        if (isNaN(driverId)) {
          return res.status(400).json({ error: 'Invalid driver ID' });
        }

        const driver = await driverHelpers.getDriverById(driverId);
        
        console.log(`[${new Date().toISOString()}] ✅ API: Retrieved driver ID ${driverId}`);
        res.json(driver);
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Driver not found',
            message: error.message
          });
        }
        
        console.error(`[${new Date().toISOString()}] ❌ API error getting driver:`, error);
        res.status(500).json({
          error: 'Failed to retrieve driver',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Create new driver
    app.post('/api/drivers', async (req: Request, res: Response) => {
      try {
        const { name, email, phone, password, is_phone_verified, is_active } = req.body;
        
        // Validate required fields
        if (!name || !phone) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Name and phone are required'
          });
        }

        const driverData = {
          name,
          email,
          phone,
          password,
          is_phone_verified: is_phone_verified || 0,
          is_active: is_active !== undefined ? is_active : 1
        };

        const newDriver = await driverHelpers.createDriver(driverData);
        
        console.log(`[${new Date().toISOString()}] ✅ API: Created new driver ${name}`);
        res.status(201).json(newDriver);
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'Driver with this phone number or email already exists'
          });
        }
        
        console.error(`[${new Date().toISOString()}] ❌ API error creating driver:`, error);
        res.status(500).json({
          error: 'Failed to create driver',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Update driver
    app.patch('/api/drivers/:id', async (req: Request, res: Response) => {
      try {
        const driverId = parseInt(req.params.id);
        
        if (isNaN(driverId)) {
          return res.status(400).json({ error: 'Invalid driver ID' });
        }

        const updateData: any = {};
        
        // Filter only allowed fields from request body with explicit property access
        if (req.body.name !== undefined) updateData.name = req.body.name;
        if (req.body.email !== undefined) updateData.email = req.body.email;
        if (req.body.phone !== undefined) updateData.phone = req.body.phone;
        if (req.body.is_phone_verified !== undefined) updateData.is_phone_verified = req.body.is_phone_verified;
        if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;
        
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'No valid fields provided for update'
          });
        }

        const updatedDriver = await driverHelpers.updateDriver(driverId, updateData);
        
        console.log(`[${new Date().toISOString()}] ✅ API: Updated driver ID ${driverId}`);
        res.json(updatedDriver);
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Driver not found',
            message: error.message
          });
        }
        
        console.error(`[${new Date().toISOString()}] ❌ API error updating driver:`, error);
        res.status(500).json({
          error: 'Failed to update driver',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Deactivate driver (soft delete)
    app.delete('/api/drivers/:id', async (req: Request, res: Response) => {
      try {
        const driverId = parseInt(req.params.id);
        
        if (isNaN(driverId)) {
          return res.status(400).json({ error: 'Invalid driver ID' });
        }

        await driverHelpers.deactivateDriver(driverId);
        
        console.log(`[${new Date().toISOString()}] ✅ API: Deactivated driver ID ${driverId}`);
        res.json({ 
          message: 'Driver deactivated successfully',
          driverId 
        });
        
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return res.status(404).json({
            error: 'Driver not found',
            message: error.message
          });
        }
        
        console.error(`[${new Date().toISOString()}] ❌ API error deactivating driver:`, error);
        res.status(500).json({
          error: 'Failed to deactivate driver',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    /**
     * STATISTICS ENDPOINTS
     */

    // Get system statistics
    app.get('/api/stats', async (req: Request, res: Response) => {
      try {
        const stats = await database.getStats();
        
        console.log(`[${new Date().toISOString()}] ✅ API: Retrieved system statistics`);
        res.json(stats);
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ API error getting system stats:`, error);
        res.status(500).json({
          error: 'Failed to retrieve system statistics',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    console.log(`[${new Date().toISOString()}] ✅ Driver management API routes registered successfully`);
  } else {
    console.log(`[${new Date().toISOString()}] ⚠️  Database not available - driver routes disabled`);
  }

  return server;
}