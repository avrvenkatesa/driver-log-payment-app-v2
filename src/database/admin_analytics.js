const dbConnection = require('./connection');

/**
 * Admin Analytics Database Operations
 * Story 14: Shift Analytics Implementation
 * Provides comprehensive analytics data for admin dashboard
 */

/**
 * Get comprehensive shift analytics data for specified time period
 * @param {string} filter - Time period filter: 'today', 'week', 'month', 'all'
 * @param {number} page - Page number for pagination (default: 1)
 * @param {number} limit - Results per page (default: 10)
 * @returns {Object} Analytics data with summary, trends, and shift details
 */
async function getShiftAnalytics(filter = 'today', page = 1, limit = 10) {
    try {
        console.log(`[Admin Analytics DB] ==> Getting analytics for filter: ${filter}, page: ${page}, limit: ${limit}`);
        
        const dateRange = getDateRange(filter);
        console.log(`[Admin Analytics DB] ==> Date range: ${dateRange.start} to ${dateRange.end}`);
        
        // Get summary analytics
        const summary = await getSummaryAnalytics(dateRange);
        
        // Get daily trends
        const dailyTrends = await getDailyTrends(dateRange);
        
        // Get driver performance
        const driverPerformance = await getDriverPerformance(dateRange);
        
        // Get paginated shift details
        const shiftDetails = await getShiftDetails(dateRange, page, limit);
        
        const analytics = {
            summary,
            period: {
                filter,
                startDate: dateRange.start,
                endDate: dateRange.end,
                description: getPeriodDescription(filter, dateRange)
            },
            trends: {
                shiftsPerDay: dailyTrends,
                driverPerformance
            }
        };
        
        console.log(`[Admin Analytics DB] ==> Analytics summary:`, {
            totalShifts: summary.totalShifts,
            activeDrivers: summary.activeDrivers,
            totalDistance: summary.totalDistance,
            dailyTrendsCount: dailyTrends.length,
            driverPerformanceCount: driverPerformance.length
        });
        
        return {
            analytics,
            shifts: shiftDetails.shifts,
            pagination: shiftDetails.pagination
        };
        
    } catch (error) {
        console.error('[Admin Analytics DB] ==> Error getting analytics:', error);
        throw new Error(`Failed to get shift analytics: ${error.message}`);
    }
}

/**
 * Get summary analytics for the specified date range
 */
async function getSummaryAnalytics(dateRange) {
    const query = `
        SELECT 
            COUNT(*) as totalShifts,
            COALESCE(SUM(total_distance), 0) as totalDistance,
            COALESCE(SUM(shift_duration_minutes), 0) as totalMinutes,
            COUNT(DISTINCT driver_id) as activeDrivers,
            COALESCE(AVG(shift_duration_minutes), 0) as avgShiftDuration,
            COALESCE(AVG(total_distance), 0) as avgDistance
        FROM shifts 
        WHERE DATE(clock_in_time) >= ? AND DATE(clock_in_time) <= ?
        AND status = 'completed'
    `;
    
    console.log(`[Admin Analytics DB] ==> Executing summary query with dates: ${dateRange.start} to ${dateRange.end}`);
    
    const result = await dbConnection.query(query, [dateRange.start, dateRange.end]);
    const summary = result[0] || {};
    
    // Calculate derived metrics
    const totalHours = (summary.totalMinutes || 0) / 60;
    const avgShiftHours = (summary.avgShiftDuration || 0) / 60;
    
    return {
        totalShifts: parseInt(summary.totalShifts) || 0,
        totalDistance: parseFloat(summary.totalDistance) || 0,
        totalHours: parseFloat(totalHours.toFixed(1)),
        totalMinutes: parseInt(summary.totalMinutes) || 0,
        activeDrivers: parseInt(summary.activeDrivers) || 0,
        averageShiftDuration: parseFloat(avgShiftHours.toFixed(1)),
        averageDistance: parseFloat((summary.avgDistance || 0).toFixed(1)),
        totalFuelUsed: parseFloat(((summary.totalDistance || 0) / 15).toFixed(1)) // Estimate: 15km per liter
    };
}

/**
 * Get daily trends for the specified date range
 */
async function getDailyTrends(dateRange) {
    const query = `
        SELECT 
            DATE(clock_in_time) as date,
            COUNT(*) as shifts,
            COALESCE(SUM(total_distance), 0) as distance,
            COALESCE(SUM(shift_duration_minutes), 0) as totalMinutes,
            COUNT(DISTINCT driver_id) as activeDrivers
        FROM shifts 
        WHERE DATE(clock_in_time) >= ? AND DATE(clock_in_time) <= ?
        AND status = 'completed'
        GROUP BY DATE(clock_in_time)
        ORDER BY date ASC
    `;
    
    const result = await dbConnection.query(query, [dateRange.start, dateRange.end]);
    
    return result.map(row => ({
        date: row.date,
        shifts: parseInt(row.shifts) || 0,
        distance: parseFloat(row.distance) || 0,
        hours: parseFloat(((row.totalMinutes || 0) / 60).toFixed(1)),
        activeDrivers: parseInt(row.activeDrivers) || 0
    }));
}

/**
 * Get driver performance for the specified date range
 */
