const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection
const dbPath = path.join(process.cwd(), 'company.db');
const db = new sqlite3.Database(dbPath);

// Convert UTC timestamp to IST
function convertToIST(utcTimestamp) {
    const utcDate = new Date(utcTimestamp);
    const options = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const formattedDate = formatter.format(utcDate);
    return formattedDate + ' IST';
}

// Get date range for filter
function getDateRange(filter) {
    const today = new Date();
    
    switch (filter) {
        case 'today':
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
            return { start: startOfToday, end: endOfToday };
            
        case 'week':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            return { start: startOfWeek, end: endOfWeek };
            
        case 'month':
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            return { start: startOfMonth, end: endOfMonth };
            
        case 'all':
        default:
            return {
                start: new Date('2025-01-01T00:00:00.000Z'),
                end: new Date()
            };
    }
}

// Get analytics summary data
function getAnalyticsSummary(filter = 'today') {
    return new Promise((resolve, reject) => {
        const { start, end } = getDateRange(filter);
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        
        console.log(`[Analytics DB] Getting summary for filter: ${filter}`);
        console.log(`[Analytics DB] Date range: ${startISO} to ${endISO}`);
        
        // Query for summary statistics
        const summaryQuery = `
            SELECT 
                COUNT(*) as totalShifts,
                COALESCE(SUM(total_distance), 0) as totalDistance,
                COALESCE(SUM(shift_duration_minutes), 0) / 60.0 as totalHours,
                COUNT(DISTINCT driver_id) as activeDrivers
            FROM shifts 
            WHERE clock_in_time >= ? AND clock_in_time <= ?
            AND status = 'completed'
        `;
        
        db.get(summaryQuery, [startISO, endISO], (err, summaryRow) => {
            if (err) {
                console.error('[Analytics DB] Error getting summary:', err);
                reject(err);
                return;
            }
            
            const summary = {
                totalShifts: summaryRow?.totalShifts || 0,
                totalDistance: Math.round((summaryRow?.totalDistance || 0) * 10) / 10, // Round to 1 decimal
                totalHours: Math.round((summaryRow?.totalHours || 0) * 10) / 10, // Round to 1 decimal
                activeDrivers: summaryRow?.activeDrivers || 0
            };
            
            console.log(`[Analytics DB] Summary calculated:`, summary);
            resolve(summary);
        });
    });
}

// Get trends data for visualization
function getAnalyticsTrends(filter = 'today') {
    return new Promise((resolve, reject) => {
        const { start, end } = getDateRange(filter);
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        
        console.log(`[Analytics DB] Getting trends for filter: ${filter}`);
        
        let trendsQuery, groupBy;
        
        switch (filter) {
            case 'today':
                // Group by hour for today
                trendsQuery = `
                    SELECT 
                        strftime('%H:00', clock_in_time) as period,
                        COUNT(*) as shifts,
                        COALESCE(SUM(shift_duration_minutes), 0) / 60.0 as hours,
                        COALESCE(SUM(total_distance), 0) as distance
                    FROM shifts 
                    WHERE clock_in_time >= ? AND clock_in_time <= ?
                    AND status = 'completed'
                    GROUP BY strftime('%H', clock_in_time)
                    ORDER BY period
                `;
                break;
                
            case 'week':
                // Group by day for this week
                trendsQuery = `
                    SELECT 
                        strftime('%Y-%m-%d', clock_in_time) as period,
                        COUNT(*) as shifts,
                        COALESCE(SUM(shift_duration_minutes), 0) / 60.0 as hours,
                        COALESCE(SUM(total_distance), 0) as distance
                    FROM shifts 
                    WHERE clock_in_time >= ? AND clock_in_time <= ?
                    AND status = 'completed'
                    GROUP BY strftime('%Y-%m-%d', clock_in_time)
                    ORDER BY period
                `;
                break;
                
            case 'month':
                // Group by week for this month
                trendsQuery = `
                    SELECT 
                        'Week ' || strftime('%W', clock_in_time) as period,
                        COUNT(*) as shifts,
                        COALESCE(SUM(shift_duration_minutes), 0) / 60.0 as hours,
                        COALESCE(SUM(total_distance), 0) as distance
                    FROM shifts 
                    WHERE clock_in_time >= ? AND clock_in_time <= ?
                    AND status = 'completed'
                    GROUP BY strftime('%W', clock_in_time)
                    ORDER BY strftime('%W', clock_in_time)
                `;
                break;
                
            case 'all':
            default:
                // Group by month for all time
                trendsQuery = `
                    SELECT 
                        strftime('%Y-%m', clock_in_time) as period,
                        COUNT(*) as shifts,
                        COALESCE(SUM(shift_duration_minutes), 0) / 60.0 as hours,
                        COALESCE(SUM(total_distance), 0) as distance
                    FROM shifts 
                    WHERE clock_in_time >= ? AND clock_in_time <= ?
                    AND status = 'completed'
                    GROUP BY strftime('%Y-%m', clock_in_time)
                    ORDER BY period
                `;
                break;
        }
        
        db.all(trendsQuery, [startISO, endISO], (err, rows) => {
            if (err) {
                console.error('[Analytics DB] Error getting trends:', err);
                reject(err);
                return;
            }
            
            const trends = rows.map(row => ({
                period: row.period,
                shifts: row.shifts,
                hours: Math.round(row.hours * 10) / 10,
                distance: Math.round(row.distance * 10) / 10
            }));
            
            console.log(`[Analytics DB] Trends calculated:`, trends.length, 'data points');
            resolve(trends);
        });
    });
}

