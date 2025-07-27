const express = require('express');
const router = express.Router();
const { requireAdminOnly } = require('../auth/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection
const dbPath = path.join(process.cwd(), 'company.db');

// Helper function to ensure test data tables exist
async function createTestDataTablesIfNotExist(db) {
    return new Promise((resolve, reject) => {
        const createSessionsTable = `
            CREATE TABLE IF NOT EXISTS test_data_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                description TEXT,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                parameters TEXT,
                shifts_count INTEGER DEFAULT 0,
                leave_requests_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (created_by) REFERENCES drivers (id)
            )
        `;
        
        db.run(createSessionsTable, (err) => {
            if (err) {
                console.log('[Test Data] Test sessions table creation error (may already exist):', err.message);
            } else {
                console.log('[Test Data] Test sessions table ready');
            }
            
            // Add test data columns to existing tables if they don't exist
            const alterShifts = `ALTER TABLE shifts ADD COLUMN is_test_data BOOLEAN DEFAULT 0`;
            const alterLeaveRequests = `ALTER TABLE leave_requests ADD COLUMN is_test_data BOOLEAN DEFAULT 0`;
            const alterAuditLog = `ALTER TABLE shift_audit_log ADD COLUMN is_test_data BOOLEAN DEFAULT 0`;
            
            db.run(alterShifts, () => {
                db.run(alterLeaveRequests, () => {
                    db.run(alterAuditLog, () => {
                        resolve();
                    });
                });
            });
        });
    });
}

class TestDataGenerator {
    constructor(config) {
        this.drivers = config.drivers;
        this.dateRange = config.dateRange;
        this.payrollConfig = config.payrollConfig;
        this.shiftPatterns = config.shiftPatterns;
        this.sessionDescription = config.sessionDescription || 'Test data session';
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T.]/g, '').substring(0, 15);
        return `test_${timestamp}`;
    }

    async generateTestData() {
        const db = new sqlite3.Database(dbPath);
        
        try {
            // Create test data sessions table if it doesn't exist
            await this.createTestDataTables(db);
            
            const shifts = [];
            const leaveRequests = [];
            
            for (const driverId of this.drivers) {
                console.log(`[Test Data] Generating data for driver ${driverId}`);
                const driverShifts = await this.generateDriverShifts(driverId, db);
                const driverLeaves = await this.generateDriverLeaves(driverId);
                
                shifts.push(...driverShifts);
                leaveRequests.push(...driverLeaves);
            }
            
            // Save to database
            await this.saveTestData(db, shifts, leaveRequests);
            
            console.log(`[Test Data] Generated ${shifts.length} shifts and ${leaveRequests.length} leave requests`);
            
            return {
                sessionId: this.sessionId,
                shiftsGenerated: shifts.length,
                leaveRequestsGenerated: leaveRequests.length,
                driversIncluded: this.drivers.length,
                dateRange: `${this.dateRange.startDate} to ${this.dateRange.endDate}`
            };
            
        } finally {
            db.close();
        }
    }

    async createTestDataTables(db) {
        return new Promise((resolve, reject) => {
            const createSessionsTable = `
                CREATE TABLE IF NOT EXISTS test_data_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT UNIQUE NOT NULL,
                    description TEXT,
                    created_by INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    parameters TEXT,
                    shifts_count INTEGER DEFAULT 0,
                    leave_requests_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active',
                    FOREIGN KEY (created_by) REFERENCES drivers (id)
                )
            `;
            
            db.run(createSessionsTable, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Add test data columns to existing tables if they don't exist
                const alterShifts = `ALTER TABLE shifts ADD COLUMN is_test_data BOOLEAN DEFAULT 0`;
                const alterLeaveRequests = `ALTER TABLE leave_requests ADD COLUMN is_test_data BOOLEAN DEFAULT 0`;
                const alterAuditLog = `ALTER TABLE shift_audit_log ADD COLUMN is_test_data BOOLEAN DEFAULT 0`;
                
                db.run(alterShifts, () => {
                    db.run(alterLeaveRequests, () => {
                        db.run(alterAuditLog, () => {
                            resolve();
                        });
                    });
                });
            });
        });
    }

    async generateDriverShifts(driverId, db) {
        const shifts = [];
        let currentOdometer = await this.getLastOdometerReading(driverId, db);
        
        const dates = this.generateWorkingDates();
        
        for (const date of dates) {
            // Skip if it's a leave day (simplified logic)
            if (Math.random() < 0.05) continue; // 5% chance of skipping (leave day)
            
            const shift = this.generateShiftForDate(driverId, date, currentOdometer);
            shifts.push(shift);
            currentOdometer = shift.endOdometer;
        }
        
        return shifts;
    }

    async getLastOdometerReading(driverId, db) {
        return new Promise((resolve) => {
            db.get(
                'SELECT end_odometer FROM shifts WHERE driver_id = ? ORDER BY clock_out_time DESC LIMIT 1',
                [driverId],
                (err, row) => {
                    resolve(row?.end_odometer || 1000 + (driverId * 100)); // Base odometer per driver
                }
            );
        });
    }

    generateWorkingDates() {
        const dates = [];
        const start = new Date(this.dateRange.startDate);
        const end = new Date(this.dateRange.endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            
            // Skip Sundays unless configured for Sunday work
            if (dayOfWeek === 0 && Math.random() > this.shiftPatterns.sundayWorkFrequency) {
                continue;
            }
            
            // Include working days
            if (dayOfWeek >= 1 && dayOfWeek <= this.shiftPatterns.workingDaysPerWeek) {
                dates.push(new Date(d));
            }
        }
        
        return dates;
    }

    generateShiftForDate(driverId, date, startOdometer) {
        const dayOfWeek = date.getDay();
        const isSunday = dayOfWeek === 0;
        
        // Determine shift timing
        let startTime, endTime, duration;
        
        if (isSunday) {
            // Sunday work - all overtime
            startTime = this.randomTime(6, 10);
            duration = this.randomFloat(4, 10);
        } else if (Math.random() < this.shiftPatterns.overtimeFrequency) {
            // Overtime shift
            startTime = this.randomTime(6, 8);
            duration = this.randomFloat(9, 12);
        } else {
            // Regular shift
            startTime = this.randomTime(7.5, 9);
            duration = this.shiftPatterns.averageHoursPerDay + this.randomFloat(-1, 1);
        }
        
        endTime = startTime + duration;
        
        // Calculate distance based on time (10-25 km/hour)
        const distance = Math.round(duration * this.randomFloat(15, 25));
        
        // Format times as ISO strings
        const clockInTime = this.dateTimeToISO(date, startTime);
        const clockOutTime = this.dateTimeToISO(date, endTime);
        
        return {
            driverId,
            clockInTime,
            clockOutTime,
            startOdometer,
            endOdometer: startOdometer + distance,
            totalDistance: distance,
            shiftDurationMinutes: Math.round(duration * 60),
            status: 'completed',
            isTestData: true,
            sessionId: this.sessionId
        };
    }

    async generateDriverLeaves(driverId) {
        const leaves = [];
        const leaveCount = this.randomInt(2, 6);
        
        for (let i = 0; i < leaveCount; i++) {
            const leaveDate = this.randomDateInRange();
            const leaveType = this.randomLeaveType();
            
            leaves.push({
                driverId,
                leaveDate: leaveDate.toISOString().split('T')[0],
                leaveType,
                reason: this.generateLeaveReason(leaveType),
                status: this.randomLeaveStatus(),
                isTestData: true,
                sessionId: this.sessionId
            });
        }
        
        return leaves;
    }

    async saveTestData(db, shifts, leaveRequests) {
        // Save session
        await new Promise((resolve, reject) => {
            const sessionParams = JSON.stringify({
                drivers: this.drivers,
                dateRange: this.dateRange,
                payrollConfig: this.payrollConfig,
                shiftPatterns: this.shiftPatterns
            });
            
            db.run(
                `INSERT INTO test_data_sessions 
                 (session_id, description, created_by, parameters, shifts_count, leave_requests_count) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [this.sessionId, this.sessionDescription, this.drivers[0], sessionParams, shifts.length, leaveRequests.length],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        // Save shifts
        for (const shift of shifts) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO shifts 
                     (driver_id, clock_in_time, clock_out_time, start_odometer, end_odometer, 
                      total_distance, shift_duration_minutes, status, is_test_data) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [shift.driverId, shift.clockInTime, shift.clockOutTime, shift.startOdometer,
                     shift.endOdometer, shift.totalDistance, shift.shiftDurationMinutes, shift.status, 1],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        // Save leave requests
        for (const leave of leaveRequests) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO leave_requests 
                     (driver_id, leave_date, leave_type, reason, status, is_test_data) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [leave.driverId, leave.leaveDate, leave.leaveType, leave.reason, leave.status, 1],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
    }

    // Utility methods
    randomTime(start, end) {
        return Math.random() * (end - start) + start;
    }

    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    randomDateInRange() {
        const start = new Date(this.dateRange.startDate);
        const end = new Date(this.dateRange.endDate);
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    randomLeaveType() {
        const types = ['annual', 'sick', 'emergency'];
        return types[Math.floor(Math.random() * types.length)];
    }

    randomLeaveStatus() {
        const statuses = ['pending', 'approved', 'rejected'];
        const weights = [0.3, 0.6, 0.1]; // 30% pending, 60% approved, 10% rejected
        const rand = Math.random();
        let sum = 0;
        for (let i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (rand <= sum) return statuses[i];
        }
        return statuses[0];
    }

    generateLeaveReason(type) {
        const reasons = {
            annual: ['Family vacation', 'Personal time', 'Wedding attendance', 'Festival celebration', 'Rest and relaxation'],
            sick: ['Medical appointment', 'Health checkup', 'Recovery time', 'Doctor visit', 'Medical procedure'],
            emergency: ['Family emergency', 'Urgent personal matter', 'Home emergency', 'Medical emergency', 'Unexpected situation']
        };
        const typeReasons = reasons[type] || reasons.annual;
        return typeReasons[Math.floor(Math.random() * typeReasons.length)];
    }

    dateTimeToISO(date, hourFloat) {
        const newDate = new Date(date);
        const hours = Math.floor(hourFloat);
        const minutes = Math.round((hourFloat - hours) * 60);
        newDate.setHours(hours, minutes, 0, 0);
        return newDate.toISOString();
    }
}

// Generate test data
router.post('/test-data/generate', requireAdminOnly, async (req, res) => {
    try {
        console.log('[Test Data] ==> POST /api/admin/test-data/generate');
        console.log('[Test Data] ==> Admin:', req.user.name, '(ID:', req.user.id, ')');
        
        const {
            drivers = [],
            dateRange = { startDate: '2025-08-01', endDate: '2025-08-31' },
            payrollConfig = { monthlySalary: 27000, overtimeRate: 110, fuelAllowance: 33.30 },
            shiftPatterns = { workingDaysPerWeek: 5, averageHoursPerDay: 8, overtimeFrequency: 0.3, sundayWorkFrequency: 0.2 },
            sessionDescription = 'Generated test data'
        } = req.body;
        
        if (!drivers || drivers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one driver must be selected'
            });
        }
        
        console.log('[Test Data] ==> Generating test data for', drivers.length, 'drivers');
        console.log('[Test Data] ==> Date range:', dateRange.startDate, 'to', dateRange.endDate);
        
        const generator = new TestDataGenerator({
            drivers,
            dateRange,
            payrollConfig,
            shiftPatterns,
            sessionDescription
        });
        
        const result = await generator.generateTestData();
        
        // Calculate estimated payroll
        const estimatedPayroll = result.shiftsGenerated * (payrollConfig.monthlySalary / 30) + 
                                result.shiftsGenerated * payrollConfig.fuelAllowance;
        
        const response = {
            success: true,
            message: 'Test data generation completed successfully',
            data: {
                ...result,
                estimatedPayroll: `₹${estimatedPayroll.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            }
        };
        
        console.log('[Test Data] ==> Test data generated successfully:', result);
        res.json(response);
        
    } catch (error) {
        console.error('[Test Data] Error generating test data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate test data',
            details: error.message
        });
    }
});

