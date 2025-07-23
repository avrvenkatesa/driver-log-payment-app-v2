const express = require('express');
const { authMiddleware } = require('../auth/auth');
const { driverHelpers, shiftHelpers } = require('../database/index');
const dbConnection = require('../database/connection');

const router = express.Router();

/**
 * Get current driver status and active shift information
 * GET /api/driver/status
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    
    // Get driver information
    const driver = await driverHelpers.getDriverById(driverId);
    
    // Check for active shift (clock_out_time is NULL)
    const activeShiftQuery = `
      SELECT 
        id,
        clock_in_time,
        start_odometer,
        total_distance,
        shift_duration_minutes,
        status,
        created_at
      FROM shifts 
      WHERE driver_id = ? AND clock_out_time IS NULL AND status = 'active'
      ORDER BY clock_in_time DESC 
      LIMIT 1
    `;
    
    const activeShift = await dbConnection.get(activeShiftQuery, [driverId]);
    
    // Get today's completed shifts count
    const today = new Date().toISOString().split('T')[0];
    const todayShiftsQuery = `
      SELECT COUNT(*) as count
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) = ?
    `;
    
    const todayShiftsResult = await dbConnection.get(todayShiftsQuery, [driverId, today]);
    const todayShiftsCount = todayShiftsResult?.count || 0;
    
    // Calculate shift duration if active
    let currentShiftDuration = 0;
    if (activeShift) {
      const clockInTime = new Date(activeShift.clock_in_time);
      const now = new Date();
      currentShiftDuration = Math.floor((now - clockInTime) / (1000 * 60)); // minutes
    }
    
    const response = {
      success: true,
      data: {
        driver: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          isActive: driver.is_active
        },
        shift: {
          hasActiveShift: !!activeShift,
          currentShift: activeShift ? {
            shiftId: activeShift.id,
            clockInTime: activeShift.clock_in_time,
            startOdometer: activeShift.start_odometer,
            currentDuration: currentShiftDuration,
            status: activeShift.status
          } : null,
          todayShiftsCount,
          status: activeShift ? 'clocked_in' : 'clocked_out'
        },
        timestamp: new Date().toISOString()
      }
    };
    
    console.log(`[${new Date().toISOString()}] ✅ Driver status retrieved: ${driver.name} - ${response.data.shift.status}`);
    res.json(response);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting driver status:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get driver status',
      message: error.message
    });
  }
});

/**
 * Clock in - Start a new shift
 * POST /api/driver/clock-in
 */