async function getDriverPerformance(dateRange) {
    const query = `
        SELECT 
            s.driver_id,
            d.name as driverName,
            d.phone as driverPhone,
            COUNT(*) as shifts,
            COALESCE(SUM(s.total_distance), 0) as distance,
            COALESCE(SUM(s.shift_duration_minutes), 0) as totalMinutes,
            COALESCE(AVG(s.shift_duration_minutes), 0) as avgShiftDuration,
            COALESCE(AVG(s.total_distance), 0) as avgDistance
        FROM shifts s
        JOIN drivers d ON s.driver_id = d.id
        WHERE DATE(s.clock_in_time) >= ? AND DATE(s.clock_in_time) <= ?
        AND s.status = 'completed'
        GROUP BY s.driver_id, d.name, d.phone
        ORDER BY shifts DESC, distance DESC
    `;
    
    const result = await dbConnection.query(query, [dateRange.start, dateRange.end]);
    
    return result.map(row => ({
        driverId: parseInt(row.driver_id),
        driverName: row.driverName,
        driverPhone: row.driverPhone,
        shifts: parseInt(row.shifts) || 0,
        distance: parseFloat(row.distance) || 0,
        hours: parseFloat(((row.totalMinutes || 0) / 60).toFixed(1)),
        avgShiftDuration: parseFloat(((row.avgShiftDuration || 0) / 60).toFixed(1)),
        avgDistance: parseFloat((row.avgDistance || 0).toFixed(1))
    }));
}

/**
 * Get paginated shift details for the specified date range
 */
async function getShiftDetails(dateRange, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    // Get total count for pagination
    const countQuery = `
        SELECT COUNT(*) as total
        FROM shifts s
        JOIN drivers d ON s.driver_id = d.id
        WHERE DATE(s.clock_in_time) >= ? AND DATE(s.clock_in_time) <= ?
        AND s.status = 'completed'
    `;
    
    const countResult = await dbConnection.query(countQuery, [dateRange.start, dateRange.end]);
    const totalShifts = parseInt(countResult[0]?.total) || 0;
    const totalPages = Math.ceil(totalShifts / limit);
    
    // Get shift details with pagination
    const shiftsQuery = `
        SELECT 
            s.id,
            s.driver_id,
            d.name as driverName,
            d.phone as driverPhone,
            DATE(s.clock_in_time) as date,
            TIME(s.clock_in_time) as startTime,
            TIME(s.clock_out_time) as endTime,
            s.shift_duration_minutes as duration,
            s.total_distance as distance,
            s.start_odometer,
            s.end_odometer,
            s.status,
            s.clock_in_time,
            s.clock_out_time
        FROM shifts s
        JOIN drivers d ON s.driver_id = d.id
        WHERE DATE(s.clock_in_time) >= ? AND DATE(s.clock_in_time) <= ?
        AND s.status = 'completed'
        ORDER BY s.clock_in_time DESC
        LIMIT ? OFFSET ?
    `;
    
    const shifts = await dbConnection.query(shiftsQuery, [dateRange.start, dateRange.end, limit, offset]);
    
    const formattedShifts = shifts.map(shift => ({
        id: parseInt(shift.id),
        driverId: parseInt(shift.driver_id),
        driverName: shift.driverName,
        driverPhone: shift.driverPhone,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        duration: parseInt(shift.duration) || 0,
        durationHours: parseFloat(((shift.duration || 0) / 60).toFixed(1)),
        distance: parseFloat(shift.distance) || 0,
        startOdometer: parseInt(shift.start_odometer) || 0,
        endOdometer: parseInt(shift.end_odometer) || 0,
        status: shift.status,
        clockInTime: shift.clock_in_time,
        clockOutTime: shift.clock_out_time
    }));
    
    return {
        shifts: formattedShifts,
        pagination: {
            currentPage: page,
            totalPages,
            totalShifts,
            limit,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}

/**
 * Get date range based on filter
 */
function getDateRange(filter) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
        case 'today':
            return {
                start: formatDate(today),
                end: formatDate(today)
            };
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
            return {
                start: formatDate(weekStart),
                end: formatDate(today)
            };
        case 'month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            return {
                start: formatDate(monthStart),
                end: formatDate(today)
            };
        case 'all':
            return {
                start: '2025-01-01',
                end: formatDate(today)
            };
        default:
            return {
                start: formatDate(today),
                end: formatDate(today)
            };
    }
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Get human-readable period description
 */
function getPeriodDescription(filter, dateRange) {
    const formatDisplayDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };
    
    switch (filter) {
        case 'today':
            return `Today (${formatDisplayDate(dateRange.start)})`;
        case 'week':
            return `This Week (${formatDisplayDate(dateRange.start)} - ${formatDisplayDate(dateRange.end)})`;
        case 'month':
            return `This Month (${formatDisplayDate(dateRange.start)} - ${formatDisplayDate(dateRange.end)})`;
        case 'all':
            return `All Time (${formatDisplayDate(dateRange.start)} - ${formatDisplayDate(dateRange.end)})`;
        default:
            return `Selected Period (${formatDisplayDate(dateRange.start)} - ${formatDisplayDate(dateRange.end)})`;
    }
}

module.exports = {
    getShiftAnalytics
};