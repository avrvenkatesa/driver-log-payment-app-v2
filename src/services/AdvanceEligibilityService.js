const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection
const dbPath = path.join(process.cwd(), 'company.db');

class AdvanceEligibilityService {
    async calculateEligibility(driverId, requestedAmount = null) {
        try {
            // Get advance configuration
            const config = await this.getAdvanceConfig();
            
            // Get driver's recent earnings (last 3 months for average)
            const earningsHistory = await this.getDriverEarningsHistory(driverId, 3);
            
            if (earningsHistory.length === 0) {
                return {
                    eligible: false,
                    reason: 'No earnings history found',
                    maxAdvanceLimit: 0,
                    availableAmount: 0,
                    monthlyEarningsEstimate: 0,
                    config: config
                };
            }
            
            // Calculate average monthly earnings based on payroll config
            const monthlyEarningsEstimate = await this.getMonthlyEarningsEstimate(driverId);
            
            // Calculate maximum advance limit
            const maxAdvanceLimit = monthlyEarningsEstimate * (config.maxAdvancePercentage / 100);
            
            // Get current outstanding advances
            const outstandingAdvances = await this.getOutstandingAdvances(driverId);
            const outstandingAmount = outstandingAdvances.reduce((sum, advance) => {
                return sum + (advance.approved_amount || 0);
            }, 0);
            
            // Calculate available amount
            const availableAmount = Math.max(0, maxAdvanceLimit - outstandingAmount);
            
            // Check monthly request limit
            const currentMonthRequests = await this.getCurrentMonthRequestCount(driverId);
            
            // Eligibility checks
            const checks = {
                hasEarningsHistory: earningsHistory.length > 0,
                withinAdvanceLimit: requestedAmount ? requestedAmount <= availableAmount : true,
                withinMonthlyRequestLimit: currentMonthRequests < config.maxRequestsPerMonth,
                meetMinimumAmount: requestedAmount ? requestedAmount >= config.minAdvanceAmount : true,
                withinMaximumAmount: requestedAmount ? requestedAmount <= config.maxAdvanceAmount : true,
                noExcessiveOutstanding: outstandingAmount < maxAdvanceLimit
            };
            
            const eligible = Object.values(checks).every(check => check === true);
            
            // Build restrictions array
            const restrictions = [];
            if (!checks.hasEarningsHistory) restrictions.push('No earnings history available');
            if (!checks.withinAdvanceLimit) restrictions.push(`Exceeds available advance limit of ₹${(availableAmount || 0).toLocaleString('en-IN')}`);
            if (!checks.withinMonthlyRequestLimit) restrictions.push(`Monthly request limit exceeded (${currentMonthRequests}/${config.maxRequestsPerMonth || 'N/A'})`);
            if (!checks.meetMinimumAmount) restrictions.push(`Below minimum advance amount of ₹${(config.minAdvanceAmount || 0).toLocaleString('en-IN')}`);
            if (!checks.withinMaximumAmount) restrictions.push(`Exceeds maximum advance amount of ₹${(config.maxAdvanceAmount || 0).toLocaleString('en-IN')}`);
            if (!checks.noExcessiveOutstanding) restrictions.push(`Outstanding advances exceed limit`);
            
            return {
                eligible,
                maxAdvanceAmount: Math.min(availableAmount, config.maxAdvanceAmount),
                currentOutstanding: outstandingAmount,
                availableAmount,
                monthlyEarningsEstimate,
                advanceLimitPercentage: config.maxAdvancePercentage,
                restrictions,
                config: {
                    minAdvanceAmount: config.minAdvanceAmount,
                    maxAdvanceAmount: config.maxAdvanceAmount,
                    maxRequestsPerMonth: config.maxRequestsPerMonth,
                    currentMonthRequests
                },
                checks
            };
        } catch (error) {
            console.error('[Advance Eligibility] Error calculating eligibility:', error);
            throw error;
        }
    }
    
