import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDriverSchema, insertDriverLogSchema, insertPayrollRecordSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      const health = await storage.healthCheck();
      res.json(health);
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: "Health check failed",
        timestamp: new Date()
      });
    }
  });

  // System metrics
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await storage.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system metrics" });
    }
  });

  app.put("/api/metrics", async (req, res) => {
    try {
      const metrics = await storage.updateSystemMetrics(req.body);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to update system metrics" });
    }
  });

  // Drivers
  app.get("/api/drivers", async (req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  app.get("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch driver" });
    }
  });

  app.post("/api/drivers", async (req, res) => {
    try {
      const validatedData = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(validatedData);
      res.status(201).json(driver);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  app.put("/api/drivers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const driver = await storage.updateDriver(id, updates);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  // Driver Logs
  app.get("/api/logs", async (req, res) => {
    try {
      const logs = await storage.getAllDriverLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get("/api/logs/recent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const logs = await storage.getRecentDriverLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent logs" });
    }
  });

  app.get("/api/drivers/:id/logs", async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const logs = await storage.getDriverLogs(driverId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch driver logs" });
    }
  });

  app.post("/api/logs", async (req, res) => {
    try {
      const validatedData = insertDriverLogSchema.parse(req.body);
      const log = await storage.createDriverLog(validatedData);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create log entry" });
    }
  });

  // Payroll
  app.get("/api/payroll", async (req, res) => {
    try {
      const payroll = await storage.getAllPayrollRecords();
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch payroll records" });
    }
  });

  app.get("/api/drivers/:id/payroll", async (req, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const payroll = await storage.getPayrollRecords(driverId);
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch driver payroll" });
    }
  });

  app.post("/api/payroll", async (req, res) => {
    try {
      const validatedData = insertPayrollRecordSchema.parse(req.body);
      const record = await storage.createPayrollRecord(validatedData);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create payroll record" });
    }
  });

  app.put("/api/payroll/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const record = await storage.updatePayrollRecord(id, updates);
      if (!record) {
        return res.status(404).json({ message: "Payroll record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: "Failed to update payroll record" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
