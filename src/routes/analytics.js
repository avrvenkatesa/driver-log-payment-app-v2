const express = require('express');
const router = express.Router();
const { getCompleteAnalyticsData } = require('../database/admin_analytics');
const { requireAdminOnly } = require('../auth/auth');

// Analytics API endpoint - Story 14: Shift Analytics
router.get('/analytics', requireAdminOnly, async (req, res) => {
    try {
        const { filter = 'today', page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        console.log(`[Analytics API] ==> GET /api/admin/analytics`);
        console.log(`[Analytics API] ==> Filter: ${filter}, Page: ${pageNum}, Limit: ${limitNum}`);
        console.log(`[Analytics API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
        
        // Get complete analytics data
        const analyticsData = await getCompleteAnalyticsData(filter, pageNum, limitNum);
        
        const response = {
            success: true,
            data: analyticsData,
            message: `Analytics data retrieved successfully for ${filter} filter`
        };
        
        console.log(`[Analytics API] ==> Analytics data retrieved successfully:`);
        console.log(`[Analytics API] ==> Summary: ${analyticsData.summary.totalShifts} shifts, ${analyticsData.summary.totalHours} hours`);
        console.log(`[Analytics API] ==> Trends: ${analyticsData.trends.length} data points`);
        console.log(`[Analytics API] ==> Drivers: ${analyticsData.drivers.length} active drivers`);
        console.log(`[Analytics API] ==> Recent shifts: ${analyticsData.recentShifts.length} shifts`);
        
        res.json(response);
        
    } catch (error) {
        console.error('[Analytics API] Error getting analytics data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve analytics data',
            details: error.message
        });
    }
});

// Test endpoint to verify database data
router.get('/analytics/test', requireAdminOnly, async (req, res) => {
    try {
        console.log(`[Analytics Test] ==> Testing database connectivity and shift data`);
        
        const sqlite3 = require('sqlite3').verbose();
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'company.db');
        const db = new sqlite3.Database(dbPath);
        
        // Test basic shift count
        db.get('SELECT COUNT(*) as total FROM shifts', (err, row) => {
            if (err) {
                console.error('[Analytics Test] Database error:', err);
                res.status(500).json({ success: false, error: err.message });
                return;
            }
            
            console.log(`[Analytics Test] ==> Total shifts in database: ${row.total}`);
            
            // Test recent shifts
            db.all('SELECT id, clock_in_time, total_distance, shift_duration_minutes FROM shifts ORDER BY clock_in_time DESC LIMIT 5', (err, rows) => {
                if (err) {
                    console.error('[Analytics Test] Error getting recent shifts:', err);
                    res.status(500).json({ success: false, error: err.message });
                    return;
                }
                
                console.log(`[Analytics Test] ==> Recent shifts:`, rows);
                
                res.json({
                    success: true,
                    data: {
                        totalShifts: row.total,
                        recentShifts: rows,
                        message: 'Database test completed successfully'
                    }
                });
                
                db.close();
            });
        });
        
    } catch (error) {
        console.error('[Analytics Test] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Analytics test failed',
            details: error.message
        });
    }
});

module.exports = router;