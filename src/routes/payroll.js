// Story 10: Basic Payroll Calculation API Routes
// Admin-only endpoints for calculating driver payrolls

const express = require('express');
const { PayrollCalculator } = require('../payroll/calculator');
const { requireAdminOnly } = require('../auth/auth');

const router = express.Router();
const payrollCalculator = new PayrollCalculator();

/**
 * GET /api/admin/payroll/driver/:driverId/:year/:month
 * Calculate payroll for a specific driver in a given month
 */
router.get('/driver/:driverId/:year/:month', requireAdminOnly, async (req, res) => {
    const requestId = Date.now();
    const { driverId, year, month } = req.params;
    
    console.log(`[${requestId}] [Payroll API] ==> GET /api/admin/payroll/driver/${driverId}/${year}/${month}`);
    console.log(`[${requestId}] [Payroll API] ==> Admin: ${req.user.name} (ID: ${req.user.userId})`);
    
    try {
        // Validate parameters
        const driverIdNum = parseInt(driverId);
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        
        if (isNaN(driverIdNum) || driverIdNum <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid driver ID. Must be a positive number.'
            });
        }
        
        if (isNaN(yearNum) || isNaN(monthNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid year or month. Must be valid numbers.'
            });
        }
        
        console.log(`[${requestId}] [Payroll API] ==> Calculating payroll for Driver ID: ${driverIdNum}, Period: ${yearNum}-${monthNum}`);
        
        // Calculate payroll
        const payrollData = await payrollCalculator.calculateDriverPayroll(driverIdNum, yearNum, monthNum);
        
        console.log(`[${requestId}] [Payroll API] ==> Payroll calculation successful`);
        console.log(`[${requestId}] [Payroll API] ==> Total earnings: ₹${payrollData.payrollDetails.totalEarnings}`);
        
        res.json({
            success: true,
            data: payrollData
        });
        
    } catch (error) {
        console.error(`[${requestId}] [Payroll API] ==> Error calculating driver payroll:`, error);
        
        let statusCode = 500;
        let errorMessage = error.message;
        
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('Invalid')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * GET /api/admin/payroll/:year/:month
 * Calculate payroll for all drivers in a given month
 */
router.get('/:year/:month', requireAdminOnly, async (req, res) => {
    const requestId = Date.now();
    const { year, month } = req.params;
    
    console.log(`[${requestId}] [Payroll API] ==> GET /api/admin/payroll/${year}/${month}`);
    console.log(`[${requestId}] [Payroll API] ==> Admin: ${req.user.name} (ID: ${req.user.userId})`);
    
    try {
        // Validate parameters
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        
        if (isNaN(yearNum) || isNaN(monthNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid year or month. Must be valid numbers.'
            });
        }
        
        console.log(`[${requestId}] [Payroll API] ==> Calculating payroll for all drivers, Period: ${yearNum}-${monthNum}`);
        
        // Calculate payroll for all drivers
        const payrollData = await payrollCalculator.calculateAllDriversPayroll(yearNum, monthNum);
        
        console.log(`[${requestId}] [Payroll API] ==> Bulk payroll calculation successful`);
        console.log(`[${requestId}] [Payroll API] ==> Total drivers: ${payrollData.summary.totalDrivers}`);
        console.log(`[${requestId}] [Payroll API] ==> Total payroll: ₹${payrollData.summary.totalPayroll}`);
        
        res.json({
            success: true,
            data: payrollData
        });
        
    } catch (error) {
        console.error(`[${requestId}] [Payroll API] ==> Error calculating bulk payroll:`, error);
        
        let statusCode = 500;
        let errorMessage = error.message;
        
        if (error.message.includes('Invalid')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

/**
 * GET /api/admin/payroll/:year/:month/summary
 * Get payroll summary with detailed statistics
 */
router.get('/:year/:month/summary', requireAdminOnly, async (req, res) => {
    const requestId = Date.now();
    const { year, month } = req.params;
    
    console.log(`[${requestId}] [Payroll API] ==> GET /api/admin/payroll/${year}/${month}/summary`);
    console.log(`[${requestId}] [Payroll API] ==> Admin: ${req.user.name} (ID: ${req.user.userId})`);
    
    try {
        // Validate parameters
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);
        
        if (isNaN(yearNum) || isNaN(monthNum)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid year or month. Must be valid numbers.'
            });
        }
        
        console.log(`[${requestId}] [Payroll API] ==> Generating payroll summary for Period: ${yearNum}-${monthNum}`);
        
        // Get full payroll data
        const payrollData = await payrollCalculator.calculateAllDriversPayroll(yearNum, monthNum);
        
        // Calculate additional summary statistics
        const drivers = payrollData.drivers;
        const totalBaseSalary = drivers.reduce((sum, d) => sum + (d.baseSalary || 0), 0);
        const totalOvertimePay = drivers.reduce((sum, d) => sum + (d.overtimePay || 0), 0);
        const totalFuelAllowance = drivers.reduce((sum, d) => sum + (d.fuelAllowance || 0), 0);
        const totalDeductions = drivers.reduce((sum, d) => sum + (d.leaveDeduction || 0), 0);
        
        const enhancedSummary = {
            ...payrollData.summary,
            breakdown: {
                totalBaseSalary: Math.round(totalBaseSalary * 100) / 100,
                totalOvertimePay: Math.round(totalOvertimePay * 100) / 100,
                totalFuelAllowance: Math.round(totalFuelAllowance * 100) / 100,
                totalDeductions: Math.round(totalDeductions * 100) / 100
            },
            driversWithOvertimeCount: drivers.filter(d => (d.overtimeHours || 0) > 0).length,
            driversWithZeroEarningsCount: drivers.filter(d => (d.totalEarnings || 0) === 0).length,
            averageWorkingDays: drivers.length > 0 ? Math.round((payrollData.summary.totalWorkingDays / drivers.length) * 100) / 100 : 0,
            averageOvertimeHours: drivers.length > 0 ? Math.round((payrollData.summary.totalOvertimeHours / drivers.length) * 100) / 100 : 0
        };
        
        const summaryResponse = {
            period: payrollData.period,
            summary: enhancedSummary,
            calculatedAt: payrollData.calculatedAt
        };
        
        console.log(`[${requestId}] [Payroll API] ==> Payroll summary generated successfully`);
        
        res.json({
            success: true,
            data: summaryResponse
        });
        
    } catch (error) {
        console.error(`[${requestId}] [Payroll API] ==> Error generating payroll summary:`, error);
        
        let statusCode = 500;
        let errorMessage = error.message;
        
        if (error.message.includes('Invalid')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

module.exports = router;