// Get driver performance data
function getDriverPerformance(filter = 'today') {
    return new Promise((resolve, reject) => {
        const { start, end } = getDateRange(filter);
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        
        console.log(`[Analytics DB] Getting driver performance for filter: ${filter}`);
        
        const driverQuery = `
            SELECT 
                d.name,
                d.phone,
                COUNT(s.id) as shifts,
                COALESCE(SUM(s.shift_duration_minutes), 0) / 60.0 as hours,
                COALESCE(SUM(s.total_distance), 0) as distance
            FROM drivers d
            LEFT JOIN shifts s ON d.id = s.driver_id 
                AND s.clock_in_time >= ? AND s.clock_in_time <= ?
                AND s.status = 'completed'
            WHERE d.is_active = 1
            GROUP BY d.id, d.name, d.phone
            HAVING shifts > 0
            ORDER BY shifts DESC, hours DESC
            LIMIT 10
        `;
        
        db.all(driverQuery, [startISO, endISO], (err, rows) => {
            if (err) {
                console.error('[Analytics DB] Error getting driver performance:', err);
                reject(err);
                return;
            }
            
            const drivers = rows.map(row => ({
                name: row.name,
                phone: row.phone,
                shifts: row.shifts,
                hours: Math.round(row.hours * 10) / 10,
                distance: Math.round(row.distance * 10) / 10
            }));
            
            console.log(`[Analytics DB] Driver performance calculated:`, drivers.length, 'drivers');
            resolve(drivers);
        });
    });
}

// Get recent shifts data
function getRecentShifts(filter = 'today', page = 1, limit = 10) {
    return new Promise((resolve, reject) => {
        const { start, end } = getDateRange(filter);
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        const offset = (page - 1) * limit;
        
        console.log(`[Analytics DB] Getting recent shifts for filter: ${filter}, page: ${page}`);
        
        const shiftsQuery = `
            SELECT 
                s.id,
                s.clock_in_time,
                s.clock_out_time,
                s.shift_duration_minutes as duration,
                s.total_distance as distance,
                s.status,
                d.name as driverName,
                d.phone as driverPhone
            FROM shifts s
            INNER JOIN drivers d ON s.driver_id = d.id
            WHERE s.clock_in_time >= ? AND s.clock_in_time <= ?
            AND s.status = 'completed'
            ORDER BY s.clock_in_time DESC
            LIMIT ? OFFSET ?
        `;
        
        db.all(shiftsQuery, [startISO, endISO, limit, offset], (err, rows) => {
            if (err) {
                console.error('[Analytics DB] Error getting recent shifts:', err);
                reject(err);
                return;
            }
            
            const shifts = rows.map(row => ({
                id: row.id,
                clockInTime: row.clock_in_time,
                clockOutTime: row.clock_out_time,
                duration: row.duration,
                distance: row.distance,
                status: row.status,
                driverName: row.driverName,
                driverPhone: row.driverPhone
            }));
            
            console.log(`[Analytics DB] Recent shifts retrieved:`, shifts.length, 'shifts');
            resolve(shifts);
        });
    });
}

// Get complete analytics data
async function getCompleteAnalyticsData(filter = 'today', page = 1, limit = 10) {
    try {
        console.log(`[Analytics DB] Getting complete analytics data for filter: ${filter}`);
        
        const [summary, trends, drivers, recentShifts] = await Promise.all([
            getAnalyticsSummary(filter),
            getAnalyticsTrends(filter),
            getDriverPerformance(filter),
            getRecentShifts(filter, page, limit)
        ]);
        
        const result = {
            summary,
            trends,
            drivers,
            recentShifts,
            filter,
            page,
            limit
        };
        
        console.log(`[Analytics DB] Complete analytics data retrieved successfully`);
        return result;
        
    } catch (error) {
        console.error('[Analytics DB] Error getting complete analytics data:', error);
        throw error;
    }
}

module.exports = {
    getAnalyticsSummary,
    getAnalyticsTrends,
    getDriverPerformance,
    getRecentShifts,
    getCompleteAnalyticsData,
    convertToIST
};