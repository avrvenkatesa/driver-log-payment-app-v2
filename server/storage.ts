import { 
  users, drivers, driverLogs, payrollRecords, systemMetrics,
  type User, type InsertUser,
  type Driver, type InsertDriver,
  type DriverLog, type InsertDriverLog,
  type PayrollRecord, type InsertPayrollRecord,
  type SystemMetrics, type InsertSystemMetrics
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Drivers
  getAllDrivers(): Promise<Driver[]>;
  getDriver(id: number): Promise<Driver | undefined>;
  getDriverByDriverId(driverId: string): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: number, updates: Partial<InsertDriver>): Promise<Driver | undefined>;

  // Driver Logs
  getAllDriverLogs(): Promise<(DriverLog & { driverName: string })[]>;
  getRecentDriverLogs(limit?: number): Promise<(DriverLog & { driverName: string })[]>;
  getDriverLogs(driverId: number): Promise<DriverLog[]>;
  createDriverLog(log: InsertDriverLog): Promise<DriverLog>;

  // Payroll
  getAllPayrollRecords(): Promise<(PayrollRecord & { driverName: string })[]>;
  getPayrollRecords(driverId: number): Promise<PayrollRecord[]>;
  createPayrollRecord(record: InsertPayrollRecord): Promise<PayrollRecord>;
  updatePayrollRecord(id: number, updates: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined>;

  // System Metrics
  getSystemMetrics(): Promise<SystemMetrics | undefined>;
  updateSystemMetrics(metrics: InsertSystemMetrics): Promise<SystemMetrics>;

  // Health Check
  healthCheck(): Promise<{ status: string; timestamp: Date; database: boolean }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private drivers: Map<number, Driver>;
  private driverLogs: Map<number, DriverLog>;
  private payrollRecords: Map<number, PayrollRecord>;
  private systemMetrics: SystemMetrics | undefined;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.drivers = new Map();
    this.driverLogs = new Map();
    this.payrollRecords = new Map();
    this.currentId = 1;

    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Create sample drivers
    const sampleDrivers = [
      { driverId: "DRV-0847", name: "John Martinez", status: "active", currentRoute: "Route 45A - Downtown", hoursToday: "6.5", maxHours: "11" },
      { driverId: "DRV-0923", name: "Sarah Chen", status: "on_break", currentRoute: "Route 72B - Airport", hoursToday: "8.5", maxHours: "11" },
      { driverId: "DRV-0756", name: "Lisa Thompson", status: "hours_alert", currentRoute: "Route 15C - Industrial", hoursToday: "9.8", maxHours: "11" },
      { driverId: "DRV-0542", name: "Mike Rodriguez", status: "active", currentRoute: "Route 23A - Warehouse", hoursToday: "4.2", maxHours: "11" },
      { driverId: "DRV-0891", name: "Amanda Foster", status: "off_duty", currentRoute: null, hoursToday: "0", maxHours: "11" },
    ];

    sampleDrivers.forEach(driver => {
      const id = this.currentId++;
      this.drivers.set(id, { 
        id, 
        ...driver,
        lastUpdate: new Date()
      });
    });

    // Create sample logs
    const sampleLogs = [
      { driverId: 1, activity: "Started shift - Route 45A", status: "active", route: "Route 45A - Downtown" },
      { driverId: 2, activity: "Completed delivery - 8.5 hours", status: "completed", route: "Route 72B - Airport" },
      { driverId: 4, activity: "Break started - Rest Area 12", status: "on_break", route: "Route 23A - Warehouse" },
      { driverId: 3, activity: "Hours approaching limit - 9.8/11 hours", status: "alert", route: "Route 15C - Industrial" },
    ];

    sampleLogs.forEach(log => {
      const id = this.currentId++;
      this.driverLogs.set(id, {
        id,
        ...log,
        startTime: new Date(),
        endTime: null,
        hours: null
      });
    });

    // Initialize system metrics
    this.systemMetrics = {
      id: 1,
      activeDrivers: 247,
      totalHoursToday: "1924",
      pendingPayments: "48235",
      systemUptime: "99.8",
      lastUpdated: new Date()
    };
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Drivers
  async getAllDrivers(): Promise<Driver[]> {
    return Array.from(this.drivers.values());
  }

  async getDriver(id: number): Promise<Driver | undefined> {
    return this.drivers.get(id);
  }

  async getDriverByDriverId(driverId: string): Promise<Driver | undefined> {
    return Array.from(this.drivers.values()).find(driver => driver.driverId === driverId);
  }

  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const id = this.currentId++;
    const driver: Driver = { 
      ...insertDriver, 
      id, 
      lastUpdate: new Date() 
    };
    this.drivers.set(id, driver);
    return driver;
  }

  async updateDriver(id: number, updates: Partial<InsertDriver>): Promise<Driver | undefined> {
    const driver = this.drivers.get(id);
    if (!driver) return undefined;

    const updatedDriver = { 
      ...driver, 
      ...updates, 
      lastUpdate: new Date() 
    };
    this.drivers.set(id, updatedDriver);
    return updatedDriver;
  }

  // Driver Logs
  async getAllDriverLogs(): Promise<(DriverLog & { driverName: string })[]> {
    const logs = Array.from(this.driverLogs.values());
    return logs.map(log => {
      const driver = this.drivers.get(log.driverId);
      return {
        ...log,
        driverName: driver?.name || "Unknown Driver"
      };
    });
  }

  async getRecentDriverLogs(limit = 10): Promise<(DriverLog & { driverName: string })[]> {
    const allLogs = await this.getAllDriverLogs();
    return allLogs
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  async getDriverLogs(driverId: number): Promise<DriverLog[]> {
    return Array.from(this.driverLogs.values()).filter(log => log.driverId === driverId);
  }

  async createDriverLog(insertLog: InsertDriverLog): Promise<DriverLog> {
    const id = this.currentId++;
    const log: DriverLog = {
      ...insertLog,
      id,
      startTime: new Date(),
      endTime: null,
      hours: null
    };
    this.driverLogs.set(id, log);
    return log;
  }

  // Payroll
  async getAllPayrollRecords(): Promise<(PayrollRecord & { driverName: string })[]> {
    const records = Array.from(this.payrollRecords.values());
    return records.map(record => {
      const driver = this.drivers.get(record.driverId);
      return {
        ...record,
        driverName: driver?.name || "Unknown Driver"
      };
    });
  }

  async getPayrollRecords(driverId: number): Promise<PayrollRecord[]> {
    return Array.from(this.payrollRecords.values()).filter(record => record.driverId === driverId);
  }

  async createPayrollRecord(insertRecord: InsertPayrollRecord): Promise<PayrollRecord> {
    const id = this.currentId++;
    const record: PayrollRecord = {
      ...insertRecord,
      id,
      processedAt: null
    };
    this.payrollRecords.set(id, record);
    return record;
  }

  async updatePayrollRecord(id: number, updates: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined> {
    const record = this.payrollRecords.get(id);
    if (!record) return undefined;

    const updatedRecord = { ...record, ...updates };
    this.payrollRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  // System Metrics
  async getSystemMetrics(): Promise<SystemMetrics | undefined> {
    return this.systemMetrics;
  }

  async updateSystemMetrics(metrics: InsertSystemMetrics): Promise<SystemMetrics> {
    const id = this.systemMetrics?.id || 1;
    this.systemMetrics = {
      ...metrics,
      id,
      lastUpdated: new Date()
    };
    return this.systemMetrics;
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: Date; database: boolean }> {
    return {
      status: "healthy",
      timestamp: new Date(),
      database: true
    };
  }
}

export const storage = new MemStorage();
