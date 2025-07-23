const express = require('express');
const { authMiddleware } = require('../auth/auth');
const { driverHelpers } = require('../database/index');
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