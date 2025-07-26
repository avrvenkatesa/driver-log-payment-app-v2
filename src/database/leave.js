const dbConnection = require('./connection.js');

/**
 * Leave Management Database Operations
 * Story 12: Leave Management Foundation
 */
class LeaveDatabase {
    
    /**
     * Add cancellation columns to existing leave_requests table
     */
    async migrateCancellationColumns() {
        const alterQueries = [
            `ALTER TABLE leave_requests ADD COLUMN cancelled_at DATETIME;`,
            `ALTER TABLE leave_requests ADD COLUMN cancelled_by TEXT;`,
            `ALTER TABLE leave_requests ADD COLUMN cancellation_reason TEXT;`,
            `ALTER TABLE leave_requests ADD COLUMN original_status TEXT;`
        ];
        
        for (const query of alterQueries) {
            try {
                await dbConnection.run(query);
                console.log(`[${new Date().toISOString()}] ✅ Migration executed: ${query}`);
            } catch (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`[${new Date().toISOString()}] ⚠️ Column already exists, skipping: ${query}`);
                } else {
                    console.error(`[${new Date().toISOString()}] ❌ Migration error: ${query}`, err);
                }
            }
        }
        
        // Create index for better performance
        try {
            await dbConnection.run(`CREATE INDEX IF NOT EXISTS idx_leave_requests_cancelled ON leave_requests(status, cancelled_at);`);
            console.log(`[${new Date().toISOString()}] ✅ Cancellation index created successfully`);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] ❌ Error creating cancellation index:`, err);
        }
    }

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
                    cancelled_at DATETIME,
                    cancelled_by TEXT,
                    cancellation_reason TEXT,
                    original_status TEXT,
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
        try {
            const { driver_id, leave_date, leave_type, reason } = leaveData;
            
            const insertQuery = `
                INSERT INTO leave_requests (driver_id, leave_date, leave_type, reason, requested_at)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const currentTimestamp = new Date().toISOString();
            
            const result = await dbConnection.run(insertQuery, [
                driver_id,
                leave_date,
                leave_type || 'annual',
                reason || null,
                currentTimestamp
            ]);
            
            console.log(`[${new Date().toISOString()}] ✅ Leave request submitted: ID ${result.lastID}`);
            return {
                id: result.lastID,
                driver_id,
                leave_date,
                leave_type: leave_type || 'annual',
                reason,
                status: 'pending',
                requested_at: currentTimestamp
            };
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error submitting leave request:`, error);
            
            // Handle duplicate date constraint violation
            if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE')) {
                throw {
                    code: 'DUPLICATE_DATE',
                    message: 'You already have a leave request for this date',
                    details: { leave_date: leaveData.leave_date, driver_id: leaveData.driver_id }
                };
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Get leave requests for a driver by year
     * @param {number} driverId - Driver ID
     * @param {number} year - Year (default: current year)
     * @returns {Promise<Array>} Leave requests array
     */
    async getDriverLeaveRequests(driverId, year = new Date().getFullYear()) {
        try {
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
                    notes,
                    cancelled_at,
                    cancelled_by,
                    cancellation_reason,
                    original_status
                FROM leave_requests 
                WHERE driver_id = ? 
                  AND strftime('%Y', leave_date) = ?
                ORDER BY leave_date DESC
            `;
            
            const rows = await dbConnection.query(selectQuery, [driverId, year.toString()]);
            
            console.log(`[${new Date().toISOString()}] ✅ Found ${rows.length} leave requests for driver ${driverId} in ${year}`);
            return rows;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error fetching leave requests:`, error);
            throw error;
        }
    }
    
    /**
     * Calculate annual leave balance for a driver
     * @param {number} driverId - Driver ID
     * @param {number} year - Year (default: current year)
     * @returns {Promise<Object>} Leave balance information
     */
    async calculateAnnualLeaveBalance(driverId, year = new Date().getFullYear()) {
        try {
            const balanceQuery = `
                SELECT 
                    COUNT(*) as used_annual_days
                FROM leave_requests 
                WHERE driver_id = ? 
                  AND strftime('%Y', leave_date) = ?
                  AND leave_type = 'annual'
                  AND status = 'approved'
            `;
            
            const rows = await dbConnection.query(balanceQuery, [driverId, year.toString()]);
            
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
            return balance;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error calculating leave balance:`, error);
            throw error;
        }
    }
    
    /**
     * Check if a leave request exists for a specific date
     * @param {number} driverId - Driver ID
     * @param {string} leaveDate - Leave date (YYYY-MM-DD format)
     * @returns {Promise<Object|null>} Existing leave request or null
     */
    async checkExistingLeaveRequest(driverId, leaveDate) {
        try {
            const checkQuery = `
                SELECT id, leave_date, leave_type, status
                FROM leave_requests
                WHERE driver_id = ? AND leave_date = ?
            `;
            
            const rows = await dbConnection.query(checkQuery, [driverId, leaveDate]);
            const existingRequest = rows.length > 0 ? rows[0] : null;
            return existingRequest;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error checking existing leave request:`, error);
            throw error;
        }
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
    
    /**
     * Get a single leave request by ID (for admin cancellation)
     * @param {number} leaveRequestId - Leave request ID
     * @returns {Promise<Object>} Leave request object
     */
    async getLeaveRequestById(leaveRequestId) {
        try {
            const query = `
                SELECT lr.*, d.name as driver_name
                FROM leave_requests lr
                JOIN drivers d ON lr.driver_id = d.id
                WHERE lr.id = ?
            `;
            
            const leaveRequest = await dbConnection.get(query, [leaveRequestId]);
            
            if (!leaveRequest) {
                throw new Error(`Leave request with ID ${leaveRequestId} not found`);
            }
            
            console.log(`[${new Date().toISOString()}] ✅ Leave request ${leaveRequestId} retrieved for admin cancellation`);
            return leaveRequest;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error retrieving leave request ${leaveRequestId}:`, error);
            throw error;
        }
    }

    /**
     * Cancel a leave request (driver or admin)
     * @param {number} leaveRequestId - Leave request ID
     * @param {string} cancelledBy - Who cancelled ('driver' or admin identifier)  
     * @param {string} cancellationReason - Reason for cancellation
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelLeaveRequest(leaveRequestId, cancelledBy, cancellationReason) {
        try {
            // First get the current leave request
            const getQuery = `SELECT * FROM leave_requests WHERE id = ?`;
            const leaveRequest = await dbConnection.get(getQuery, [leaveRequestId]);
            
            if (!leaveRequest) {
                throw new Error('Leave request not found');
            }
            
            if (leaveRequest.status === 'cancelled') {
                throw new Error('Leave request is already cancelled');
            }
            
            const currentTimestamp = new Date().toISOString();
            
            // Update the leave request with cancellation details
            const updateQuery = `
                UPDATE leave_requests 
                SET status = 'cancelled',
                    cancelled_at = ?,
                    cancelled_by = ?,
                    cancellation_reason = ?,
                    original_status = ?
                WHERE id = ?
            `;
            
            await dbConnection.run(updateQuery, [
                currentTimestamp,
                cancelledBy,
                cancellationReason,
                leaveRequest.status, // preserve original status
                leaveRequestId
            ]);
            
            console.log(`[${new Date().toISOString()}] ✅ Leave request ${leaveRequestId} cancelled by ${cancelledBy}`);
            
            return {
                leaveRequestId: leaveRequestId,
                status: 'cancelled',
                cancelledAt: currentTimestamp,
                cancelledBy: cancelledBy,
                cancellationReason: cancellationReason,
                originalStatus: leaveRequest.status,
                leaveType: leaveRequest.leave_type,
                leaveDate: leaveRequest.leave_date,
                driverId: leaveRequest.driver_id
            };
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error cancelling leave request ${leaveRequestId}:`, error);
            throw error;
        }
    }
    
    /**
     * Check if a driver can cancel their leave request (24-hour rule)
     * @param {string} leaveDate - Leave date (YYYY-MM-DD)
     * @returns {Object} Cancellation eligibility and time remaining
     */
    canDriverCancelLeave(leaveDate) {
        try {
            const now = new Date();
            const leaveStartTime = new Date(leaveDate + 'T00:00:00+05:30'); // IST timezone
            const timeDifference = leaveStartTime - now;
            const hoursRemaining = timeDifference / (1000 * 60 * 60);
            
            const canCancel = hoursRemaining > 24;
            
            // Format time remaining for display
            let timeRemainingText = '';
            if (hoursRemaining > 0) {
                const hours = Math.floor(hoursRemaining);
                const minutes = Math.floor((hoursRemaining - hours) * 60);
                timeRemainingText = `${hours} hours ${minutes} minutes`;
            } else {
                timeRemainingText = 'Leave date has passed';
            }
            
            return {
                canCancel: canCancel,
                hoursRemaining: hoursRemaining,
                timeRemainingText: timeRemainingText,
                minimumRequired: '24 hours'
            };
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error checking cancellation eligibility:`, error);
            return {
                canCancel: false,
                hoursRemaining: 0,
                timeRemainingText: 'Error calculating time',
                minimumRequired: '24 hours'
            };
        }
    }
    
    /**
     * Calculate and restore leave balance for cancelled annual leave
     * @param {number} driverId - Driver ID
     * @param {string} leaveType - Type of leave (annual, sick, emergency)
     * @returns {Promise<number>} Balance restored (1 for annual, 0 for others)
     */
    async restoreLeaveBalance(driverId, leaveType) {
        try {
            if (leaveType === 'annual') {
                // For annual leave, we restore the balance by reducing used count
                // This is handled in the balance calculation, not stored separately
                console.log(`[${new Date().toISOString()}] ✅ Annual leave balance restored for driver ${driverId}`);
                return 1; // 1 day restored
            }
            
            // Sick and emergency leave don't affect annual balance
            return 0;
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error restoring leave balance:`, error);
            return 0;
        }
    }
}

module.exports = new LeaveDatabase();