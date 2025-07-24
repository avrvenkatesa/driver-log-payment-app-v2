const dbConnection = require('./connection');

/**
 * Shifts CRUD operations
 * Implements all required database operations for shifts table
 */
class ShiftHelpers {
  
  /**
   * Create a new shift (clock-in)
   * @param {Object} shiftData - Shift data
   * @returns {Promise<Object>} - Created shift
   */
  async createShift(shiftData) {
    try {
      const { driver_id, start_odometer } = shiftData;
      
      // Validate required fields
      if (!driver_id || !start_odometer) {
        throw new Error('Driver ID and start odometer are required');
      }

      // Check if driver already has an active shift
      const activeShiftCheck = await this.getActiveShiftByDriverId(driver_id);
      if (activeShiftCheck) {
        throw new Error('Driver already has an active shift. Please clock out first.');
      }

      // Get previous shift to validate odometer continuity
      const previousShift = await this.getLastCompletedShiftByDriverId(driver_id);
      if (previousShift && previousShift.end_odometer && start_odometer < previousShift.end_odometer) {
        throw new Error(`Start odometer (${start_odometer}) must be greater than or equal to previous shift's end odometer (${previousShift.end_odometer})`);
      }

      // Ensure UTC storage as specified
      const now = new Date();
      const utcTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const clockInISO = now.toISOString();

      const sql = `
        INSERT INTO shifts (
          driver_id, 
          clock_in_time, 
          start_odometer, 
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, 'active', ?, ?)
      `;
      
      const params = [driver_id, clockInISO, start_odometer, clockInISO, clockInISO];
      
      console.log(`[${new Date().toISOString()}] 📝 Storing UTC timestamp: ${clockInISO}`);
      const result = await dbConnection.run(sql, params);
      
      console.log(`[${new Date().toISOString()}] ✅ Shift created: Driver ${driver_id}, Shift ID: ${result.lastID}`);
      
      // Return the created shift
      return await this.getShiftById(result.lastID);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error creating shift:`, error.message);
      throw error;
    }
  }

  /**
   * Get shift by ID
   * @param {number} shiftId - Shift ID
   * @returns {Promise<Object|null>} - Shift data
   */
  async getShiftById(shiftId) {
    try {
      const sql = 'SELECT * FROM shifts WHERE id = ?';
      const shift = await dbConnection.get(sql, [shiftId]);
      return shift;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting shift by ID:`, error.message);
      throw error;
    }
  }

  /**
   * Get active shift by driver ID
   * @param {number} driverId - Driver ID
   * @returns {Promise<Object|null>} - Active shift data
   */
  async getActiveShiftByDriverId(driverId) {
    try {
      const sql = `
        SELECT * FROM shifts 
        WHERE driver_id = ? AND clock_out_time IS NULL AND status = 'active'
        ORDER BY clock_in_time DESC 
        LIMIT 1
      `;
      const shift = await dbConnection.get(sql, [driverId]);
      return shift;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting active shift:`, error.message);
      throw error;
    }
  }

  /**
   * Get last completed shift by driver ID
   * @param {number} driverId - Driver ID
   * @returns {Promise<Object|null>} - Last completed shift data
   */
  async getLastCompletedShiftByDriverId(driverId) {
    try {
      const sql = `
        SELECT * FROM shifts 
        WHERE driver_id = ? AND clock_out_time IS NOT NULL
        ORDER BY clock_out_time DESC 
        LIMIT 1
      `;
      const shift = await dbConnection.get(sql, [driverId]);
      return shift;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting last completed shift:`, error.message);
      throw error;
    }
  }

  /**
   * Update shift (clock-out)
   * @param {number} shiftId - Shift ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated shift
   */
  async updateShift(shiftId, updateData) {
    try {
      const { end_odometer } = updateData;
      
      // Get the current shift
      const currentShift = await this.getShiftById(shiftId);
      if (!currentShift) {
        throw new Error(`Shift not found with ID: ${shiftId}`);
      }

      // Validate end odometer is >= start odometer
      if (end_odometer && end_odometer < currentShift.start_odometer) {
        throw new Error(`End odometer (${end_odometer}) must be greater than or equal to start odometer (${currentShift.start_odometer})`);
      }

      // Ensure UTC storage as specified
      const now = new Date();
      const utcTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);
      const clockOutISO = now.toISOString();
      
      console.log(`[${new Date().toISOString()}] 📝 Storing UTC clock-out timestamp: ${clockOutISO}`);

      // Calculate duration and distance
      const clockInTime = new Date(currentShift.clock_in_time);
      const clockOutTimeObj = new Date(clockOutISO);
      const durationMinutes = Math.floor((clockOutTimeObj - clockInTime) / (1000 * 60));
      const totalDistance = end_odometer ? end_odometer - currentShift.start_odometer : null;

      const sql = `
        UPDATE shifts 
        SET clock_out_time = ?, 
            end_odometer = ?, 
            total_distance = ?, 
            shift_duration_minutes = ?,
            status = 'completed',
            updated_at = ?
        WHERE id = ?
      `;
      
      const params = [clockOutISO, end_odometer, totalDistance, durationMinutes, clockOutISO, shiftId];
      const result = await dbConnection.run(sql, params);

      if (result.changes === 0) {
        throw new Error(`Shift not found with ID: ${shiftId}`);
      }

      console.log(`[${new Date().toISOString()}] ✅ Shift updated: ID ${shiftId}, Duration: ${durationMinutes}min`);
      
      // Return the updated shift
      return await this.getShiftById(shiftId);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error updating shift:`, error.message);
      throw error;
    }
  }

  /**
   * Get shifts by driver ID with date filter
   * @param {number} driverId - Driver ID
   * @param {string} date - Date in YYYY-MM-DD format (optional)
   * @returns {Promise<Array>} - Array of shifts
   */
  async getShiftsByDriverId(driverId, date = null) {
    try {
      let sql = `
        SELECT * FROM shifts 
        WHERE driver_id = ?
      `;
      let params = [driverId];

      if (date) {
        sql += ` AND DATE(clock_in_time) = ?`;
        params.push(date);
      }

      sql += ` ORDER BY clock_in_time DESC`;
      
      const shifts = await dbConnection.all(sql, params);
      return shifts;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting shifts by driver:`, error.message);
      throw error;
    }
  }

  /**
   * Get shifts statistics for a driver
   * @param {number} driverId - Driver ID
   * @returns {Promise<Object>} - Shift statistics
   */
  async getDriverShiftStats(driverId) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_shifts,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_shifts,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_shifts,
          SUM(shift_duration_minutes) as total_minutes,
          SUM(total_distance) as total_distance,
          AVG(shift_duration_minutes) as avg_duration,
          MAX(clock_in_time) as last_shift_date
        FROM shifts 
        WHERE driver_id = ?
      `;
      
      const stats = await dbConnection.get(sql, [driverId]);
      return stats;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting driver shift stats:`, error.message);
      throw error;
    }
  }
  /**
   * Complete a shift (clock-out)
   * @param {number} driverId - Driver ID
   * @param {Object} clockOutData - Clock-out data
   * @returns {Promise<Object>} - Updated shift
   */
  async completeShift(driverId, clockOutData) {
    try {
      const { endOdometer } = clockOutData;
      
      // Validate required fields
      if (!driverId || !endOdometer) {
        throw new Error('Driver ID and end odometer are required');
      }

      // Check if driver has an active shift
      const activeShift = await this.getActiveShiftByDriverId(driverId);
      if (!activeShift) {
        throw new Error('No active shift found to clock out');
      }

      // Validate end odometer is >= start odometer
      if (endOdometer < activeShift.start_odometer) {
        throw new Error(`End odometer (${endOdometer}) must be greater than or equal to start odometer (${activeShift.start_odometer})`);
      }

      // Record timestamp in IST
      const clockOutTime = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata'
      });
      const clockOutISO = new Date(clockOutTime).toISOString();

      // Calculate total distance
      const totalDistance = endOdometer - activeShift.start_odometer;

      // Calculate shift duration in minutes
      const clockInTime = new Date(activeShift.clock_in_time);
      const clockOutTimeDate = new Date(clockOutISO);
      const shiftDurationMinutes = Math.round((clockOutTimeDate - clockInTime) / (1000 * 60));

      // Update the active shift with clock-out data
      const sql = `
        UPDATE shifts SET
          clock_out_time = ?,
          end_odometer = ?,
          total_distance = ?,
          shift_duration_minutes = ?,
          status = 'completed',
          updated_at = ?
        WHERE id = ? AND driver_id = ?
      `;
      
      const params = [
        clockOutISO,
        endOdometer,
        totalDistance,
        shiftDurationMinutes,
        clockOutISO,
        activeShift.id,
        driverId
      ];
      
      const result = await dbConnection.run(sql, params);
      
      if (result.changes === 0) {
        throw new Error('Failed to update shift record');
      }
      
      console.log(`[${new Date().toISOString()}] ✅ Shift completed: Driver ${driverId}, Shift ID: ${activeShift.id}, Distance: ${totalDistance} km, Duration: ${shiftDurationMinutes} minutes`);
      
      // Return the completed shift
      return await this.getShiftById(activeShift.id);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error completing shift:`, error.message);
      throw error;
    }
  }
}

module.exports = new ShiftHelpers();