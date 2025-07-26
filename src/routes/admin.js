const express = require('express');
const router = express.Router();
const payrollDB = require('../database/payroll');
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
        const { reason, driverId } = req.body;

        // Validate required fields
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Cancellation reason is required'
            });
        }

        if (!driverId) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',  
                message: 'Driver ID is required for admin cancellation'
            });
        }

        // Import leave database
        const leaveDatabase = require('../database/leave.js');

        // Get the leave request (admin can cancel any request)
        const leaveRequests = await leaveDatabase.getDriverLeaveRequests(driverId, new Date().getFullYear());
        const leaveRequest = leaveRequests.find(lr => lr.id === leaveRequestId);

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
            message: 'Leave request cancelled successfully (admin override)',
            data: {
                leaveRequestId: cancellationResult.leaveRequestId,
                status: cancellationResult.status,
                cancelledAt: convertToIST(cancellationResult.cancelledAt),
                cancelledBy: cancellationResult.cancelledBy,
                cancellationReason: cancellationResult.cancellationReason,
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

// Export both the router and initialization function
module.exports = {
  router,
  initializePayrollSystem
};