// Story 10: Basic Payroll Calculation Engine
// Comprehensive payroll calculation system with overtime, allowances, and leave impact

const { dbConnection } = require('../database/index');

/**
 * Core Payroll Calculator Class
 * Handles all payroll calculations including base salary, overtime, fuel allowance, and leave deductions
 */
class PayrollCalculator {
    
    /**
     * Calculate payroll for a specific driver in a given month
     * @param {number} driverId - Driver ID
     * @param {number} year - Year (e.g., 2025)
     * @param {number} month - Month (1-12)
     * @returns {Object} Complete payroll breakdown
     */
    async calculateDriverPayroll(driverId, year, month) {
        try {
            console.log(`[Payroll Calculator] ==> Calculating payroll for driver ${driverId}, ${year}-${month}`);
            
            // 1. Validate inputs
            this.validatePayrollPeriod(year, month);
            
            // 2. Get current payroll configuration
            const config = await this.getCurrentPayrollConfig();
            console.log(`[Payroll Calculator] ==> Using config:`, config);
            
            // 3. Get driver information
            const driver = await this.getDriverInfo(driverId);
            if (!driver) {
                throw new Error(`Driver with ID ${driverId} not found`);
            }
            
            // 4. Get shift data for the month
            const shifts = await this.getDriverShifts(driverId, year, month);
            console.log(`[Payroll Calculator] ==> Found ${shifts.length} shifts for driver`);
            
            // 5. Get leave data for the year
            const leaveData = await this.getDriverLeaves(driverId, year);
            console.log(`[Payroll Calculator] ==> Leave data:`, leaveData);
            
            // 6. Calculate working time and overtime
            const timeCalculation = this.calculateWorkingTime(shifts);
            console.log(`[Payroll Calculator] ==> Time calculation:`, timeCalculation);
            
            // 7. Calculate payroll components
            const daysInMonth = new Date(year, month, 0).getDate();
            const baseSalary = this.calculateBaseSalary(config.monthly_salary, timeCalculation.workingDays, daysInMonth);
            const overtimePay = timeCalculation.overtimeHours * config.overtime_rate;
            const fuelAllowance = timeCalculation.workingDays * config.fuel_allowance;
            const leaveDeduction = this.calculateLeaveDeduction(config.monthly_salary, leaveData.unpaidLeaves, daysInMonth);
            
            // 8. Calculate total earnings
            const totalEarnings = baseSalary + overtimePay + fuelAllowance - leaveDeduction;
            
            // 9. Prepare comprehensive response
            const payrollResult = {
                driverId: driverId,
                driverName: driver.name,
                period: `${year}-${String(month).padStart(2, '0')}`,
                payrollDetails: {
                    baseSalary: Math.round(baseSalary * 100) / 100,
                    overtimePay: Math.round(overtimePay * 100) / 100,
                    overtimeHours: Math.round(timeCalculation.overtimeHours * 100) / 100,
                    fuelAllowance: Math.round(fuelAllowance * 100) / 100,
                    workingDays: timeCalculation.workingDays,
                    leaveDeduction: Math.round(leaveDeduction * 100) / 100,
                    totalEarnings: Math.round(totalEarnings * 100) / 100
                },
                shiftSummary: {
                    totalShifts: shifts.length,
                    totalHours: Math.round(timeCalculation.totalHours * 100) / 100,
                    regularHours: Math.round(timeCalculation.regularHours * 100) / 100,
                    overtimeHours: Math.round(timeCalculation.overtimeHours * 100) / 100
                },
                configurationUsed: {
                    monthlySalary: config.monthly_salary,
                    overtimeRate: config.overtime_rate,
                    fuelAllowance: config.fuel_allowance,
                    workingHours: config.working_hours
                },
                calculatedAt: this.convertToIST(new Date().toISOString())
            };
            
            console.log(`[Payroll Calculator] ==> Calculation complete:`, payrollResult);
            return payrollResult;
            
        } catch (error) {
            console.error(`[Payroll Calculator] ==> Error calculating payroll:`, error);
            throw new Error(`Payroll calculation failed: ${error.message}`);
        }
    }
    
