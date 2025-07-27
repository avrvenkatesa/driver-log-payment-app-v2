const express = require('express');
const router = express.Router();
const payrollDB = require('../database/payroll');
const adminDriversDB = require('../database/admin_drivers');
const adminAnalyticsDB = require('../database/admin_analytics');
const { authMiddleware, requireAdminOnly, requireDriverOrAdmin } = require('../auth/auth');

// FIXED: Add IST timezone conversion for admin timestamps (same as driver routes)
function convertToIST(utcTimestamp) {
  if (!utcTimestamp) return null;
  
  const date = new Date(utcTimestamp);
  
  // Debug: Log the conversion process
  console.log(`[IST Convert Admin] UTC: ${utcTimestamp} => Converting to IST`);
  
  const istString = date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  console.log(`[IST Convert Admin] Result: ${istString}`);
  return istString;
}

/**
 * Admin Routes for Payroll Configuration Management
 * Story 9: Payroll Configuration System
 */

/**
 * Initialize payroll configuration (run once during setup)
 * This is called automatically when the server starts
 */
async function initializePayrollSystem() {
  try {
    await payrollDB.initializePayrollConfig();
    console.log(`[${new Date().toISOString()}] ✅ Payroll system initialized successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error initializing payroll system:`, error.message);
  }
}

/**
 * GET /api/admin/analytics/shifts
 * Story 14: Shift Analytics - Get comprehensive shift analytics
 * Admin-only endpoint for operational insights
 */
