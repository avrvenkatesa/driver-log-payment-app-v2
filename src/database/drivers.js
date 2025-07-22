const dbConnection = require('./connection');
const bcrypt = require('bcryptjs');

/**
 * Driver CRUD operations
 * Implements all required database operations for drivers table
 */
class DriverHelpers {
  
  /**
   * Create a new driver
   */
  async createDriver(driverData) {
    try {
      const { name, email, phone, password, is_phone_verified = 0, is_active = 1 } = driverData;
      
      // Validate required fields
      if (!name || !phone) {
        throw new Error('Name and phone are required fields');
      }

      // Hash password if provided
      let password_hash = null;
      if (password) {
        password_hash = await bcrypt.hash(password, 10);
      }

      const sql = `
        INSERT INTO drivers (name, email, phone, password_hash, is_phone_verified, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const params = [name, email, phone, password_hash, is_phone_verified, is_active];
      const result = await dbConnection.run(sql, params);
      
      console.log(`[${new Date().toISOString()}] ✅ Driver created: ${name} (ID: ${result.lastID})`);
      
      // Return the created driver
      return await this.getDriverById(result.lastID);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error creating driver:`, error.message);
      throw error;
    }
  }

  /**
   * Get driver by ID
   */
  async getDriverById(driverId) {
    try {
      const sql = 'SELECT * FROM drivers WHERE id = ?';
      const driver = await dbConnection.get(sql, [driverId]);
      
      if (!driver) {
        throw new Error(`Driver not found with ID: ${driverId}`);
      }
      
      // Remove password hash from response for security
      const { password_hash, ...safeDriver } = driver;
      return safeDriver;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting driver by ID:`, error.message);
      throw error;
    }
  }

  /**
   * Get driver by phone number
   */
  async getDriverByPhone(phone) {
    try {
      const sql = 'SELECT * FROM drivers WHERE phone = ?';
      const driver = await dbConnection.get(sql, [phone]);
      
      if (!driver) {
        return null; // Return null instead of throwing error for login checks
      }
      
      return driver; // Include password hash for authentication
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting driver by phone:`, error.message);
      throw error;
    }
  }

  /**
   * Get driver by email
   */
  async getDriverByEmail(email) {
    try {
      const sql = 'SELECT * FROM drivers WHERE email = ?';
      const driver = await dbConnection.get(sql, [email]);
      
      if (!driver) {
        return null;
      }
      
      return driver;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting driver by email:`, error.message);
      throw error;
    }
  }

  /**
   * Get all drivers with pagination and filtering
   */
  async getAllDrivers(options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        is_active = null,
        search = null,
        orderBy = 'created_at',
        orderDirection = 'DESC'
      } = options;

      let sql = 'SELECT id, name, email, phone, is_phone_verified, is_active, created_at FROM drivers';
      let params = [];
      let whereConditions = [];

      // Filter by active status
      if (is_active !== null) {
        whereConditions.push('is_active = ?');
        params.push(is_active);
      }

      // Search by name, email, or phone
      if (search) {
        whereConditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
      }

      // Add WHERE clause if conditions exist
      if (whereConditions.length > 0) {
        sql += ' WHERE ' + whereConditions.join(' AND ');
      }

      // Add ordering
      sql += ` ORDER BY ${orderBy} ${orderDirection}`;

      // Add pagination
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const drivers = await dbConnection.query(sql, params);
      
      // Get total count for pagination
      let countSql = 'SELECT COUNT(*) as total FROM drivers';
      let countParams = [];
      
      if (whereConditions.length > 0) {
        countSql += ' WHERE ' + whereConditions.join(' AND ');
        countParams = params.slice(0, -2); // Remove limit and offset
      }
      
      const countResult = await dbConnection.get(countSql, countParams);
      const total = countResult.total;

      console.log(`[${new Date().toISOString()}] ✅ Retrieved ${drivers.length} drivers (${offset + 1}-${offset + drivers.length} of ${total})`);
      
      return {
        drivers,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + drivers.length < total
        }
      };
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting all drivers:`, error.message);
      throw error;
    }
  }

  /**
   * Update driver information
   */
  async updateDriver(driverId, updateData) {
    try {
      const allowedFields = ['name', 'email', 'phone', 'is_phone_verified', 'is_active'];
      const updates = [];
      const params = [];

      // Build dynamic UPDATE query
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields provided for update');
      }

      // Add driver ID to params
      params.push(driverId);

      const sql = `UPDATE drivers SET ${updates.join(', ')} WHERE id = ?`;
      const result = await dbConnection.run(sql, params);

      if (result.changes === 0) {
        throw new Error(`Driver not found with ID: ${driverId}`);
      }

      console.log(`[${new Date().toISOString()}] ✅ Driver updated: ID ${driverId}`);
      
      // Return updated driver
      return await this.getDriverById(driverId);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error updating driver:`, error.message);
      throw error;
    }
  }

  /**
   * Update driver password
   */
  async updateDriverPassword(driverId, newPassword) {
    try {
      const password_hash = await bcrypt.hash(newPassword, 10);
      
      const sql = 'UPDATE drivers SET password_hash = ? WHERE id = ?';
      const result = await dbConnection.run(sql, [password_hash, driverId]);

      if (result.changes === 0) {
        throw new Error(`Driver not found with ID: ${driverId}`);
      }

      console.log(`[${new Date().toISOString()}] ✅ Driver password updated: ID ${driverId}`);
      return true;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error updating driver password:`, error.message);
      throw error;
    }
  }

  /**
   * Verify driver password
   */
  async verifyDriverPassword(driverId, password) {
    try {
      const sql = 'SELECT password_hash FROM drivers WHERE id = ?';
      const result = await dbConnection.get(sql, [driverId]);

      if (!result || !result.password_hash) {
        return false;
      }

      const isValid = await bcrypt.compare(password, result.password_hash);
      return isValid;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error verifying driver password:`, error.message);
      throw error;
    }
  }

  /**
   * Soft delete driver (deactivate)
   */
  async deactivateDriver(driverId) {
    try {
      const sql = 'UPDATE drivers SET is_active = 0 WHERE id = ?';
      const result = await dbConnection.run(sql, [driverId]);

      if (result.changes === 0) {
        throw new Error(`Driver not found with ID: ${driverId}`);
      }

      console.log(`[${new Date().toISOString()}] ✅ Driver deactivated: ID ${driverId}`);
      return true;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error deactivating driver:`, error.message);
      throw error;
    }
  }

  /**
   * Activate driver
   */
  async activateDriver(driverId) {
    try {
      const sql = 'UPDATE drivers SET is_active = 1 WHERE id = ?';
      const result = await dbConnection.run(sql, [driverId]);

      if (result.changes === 0) {
        throw new Error(`Driver not found with ID: ${driverId}`);
      }

      console.log(`[${new Date().toISOString()}] ✅ Driver activated: ID ${driverId}`);
      return true;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error activating driver:`, error.message);
      throw error;
    }
  }

  /**
   * Get driver statistics
   */
  async getDriverStats() {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_drivers,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_drivers,
          SUM(CASE WHEN is_phone_verified = 1 THEN 1 ELSE 0 END) as verified_drivers,
          COUNT(DISTINCT DATE(created_at)) as registration_days
        FROM drivers
      `;
      
      const stats = await dbConnection.get(sql);
      
      console.log(`[${new Date().toISOString()}] ✅ Driver statistics retrieved`);
      return stats;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting driver statistics:`, error.message);
      throw error;
    }
  }
}

// Create singleton instance
const driverHelpers = new DriverHelpers();

module.exports = driverHelpers;