    /**
     * Calculate payroll for all drivers in a given month
     * @param {number} year - Year
     * @param {number} month - Month
     * @returns {Object} All drivers payroll summary
     */
    async calculateAllDriversPayroll(year, month) {
        try {
            console.log(`[Payroll Calculator] ==> Calculating payroll for all drivers, ${year}-${month}`);
            
            // 1. Validate inputs
            this.validatePayrollPeriod(year, month);
            
            // 2. Get all active drivers
            const drivers = await this.getAllActiveDrivers();
            console.log(`[Payroll Calculator] ==> Found ${drivers.length} active drivers`);
            
            // 3. Calculate payroll for each driver
            const driverPayrolls = [];
            let totalPayroll = 0;
            let totalWorkingDays = 0;
            let totalOvertimeHours = 0;
            
            for (const driver of drivers) {
                try {
                    const payroll = await this.calculateDriverPayroll(driver.id, year, month);
                    
                    driverPayrolls.push({
                        driverId: payroll.driverId,
                        driverName: payroll.driverName,
                        totalEarnings: payroll.payrollDetails.totalEarnings,
                        workingDays: payroll.payrollDetails.workingDays,
                        overtimeHours: payroll.payrollDetails.overtimeHours
                    });
                    
                    totalPayroll += payroll.payrollDetails.totalEarnings;
                    totalWorkingDays += payroll.payrollDetails.workingDays;
                    totalOvertimeHours += payroll.payrollDetails.overtimeHours;
                    
                } catch (error) {
                    console.error(`[Payroll Calculator] ==> Error calculating payroll for driver ${driver.id}:`, error);
                    
                    // Add driver with zero earnings if calculation fails
                    driverPayrolls.push({
                        driverId: driver.id,
                        driverName: driver.name,
                        totalEarnings: 0,
                        workingDays: 0,
                        overtimeHours: 0,
                        error: error.message
                    });
                }
            }
            
            // 4. Calculate summary statistics
            const summary = {
                totalDrivers: drivers.length,
                totalPayroll: Math.round(totalPayroll * 100) / 100,
                averageEarnings: drivers.length > 0 ? Math.round((totalPayroll / drivers.length) * 100) / 100 : 0,
                totalWorkingDays: totalWorkingDays,
                totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100
            };
            
            return {
                period: `${year}-${String(month).padStart(2, '0')}`,
                drivers: driverPayrolls,
                summary: summary,
                calculatedAt: this.convertToIST(new Date().toISOString())
            };
            
        } catch (error) {
            console.error(`[Payroll Calculator] ==> Error calculating all drivers payroll:`, error);
            throw new Error(`Bulk payroll calculation failed: ${error.message}`);
        }
    }
    
    /**
     * Get current payroll configuration
     * @returns {Object} Current payroll configuration
     */
    async getCurrentPayrollConfig() {
        try {
            const query = `
                SELECT * FROM payroll_config_history 
                ORDER BY changed_at DESC 
                LIMIT 1
            `;
            
            const result = await dbConnection.get(query);
            
            if (!result) {
                throw new Error('No payroll configuration found');
            }
            
            return result;
        } catch (error) {
            console.error('[Payroll Calculator] ==> Database error getting config:', error);
            throw new Error(`Database error: ${error.message}`);
        }
    }
    
    /**
     * Get driver information
     * @param {number} driverId - Driver ID
     * @returns {Object} Driver information
     */
    async getDriverInfo(driverId) {
        try {
            const query = `SELECT * FROM drivers WHERE id = ?`;
            const result = await dbConnection.get(query, [driverId]);
            return result || null;
        } catch (error) {
            console.error('[Payroll Calculator] ==> Database error getting driver:', error);
            throw new Error(`Database error: ${error.message}`);
        }
    }
    
    /**
     * Get all active drivers
     * @returns {Array} List of active drivers
     */
    async getAllActiveDrivers() {
        try {
            const query = `SELECT * FROM drivers WHERE is_active = 1 ORDER BY name`;
            const result = await dbConnection.query(query);
            return result || [];
        } catch (error) {
            console.error('[Payroll Calculator] ==> Database error getting drivers:', error);
            throw new Error(`Database error: ${error.message}`);
        }
    }
    
    /**
     * Get driver shifts for a specific month
     * @param {number} driverId - Driver ID
     * @param {number} year - Year
     * @param {number} month - Month
     * @returns {Array} List of completed shifts
     */
    async getDriverShifts(driverId, year, month) {
        try {
            const query = `
                SELECT 
                    s.*,
                    strftime('%w', s.clock_in_time) as day_of_week,
                    strftime('%H:%M', s.clock_in_time) as clock_in_hour,
                    strftime('%H:%M', s.clock_out_time) as clock_out_hour,
                    s.shift_duration_minutes / 60.0 as shift_hours
                FROM shifts s 
                WHERE s.driver_id = ? 
                    AND strftime('%Y-%m', s.clock_in_time) = ?
                    AND s.status = 'completed'
                ORDER BY s.clock_in_time
            `;
            
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const result = await dbConnection.query(query, [driverId, yearMonth]);
            return result || [];
        } catch (error) {
            console.error('[Payroll Calculator] ==> Database error getting shifts:', error);
            throw new Error(`Database error: ${error.message}`);
        }
    }
    