// Cleanup test data
router.delete('/test-data/cleanup', requireAdminOnly, async (req, res) => {
    try {
        console.log('[Test Data] ==> DELETE /api/admin/test-data/cleanup');
        console.log('[Test Data] ==> Admin:', req.user.name, '(ID:', req.user.id, ')');
        
        const { sessionId = null, confirmCleanup = false, preserveProduction = true } = req.body;
        
        if (!confirmCleanup) {
            return res.status(400).json({
                success: false,
                error: 'Cleanup confirmation required'
            });
        }
        
        const db = new sqlite3.Database(dbPath);
        
        try {
            let shiftsRemoved = 0;
            let leaveRequestsRemoved = 0;
            let auditEntriesRemoved = 0;
            let sessionsCleared = 0;
            
            if (sessionId) {
                // Cleanup specific session
                console.log('[Test Data] ==> Cleaning up session:', sessionId);
                
                // Count items to be removed
                const countShifts = await new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM shifts WHERE is_test_data = 1', (err, row) => {
                        resolve(row?.count || 0);
                    });
                });
                
                const countLeaves = await new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM leave_requests WHERE is_test_data = 1', (err, row) => {
                        resolve(row?.count || 0);
                    });
                });
                
                // Remove test data
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM shifts WHERE is_test_data = 1', (err) => {
                        if (err) reject(err); else resolve();
                    });
                });
                
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM leave_requests WHERE is_test_data = 1', (err) => {
                        if (err) reject(err); else resolve();
                    });
                });
                
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM shift_audit_log WHERE is_test_data = 1', (err) => {
                        if (err) reject(err); else resolve();
                    });
                });
                
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM test_data_sessions WHERE session_id = ?', [sessionId], (err) => {
                        if (err) reject(err); else resolve();
                    });
                });
                
                shiftsRemoved = countShifts;
                leaveRequestsRemoved = countLeaves;
                sessionsCleared = 1;
                
            } else {
                // Cleanup all test data
                console.log('[Test Data] ==> Cleaning up all test data');
                
                // Count items to be removed
                const counts = await Promise.all([
                    new Promise((resolve) => {
                        db.get('SELECT COUNT(*) as count FROM shifts WHERE is_test_data = 1', (err, row) => {
                            resolve(row?.count || 0);
                        });
                    }),
                    new Promise((resolve) => {
                        db.get('SELECT COUNT(*) as count FROM leave_requests WHERE is_test_data = 1', (err, row) => {
                            resolve(row?.count || 0);
                        });
                    }),
                    new Promise((resolve) => {
                        db.get('SELECT COUNT(*) as count FROM test_data_sessions', (err, row) => {
                            resolve(row?.count || 0);
                        });
                    })
                ]);
                
                shiftsRemoved = counts[0];
                leaveRequestsRemoved = counts[1];
                sessionsCleared = counts[2];
                
                // Remove all test data
                await Promise.all([
                    new Promise((resolve, reject) => {
                        db.run('DELETE FROM shifts WHERE is_test_data = 1', (err) => {
                            if (err) reject(err); else resolve();
                        });
                    }),
                    new Promise((resolve, reject) => {
                        db.run('DELETE FROM leave_requests WHERE is_test_data = 1', (err) => {
                            if (err) reject(err); else resolve();
                        });
                    }),
                    new Promise((resolve, reject) => {
                        db.run('DELETE FROM shift_audit_log WHERE is_test_data = 1', (err) => {
                            if (err) reject(err); else resolve();
                        });
                    }),
                    new Promise((resolve, reject) => {
                        db.run('DELETE FROM test_data_sessions', (err) => {
                            if (err) reject(err); else resolve();
                        });
                    })
                ]);
            }
            
            const response = {
                success: true,
                message: 'Test data cleanup completed successfully',
                data: {
                    shiftsRemoved,
                    leaveRequestsRemoved,
                    auditEntriesRemoved,
                    sessionsCleared,
                    preservedProduction
                }
            };
            
            console.log('[Test Data] ==> Cleanup completed:', response.data);
            res.json(response);
            
        } finally {
            db.close();
        }
        
    } catch (error) {
        console.error('[Test Data] Error cleaning up test data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup test data',
            details: error.message
        });
    }
});

