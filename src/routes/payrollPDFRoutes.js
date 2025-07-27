const express = require('express');
const router = express.Router();
const { requireAdminOnly } = require('../auth/auth');
const PDFService = require('../services/PDFService');
const SimplePDFService = require('../services/SimplePDFService');
const AlternativePDFService = require('../services/AlternativePDFService');
// Import existing database connection
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, '../../company.db');
const dbConnection = new sqlite3.Database(dbPath);

// Helper function to calculate payroll data (using existing logic from Story 10)
async function calculateBulkPayroll(year, month) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                d.id as driverId,
                d.name as driverName,
                COUNT(DISTINCT DATE(s.clock_in_time)) as workingDays,
                COALESCE(SUM(s.shift_duration_minutes), 0) as totalMinutes,
                COALESCE(SUM(s.total_distance), 0) as totalDistance,
                COALESCE(AVG(s.shift_duration_minutes), 0) as avgShiftMinutes
            FROM drivers d
            LEFT JOIN shifts s ON d.id = s.driver_id 
                AND strftime('%Y', s.clock_in_time) = ?
                AND strftime('%m', s.clock_in_time) = ?
                AND s.status = 'completed'
            WHERE d.is_active = 1
            GROUP BY d.id, d.name
            ORDER BY d.name
        `;
        
        dbConnection.all(query, [year.toString(), month.toString().padStart(2, '0')], async (err, drivers) => {
            if (err) {
                reject(err);
                return;
            }
            
            try {
                // Get payroll configuration
                const configQuery = 'SELECT * FROM payroll_config ORDER BY created_at DESC LIMIT 1';
                const config = await new Promise((res, rej) => {
                    dbConnection.get(configQuery, (err, row) => {
                        if (err) rej(err);
                        else res(row || { monthly_salary: 27000, overtime_rate: 110, fuel_allowance: 15 });
                    });
                });
                
                const payrollData = drivers.map(driver => {
                    const workingDays = driver.workingDays || 0;
                    const totalHours = (driver.totalMinutes || 0) / 60;
                    const regularHours = Math.min(totalHours, workingDays * 8);
                    const overtimeHours = Math.max(0, totalHours - regularHours);
                    
                    // Calculate base salary (full monthly if worked 20+ days, otherwise prorated)
                    const daysInMonth = new Date(year, month, 0).getDate();
                    const minimumDaysForFullSalary = 20;
                    const baseSalary = workingDays >= minimumDaysForFullSalary ? 
                        (config.monthly_salary || 27000) : 
                        ((config.monthly_salary || 27000) * (workingDays / daysInMonth));
                    
                    const overtimePay = overtimeHours * (config.overtime_rate || 110);
                    const fuelAllowance = workingDays * (config.fuel_allowance || 15);
                    
                    // Calculate deductions
                    const grossEarnings = baseSalary + overtimePay + fuelAllowance;
                    
                    // Leave deduction for unpaid leaves (if worked less than expected days)
                    const expectedWorkingDays = Math.min(daysInMonth, 30); // Max 30 working days
                    const unpaidLeaveDays = Math.max(0, expectedWorkingDays - workingDays - 4); // Allow 4 weekly offs
                    const leaveDeduction = unpaidLeaveDays > 0 ? 
                        ((config.monthly_salary || 27000) / expectedWorkingDays) * unpaidLeaveDays : 0;
                    
                    // Standard deductions (PF: 12%, ESI: 0.75% if salary < 25000, Tax: 5% if salary > 20000)
                    const pfDeduction = grossEarnings * 0.12; // 12% PF
                    const esiDeduction = grossEarnings < 25000 ? grossEarnings * 0.0075 : 0; // 0.75% ESI if under 25k
                    const taxDeduction = grossEarnings > 20000 ? grossEarnings * 0.05 : 0; // 5% tax if over 20k
                    
                    const totalDeductions = leaveDeduction + pfDeduction + esiDeduction + taxDeduction;
                    const totalEarnings = grossEarnings - totalDeductions;
                    
                    return {
                        driverName: driver.driverName,
                        breakdown: {
                            baseSalary: Math.round(baseSalary * 100) / 100,
                            overtimeHours: Math.round(overtimeHours * 100) / 100,
                            overtimePay: Math.round(overtimePay * 100) / 100,
                            fuelAllowance: Math.round(fuelAllowance * 100) / 100,
                            grossEarnings: Math.round(grossEarnings * 100) / 100,
                            leaveDeduction: Math.round(leaveDeduction * 100) / 100,
                            pfDeduction: Math.round(pfDeduction * 100) / 100,
                            esiDeduction: Math.round(esiDeduction * 100) / 100,
                            taxDeduction: Math.round(taxDeduction * 100) / 100,
                            totalDeductions: Math.round(totalDeductions * 100) / 100,
                            totalEarnings: Math.round(totalEarnings * 100) / 100,
                            workingDays: workingDays
                        }
                    };
                });
                
                resolve(payrollData);
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Helper function to get month name
function getMonthName(month) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return monthNames[parseInt(month) - 1] || 'Unknown';
}

// Helper function to format IST timestamp
function getISTTimestamp() {
    return new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }) + ' IST';
}

// Monthly Payroll PDF Export
router.get('/payroll/:year/:month/export', requireAdminOnly, async (req, res) => {
    try {
        const { year, month } = req.params;
        const { download = 'true' } = req.query;
        
        console.log(`[PDF Export] Generating monthly payroll PDF for ${month}/${year}`);
        
        // Validate parameters
        if (!year || !month || month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_PARAMETERS',
                message: 'Valid year and month (1-12) are required'
            });
        }
        
        // Get payroll data using our custom calculation function
        const payrollData = await calculateBulkPayroll(parseInt(year), parseInt(month));
        
        if (!payrollData || payrollData.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'NO_PAYROLL_DATA',
                message: `No payroll data found for ${getMonthName(month)} ${year}`
            });
        }
        
        // Prepare PDF options
        const options = {
            title: `Monthly Payroll Report - ${getMonthName(month)} ${year}`,
            period: `${month}/${year}`,
            generatedAt: getISTTimestamp(),
            year: year,
            month: month
        };
        
        // Try PDF generation with fallback to HTML
        let pdfContent;
        let contentType = 'application/pdf';
        let isHTML = false;
        
        try {
            // Try Puppeteer PDF generation first
            pdfContent = await PDFService.generatePayrollPDF(payrollData, options);
        } catch (pdfError) {
            console.log('[PDF Export] Puppeteer failed, trying alternative PDF service:', pdfError.message);
            try {
                // Try alternative PDF service
                pdfContent = await AlternativePDFService.generatePayrollPDF(payrollData, options);
                console.log('[PDF Export] Alternative PDF service succeeded');
            } catch (alternativeError) {
                console.log('[PDF Export] Alternative PDF failed, falling back to HTML:', alternativeError.message);
                // Final fallback to HTML format
                pdfContent = SimplePDFService.generatePayrollHTML(payrollData, options);
                contentType = 'text/html';
                isHTML = true;
            }
        }
        
        // Set response headers
        const filename = `Payroll_Report_${getMonthName(month)}_${year}.${isHTML ? 'html' : 'pdf'}`;
        
        res.setHeader('Content-Type', contentType);
        
        if (isHTML) {
            // For HTML, send as viewable page
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            console.log(`[PDF Export] Generated HTML payroll report: ${filename}`);
            res.send(pdfContent);
        } else {
            // For PDF, handle as binary
            res.setHeader('Content-Length', pdfContent.length);
            
            if (download === 'true') {
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            } else {
                res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            }
            
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            console.log(`[PDF Export] Successfully generated PDF: ${filename} (${pdfContent.length} bytes)`);
            res.send(pdfContent);
        }
        
    } catch (error) {
        console.error('[PDF Export] Error generating monthly PDF:', error);
        res.status(500).json({
            success: false,
            error: 'PDF_GENERATION_FAILED',
            message: 'Failed to generate PDF report',
            details: error.message
        });
    }
});

// Year-to-Date Payroll PDF Export
router.get('/payroll/:year/ytd/export', requireAdminOnly, async (req, res) => {
    try {
        const { year } = req.params;
        const { download = 'true' } = req.query;
        
        console.log(`[PDF Export] Generating YTD payroll PDF for ${year}`);
        
        // Validate year
        if (!year || year < 2020 || year > 2030) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_YEAR',
                message: 'Valid year is required'
            });
        }
        
        // Get current month to determine YTD range
        const currentDate = new Date();
        const currentMonth = currentDate.getFullYear() == year ? currentDate.getMonth() + 1 : 12;
        
        console.log(`[PDF Export] Calculating YTD data for months 1-${currentMonth} of ${year}`);
        
        // Collect payroll data for all months up to current month
        const allMonthsData = [];
        const monthlySummaries = [];
        
        for (let month = 1; month <= currentMonth; month++) {
            try {
                const monthData = await calculateBulkPayroll(parseInt(year), month);
                if (monthData && monthData.length > 0) {
                    
                    // Calculate monthly totals
                    const monthlyTotal = monthData.reduce((sum, driver) => {
                        return sum + (driver.breakdown?.totalEarnings || 0);
                    }, 0);
                    
                    monthlySummaries.push({
                        month: month,
                        monthName: getMonthName(month),
                        driversCount: monthData.length,
                        totalPayroll: monthlyTotal,
                        data: monthData
                    });
                    
                    allMonthsData.push(...monthData);
                }
            } catch (monthError) {
                console.log(`[PDF Export] No data for month ${month}/${year}:`, monthError.message);
            }
        }
        
        if (monthlySummaries.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'NO_YTD_DATA',
                message: `No payroll data found for year ${year}`
            });
        }
        
        // Prepare YTD PDF options
        const options = {
            title: `Year-to-Date Payroll Report - ${year}`,
            period: `Jan-${getMonthName(currentMonth)} ${year}`,
            generatedAt: getISTTimestamp(),
            year: year,
            isYTD: true,
            monthlySummaries: monthlySummaries
        };
        
        // Generate consolidated YTD data (sum per driver across all months)
        const ytdData = {};
        allMonthsData.forEach(driver => {
            const driverName = driver.driverName;
            if (!ytdData[driverName]) {
                ytdData[driverName] = {
                    driverName: driverName,
                    breakdown: {
                        baseSalary: 0,
                        overtimeHours: 0,
                        overtimePay: 0,
                        fuelAllowance: 0,
                        leaveDeduction: 0,
                        totalEarnings: 0,
                        workingDays: 0
                    }
                };
            }
            
            const breakdown = driver.breakdown || {};
            ytdData[driverName].breakdown.baseSalary += breakdown.baseSalary || 0;
            ytdData[driverName].breakdown.overtimeHours += breakdown.overtimeHours || 0;
            ytdData[driverName].breakdown.overtimePay += breakdown.overtimePay || 0;
            ytdData[driverName].breakdown.fuelAllowance += breakdown.fuelAllowance || 0;
            ytdData[driverName].breakdown.leaveDeduction += breakdown.leaveDeduction || 0;
            ytdData[driverName].breakdown.totalEarnings += breakdown.totalEarnings || 0;
            ytdData[driverName].breakdown.workingDays += breakdown.workingDays || 0;
        });
        
        const consolidatedYTDData = Object.values(ytdData);
        
        // Try PDF generation with fallback to HTML
        let pdfContent;
        let contentType = 'application/pdf';
        let isHTML = false;
        
        try {
            // Try Puppeteer PDF generation first
            pdfContent = await PDFService.generatePayrollPDF(consolidatedYTDData, options);
        } catch (pdfError) {
            console.log('[PDF Export] Puppeteer failed, trying alternative PDF service:', pdfError.message);
            try {
                // Try alternative PDF service
                pdfContent = await AlternativePDFService.generatePayrollPDF(consolidatedYTDData, options);
                console.log('[PDF Export] Alternative PDF service succeeded');
            } catch (alternativeError) {
                console.log('[PDF Export] Alternative PDF failed, falling back to HTML:', alternativeError.message);
                // Final fallback to HTML format
                pdfContent = SimplePDFService.generatePayrollHTML(consolidatedYTDData, options);
                contentType = 'text/html';
                isHTML = true;
            }
        }
        
        // Set response headers
        const filename = `YTD_Payroll_Report_${year}.${isHTML ? 'html' : 'pdf'}`;
        
        res.setHeader('Content-Type', contentType);
        
        if (isHTML) {
            // For HTML, send as viewable page
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            console.log(`[PDF Export] Generated HTML YTD report: ${filename}`);
            res.send(pdfContent);
        } else {
            // For PDF, handle as binary
            res.setHeader('Content-Length', pdfContent.length);
            
            if (download === 'true') {
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            } else {
                res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            }
            
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            console.log(`[PDF Export] Successfully generated YTD PDF: ${filename} (${pdfContent.length} bytes)`);
            res.send(pdfContent);
        }
        
    } catch (error) {
        console.error('[PDF Export] Error generating YTD PDF:', error);
        res.status(500).json({
            success: false,
            error: 'PDF_GENERATION_FAILED',
            message: 'Failed to generate YTD PDF report',
            details: error.message
        });
    }
});

// PDF Service health check
router.get('/pdf/health', requireAdminOnly, async (req, res) => {
    try {
        const browser = await PDFService.initBrowser();
        const isHealthy = browser && !browser.isConnected || browser.isConnected();
        
        res.json({
            success: true,
            service: 'PDF Generation Service',
            status: isHealthy ? 'healthy' : 'degraded',
            timestamp: getISTTimestamp()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            service: 'PDF Generation Service',
            status: 'unhealthy',
            error: error.message,
            timestamp: getISTTimestamp()
        });
    }
});

module.exports = router;