    /**
     * Get driver leave data for a specific year
     * @param {number} driverId - Driver ID
     * @param {number} year - Year
     * @returns {Object} Leave statistics
     */
    async getDriverLeaves(driverId, year) {
        // Note: Since leave system is not implemented yet, return default values
        // This can be extended when leave management is implemented
        return {
            totalLeaves: 0,
            paidLeaves: 0,
            unpaidLeaves: 0
        };
    }
    
    /**
     * Calculate working time and overtime from shifts
     * @param {Array} shifts - List of shifts
     * @returns {Object} Working time breakdown
     */
    calculateWorkingTime(shifts) {
        let totalHours = 0;
        let overtimeHours = 0;
        let regularHours = 0;
        const workingDays = shifts.length;
        
        shifts.forEach(shift => {
            const shiftHours = shift.shift_duration_minutes / 60;
            totalHours += shiftHours;
            
            // Calculate overtime for this shift
            const shiftOvertimeHours = this.calculateShiftOvertimeHours(shift);
            overtimeHours += shiftOvertimeHours;
            regularHours += (shiftHours - shiftOvertimeHours);
        });
        
        return {
            workingDays: workingDays,
            totalHours: totalHours,
            regularHours: Math.max(0, regularHours),
            overtimeHours: overtimeHours
        };
    }
    
    /**
     * Calculate overtime hours for a specific shift
     * @param {Object} shift - Shift data
     * @returns {number} Overtime hours
     */
    calculateShiftOvertimeHours(shift) {
        const clockIn = new Date(shift.clock_in_time);
        const clockOut = new Date(shift.clock_out_time);
        const dayOfWeek = parseInt(shift.day_of_week); // 0 = Sunday
        
        let overtimeHours = 0;
        const shiftDurationHours = shift.shift_duration_minutes / 60;
        
        // Sunday work - all hours are overtime
        if (dayOfWeek === 0) {
            return shiftDurationHours;
        }
        
        // Weekday overtime calculation
        const regularStart = 8; // 8:00 AM
        const regularEnd = 20;  // 8:00 PM
        
        const startHour = clockIn.getHours() + (clockIn.getMinutes() / 60);
        const endHour = clockOut.getHours() + (clockOut.getMinutes() / 60);
        
        // Early morning overtime (before 8 AM)
        if (startHour < regularStart) {
            const earlyOvertimeEnd = Math.min(regularStart, endHour);
            overtimeHours += Math.max(0, earlyOvertimeEnd - startHour);
        }
        
        // Late evening overtime (after 8 PM)
        if (endHour > regularEnd) {
            const lateOvertimeStart = Math.max(regularEnd, startHour);
            overtimeHours += Math.max(0, endHour - lateOvertimeStart);
        }
        
        return Math.max(0, overtimeHours);
    }
    
    /**
     * Calculate base salary based on working days
     * @param {number} monthlySalary - Monthly salary from config
     * @param {number} workingDays - Actual working days
     * @param {number} daysInMonth - Total days in month
     * @returns {number} Prorated base salary
     */
    calculateBaseSalary(monthlySalary, workingDays, daysInMonth) {
        // Prorated based on working days vs calendar days
        return monthlySalary * (workingDays / daysInMonth);
    }
    
    /**
     * Calculate leave deduction for unpaid leaves
     * @param {number} monthlySalary - Monthly salary
     * @param {number} unpaidLeaves - Number of unpaid leave days
     * @param {number} daysInMonth - Days in month
     * @returns {number} Deduction amount
     */
    calculateLeaveDeduction(monthlySalary, unpaidLeaves, daysInMonth) {
        if (unpaidLeaves <= 0) return 0;
        
        const dailySalary = monthlySalary / daysInMonth;
        return unpaidLeaves * dailySalary;
    }
    
    /**
     * Validate payroll period parameters
     * @param {number} year - Year
     * @param {number} month - Month
     */
    validatePayrollPeriod(year, month) {
        const currentYear = new Date().getFullYear();
        
        if (!year || year < 2020 || year > currentYear + 1) {
            throw new Error(`Invalid year: ${year}. Must be between 2020 and ${currentYear + 1}`);
        }
        
        if (!month || month < 1 || month > 12) {
            throw new Error(`Invalid month: ${month}. Must be between 1 and 12`);
        }
    }
    
    /**
     * Convert UTC timestamp to IST format
     * @param {string} utcTimestamp - UTC timestamp
     * @returns {string} IST formatted timestamp
     */
    convertToIST(utcTimestamp) {
        const utcDate = new Date(utcTimestamp);
        
        const options = {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        
        const formatter = new Intl.DateTimeFormat('en-IN', options);
        const formattedDate = formatter.format(utcDate);
        
        return formattedDate + ' IST';
    }
}

module.exports = { PayrollCalculator };