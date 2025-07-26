/**
 * Admin Driver Management Database Operations
 * Story 13: Driver Management (Admin)
 * 
 * Comprehensive driver management functions for administrators
 * Includes metrics calculation, status management, and detailed driver information
 */

const dbConnection = require('./connection');

/**
 * Get comprehensive driver list with metrics and pagination
 * @param {Object} options - Query options
 * @param {string} options.search - Search term for name/phone/email
 * @param {string} options.status - Filter by status (active, inactive, all)
 * @param {number} options.page - Page number for pagination
 * @param {number} options.limit - Results per page
 * @returns {Object} Driver list with pagination and summary
 */
async function getDriversList(options = {}) {
  const {
    search = '',
    status = 'all',
    page = 1,
    limit = 10
  } = options;

  try {
    console.log(`[Admin Drivers DB] ==> Getting drivers list with options:`, options);
    
    // Build WHERE clause for search and filtering
    let whereClause = '1=1';
    const params = [];
    
    // Search functionality
    if (search && search.trim()) {
      whereClause += ` AND (d.name LIKE ? OR d.phone LIKE ? OR d.email LIKE ?)`;
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Status filtering
    if (status === 'active') {
      whereClause += ` AND d.is_active = 1`;
    } else if (status === 'inactive') {
      whereClause += ` AND d.is_active = 0`;
    }
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Main query to get drivers with comprehensive metrics
    const driversQuery = `
      SELECT 
        d.id,
        d.name,
        d.phone,
        d.email,
        d.is_active,
        d.is_phone_verified,
        d.created_at,
        d.updated_at,
        COUNT(DISTINCT s.id) as total_shifts,
        COALESCE(SUM(s.shift_duration_minutes) / 60.0, 0) as total_hours,
        COALESCE(SUM(s.total_distance), 0) as total_distance,
        COUNT(DISTINCT lr.id) as leave_requests_count,
        MAX(s.clock_out_time) as last_shift_date,
        MAX(s.created_at) as last_active
      FROM drivers d
      LEFT JOIN shifts s ON d.id = s.driver_id AND s.status = 'completed'
      LEFT JOIN leave_requests lr ON d.id = lr.driver_id
      WHERE ${whereClause}
      GROUP BY d.id, d.name, d.phone, d.email, d.is_active, d.is_phone_verified, d.created_at, d.updated_at
      ORDER BY d.name ASC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    
    console.log(`[Admin Drivers DB] ==> Executing drivers query with ${params.length} parameters`);
    const drivers = await dbConnection.query(driversQuery, params);
    
    // Count total drivers for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM drivers d
      LEFT JOIN shifts s ON d.id = s.driver_id
      LEFT JOIN leave_requests lr ON d.id = lr.driver_id
      WHERE ${whereClause.replace('LIMIT ? OFFSET ?', '')}
    `;
    
    const countParams = params.slice(0, -2); // Remove limit and offset
    const totalResult = await dbConnection.query(countQuery, countParams);
    const totalDrivers = totalResult[0]?.total || 0;
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_drivers,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_drivers,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_drivers,
        SUM(CASE WHEN is_phone_verified = 1 THEN 1 ELSE 0 END) as verified_drivers
      FROM drivers
    `;
    
    const summaryResult = await dbConnection.query(summaryQuery);
    const summary = summaryResult[0] || {};
    
    // Format driver data
    const formattedDrivers = drivers.map(driver => ({
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      is_active: driver.is_active,
      is_phone_verified: driver.is_phone_verified,
      created_at: driver.created_at,
      last_active: driver.last_active || driver.updated_at,
      metrics: {
        totalShifts: parseInt(driver.total_shifts) || 0,
        totalHours: parseFloat(driver.total_hours) || 0,
        totalDistance: parseFloat(driver.total_distance) || 0,
        leaveRequests: parseInt(driver.leave_requests_count) || 0,
        lastShiftDate: driver.last_shift_date
      }
    }));
    
    const result = {
      drivers: formattedDrivers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDrivers / limit),
        totalDrivers: totalDrivers,
        limit: limit,
        hasNext: page < Math.ceil(totalDrivers / limit),
        hasPrev: page > 1
      },
      summary: {
        totalDrivers: parseInt(summary.total_drivers) || 0,
        activeDrivers: parseInt(summary.active_drivers) || 0,
        inactiveDrivers: parseInt(summary.inactive_drivers) || 0,
        verifiedDrivers: parseInt(summary.verified_drivers) || 0
      }
    };
    
    console.log(`[Admin Drivers DB] ==> Retrieved ${formattedDrivers.length} drivers (Page ${page}/${result.pagination.totalPages})`);
    return result;
    
  } catch (error) {
    console.error(`[Admin Drivers DB] ==> Error getting drivers list:`, error.message);
    throw new Error(`Failed to retrieve drivers list: ${error.message}`);
  }
}

/**
 * Update driver status (activate/deactivate)
 * @param {number} driverId - Driver ID
 * @param {boolean} isActive - New active status
 * @param {string} reason - Reason for status change
 * @param {number} adminId - Admin user ID making the change
 * @returns {Object} Updated driver information
 */
async function updateDriverStatus(driverId, isActive, reason, adminId) {
  try {
    console.log(`[Admin Drivers DB] ==> Updating driver ${driverId} status to ${isActive ? 'active' : 'inactive'}`);
    
    // First, get the current driver info
    const currentDriverQuery = `SELECT id, name, is_active FROM drivers WHERE id = ?`;
    const currentDriver = await dbConnection.query(currentDriverQuery, [driverId]);
    
    if (!currentDriver || currentDriver.length === 0) {
      throw new Error(`Driver with ID ${driverId} not found`);
    }
    
    const driver = currentDriver[0];
    const oldStatus = driver.is_active;
    
    // Update driver status
    const updateQuery = `
      UPDATE drivers 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    await dbConnection.query(updateQuery, [isActive ? 1 : 0, driverId]);
    
    // Get updated driver information
    const updatedDriverQuery = `
      SELECT id, name, is_active, updated_at 
      FROM drivers 
      WHERE id = ?
    `;
    
    const updatedDriver = await dbConnection.query(updatedDriverQuery, [driverId]);
    
    const result = {
      driverId: parseInt(driverId),
      name: driver.name,
      is_active: isActive,
      updated_at: updatedDriver[0]?.updated_at,
      updated_by: `admin_${adminId}`
    };
    
    console.log(`[Admin Drivers DB] ==> Driver ${driverId} status updated successfully: ${oldStatus} -> ${isActive ? 1 : 0}`);
    return result;
    
  } catch (error) {
    console.error(`[Admin Drivers DB] ==> Error updating driver status:`, error.message);
    throw new Error(`Failed to update driver status: ${error.message}`);
  }
}

/**
 * Get detailed driver information with metrics and history
 * @param {number} driverId - Driver ID
 * @returns {Object} Detailed driver information
 */
async function getDriverDetails(driverId) {
  try {
    console.log(`[Admin Drivers DB] ==> Getting detailed info for driver ${driverId}`);
    
    // Get basic driver information
    const driverQuery = `
      SELECT id, name, phone, email, is_active, is_phone_verified, created_at, updated_at
      FROM drivers 
      WHERE id = ?
    `;
    
    const driverResult = await dbConnection.query(driverQuery, [driverId]);
    
    if (!driverResult || driverResult.length === 0) {
      throw new Error(`Driver with ID ${driverId} not found`);
    }
    
    const driver = driverResult[0];
    
    // Get comprehensive metrics
    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_shifts,
        COALESCE(SUM(s.shift_duration_minutes) / 60.0, 0) as total_hours,
        COALESCE(SUM(s.total_distance), 0) as total_distance,
        COALESCE(AVG(s.shift_duration_minutes) / 60.0, 0) as average_shift_duration,
        MAX(s.clock_out_time) as last_shift_date
      FROM shifts s
      WHERE s.driver_id = ? AND s.status = 'completed'
    `;
    
    const metricsResult = await dbConnection.query(metricsQuery, [driverId]);
    const metrics = metricsResult[0] || {};
    
    // Get recent shifts (last 5)
    const recentShiftsQuery = `
      SELECT 
        DATE(clock_in_time) as date,
        shift_duration_minutes / 60.0 as duration_hours,
        total_distance
      FROM shifts
      WHERE driver_id = ? AND status = 'completed'
      ORDER BY clock_out_time DESC
      LIMIT 5
    `;
    
    const recentShiftsResult = await dbConnection.query(recentShiftsQuery, [driverId]);
    const recentShifts = recentShiftsResult.map(shift => ({
      date: shift.date,
      duration: `${shift.duration_hours?.toFixed(1)} hours`,
      distance: `${shift.total_distance || 0} km`
    }));
    
    // Get leave requests (recent 5)
    const leaveRequestsQuery = `
      SELECT id, leave_date, leave_type, status, requested_at
      FROM leave_requests
      WHERE driver_id = ?
      ORDER BY requested_at DESC
      LIMIT 5
    `;
    
    const leaveRequestsResult = await dbConnection.query(leaveRequestsQuery, [driverId]);
    const leaveRequests = leaveRequestsResult || [];
    
    const result = {
      driver: driver,
      metrics: {
        totalShifts: parseInt(metrics.total_shifts) || 0,
        totalHours: parseFloat(metrics.total_hours) || 0,
        totalDistance: parseFloat(metrics.total_distance) || 0,
        averageShiftDuration: parseFloat(metrics.average_shift_duration) || 0,
        lastShiftDate: metrics.last_shift_date
      },
      recentShifts: recentShifts,
      leaveRequests: leaveRequests
    };
    
    console.log(`[Admin Drivers DB] ==> Retrieved detailed info for driver ${driverId}: ${metrics.total_shifts} shifts, ${metrics.total_hours}h`);
    return result;
    
  } catch (error) {
    console.error(`[Admin Drivers DB] ==> Error getting driver details:`, error.message);
    throw new Error(`Failed to retrieve driver details: ${error.message}`);
  }
}

module.exports = {
  getDriversList,
  updateDriverStatus,
  getDriverDetails
};