const dbConnection = require('./connection.js');

/**
 * Leave Management Database Operations
 * Story 12: Leave Management Foundation
 */
class LeaveDatabase {
    
    /**
     * Initialize leave_requests table with proper schema
     */
    async initializeLeaveTable() {
        return new Promise((resolve, reject) => {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS leave_requests (
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
                )
            `;
            
            dbConnection.query(createTableQuery, [], (err, result) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] ❌ Error creating leave_requests table:`, err);
                    reject(err);
                } else {
                    console.log(`[${new Date().toISOString()}] ✅ Leave requests table created successfully`);
                    resolve(result);
                }
            });
        });
    }
    
    /**
     * Submit a new leave request
     * @param {Object} leaveData - Leave request data
     * @returns {Promise<Object>} Created leave request with ID
     */
    async submitLeaveRequest(leaveData) {
        return new Promise((resolve, reject) => {
            const { driver_id, leave_date, leave_type, reason } = leaveData;
            
            const insertQuery = `
                INSERT INTO leave_requests (driver_id, leave_date, leave_type, reason, requested_at)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const currentTimestamp = new Date().toISOString();
            
            dbConnection.query(insertQuery, [
                driver_id,
                leave_date,
                leave_type || 'annual',
                reason || null,
                currentTimestamp
            ], (err, result) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] ❌ Error submitting leave request:`, err);
                    
                    // Handle duplicate date constraint violation
                    if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
                        reject({
                            code: 'DUPLICATE_DATE',
                            message: 'You already have a leave request for this date',
                            details: { leave_date, driver_id }
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    console.log(`[${new Date().toISOString()}] ✅ Leave request submitted: ID ${result.lastID}`);
                    resolve({
                        id: result.lastID,
                        driver_id,
                        leave_date,
                        leave_type: leave_type || 'annual',
                        reason,
                        status: 'pending',
                        requested_at: currentTimestamp
                    });
                }
            });
        });
    }
    
    /**
     * Get leave requests for a driver by year
     * @param {number} driverId - Driver ID
     * @param {number} year - Year (default: current year)
     * @returns {Promise<Array>} Leave requests array
     */
    async getDriverLeaveRequests(driverId, year = new Date().getFullYear()) {
        return new Promise((resolve, reject) => {
            const selectQuery = `
                SELECT 
                    id,
                    driver_id,
                    leave_date,
                    leave_type,
                    reason,
                    status,
                    requested_at,
                    approved_by,
                    approved_at,
                    notes
                FROM leave_requests 
                WHERE driver_id = ? 
                  AND strftime('%Y', leave_date) = ?
                ORDER BY leave_date DESC
            `;
            
            dbConnection.query(selectQuery, [driverId, year.toString()], (err, rows) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] ❌ Error fetching leave requests:`, err);
                    reject(err);
                } else {
                    console.log(`[${new Date().toISOString()}] ✅ Found ${rows.length} leave requests for driver ${driverId} in ${year}`);
                    resolve(rows);
                }
            });
        });
    }
    
    /**
     * Calculate annual leave balance for a driver
     * @param {number} driverId - Driver ID
     * @param {number} year - Year (default: current year)
     * @returns {Promise<Object>} Leave balance information
     */
    async calculateAnnualLeaveBalance(driverId, year = new Date().getFullYear()) {
        return new Promise((resolve, reject) => {
            const balanceQuery = `
                SELECT 
                    COUNT(*) as used_annual_days
                FROM leave_requests 
                WHERE driver_id = ? 
                  AND strftime('%Y', leave_date) = ?
                  AND leave_type = 'annual'
                  AND status = 'approved'
            `;
            
            dbConnection.query(balanceQuery, [driverId, year.toString()], (err, rows) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] ❌ Error calculating leave balance:`, err);
                    reject(err);
                } else {
                    const usedDays = rows[0]?.used_annual_days || 0;
                    const totalDays = 12; // Maximum annual leave days
                    const remainingDays = Math.max(0, totalDays - usedDays);
                    
                    const balance = {
                        total: totalDays,
                        used: usedDays,
                        remaining: remainingDays,
                        year: year
                    };
                    
                    console.log(`[${new Date().toISOString()}] ✅ Leave balance calculated for driver ${driverId}:`, balance);
                    resolve(balance);
                }
            });
        });
    }
    
    /**
     * Check if a leave request exists for a specific date
     * @param {number} driverId - Driver ID
     * @param {string} leaveDate - Leave date (YYYY-MM-DD format)
     * @returns {Promise<Object|null>} Existing leave request or null
     */
    async checkExistingLeaveRequest(driverId, leaveDate) {
        return new Promise((resolve, reject) => {
            const checkQuery = `
                SELECT id, leave_date, leave_type, status
                FROM leave_requests
                WHERE driver_id = ? AND leave_date = ?
            `;
            
            dbConnection.query(checkQuery, [driverId, leaveDate], (err, rows) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] ❌ Error checking existing leave request:`, err);
                    reject(err);
                } else {
                    const existingRequest = rows.length > 0 ? rows[0] : null;
                    resolve(existingRequest);
                }
            });
        });
    }
    
    /**
     * Update leave request status (for admin approval/rejection)
     * @param {number} leaveRequestId - Leave request ID
     * @param {string} status - New status (approved/rejected)
     * @param {string} approvedBy - Admin who approved/rejected
     * @param {string} notes - Optional notes
     * @returns {Promise<Object>} Updated leave request
     */
    async updateLeaveRequestStatus(leaveRequestId, status, approvedBy, notes = null) {
        return new Promise((resolve, reject) => {
            const updateQuery = `
                UPDATE leave_requests 
                SET status = ?, 
                    approved_by = ?, 
                    approved_at = ?,
                    notes = ?
                WHERE id = ?
            `;
            
            const approvedAt = new Date().toISOString();
            
            dbConnection.query(updateQuery, [
                status,
                approvedBy,
                approvedAt,
                notes,
                leaveRequestId
            ], (err, result) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] ❌ Error updating leave request status:`, err);
                    reject(err);
                } else if (result.changes === 0) {
                    reject(new Error(`Leave request with ID ${leaveRequestId} not found`));
                } else {
                    console.log(`[${new Date().toISOString()}] ✅ Leave request ${leaveRequestId} status updated to: ${status}`);
                    resolve({
                        id: leaveRequestId,
                        status,
                        approved_by: approvedBy,
                        approved_at: approvedAt,
                        notes
                    });
                }
            });
        });
    }
}

module.exports = new LeaveDatabase();