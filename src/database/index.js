const dbConnection = require('./connection');
const driverHelpers = require('./drivers');
const shiftHelpers = require('./shifts');
const { initializeDatabase } = require('../../database/init');
const { seedDatabase } = require('../../database/seed');

/**
 * Main database module
 * Provides unified interface for all database operations
 */
class Database {
  constructor() {
    this.connection = dbConnection;
    this.drivers = driverHelpers;
    this.shifts = shiftHelpers;
  }

  /**
   * Initialize database with tables and indexes
   */
  async initialize() {
    try {
      console.log(`[${new Date().toISOString()}] 🚀 Starting database initialization...`);
      await initializeDatabase();
      console.log(`[${new Date().toISOString()}] ✅ Database initialization completed`);
      return true;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Database initialization failed:`, error.message);
      throw error;
    }
  }

  /**
   * Seed database with test data
   */
  async seed() {
    try {
      console.log(`[${new Date().toISOString()}] 🌱 Starting database seeding...`);
      await seedDatabase();
      console.log(`[${new Date().toISOString()}] ✅ Database seeding completed`);
      return true;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Database seeding failed:`, error.message);
      throw error;
    }
  }

  /**
   * Perform database health check
   */
  async healthCheck() {
    try {
      return await this.connection.healthCheck();
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Database health check failed:`, error.message);
      return {
        status: 'error',
        database: false,
        error: error.message
      };
    }
  }

  /**
   * Execute raw SQL query (for administrative tasks)
   */
  async query(sql, params = []) {
    try {
      return await this.connection.query(sql, params);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Database query failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute single row query
   */
  async get(sql, params = []) {
    try {
      return await this.connection.get(sql, params);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Database get failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute insert/update/delete query
   */
  async run(sql, params = []) {
    try {
      return await this.connection.run(sql, params);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Database run failed:`, error.message);
      throw error;
    }
  }

  /**
   * Execute transaction
   */
  async transaction(operations) {
    try {
      return await this.connection.transaction(operations);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Database transaction failed:`, error.message);
      throw error;
    }
  }

  /**
   * Close all database connections
   */
  async close() {
    try {
      await this.connection.closeAll();
      console.log(`[${new Date().toISOString()}] ✅ Database connections closed`);
      return true;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error closing database:`, error.message);
      throw error;
    }
  }

  /**
   * Get database statistics and information
   */
  async getStats() {
    try {
      const driverStats = await this.drivers.getDriverStats();
      const healthCheck = await this.healthCheck();
      
      return {
        health: healthCheck,
        drivers: driverStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting database stats:`, error.message);
      throw error;
    }
  }
}

// Create singleton instance
const database = new Database();

// Export both the class and instance for flexibility
module.exports = {
  Database,
  database,
  dbConnection,
  driverHelpers,
  shiftHelpers,
  initializeDatabase,
  seedDatabase
};