import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("driver"), // driver, admin, manager
  fullName: text("full_name").notNull(),
});

export const drivers = pgTable("drivers", {
  id: serial("id").primaryKey(),
  driverId: text("driver_id").notNull().unique(), // e.g., DRV-0847
  name: text("name").notNull(),
  status: text("status").notNull().default("off_duty"), // active, on_break, off_duty, hours_alert
  currentRoute: text("current_route"),
  hoursToday: decimal("hours_today", { precision: 4, scale: 2 }).default("0"),
  maxHours: decimal("max_hours", { precision: 4, scale: 2 }).default("11"),
  lastUpdate: timestamp("last_update").defaultNow(),
});

export const driverLogs = pgTable("driver_logs", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => drivers.id).notNull(),
  activity: text("activity").notNull(), // "Started shift", "Completed delivery", "Break started", etc.
  status: text("status").notNull(), // active, completed, on_break, alert
  route: text("route"),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  hours: decimal("hours", { precision: 4, scale: 2 }),
});

export const payrollRecords = pgTable("payroll_records", {
  id: serial("id").primaryKey(),
  driverId: integer("driver_id").references(() => drivers.id).notNull(),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  totalHours: decimal("total_hours", { precision: 6, scale: 2 }).notNull(),
  overtimeHours: decimal("overtime_hours", { precision: 6, scale: 2 }).default("0"),
  regularPay: decimal("regular_pay", { precision: 10, scale: 2 }).notNull(),
  overtimePay: decimal("overtime_pay", { precision: 10, scale: 2 }).default("0"),
  totalPay: decimal("total_pay", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, processed, paid
  processedAt: timestamp("processed_at"),
});

export const systemMetrics = pgTable("system_metrics", {
  id: serial("id").primaryKey(),
  activeDrivers: integer("active_drivers").default(0),
  totalHoursToday: decimal("total_hours_today", { precision: 8, scale: 2 }).default("0"),
  pendingPayments: decimal("pending_payments", { precision: 12, scale: 2 }).default("0"),
  systemUptime: decimal("system_uptime", { precision: 5, scale: 2 }).default("99.8"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertDriverSchema = createInsertSchema(drivers).omit({ id: true, lastUpdate: true });
export const insertDriverLogSchema = createInsertSchema(driverLogs).omit({ id: true, startTime: true });
export const insertPayrollRecordSchema = createInsertSchema(payrollRecords).omit({ id: true, processedAt: true });
export const insertSystemMetricsSchema = createInsertSchema(systemMetrics).omit({ id: true, lastUpdated: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export type DriverLog = typeof driverLogs.$inferSelect;
export type InsertDriverLog = z.infer<typeof insertDriverLogSchema>;

export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type InsertPayrollRecord = z.infer<typeof insertPayrollRecordSchema>;

export type SystemMetrics = typeof systemMetrics.$inferSelect;
export type InsertSystemMetrics = z.infer<typeof insertSystemMetricsSchema>;
