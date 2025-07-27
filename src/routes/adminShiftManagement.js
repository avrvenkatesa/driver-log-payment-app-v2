// Story 17: Manual Shift Management (Admin) - API Routes
// Implementation for comprehensive admin shift management with audit trails

const express = require('express');
const { requireAdminOnly, requireDriverOrAdmin } = require('../auth/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection - using the same approach as other routes
const dbPath = path.join(process.cwd(), 'company.db');
const dbConnection = new sqlite3.Database(dbPath);

// IST timezone conversion utility (inline for this module)
function convertToIST(utcTimestamp) {
  if (!utcTimestamp) return null;
  
  const date = new Date(utcTimestamp);
  
  const istString = date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  return {
    timestamp: date,
    formatted: istString,
    iso: date.toISOString()
  };
}

const router = express.Router();

// Apply admin-only middleware to all routes
router.use(requireAdminOnly);

// GET /api/admin/shifts - List shifts with pagination and filtering
router.get('/shifts', async (req, res) => {
    try {
        console.log('[Manual Shift] Fetching shifts list');
        
        const { 
            page = 1, 
            limit = 20, 
            driver_id = null, 
            status = 'all', 
            date = null 
        } = req.query;
        
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        
        // Build WHERE clause
        let whereConditions = [];
        let params = [];
        
        if (driver_id && driver_id !== 'all') {
            whereConditions.push('s.driver_id = ?');
            params.push(parseInt(driver_id));
        }
        
        if (status && status !== 'all') {
            const statusCondition = status === 'active' ? 's.clock_out_time IS NULL' : 's.clock_out_time IS NOT NULL';
            whereConditions.push(statusCondition);
        }
        
        if (date) {
            whereConditions.push('DATE(s.clock_in_time) = ?');
            params.push(date);
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM shifts s
            INNER JOIN drivers d ON s.driver_id = d.id
            ${whereClause}
        `;
        
        const totalResult = new Promise((resolve, reject) => {
            dbConnection.get(countQuery, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const totalCount = await totalResult;
        const total = totalCount.total;
        
        // Get shifts
        const shiftsQuery = `
            SELECT 
                s.*,
                d.name as driver_name,
                d.phone as driver_phone,
                CASE 
                    WHEN s.clock_out_time IS NULL THEN 'active'
                    ELSE 'completed'
                END as status,
                CASE 
                    WHEN s.clock_out_time IS NOT NULL 
                    THEN (julianday(s.clock_out_time) - julianday(s.clock_in_time)) * 24 * 60
                    ELSE NULL
                END as duration_minutes,
                CASE 
                    WHEN s.end_odometer IS NOT NULL 
                    THEN s.end_odometer - s.start_odometer
                    ELSE NULL
                END as total_distance
            FROM shifts s
            INNER JOIN drivers d ON s.driver_id = d.id
            ${whereClause}
            ORDER BY s.clock_in_time DESC
            LIMIT ? OFFSET ?
        `;
        
        const shiftsResult = new Promise((resolve, reject) => {
            dbConnection.all(shiftsQuery, [...params, limitNum, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const shifts = await shiftsResult;
        
        // Convert timestamps to IST
        const shiftsWithIST = shifts.map(shift => {
            let clockInFormatted = shift.clock_in_time;
            let clockOutFormatted = shift.clock_out_time;
            
            try {
                // Try to parse and convert the dates if they're valid
                if (shift.clock_in_time) {
                    const clockInDate = new Date(shift.clock_in_time);
                    if (!isNaN(clockInDate.getTime())) {
                        clockInFormatted = convertToIST(clockInDate).formatted;
                    }
                }
                
                if (shift.clock_out_time) {
                    const clockOutDate = new Date(shift.clock_out_time);
                    if (!isNaN(clockOutDate.getTime())) {
                        clockOutFormatted = convertToIST(clockOutDate).formatted;
                    }
                }
            } catch (error) {
                console.log(`[Manual Shift] Date conversion error for shift ${shift.id}:`, error.message);
                // Keep original values if conversion fails
            }
            
            return {
                ...shift,
                clock_in_time: clockInFormatted,
                clock_out_time: clockOutFormatted
            };
        });
        
        const totalPages = Math.ceil(total / limitNum);
        
        res.json({
            success: true,
            data: {
                shifts: shiftsWithIST,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalShifts: total,
                    limit: limitNum,
                    hasNext: pageNum < totalPages,
                    hasPrev: pageNum > 1
                }
            }
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error fetching shifts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch shifts',
            message: error.message
        });
    }
});

// GET /api/admin/shifts/:id - Get single shift details
router.get('/shifts/:id', async (req, res) => {
    try {
        const shiftId = parseInt(req.params.id);
        
        const shiftResult = new Promise((resolve, reject) => {
            dbConnection.get(`
                SELECT 
                    s.*,
                    d.name as driver_name,
                    d.phone as driver_phone,
                    CASE 
                        WHEN s.clock_out_time IS NULL THEN 'active'
                        ELSE 'completed'
                    END as status
                FROM shifts s
                INNER JOIN drivers d ON s.driver_id = d.id
                WHERE s.id = ?
            `, shiftId, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const shift = await shiftResult;
        
        if (!shift) {
            return res.status(404).json({
                success: false,
                error: 'Shift not found'
            });
        }
        
        // Convert timestamps to IST
        const shiftWithIST = {
            ...shift,
            clock_in_time: shift.clock_in_time ? convertToIST(shift.clock_in_time).iso : null,
            clock_out_time: shift.clock_out_time ? convertToIST(shift.clock_out_time).iso : null
        };
        
        res.json({
            success: true,
            data: shiftWithIST
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error fetching shift details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch shift details',
            message: error.message
        });
    }
});

// Validation function for shift data
function validateShiftData(shiftData, existingShifts = []) {
    const errors = [];
    
    // 1. Required fields validation
    const requiredFields = ['driverId', 'date', 'startTime', 'endTime', 'startOdometer', 'endOdometer'];
    requiredFields.forEach(field => {
        if (shiftData[field] === undefined || shiftData[field] === null || shiftData[field] === '') {
            errors.push(`${field} is required`);
        }
    });
    
    if (errors.length > 0) return { isValid: false, errors };
    
    // 2. Time logic validation
    const startDateTime = new Date(`${shiftData.date}T${shiftData.startTime}`);
    const endDateTime = new Date(`${shiftData.date}T${shiftData.endTime}`);
    
    if (endDateTime <= startDateTime) {
        errors.push('End time must be after start time');
    }
    
    // 3. Odometer validation
    const startOdo = parseInt(shiftData.startOdometer);
    const endOdo = parseInt(shiftData.endOdometer);
    
    if (endOdo <= startOdo) {
        errors.push('End odometer must be greater than start odometer');
    }
    
    // 4. Odometer continuity validation
    const previousShift = existingShifts
        .filter(s => s.driver_id === parseInt(shiftData.driverId) && s.shift_date < shiftData.date)
        .sort((a, b) => new Date(b.shift_date) - new Date(a.shift_date))[0];
        
    if (previousShift && startOdo < previousShift.end_odometer) {
        errors.push(`Start odometer (${startOdo}) must be >= previous shift end odometer (${previousShift.end_odometer})`);
    }
    
    // 5. Date validation
    const shiftDate = new Date(shiftData.date);
    const now = new Date();
    const maxFutureDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    
    if (shiftDate > maxFutureDate) {
        errors.push('Shift date cannot be more than 30 days in the future');
    }
    
    // 6. Reasonable duration validation (1-24 hours)
    const durationHours = (endDateTime - startDateTime) / (1000 * 60 * 60);
    if (durationHours > 24) {
        errors.push('Shift duration cannot exceed 24 hours');
    }
    
    if (durationHours < 0.5) {
        errors.push('Shift duration must be at least 30 minutes');
    }
    
    // 7. Reasonable distance validation (0-1000 km per shift)
    const distance = endOdo - startOdo;
    if (distance > 1000) {
        errors.push('Shift distance cannot exceed 1000 km');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Create audit log entry
async function createAuditLog(shiftId, action, oldValues, newValues, changedBy, notes) {
    try {
        return new Promise((resolve, reject) => {
            dbConnection.run(`
                INSERT INTO shift_audit_log (shift_id, action, old_values, new_values, changed_by, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                shiftId,
                action,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                changedBy,
                notes
            ], function(err) {
                if (err) {
                    console.error('[Audit Log] Error creating audit entry:', err);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    } catch (error) {
        console.error('[Audit Log] Error creating audit entry:', error);
        throw error;
    }
}

// POST /api/admin/shifts - Manual shift creation
router.post('/shifts', async (req, res) => {
    try {
        console.log('[Manual Shift] Creating new shift:', req.body);
        
        const { driverId, date, startTime, endTime, startOdometer, endOdometer, notes } = req.body;
        const adminId = req.user.id;
        
        // Get existing shifts for validation
        const existingShiftsResult = new Promise((resolve, reject) => {
            dbConnection.all(`
                SELECT * FROM shifts WHERE driver_id = ? ORDER BY clock_in_time DESC
            `, [driverId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const existingShifts = await existingShiftsResult;
        
        // Validate shift data
        const validation = validateShiftData({
            driverId, date, startTime, endTime, startOdometer, endOdometer
        }, existingShifts);
        
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.errors
            });
        }
        
        // Check for duplicate shift on same date
        const duplicateResult = new Promise((resolve, reject) => {
            dbConnection.get(`
                SELECT id FROM shifts WHERE driver_id = ? AND DATE(clock_in_time) = ?
            `, [driverId, date], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const duplicateCheck = await duplicateResult;
        
        if (duplicateCheck) {
            return res.status(400).json({
                success: false,
                message: 'A shift already exists for this driver on this date'
            });
        }
        
        // Calculate shift details
        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);
        const durationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));
        const distance = parseInt(endOdometer) - parseInt(startOdometer);
        
        // Create shift  
        const insertResult = new Promise((resolve, reject) => {
            dbConnection.run(`
                INSERT INTO shifts (
                    driver_id, clock_in_time, clock_out_time, 
                    start_odometer, end_odometer, total_distance, 
                    shift_duration_minutes, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))
            `, [
                driverId,
                convertToIST(startDateTime).formatted,
                convertToIST(endDateTime).formatted,
                startOdometer, endOdometer, distance, durationMinutes
            ], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
        
        const result = await insertResult;
        
        const shiftId = result.lastInsertRowid;
        
        // Create audit log
        const newValues = {
            driverId, date, startTime, endTime, startOdometer, endOdometer, 
            duration: durationMinutes, distance, notes
        };
        
        const auditId = await createAuditLog(shiftId, 'create', null, newValues, adminId, notes);
        
        // Get driver name for response
        const driverResult = new Promise((resolve, reject) => {
            dbConnection.get('SELECT name FROM drivers WHERE id = ?', [driverId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const driver = await driverResult;
        
        console.log(`[Manual Shift] Created shift ${shiftId} for driver ${driverId}`);
        
        res.json({
            success: true,
            message: 'Shift created successfully',
            data: {
                shiftId: shiftId,
                driverId: parseInt(driverId),
                driverName: driver?.name || 'Unknown',
                date: date,
                duration: durationMinutes,
                distance: distance,
                createdBy: `admin_${adminId}`,
                auditId: auditId
            }
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error creating shift:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating shift'
        });
    }
});

// PUT /api/admin/shifts/:shiftId - Edit existing shift
router.put('/shifts/:shiftId', async (req, res) => {
    try {
        const shiftId = parseInt(req.params.shiftId);
        const { startTime, endTime, startOdometer, endOdometer, notes } = req.body;
        const adminId = req.user.id;
        
        console.log(`[Manual Shift] Editing shift ${shiftId}:`, req.body);
        
        // Get existing shift
        const existingShift = dbConnection.prepare(`
            SELECT * FROM shifts WHERE id = ?
        `).get(shiftId);
        
        if (!existingShift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }
        
        // Get existing shifts for validation (excluding current one)
        const existingShifts = dbConnection.prepare(`
            SELECT * FROM shifts WHERE driver_id = ? AND id != ? ORDER BY shift_date DESC
        `).all(existingShift.driver_id, shiftId);
        
        // Prepare validation data
        const shiftData = {
            driverId: existingShift.driver_id,
            date: existingShift.shift_date,
            startTime: startTime || existingShift.clock_in_time.split(', ')[1].split(' ')[0],
            endTime: endTime || existingShift.clock_out_time.split(', ')[1].split(' ')[0],
            startOdometer: startOdometer || existingShift.start_odometer,
            endOdometer: endOdometer || existingShift.end_odometer
        };
        
        // Validate changes
        const validation = validateShiftData(shiftData, existingShifts);
        
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.errors
            });
        }
        
        // Prepare original values for audit
        const originalValues = {
            startTime: existingShift.clock_in_time,
            endTime: existingShift.clock_out_time,
            startOdometer: existingShift.start_odometer,
            endOdometer: existingShift.end_odometer,
            duration: existingShift.shift_duration_minutes,
            distance: existingShift.total_distance
        };
        
        // Calculate new values
        const startDateTime = new Date(`${existingShift.shift_date}T${shiftData.startTime}`);
        const endDateTime = new Date(`${existingShift.shift_date}T${shiftData.endTime}`);
        const newDurationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));
        const newDistance = parseInt(shiftData.endOdometer) - parseInt(shiftData.startOdometer);
        
        // Update shift
        const updateStmt = dbConnection.prepare(`
            UPDATE shifts SET 
                clock_in_time = ?, clock_out_time = ?, 
                start_odometer = ?, end_odometer = ?, 
                total_distance = ?, shift_duration_minutes = ?,
                last_modified_by = ?, last_modified_at = datetime('now')
            WHERE id = ?
        `);
        
        updateStmt.run(
            convertToIST(startDateTime).formatted,
            convertToIST(endDateTime).formatted,
            shiftData.startOdometer, shiftData.endOdometer,
            newDistance, newDurationMinutes, adminId, shiftId
        );
        
        // Prepare new values for audit
        const newValues = {
            startTime: convertToIST(startDateTime).formatted,
            endTime: convertToIST(endDateTime).formatted,
            startOdometer: shiftData.startOdometer,
            endOdometer: shiftData.endOdometer,
            duration: newDurationMinutes,
            distance: newDistance,
            notes
        };
        
        // Create audit log
        const auditId = await createAuditLog(shiftId, 'update', originalValues, newValues, adminId, notes);
        
        console.log(`[Manual Shift] Updated shift ${shiftId}`);
        
        res.json({
            success: true,
            message: 'Shift updated successfully',
            data: {
                shiftId: shiftId,
                originalValues: originalValues,
                newValues: newValues,
                modifiedBy: `admin_${adminId}`,
                auditId: auditId
            }
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error updating shift:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while updating shift'
        });
    }
});

// DELETE /api/admin/shifts/:shiftId - Delete shift
router.delete('/shifts/:shiftId', async (req, res) => {
    try {
        const shiftId = parseInt(req.params.shiftId);
        const { reason } = req.body;
        const adminId = req.user.id;
        
        console.log(`[Manual Shift] Deleting shift ${shiftId}, reason:`, reason);
        
        // Get existing shift for audit
        const existingShift = dbConnection.prepare(`
            SELECT s.*, d.name as driver_name 
            FROM shifts s 
            JOIN drivers d ON s.driver_id = d.id 
            WHERE s.id = ?
        `).get(shiftId);
        
        if (!existingShift) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found'
            });
        }
        
        // Store shift data for audit
        const deletedShift = {
            driverId: existingShift.driver_id,
            driverName: existingShift.driver_name,
            date: existingShift.shift_date,
            startTime: existingShift.clock_in_time,
            endTime: existingShift.clock_out_time,
            startOdometer: existingShift.start_odometer,
            endOdometer: existingShift.end_odometer,
            duration: existingShift.shift_duration_minutes,
            distance: existingShift.total_distance
        };
        
        // Delete shift
        const deleteStmt = dbConnection.prepare('DELETE FROM shifts WHERE id = ?');
        const result = deleteStmt.run(shiftId);
        
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Shift not found or already deleted'
            });
        }
        
        // Create audit log
        const auditId = await createAuditLog(shiftId, 'delete', deletedShift, null, adminId, reason);
        
        console.log(`[Manual Shift] Deleted shift ${shiftId}`);
        
        res.json({
            success: true,
            message: 'Shift deleted successfully',
            data: {
                shiftId: shiftId,
                deletedShift: deletedShift,
                deletedBy: `admin_${adminId}`,
                reason: reason,
                auditId: auditId
            }
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error deleting shift:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while deleting shift'
        });
    }
});

// GET /api/admin/shifts/monthly/:driverId/:year/:month - Monthly shift editor
router.get('/shifts/monthly/:driverId/:year/:month', async (req, res) => {
    try {
        const { driverId, year, month } = req.params;
        
        console.log(`[Manual Shift] Loading monthly shifts for driver ${driverId}, ${year}/${month}`);
        
        // Get driver info
        const driver = dbConnection.prepare('SELECT id, name FROM drivers WHERE id = ?').get(driverId);
        
        if (!driver) {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }
        
        // Get shifts for the month
        const shiftsResult = new Promise((resolve, reject) => {
            dbConnection.all(`
                SELECT 
                    id, DATE(clock_in_time) as date, clock_in_time, clock_out_time,
                    start_odometer, end_odometer, total_distance as distance,
                    shift_duration_minutes as duration, status
                FROM shifts 
                WHERE driver_id = ? 
                AND strftime('%Y', clock_in_time) = ? 
                AND strftime('%m', clock_in_time) = ?
                ORDER BY clock_in_time ASC
            `, [driverId, year, month.padStart(2, '0')], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        const shifts = await shiftsResult;
        
        // Process shifts for response
        const processedShifts = shifts.map(shift => ({
            id: shift.id,
            date: shift.date,
            startTime: shift.clock_in_time ? shift.clock_in_time.split(', ')[1]?.split(' ')[0] : null,
            endTime: shift.clock_out_time ? shift.clock_out_time.split(', ')[1]?.split(' ')[0] : null,
            startOdometer: shift.start_odometer,
            endOdometer: shift.end_odometer,
            duration: shift.duration,
            distance: shift.distance,
            status: shift.status,
            isManualEntry: shift.created_by !== null
        }));
        
        // Calculate summary
        const summary = {
            totalShifts: processedShifts.length,
            totalHours: Math.round(processedShifts.reduce((sum, s) => sum + (s.duration || 0), 0) / 60 * 100) / 100,
            totalDistance: processedShifts.reduce((sum, s) => sum + (s.distance || 0), 0),
            daysWorked: processedShifts.length
        };
        
        const daysInMonth = new Date(year, month, 0).getDate();
        
        res.json({
            success: true,
            data: {
                driver: {
                    id: parseInt(driverId),
                    name: driver.name
                },
                period: {
                    year: parseInt(year),
                    month: parseInt(month),
                    totalDays: daysInMonth
                },
                shifts: processedShifts,
                summary: summary
            }
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error loading monthly shifts:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while loading shifts'
        });
    }
});

// GET /api/admin/audit/shifts - Audit trail
router.get('/audit/shifts', async (req, res) => {
    try {
        const { shiftId, limit = 50, page = 1 } = req.query;
        const offset = (page - 1) * limit;
        
        console.log('[Manual Shift] Loading audit trail, shiftId:', shiftId);
        
        let query = `
            SELECT 
                sal.id, sal.shift_id, sal.action, sal.old_values, sal.new_values,
                sal.changed_by, sal.changed_at, sal.notes,
                d.name as changed_by_name
            FROM shift_audit_log sal
            LEFT JOIN drivers d ON sal.changed_by = d.id
        `;
        
        let params = [];
        
        if (shiftId) {
            query += ' WHERE sal.shift_id = ?';
            params.push(shiftId);
        }
        
        query += ' ORDER BY sal.changed_at DESC';
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM shift_audit_log';
        if (shiftId) {
            countQuery += ' WHERE shift_id = ?';
        }
        
        const totalResult = new Promise((resolve, reject) => {
            dbConnection.get(countQuery, shiftId ? [shiftId] : [], (err, row) => {
                if (err) reject(err);
                else resolve(row || { total: 0 });
            });
        });
        
        const totalCount = await totalResult;
        const total = totalCount.total;
        
        // Get paginated results
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const auditResult = new Promise((resolve, reject) => {
            dbConnection.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        const auditTrail = await auditResult;
        
        // Process audit entries
        const processedAuditTrail = auditTrail.map(entry => {
            try {
                return {
                    id: entry.id,
                    shiftId: entry.shift_id,
                    action: entry.action,
                    changedBy: `admin_${entry.changed_by}`,
                    changedByName: entry.changed_by_name || 'Unknown',
                    changedAt: entry.changed_at ? convertToIST(new Date(entry.changed_at)).formatted : 'Unknown',
                    notes: entry.notes,
                    oldValues: entry.old_values ? JSON.parse(entry.old_values) : null,
                    newValues: entry.new_values ? JSON.parse(entry.new_values) : null
                };
            } catch (error) {
                console.log(`[Audit Log] Error processing entry ${entry?.id}:`, error.message);
                return null;
            }
        }).filter(entry => entry !== null);
        
        res.json({
            success: true,
            data: {
                auditTrail: processedAuditTrail,
                pagination: {
                    total: total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    hasNext: offset + parseInt(limit) < total,
                    hasPrev: page > 1
                }
            }
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error loading audit trail:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while loading audit trail'
        });
    }
});

// POST /api/admin/shifts/bulk - Bulk operations
router.post('/shifts/bulk', async (req, res) => {
    try {
        const { operation, shifts } = req.body;
        const adminId = req.user.id;
        
        console.log(`[Manual Shift] Bulk ${operation} operation for ${shifts.length} shifts`);
        
        if (!['create', 'update', 'delete'].includes(operation)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid operation. Must be create, update, or delete'
            });
        }
        
        const results = [];
        const auditIds = [];
        let successful = 0;
        let failed = 0;
        
        for (const shiftData of shifts) {
            try {
                if (operation === 'create') {
                    // Validate and create shift
                    const existingShifts = dbConnection.prepare(`
                        SELECT * FROM shifts WHERE driver_id = ? ORDER BY shift_date DESC
                    `).all(shiftData.driverId);
                    
                    const validation = validateShiftData(shiftData, existingShifts);
                    
                    if (!validation.isValid) {
                        results.push({ 
                            shiftData, 
                            status: 'failed', 
                            errors: validation.errors 
                        });
                        failed++;
                        continue;
                    }
                    
                    // Create shift (similar to individual create logic)
                    const startDateTime = new Date(`${shiftData.date}T${shiftData.startTime}`);
                    const endDateTime = new Date(`${shiftData.date}T${shiftData.endTime}`);
                    const durationMinutes = Math.round((endDateTime - startDateTime) / (1000 * 60));
                    const distance = parseInt(shiftData.endOdometer) - parseInt(shiftData.startOdometer);
                    
                    const insertStmt = dbConnection.prepare(`
                        INSERT INTO shifts (
                            driver_id, shift_date, clock_in_time, clock_out_time, 
                            start_odometer, end_odometer, total_distance, 
                            shift_duration_minutes, status, created_by, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, datetime('now'))
                    `);
                    
                    const result = insertStmt.run(
                        shiftData.driverId, shiftData.date,
                        convertToIST(startDateTime).formatted,
                        convertToIST(endDateTime).formatted,
                        shiftData.startOdometer, shiftData.endOdometer, 
                        distance, durationMinutes, adminId
                    );
                    
                    const auditId = await createAuditLog(
                        result.lastInsertRowid, 'create', null, shiftData, adminId, 
                        `Bulk create operation`
                    );
                    
                    results.push({ 
                        shiftId: result.lastInsertRowid, 
                        status: 'created' 
                    });
                    auditIds.push(auditId);
                    successful++;
                }
                // Add update and delete operations as needed
                
            } catch (error) {
                console.error('[Manual Shift] Bulk operation error:', error);
                results.push({ 
                    shiftData, 
                    status: 'failed', 
                    error: error.message 
                });
                failed++;
            }
        }
        
        res.json({
            success: true,
            message: 'Bulk operation completed',
            data: {
                operation: operation,
                totalProcessed: shifts.length,
                successful: successful,
                failed: failed,
                results: results,
                auditIds: auditIds
            }
        });
        
    } catch (error) {
        console.error('[Manual Shift] Error in bulk operations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during bulk operation'
        });
    }
});

module.exports = router;