router.get('/analytics/shifts', requireAdminOnly, async (req, res) => {
  try {
    const { filter = 'today', page = 1, limit = 10 } = req.query;
    
    console.log(`[${new Date().toISOString()}] GET /api/admin/shifts - IP: ${req.ip}`);
    console.log(`[Admin Analytics API] ==> Request params: filter=${filter}, page=${page}, limit=${limit}`);
    console.log(`[Admin Analytics API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
    
    // Validate filter parameter
    const validFilters = ['today', 'week', 'month', 'all'];
    if (!validFilters.includes(filter)) {
      console.log(`[Admin Analytics API] ==> Invalid filter: ${filter}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid filter parameter',
        message: `Filter must be one of: ${validFilters.join(', ')}`
      });
    }
    
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page parameter',
        message: 'Page must be a positive integer'
      });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter',
        message: 'Limit must be between 1 and 100'
      });
    }
    
    // Get analytics data
    const analyticsData = await adminAnalyticsDB.getShiftAnalytics(filter, pageNum, limitNum);
    
    console.log(`[Admin Analytics API] ==> Analytics retrieved successfully`);
    console.log(`[Admin Analytics API] ==> Summary: ${analyticsData.analytics.summary.totalShifts} shifts, ${analyticsData.analytics.summary.activeDrivers} active drivers`);
    
    res.json({
      success: true,
      data: analyticsData,
      meta: {
        requestedAt: new Date().toISOString(),
        filter,
        page: pageNum,
        limit: limitNum,
        period: analyticsData.analytics.period.description
      }
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting shift analytics:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve shift analytics',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/admin/payroll-config
 * Get current payroll configuration
 */
router.get('/payroll-config', requireAdminOnly, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] GET /api/admin/payroll-config - IP: ${req.ip}`);
    
    const config = await payrollDB.getCurrentConfig();
    
    console.log(`[${new Date().toISOString()}] ✅ Current payroll config retrieved successfully`);
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting payroll config:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payroll configuration',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/payroll-config
 * Save new payroll configuration
 */
router.post('/payroll-config', requireAdminOnly, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] POST /api/admin/payroll-config - IP: ${req.ip}`);
    console.log(`[${new Date().toISOString()}] Request body:`, req.body);
    
    const { monthly_salary, overtime_rate, fuel_allowance, working_hours, notes } = req.body;
    
    // Get current configuration to check for changes
    const currentConfig = await payrollDB.getCurrentConfig();
    
    // Check if any values have changed
    const hasChanges = 
      parseFloat(monthly_salary) !== currentConfig.monthly_salary ||
      parseFloat(overtime_rate) !== currentConfig.overtime_rate ||
      parseFloat(fuel_allowance) !== currentConfig.fuel_allowance ||
      parseFloat(working_hours || 8) !== currentConfig.working_hours;
    
    // If there are changes, notes field is mandatory
    if (hasChanges && (!notes || notes.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Configuration changes detected. Notes field is mandatory when modifying payroll configuration.',
        details: 'Please provide a reason for the configuration change in the notes field.'
      });
    }
    
    // Add admin identifier (from JWT token if available)
    const configData = {
      monthly_salary,
      overtime_rate,
      fuel_allowance,
      working_hours,
      changed_by: req.user?.name || req.user?.phone || 'ADMIN',
      notes: notes || ''
    };
    
    // Calculate potential impact before saving
    const impact = await payrollDB.calculateConfigImpact(configData);
    
    // Save the new configuration
    const newConfig = await payrollDB.saveConfig(configData);
    
    console.log(`[${new Date().toISOString()}] ✅ Payroll config saved successfully (ID: ${newConfig.id})`);
    
    res.json({
      success: true,
      message: 'Payroll configuration saved successfully',
      data: newConfig,
      impact: impact
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error saving payroll config:`, error.message);
    
    // Check if it's a validation error
    const statusCode = error.message.includes('Validation errors') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: 'Failed to save payroll configuration',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/payroll-config-history
 * Get payroll configuration history with pagination
 */
router.get('/payroll-config-history', requireAdminOnly, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] GET /api/admin/payroll-config-history - IP: ${req.ip}`);
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Validate pagination parameters
    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit cannot exceed 100 records'
      });
    }
    
    const result = await payrollDB.getConfigHistory(limit, offset);
    
    // FIXED: Apply IST conversion to all timestamps in history
    const historyWithIST = result.history.map(config => ({
      ...config,
      changed_at: convertToIST(config.changed_at)
    }));
    
    console.log(`[${new Date().toISOString()}] ✅ Payroll config history retrieved (${result.history.length} records) with IST conversion`);
    
    res.json({
      success: true,
      data: historyWithIST,
      pagination: result.pagination
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting payroll config history:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payroll configuration history',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/config
 * Get simplified current configuration (for other systems)
 */
router.get('/config', requireAdminOnly, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] GET /api/admin/config - IP: ${req.ip}`);
    
    const config = await payrollDB.getSimplifiedConfig();
    
    console.log(`[${new Date().toISOString()}] ✅ Simplified config retrieved successfully`);
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error getting simplified config:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve configuration',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/payroll-config/impact
 * Calculate impact of potential configuration changes (preview mode)
 */
router.post('/payroll-config/impact', requireAdminOnly, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] POST /api/admin/payroll-config/impact - IP: ${req.ip}`);
    
    const { monthly_salary, overtime_rate, fuel_allowance, working_hours } = req.body;
    
    // Validate required fields for impact calculation
    if (!monthly_salary || !overtime_rate || !fuel_allowance) {
      return res.status(400).json({
        success: false,
        error: 'Monthly salary, overtime rate, and fuel allowance are required for impact calculation'
      });
    }
    
    const configData = {
      monthly_salary: parseFloat(monthly_salary),
      overtime_rate: parseFloat(overtime_rate),
      fuel_allowance: parseFloat(fuel_allowance),
      working_hours: parseFloat(working_hours || 8)
    };
    
    const impact = await payrollDB.calculateConfigImpact(configData);
    
    console.log(`[${new Date().toISOString()}] ✅ Config impact calculated successfully`);
    
    res.json({
      success: true,
      data: impact
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error calculating config impact:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate configuration impact',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/payroll-config/health
 * Health check for payroll configuration system
 */
router.get('/payroll-config/health', requireAdminOnly, async (req, res) => {
  try {
    const health = await payrollDB.healthCheck();
    
    res.json({
      success: true,
      data: health
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

/**
 * DELETE /api/admin/leave-request/:id
 * Force cancel any leave request (admin override)
 */
router.delete('/leave-request/:id', requireAdminOnly, async (req, res) => {
    try {
        const timestamp = Date.now();
        console.log(`[${timestamp}] [Admin Leave API] ==> DELETE /api/admin/leave-request`);
        console.log(`[${timestamp}] [Admin Leave API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);

        const leaveRequestId = parseInt(req.params.id);
        const { reason } = req.body;

        // Validate required fields
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Cancellation reason is required'
            });
        }

        // Import leave database
        const leaveDatabase = require('../database/leave.js');

        // Get the leave request by ID (admin can cancel any request)
        const leaveRequest = await leaveDatabase.getLeaveRequestById(leaveRequestId);
        const driverId = leaveRequest ? leaveRequest.driver_id : null;

        if (!leaveRequest) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Leave request not found'
            });
        }

        if (leaveRequest.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: 'ALREADY_CANCELLED',
                message: 'Leave request is already cancelled'
            });
        }

        // Admin can cancel any leave request regardless of time restrictions
        const cancellationResult = await leaveDatabase.cancelLeaveRequest(
            leaveRequestId,
            `admin_${req.user.id}`,
            reason.trim()
        );

        // Restore leave balance if it was annual leave
        const balanceRestored = await leaveDatabase.restoreLeaveBalance(
            driverId,
            cancellationResult.leaveType
        );

        // Get updated leave balance
        const updatedBalance = await leaveDatabase.calculateAnnualLeaveBalance(driverId);

        console.log(`[${timestamp}] [Admin Leave API] ==> Leave request ${leaveRequestId} force cancelled by admin`);

        return res.status(200).json({
            success: true,
            message: 'Leave request cancelled successfully by admin',
            data: {
                leaveRequestId: cancellationResult.leaveRequestId,
                status: cancellationResult.status,
                cancelledAt: convertToIST(cancellationResult.cancelledAt),
                cancelledBy: cancellationResult.cancelledBy,
                cancellationReason: cancellationResult.cancellationReason,
                driverName: leaveRequest.driver_name,
                adminOverride: true,
                balanceRestored: balanceRestored,
                remainingAnnualLeave: updatedBalance.remaining,
                formatted_time: convertToIST(cancellationResult.cancelledAt)
            }
        });

    } catch (error) {
        console.error(`[${Date.now()}] [Admin Leave API] ==> Error force cancelling leave request:`, error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to cancel leave request',
            details: error.message
        });
    }
});

/**
 * STORY 13: DRIVER MANAGEMENT (ADMIN) ENDPOINTS
 * Comprehensive driver management system for administrators
 */

/**
 * GET /api/admin/drivers
 * Get comprehensive driver list with metrics and pagination
 * Query parameters: search, status, page, limit
 */
router.get('/drivers', requireAdminOnly, async (req, res) => {
  const requestId = Date.now();
  
  try {
    console.log(`[${requestId}] [Admin Drivers API] ==> GET /api/admin/drivers`);
    console.log(`[${requestId}] [Admin Drivers API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
    
    const {
      search = '',
      status = 'all',
      page = 1,
      limit = 10
    } = req.query;
    
    const options = {
      search: search.toString().trim(),
      status: status.toString(),
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 10, 50) // Max 50 per page
    };
    
    console.log(`[${requestId}] [Admin Drivers API] ==> Query options:`, options);
    
    const result = await adminDriversDB.getDriversList(options);
    
    // Convert timestamps to IST for display
    const driversWithIST = result.drivers.map(driver => ({
      ...driver,
      created_at: convertToIST(driver.created_at),
      last_active: convertToIST(driver.last_active),
      metrics: {
        ...driver.metrics,
        lastShiftDate: driver.metrics.lastShiftDate ? convertToIST(driver.metrics.lastShiftDate) : null
      }
    }));
    
    const response = {
      ...result,
      drivers: driversWithIST
    };
    
    console.log(`[${requestId}] [Admin Drivers API] ==> Retrieved ${driversWithIST.length} drivers`);
    console.log(`[${requestId}] [Admin Drivers API] ==> Summary: ${result.summary.totalDrivers} total, ${result.summary.activeDrivers} active`);
    
    res.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error(`[${requestId}] [Admin Drivers API] ==> Error getting drivers list:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve drivers list',
      details: error.message
    });
  }
});

/**
 * PUT /api/admin/driver/:driverId/status
 * Update driver status (activate/deactivate)
 */
router.put('/driver/:driverId/status', requireAdminOnly, async (req, res) => {
  const requestId = Date.now();
  
  try {
    const { driverId } = req.params;
    const { is_active, reason = 'Status updated by admin' } = req.body;
    
    console.log(`[${requestId}] [Admin Drivers API] ==> PUT /api/admin/driver/${driverId}/status`);
    console.log(`[${requestId}] [Admin Drivers API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
    console.log(`[${requestId}] [Admin Drivers API] ==> New status: ${is_active ? 'active' : 'inactive'}`);
    
    // Validate request
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'is_active must be a boolean value'
      });
    }
    
    if (!driverId || isNaN(parseInt(driverId))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid driver ID',
        message: 'Driver ID must be a valid number'
      });
    }
    
    const result = await adminDriversDB.updateDriverStatus(
      parseInt(driverId),
      is_active,
      reason.toString(),
      req.user.id
    );
    
    // Convert timestamp to IST
    const resultWithIST = {
      ...result,
      updated_at: convertToIST(result.updated_at)
    };
    
    console.log(`[${requestId}] [Admin Drivers API] ==> Driver status updated successfully: ${result.name}`);
    
    res.json({
      success: true,
      message: 'Driver status updated successfully',
      data: resultWithIST
    });
    
  } catch (error) {
    console.error(`[${requestId}] [Admin Drivers API] ==> Error updating driver status:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update driver status',
      details: error.message
    });
  }
});

/**
 * GET /api/admin/driver/:driverId/details
 * Get detailed driver information with metrics and history
 */
router.get('/driver/:driverId/details', requireAdminOnly, async (req, res) => {
  const requestId = Date.now();
  
  try {
    const { driverId } = req.params;
    
    console.log(`[${requestId}] [Admin Drivers API] ==> GET /api/admin/driver/${driverId}/details`);
    console.log(`[${requestId}] [Admin Drivers API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
    
    if (!driverId || isNaN(parseInt(driverId))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid driver ID',
        message: 'Driver ID must be a valid number'
      });
    }
    
    const result = await adminDriversDB.getDriverDetails(parseInt(driverId));
    
    // Convert timestamps to IST
    const detailsWithIST = {
      driver: {
        ...result.driver,
        created_at: convertToIST(result.driver.created_at),
        updated_at: convertToIST(result.driver.updated_at)
      },
      metrics: {
        ...result.metrics,
        lastShiftDate: result.metrics.lastShiftDate ? convertToIST(result.metrics.lastShiftDate) : null
      },
      recentShifts: result.recentShifts,
      leaveRequests: result.leaveRequests.map(lr => ({
        ...lr,
        leave_date: lr.leave_date, // Keep as date string
        requested_at: convertToIST(lr.requested_at)
      }))
    };
    
    console.log(`[${requestId}] [Admin Drivers API] ==> Retrieved details for driver: ${result.driver.name}`);
    console.log(`[${requestId}] [Admin Drivers API] ==> Metrics: ${result.metrics.totalShifts} shifts, ${result.metrics.totalHours}h`);
    
    res.json({
      success: true,
      data: detailsWithIST
    });
    
  } catch (error) {
    console.error(`[${requestId}] [Admin Drivers API] ==> Error getting driver details:`, error.message);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve driver details',
      details: error.message
    });
  }
});

// Export both the router and initialization function
module.exports = {
  router,
  initializePayrollSystem
};