router.post('/clock-in', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { startOdometer } = req.body;
    
    // Validate required fields
    if (!startOdometer) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Start odometer reading is required'
      });
    }

    // Validate odometer is numeric
    if (isNaN(startOdometer) || startOdometer < 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Start odometer must be a valid positive number'
      });
    }

    const parsedOdometer = parseInt(startOdometer);
    
    console.log(`[${new Date().toISOString()}] 🕐 Clock-in attempt: Driver ${driverId}, Odometer: ${parsedOdometer}`);
    
    // Create new shift
    const shift = await shiftHelpers.createShift({
      driver_id: driverId,
      start_odometer: parsedOdometer
    });
    
    const response = {
      success: true,
      message: 'Successfully clocked in',
      shift: {
        shiftId: shift.id,
        driverId: shift.driver_id,
        clockInTime: shift.clock_in_time,
        startOdometer: shift.start_odometer,
        status: shift.status
      }
    };
    
    console.log(`[${new Date().toISOString()}] ✅ Clock-in successful: Driver ${driverId}, Shift ID: ${shift.id}`);
    res.status(201).json(response);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Clock-in error:`, error.message);
    
    // Handle specific error cases
    if (error.message.includes('already has an active shift')) {
      return res.status(409).json({
        success: false,
        error: 'Active Shift Exists',
        message: error.message
      });
    }
    
    if (error.message.includes('must be greater than or equal to previous')) {
      return res.status(400).json({
        success: false,
        error: 'Odometer Validation Error',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to clock in',
      message: error.message
    });
  }
});

/**
 * Clock out - Complete current shift
 * POST /api/driver/clock-out
 */
router.post('/clock-out', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { endOdometer } = req.body;
    
    // Validate required fields
    if (!endOdometer) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'End odometer reading is required'
      });
    }

    // Validate odometer is numeric
    if (isNaN(endOdometer) || endOdometer < 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'End odometer must be a valid positive number'
      });
    }

    const parsedOdometer = parseInt(endOdometer);
    
    console.log(`[${new Date().toISOString()}] 🕕 Clock-out attempt: Driver ${driverId}, End Odometer: ${parsedOdometer}`);
    
    // Complete the shift
    const completedShift = await shiftHelpers.completeShift(driverId, {
      endOdometer: parsedOdometer
    });
    
    const response = {
      success: true,
      message: 'Successfully clocked out',
      shift: {
        shiftId: completedShift.id,
        driverId: completedShift.driver_id,
        clockInTime: completedShift.clock_in_time,
        clockOutTime: completedShift.clock_out_time,
        startOdometer: completedShift.start_odometer,
        endOdometer: completedShift.end_odometer,
        totalDistance: completedShift.total_distance,
        shiftDurationMinutes: completedShift.shift_duration_minutes,
        status: completedShift.status
      }
    };
    
    console.log(`[${new Date().toISOString()}] ✅ Clock-out successful: Driver ${driverId}, Shift ID: ${completedShift.id}, Distance: ${completedShift.total_distance}km, Duration: ${completedShift.shift_duration_minutes}min`);
    res.status(200).json(response);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Clock-out error:`, error.message);
    
    // Handle specific error cases
    if (error.message.includes('No active shift found')) {
      return res.status(409).json({
        success: false,
        error: 'No Active Shift',
        message: error.message
      });
    }
    
    if (error.message.includes('must be greater than or equal to')) {
      return res.status(400).json({
        success: false,
        error: 'Odometer Validation Error',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to clock out',
      message: error.message
    });
  }
});

/**
 * Get driver profile information
 * GET /api/driver/profile
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const driver = await driverHelpers.getDriverById(driverId);
    
    res.json({
      success: true,
      data: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        isActive: driver.is_active,
        isPhoneVerified: driver.is_phone_verified,
        createdAt: driver.created_at
      }
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting driver profile:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get driver profile',
      message: error.message
    });
  }
});

/**
 * Get daily shift history for a specific date
 * GET /api/driver/shifts/daily/:date (YYYY-MM-DD format)
 */