// Get test data sessions
router.get('/test-data/sessions', requireAdminOnly, async (req, res) => {
    try {
        console.log('[Test Data] ==> GET /api/admin/test-data/sessions');
        console.log('[Test Data] ==> Admin:', req.user.name, '(ID:', req.user.id, ')');
        
        const db = new sqlite3.Database(dbPath);
        
        try {
            // Ensure test data tables exist before querying
            await createTestDataTablesIfNotExist(db);
            
            const sessions = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT * FROM test_data_sessions ORDER BY created_at DESC`,
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows || []);
                    }
                );
            });
            
            // Get summary statistics
            const summary = await Promise.all([
                new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM test_data_sessions', (err, row) => {
                        resolve(row?.count || 0);
                    });
                }),
                new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM test_data_sessions WHERE status = "active"', (err, row) => {
                        resolve(row?.count || 0);
                    });
                }),
                new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM shifts WHERE is_test_data = 1', (err, row) => {
                        resolve(row?.count || 0);
                    });
                }),
                new Promise((resolve) => {
                    db.get('SELECT COUNT(*) as count FROM leave_requests WHERE is_test_data = 1', (err, row) => {
                        resolve(row?.count || 0);
                    });
                })
            ]);
            
            // Format sessions for response
            const formattedSessions = sessions.map(session => ({
                id: session.id,
                sessionId: session.session_id,
                description: session.description,
                createdAt: new Date(session.created_at).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                }) + ' IST',
                status: session.status,
                shiftsCount: session.shifts_count,
                leaveRequestsCount: session.leave_requests_count,
                parameters: session.parameters ? JSON.parse(session.parameters) : null
            }));
            
            const response = {
                success: true,
                data: {
                    sessions: formattedSessions,
                    summary: {
                        totalSessions: summary[0],
                        activeSessions: summary[1],
                        totalTestShifts: summary[2],
                        totalTestLeaveRequests: summary[3]
                    }
                }
            };
            
            console.log('[Test Data] ==> Retrieved', formattedSessions.length, 'test data sessions');
            res.json(response);
            
        } finally {
            db.close();
        }
        
    } catch (error) {
        console.error('[Test Data] Error getting test data sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve test data sessions',
            details: error.message
        });
    }
});

module.exports = router;