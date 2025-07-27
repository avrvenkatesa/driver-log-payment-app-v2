const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const DB_PATH = path.join(__dirname, 'driver_logs.db');

/**
 * Initialize database with all required tables
 * Implements the complete schema from the requirements document
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    console.log(`[${new Date().toISOString()}] 🚀 Initializing database at: ${DB_PATH}`);

    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, err.message);
        reject(err);
        return;
      }
      console.log(`[${new Date().toISOString()}] ✅ Connected to SQLite database`);
    });

    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) {
        console.error(`[${new Date().toISOString()}] ❌ Error enabling foreign keys:`, err.message);
        reject(err);
        return;
      }
      console.log(`[${new Date().toISOString()}] ✅ Foreign key constraints enabled`);
    });

    // Define table creation queries
    const tableQueries = [
      // Drivers table - Core driver information
      `CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        verification_code TEXT,
        verification_expires_at DATETIME,
        is_phone_verified BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Shifts table - Driver shift tracking
      `CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER NOT NULL,
        clock_in_time DATETIME NOT NULL,
        clock_out_time DATETIME,
        start_odometer INTEGER NOT NULL,
        end_odometer INTEGER,
        total_distance INTEGER,
        shift_duration_minutes INTEGER,
        is_overtime BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers (id)
      )`,

      // Payroll configuration history
      `CREATE TABLE IF NOT EXISTS payroll_config_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        monthly_salary REAL NOT NULL,
        overtime_rate REAL NOT NULL,
        fuel_allowance REAL NOT NULL,
        working_hours REAL DEFAULT 8,
        changed_by TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )`,

      // Leave requests table
      `CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER NOT NULL,
        leave_date DATE NOT NULL,
        leave_type TEXT DEFAULT 'annual',
        reason TEXT,
        status TEXT DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_by TEXT,
        approved_at DATETIME,
        notes TEXT,
        FOREIGN KEY (driver_id) REFERENCES drivers (id),
        UNIQUE(driver_id, leave_date)
      )`,

      // Audit log table for tracking changes
      `CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        changed_by TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Story 17: Shift audit log table for manual shift management
      `CREATE TABLE IF NOT EXISTS shift_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER,
        action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
        old_values TEXT,
        new_values TEXT,
        changed_by INTEGER,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (shift_id) REFERENCES shifts (id),
        FOREIGN KEY (changed_by) REFERENCES drivers (id)
      )`
    ];

    // Create indexes for better performance
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers (phone)',
      'CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers (email)',
      'CREATE INDEX IF NOT EXISTS idx_shifts_driver_id ON shifts (driver_id)',
      'CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts (clock_in_time)',
      'CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts (status)',
      'CREATE INDEX IF NOT EXISTS idx_leave_requests_driver_date ON leave_requests (driver_id, leave_date)',
      'CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log (table_name, record_id)',
      'CREATE INDEX IF NOT EXISTS idx_shift_audit_shift_id ON shift_audit_log(shift_id)',
      'CREATE INDEX IF NOT EXISTS idx_shift_audit_changed_at ON shift_audit_log(changed_at)'
    ];

    // Execute table creation queries first
    let tableCompleted = 0;
    const createTablesPromise = new Promise((resolveTable, rejectTable) => {
      tableQueries.forEach((query, index) => {
        const tableName = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
        db.run(query, (err) => {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Error creating table ${tableName}:`, err.message);
            rejectTable(err);
            return;
          }
          
          tableCompleted++;
          console.log(`[${new Date().toISOString()}] ✅ Table ${tableName} created/verified (${tableCompleted}/${tableQueries.length})`);
          
          if (tableCompleted === tableQueries.length) {
            resolveTable();
          }
        });
      });
    });

    // Wait for all tables to be created before creating indexes
    createTablesPromise
      .then(() => {
        // Now execute index creation queries
        let indexCompleted = 0;
        indexQueries.forEach((query, index) => {
          const indexName = query.match(/CREATE INDEX IF NOT EXISTS (\w+)/)[1];
          db.run(query, (err) => {
            if (err) {
              console.error(`[${new Date().toISOString()}] ❌ Error creating index ${indexName}:`, err.message);
              reject(err);
              return;
            }
            
            indexCompleted++;
            console.log(`[${new Date().toISOString()}] ✅ Index ${indexName} created/verified (${indexCompleted}/${indexQueries.length})`);
            
            if (indexCompleted === indexQueries.length) {
              db.close((err) => {
                if (err) {
                  console.error(`[${new Date().toISOString()}] ❌ Error closing database:`, err.message);
                  reject(err);
                  return;
                }
                console.log(`[${new Date().toISOString()}] 🎉 Database initialization completed successfully`);
                resolve();
              });
            }
          });
        });
      })
      .catch((err) => {
        reject(err);
      });
  });
}

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log(`[${new Date().toISOString()}] ✅ Database initialization script completed`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`[${new Date().toISOString()}] ❌ Database initialization failed:`, error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase, DB_PATH };