router.get('/shifts/daily/:date', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { date } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        message: 'Date must be in YYYY-MM-DD format'
      });
    }

    // Get shifts for the specific date
    const shiftsQuery = `
      SELECT 
        id, clock_in_time, clock_out_time, start_odometer, end_odometer,
        total_distance, shift_duration_minutes, status, created_at
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) = ?
      AND status = 'completed'
      ORDER BY clock_in_time DESC 
      LIMIT ? OFFSET ?
    `;

    const shifts = await dbConnection.all(shiftsQuery, [driverId, date, limit, offset]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) = ?
      AND status = 'completed'
    `;
    const countResult = await dbConnection.get(countQuery, [driverId, date]);
    const total = countResult.total || 0;

    // Calculate summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as totalShifts,
        COALESCE(SUM(shift_duration_minutes), 0) as totalMinutes,
        COALESCE(SUM(total_distance), 0) as totalDistance
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) = ?
      AND status = 'completed'
    `;
    const summary = await dbConnection.get(summaryQuery, [driverId, date]);

    res.json({
      success: true,
      data: {
        shifts: shifts.map(shift => ({
          ...shift,
          clock_in_time: new Date(shift.clock_in_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          clock_out_time: shift.clock_out_time ? new Date(shift.clock_out_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
          duration_hours: shift.shift_duration_minutes ? (shift.shift_duration_minutes / 60).toFixed(2) : null
        })),
        summary: {
          totalShifts: summary.totalShifts || 0,
          totalHours: summary.totalMinutes ? (summary.totalMinutes / 60).toFixed(2) : 0,
          totalDistance: summary.totalDistance || 0,
          date: date
        },
        pagination: {
          page,
          limit,
          total,
          hasNext: offset + limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting daily shifts:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Database Error',
      message: 'Failed to retrieve daily shifts'
    });
  }
});

/**
 * Get weekly shift history 
 * GET /api/driver/shifts/weekly/:year/:week (ISO week numbers)
 */
router.get('/shifts/weekly/:year/:week', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { year, week } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Calculate start and end dates for the week
    const startDate = new Date(year, 0, 1 + (week - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get shifts for the week
    const shiftsQuery = `
      SELECT 
        id, clock_in_time, clock_out_time, start_odometer, end_odometer,
        total_distance, shift_duration_minutes, status, created_at
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) BETWEEN ? AND ?
      AND status = 'completed'
      ORDER BY clock_in_time DESC 
      LIMIT ? OFFSET ?
    `;

    const shifts = await dbConnection.all(shiftsQuery, [driverId, startDateStr, endDateStr, limit, offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) BETWEEN ? AND ?
      AND status = 'completed'
    `;
    const countResult = await dbConnection.get(countQuery, [driverId, startDateStr, endDateStr]);
    const total = countResult.total || 0;

    // Calculate summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as totalShifts,
        COALESCE(SUM(shift_duration_minutes), 0) as totalMinutes,
        COALESCE(SUM(total_distance), 0) as totalDistance
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) BETWEEN ? AND ?
      AND status = 'completed'
    `;
    const summary = await dbConnection.get(summaryQuery, [driverId, startDateStr, endDateStr]);

    res.json({
      success: true,
      data: {
        shifts: shifts.map(shift => ({
          ...shift,
          clock_in_time: new Date(shift.clock_in_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          clock_out_time: shift.clock_out_time ? new Date(shift.clock_out_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
          duration_hours: shift.shift_duration_minutes ? (shift.shift_duration_minutes / 60).toFixed(2) : null
        })),
        summary: {
          totalShifts: summary.totalShifts || 0,
          totalHours: summary.totalMinutes ? (summary.totalMinutes / 60).toFixed(2) : 0,
          totalDistance: summary.totalDistance || 0,
          weekNumber: week,
          year: year,
          startDate: startDateStr,
          endDate: endDateStr
        },
        pagination: {
          page,
          limit,
          total,
          hasNext: offset + limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting weekly shifts:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Database Error',
      message: 'Failed to retrieve weekly shifts'
    });
  }
});

/**
 * Get monthly shift summary
 * GET /api/driver/shifts/monthly/:year/:month
 */
router.get('/shifts/monthly/:year/:month', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { year, month } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Validate month (1-12)
    const monthNum = parseInt(month);
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month',
        message: 'Month must be between 1 and 12'
      });
    }

    // Calculate start and end dates for the month
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? parseInt(year) + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    // Get shifts for the month
    const shiftsQuery = `
      SELECT 
        id, clock_in_time, clock_out_time, start_odometer, end_odometer,
        total_distance, shift_duration_minutes, status, created_at
      FROM shifts 
      WHERE driver_id = ? 
      AND clock_in_time >= ? 
      AND clock_in_time < ?
      AND status = 'completed'
      ORDER BY clock_in_time DESC 
      LIMIT ? OFFSET ?
    `;

    const shifts = await dbConnection.all(shiftsQuery, [driverId, startDate, endDate, limit, offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM shifts 
      WHERE driver_id = ? 
      AND clock_in_time >= ? 
      AND clock_in_time < ?
      AND status = 'completed'
    `;
    const countResult = await dbConnection.get(countQuery, [driverId, startDate, endDate]);
    const total = countResult.total || 0;

    // Calculate comprehensive summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as totalShifts,
        COALESCE(SUM(shift_duration_minutes), 0) as totalMinutes,
        COALESCE(SUM(total_distance), 0) as totalDistance,
        COALESCE(AVG(shift_duration_minutes), 0) as avgMinutes,
        COALESCE(AVG(total_distance), 0) as avgDistance,
        COUNT(DISTINCT DATE(clock_in_time)) as workingDays
      FROM shifts 
      WHERE driver_id = ? 
      AND clock_in_time >= ? 
      AND clock_in_time < ?
      AND status = 'completed'
    `;
    const summary = await dbConnection.get(summaryQuery, [driverId, startDate, endDate]);

    res.json({
      success: true,
      data: {
        shifts: shifts.map(shift => ({
          ...shift,
          clock_in_time: new Date(shift.clock_in_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          clock_out_time: shift.clock_out_time ? new Date(shift.clock_out_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
          duration_hours: shift.shift_duration_minutes ? (shift.shift_duration_minutes / 60).toFixed(2) : null,
          shift_date: new Date(shift.clock_in_time).toLocaleDateString('en-IN')
        })),
        summary: {
          totalShifts: summary.totalShifts || 0,
          totalHours: summary.totalMinutes ? (summary.totalMinutes / 60).toFixed(2) : 0,
          totalDistance: summary.totalDistance || 0,
          averageHours: summary.avgMinutes ? (summary.avgMinutes / 60).toFixed(2) : 0,
          averageDistance: summary.avgDistance ? Math.round(summary.avgDistance) : 0,
          workingDays: summary.workingDays || 0,
          month: monthNum,
          year: parseInt(year),
          monthName: new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'long' })
        },
        pagination: {
          page,
          limit,
          total,
          hasNext: offset + limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting monthly shifts:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Database Error',
      message: 'Failed to retrieve monthly shifts'
    });
  }
});

/**
 * Export shift data with date range filtering
 * GET /api/driver/shifts/export?start=date&end=date&format=csv|json
 */
router.get('/shifts/export', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { start, end, format = 'json' } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'Start and end date are required'
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
        message: 'Dates must be in YYYY-MM-DD format'
      });
    }

    // Get shifts within date range
    const shiftsQuery = `
      SELECT 
        id, clock_in_time, clock_out_time, start_odometer, end_odometer,
        total_distance, shift_duration_minutes, status, created_at
      FROM shifts 
      WHERE driver_id = ? 
      AND DATE(clock_in_time) BETWEEN ? AND ?
      AND status = 'completed'
      ORDER BY clock_in_time ASC
    `;

    const shifts = await dbConnection.all(shiftsQuery, [driverId, start, end]);

    const exportData = shifts.map(shift => ({
      shift_id: shift.id,
      date: new Date(shift.clock_in_time).toLocaleDateString('en-IN'),
      clock_in: new Date(shift.clock_in_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      clock_out: shift.clock_out_time ? new Date(shift.clock_out_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      duration_hours: shift.shift_duration_minutes ? (shift.shift_duration_minutes / 60).toFixed(2) : 0,
      start_odometer: shift.start_odometer,
      end_odometer: shift.end_odometer || 0,
      distance_km: shift.total_distance || 0,
      status: shift.status
    }));

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'Shift ID,Date,Clock In,Clock Out,Duration (Hours),Start Odometer,End Odometer,Distance (KM),Status\n';
      const csvRows = exportData.map(row => 
        `${row.shift_id},${row.date},"${row.clock_in}","${row.clock_out}",${row.duration_hours},${row.start_odometer},${row.end_odometer},${row.distance_km},${row.status}`
      ).join('\n');
      
      const csv = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="shifts_${start}_to_${end}.csv"`);
      res.send(csv);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="shifts_${start}_to_${end}.json"`);
      res.json({
        success: true,
        data: {
          shifts: exportData,
          dateRange: { start, end },
          totalShifts: exportData.length,
          exportedAt: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error exporting shifts:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Export Error',
      message: 'Failed to export shift data'
    });
  }
});

module.exports = router;