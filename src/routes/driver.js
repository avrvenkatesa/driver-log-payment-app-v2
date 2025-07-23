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

module.exports = router;