    async getAdvanceConfig() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            
            db.get(
                `SELECT * FROM advance_payment_config ORDER BY id DESC LIMIT 1`,
                (err, config) => {
                    db.close();
                    if (err) {
                        reject(err);
                    } else if (!config) {
                        // Return default configuration if none exists
                        resolve({
                            maxAdvancePercentage: 60,
                            maxRequestsPerMonth: 3,
                            minAdvanceAmount: 500,
                            maxAdvanceAmount: 20000,
                            approvalRequiredAbove: 5000,
                            allowMultipleOutstanding: true,
                            requireReason: true,
                            autoSettleOnPayroll: true,
                            adminApprovalRequired: true,
                            emergencyAdvanceAllowed: true
                        });
                    } else {
                        // Map database columns to camelCase properties
                        resolve({
                            maxAdvancePercentage: config.max_advance_percentage || 60,
                            maxRequestsPerMonth: config.max_requests_per_month || 3,
                            minAdvanceAmount: config.min_advance_amount || 500,
                            maxAdvanceAmount: config.max_advance_amount || 20000,
                            approvalRequiredAbove: config.approval_required_above || 5000,
                            allowMultipleOutstanding: config.allow_multiple_outstanding || true,
                            requireReason: config.require_reason || true,
                            autoSettleOnPayroll: config.auto_settle_on_payroll || true,
                            adminApprovalRequired: config.admin_approval_required || true,
                            emergencyAdvanceAllowed: config.emergency_advance_allowed || true
                        });
                    }
                }
            );
        });
    }
    
    async getDriverEarningsHistory(driverId, months = 3) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            
            // Get recent shifts for earnings calculation
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - months);
            
            db.all(
                `SELECT 
                    DATE(clock_in_time) as shift_date,
                    shift_duration_minutes,
                    total_distance
                FROM shifts 
                WHERE driver_id = ? 
                AND clock_in_time >= ? 
                AND status = 'completed'
                ORDER BY clock_in_time DESC`,
                [driverId, threeMonthsAgo.toISOString()],
                (err, rows) => {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        // Group by month for earnings calculation
                        const monthlyEarnings = {};
                        rows.forEach(shift => {
                            const monthKey = shift.shift_date.substring(0, 7); // YYYY-MM
                            if (!monthlyEarnings[monthKey]) {
                                monthlyEarnings[monthKey] = {
                                    month: monthKey,
                                    totalShifts: 0,
                                    totalHours: 0,
                                    totalDistance: 0,
                                    totalEarnings: 0
                                };
                            }
                            
                            monthlyEarnings[monthKey].totalShifts++;
                            monthlyEarnings[monthKey].totalHours += (shift.shift_duration_minutes || 0) / 60;
                            monthlyEarnings[monthKey].totalDistance += shift.total_distance || 0;
                        });
                        
                        // Calculate earnings based on current payroll config
                        Object.keys(monthlyEarnings).forEach(month => {
                            const data = monthlyEarnings[month];
                            // Estimate earnings: base salary prorated + fuel allowance per day
                            const workingDays = data.totalShifts;
                            const estimatedEarnings = (27000 / 30) * workingDays + (33.30 * workingDays);
                            monthlyEarnings[month].totalEarnings = estimatedEarnings;
                        });
                        
                        resolve(Object.values(monthlyEarnings));
                    }
                }
            );
        });
    }
    
    async getMonthlyEarningsEstimate(driverId) {
        // Get current payroll configuration
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            
            db.get(
                `SELECT base_salary, fuel_allowance FROM payroll_config ORDER BY id DESC LIMIT 1`,
                (err, config) => {
                    if (err) {
                        db.close();
                        reject(err);
                        return;
                    }
                    
                    // Use default values if config not found
                    const monthlySalary = config?.base_salary || 27000;
                    const fuelAllowance = config?.fuel_allowance || 33.30;
                    
                    // Estimate based on 25 working days per month
                    const estimatedMonthlyEarnings = monthlySalary + (fuelAllowance * 25);
                    
                    db.close();
                    resolve(estimatedMonthlyEarnings);
                }
            );
        });
    }
    
    async getOutstandingAdvances(driverId) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            
            db.all(
                `SELECT * FROM advance_payments 
                WHERE driver_id = ? 
                AND status IN ('approved', 'paid') 
                AND (settled_at IS NULL OR settled_at = '')`,
                [driverId],
                (err, rows) => {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }
    
    async getCurrentMonthRequestCount(driverId) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            
            const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
            
            db.get(
                `SELECT COUNT(*) as count FROM advance_payments 
                WHERE driver_id = ? 
                AND strftime('%Y-%m', request_date) = ?`,
                [driverId, currentMonth],
                (err, row) => {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row?.count || 0);
                    }
                }
            );
        });
    }
}

module.exports = AdvanceEligibilityService;