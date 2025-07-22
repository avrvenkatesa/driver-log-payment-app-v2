const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'driver_logs.db');

/**
 * Seed database with test data for development and testing
 */
async function seedDatabase() {
  return new Promise(async (resolve, reject) => {
    console.log(`[${new Date().toISOString()}] 🌱 Seeding database with test data`);

    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error(`[${new Date().toISOString()}] ❌ Database connection error:`, err.message);
        reject(err);
        return;
      }
    });

    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON;');

    try {
      // Test driver data
      const testDrivers = [
        {
          name: 'John Martinez',
          email: 'john@example.com',
          phone: '+1234567890',
          password: 'password123',
          is_phone_verified: 1,
          is_active: 1
        },
        {
          name: 'Sarah Chen',
          email: 'sarah@example.com', 
          phone: '+1987654321',
          password: 'password123',
          is_phone_verified: 1,
          is_active: 1
        },
        {
          name: 'Mike Rodriguez',
          email: 'mike@example.com',
          phone: '+1555666777',
          password: 'password123',
          is_phone_verified: 0,
          is_active: 1
        },
        {
          name: 'Lisa Thompson',
          email: 'lisa@example.com',
          phone: '+1444555666',
          password: 'password123',
          is_phone_verified: 1,
          is_active: 0
        }
      ];

      // Hash passwords for all test drivers
      const hashedDrivers = await Promise.all(
        testDrivers.map(async (driver) => ({
          ...driver,
          password_hash: await bcrypt.hash(driver.password, 10)
        }))
      );

      // Insert test drivers
      const driverInsertPromises = hashedDrivers.map((driver, index) => {
        return new Promise((resolve, reject) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO drivers (name, email, phone, password_hash, is_phone_verified, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          stmt.run([
            driver.name,
            driver.email,
            driver.phone,
            driver.password_hash,
            driver.is_phone_verified,
            driver.is_active
          ], function(err) {
            if (err) {
              console.error(`[${new Date().toISOString()}] ❌ Error inserting driver ${driver.name}:`, err.message);
              reject(err);
            } else {
              console.log(`[${new Date().toISOString()}] ✅ Driver ${driver.name} inserted with ID: ${this.lastID || 'existing'}`);
              resolve(this.lastID);
            }
          });
          
          stmt.finalize();
        });
      });

      await Promise.all(driverInsertPromises);

      // Insert test shifts for the first driver
      const testShifts = [
        {
          driver_id: 1,
          clock_in_time: '2025-07-22 08:00:00',
          clock_out_time: '2025-07-22 16:30:00',
          start_odometer: 10000,
          end_odometer: 10250,
          total_distance: 250,
          shift_duration_minutes: 510,
          is_overtime: 1,
          status: 'completed'
        },
        {
          driver_id: 1,
          clock_in_time: '2025-07-21 09:00:00',
          clock_out_time: '2025-07-21 17:00:00',
          start_odometer: 9750,
          end_odometer: 10000,
          total_distance: 250,
          shift_duration_minutes: 480,
          is_overtime: 0,
          status: 'completed'
        },
        {
          driver_id: 2,
          clock_in_time: '2025-07-22 07:30:00',
          clock_out_time: null,
          start_odometer: 15000,
          end_odometer: null,
          total_distance: null,
          shift_duration_minutes: null,
          is_overtime: 0,
          status: 'active'
        }
      ];

      const shiftInsertPromises = testShifts.map((shift) => {
        return new Promise((resolve, reject) => {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO shifts (
              driver_id, clock_in_time, clock_out_time, start_odometer, 
              end_odometer, total_distance, shift_duration_minutes, 
              is_overtime, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          stmt.run([
            shift.driver_id,
            shift.clock_in_time,
            shift.clock_out_time,
            shift.start_odometer,
            shift.end_odometer,
            shift.total_distance,
            shift.shift_duration_minutes,
            shift.is_overtime,
            shift.status
          ], function(err) {
            if (err) {
              console.error(`[${new Date().toISOString()}] ❌ Error inserting shift:`, err.message);
              reject(err);
            } else {
              console.log(`[${new Date().toISOString()}] ✅ Shift inserted with ID: ${this.lastID || 'existing'}`);
              resolve(this.lastID);
            }
          });
          
          stmt.finalize();
        });
      });

      await Promise.all(shiftInsertPromises);

      // Insert default payroll configuration
      const payrollConfig = {
        monthly_salary: 27000,
        overtime_rate: 100,
        fuel_allowance: 33.30,
        working_hours: 8,
        changed_by: 'system_init',
        notes: 'Initial payroll configuration'
      };

      await new Promise((resolve, reject) => {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO payroll_config_history (
            monthly_salary, overtime_rate, fuel_allowance, 
            working_hours, changed_by, notes
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
          payrollConfig.monthly_salary,
          payrollConfig.overtime_rate,
          payrollConfig.fuel_allowance,
          payrollConfig.working_hours,
          payrollConfig.changed_by,
          payrollConfig.notes
        ], function(err) {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Error inserting payroll config:`, err.message);
            reject(err);
          } else {
            console.log(`[${new Date().toISOString()}] ✅ Payroll configuration inserted`);
            resolve(this.lastID);
          }
        });
        
        stmt.finalize();
      });

      // Insert sample leave request
      await new Promise((resolve, reject) => {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO leave_requests (
            driver_id, leave_date, leave_type, reason, status
          ) VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run([
          1,
          '2025-08-15',
          'annual',
          'Family vacation',
          'pending'
        ], function(err) {
          if (err) {
            console.error(`[${new Date().toISOString()}] ❌ Error inserting leave request:`, err.message);
            reject(err);
          } else {
            console.log(`[${new Date().toISOString()}] ✅ Leave request inserted`);
            resolve(this.lastID);
          }
        });
        
        stmt.finalize();
      });

      db.close((err) => {
        if (err) {
          console.error(`[${new Date().toISOString()}] ❌ Error closing database:`, err.message);
          reject(err);
        } else {
          console.log(`[${new Date().toISOString()}] 🎉 Database seeding completed successfully`);
          resolve();
        }
      });

    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error during seeding:`, error);
      reject(error);
    }
  });
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log(`[${new Date().toISOString()}] ✅ Database seeding script completed`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`[${new Date().toISOString()}] ❌ Database seeding failed:`, error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };