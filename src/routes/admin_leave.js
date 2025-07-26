const express = require('express');
const { 
  getAllLeaveRequests, 
  getLeaveRequestsSummary,
  getLeaveRequestById,
  updateLeaveRequestStatus,
  getDriverAnnualLeaveUsage,
  getRecentLeaveActivity
} = require('../database/admin_leave');
const { requireAdminOnly } = require('../auth/auth');

const router = express.Router();

/**
 * Admin Leave Management API Routes
 * Handles admin operations for leave request management
 */

// GET /api/admin/leave-requests - Get all leave requests with filtering
router.get('/leave-requests', requireAdminOnly, async (req, res) => {
  const reqId = Date.now();
  console.log(`[${reqId}] [Admin Leave API] ==> GET /api/admin/leave-requests`);
  
  try {
    const { status = 'all', page = 1, limit = 10, startDate, endDate } = req.query;
    const adminUser = req.user;
    
    console.log(`[${reqId}] [Admin Leave API] ==> Filters:`, { status, page, limit, startDate, endDate });
    console.log(`[${reqId}] [Admin Leave API] ==> Admin:`, adminUser.name, `(ID: ${adminUser.id})`);
    
    // Get leave requests with filtering
    const leaveData = await getAllLeaveRequests(status, parseInt(page), parseInt(limit), startDate, endDate);
    
    // Get summary statistics
    const summary = await getLeaveRequestsSummary();
    
    const response = {
      success: true,
      data: {
        leaveRequests: leaveData.leaveRequests,
        summary,
        pagination: {
          currentPage: leaveData.currentPage,
          totalPages: leaveData.totalPages,
          totalRequests: leaveData.totalCount,
          limit: leaveData.limit
        }
      },
      message: `Leave requests retrieved successfully for ${status} filter`
    };
    
    console.log(`[${reqId}] [Admin Leave API] ==> Retrieved ${leaveData.leaveRequests.length} requests`);
    console.log(`[${reqId}] [Admin Leave API] ==> Summary:`, summary);
    
    res.json(response);
    
  } catch (error) {
    console.error(`[${reqId}] [Admin Leave API] ==> Error:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leave requests',
      error: error.message
    });
  }
});

// PUT /api/admin/leave-request/:id - Approve or reject leave request
router.put('/leave-request/:id', requireAdminOnly, async (req, res) => {
  const reqId = Date.now();
  const leaveRequestId = req.params.id;
  
  console.log(`[${reqId}] [Admin Leave API] ==> PUT /api/admin/leave-request/${leaveRequestId}`);
  
  try {
    const { status, notes } = req.body;
    const adminUser = req.user;
    
    console.log(`[${reqId}] [Admin Leave API] ==> Action:`, status);
    console.log(`[${reqId}] [Admin Leave API] ==> Notes:`, notes ? 'provided' : 'none');
    console.log(`[${reqId}] [Admin Leave API] ==> Admin:`, adminUser.name, `(ID: ${adminUser.id})`);
    
    // Validate input
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"'
      });
    }
    
    if (!leaveRequestId || isNaN(leaveRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid leave request ID is required'
      });
    }
    
    // Update leave request status
    const updateResult = await updateLeaveRequestStatus(
      leaveRequestId,
      status,
      notes || null,
      adminUser.id,
      adminUser.name
    );
    
    const response = {
      success: true,
      message: `Leave request ${status} successfully`,
      data: updateResult
    };
    
    console.log(`[${reqId}] [Admin Leave API] ==> Leave request ${status} successfully`);
    console.log(`[${reqId}] [Admin Leave API] ==> Updated data:`, updateResult);
    
    res.json(response);
    
  } catch (error) {
    console.error(`[${reqId}] [Admin Leave API] ==> Error:`, error.message);
    
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('Cannot update') || error.message.includes('Invalid status')) {
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message
    });
  }
});

// GET /api/admin/leave-request/:id - Get single leave request details
router.get('/leave-request/:id', requireAdminOnly, async (req, res) => {
  const reqId = Date.now();
  const leaveRequestId = req.params.id;
  
  console.log(`[${reqId}] [Admin Leave API] ==> GET /api/admin/leave-request/${leaveRequestId}`);
  
  try {
    const adminUser = req.user;
    console.log(`[${reqId}] [Admin Leave API] ==> Admin:`, adminUser.name, `(ID: ${adminUser.id})`);
    
    if (!leaveRequestId || isNaN(leaveRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid leave request ID is required'
      });
    }
    
    const leaveRequest = await getLeaveRequestById(leaveRequestId);
    
    const response = {
      success: true,
      data: leaveRequest,
      message: 'Leave request details retrieved successfully'
    };
    
    console.log(`[${reqId}] [Admin Leave API] ==> Leave request found:`, leaveRequest.driverName);
    
    res.json(response);
    
  } catch (error) {
    console.error(`[${reqId}] [Admin Leave API] ==> Error:`, error.message);
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    
    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.message
    });
  }
});

// GET /api/admin/leave-activity - Get recent leave management activity
router.get('/leave-activity', requireAdminOnly, async (req, res) => {
  const reqId = Date.now();
  console.log(`[${reqId}] [Admin Leave API] ==> GET /api/admin/leave-activity`);
  
  try {
    const { limit = 10 } = req.query;
    const adminUser = req.user;
    
    console.log(`[${reqId}] [Admin Leave API] ==> Limit:`, limit);
    console.log(`[${reqId}] [Admin Leave API] ==> Admin:`, adminUser.name, `(ID: ${adminUser.id})`);
    
    const activities = await getRecentLeaveActivity(parseInt(limit));
    
    const response = {
      success: true,
      data: {
        activities,
        count: activities.length
      },
      message: 'Recent leave activity retrieved successfully'
    };
    
    console.log(`[${reqId}] [Admin Leave API] ==> Retrieved ${activities.length} recent activities`);
    
    res.json(response);
    
  } catch (error) {
    console.error(`[${reqId}] [Admin Leave API] ==> Error:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leave activity',
      error: error.message
    });
  }
});

// GET /api/admin/driver/:id/leave-balance/:year - Get driver's leave balance for admin view
router.get('/driver/:id/leave-balance/:year', requireAdminOnly, async (req, res) => {
  const reqId = Date.now();
  const { id: driverId, year } = req.params;
  
  console.log(`[${reqId}] [Admin Leave API] ==> GET /api/admin/driver/${driverId}/leave-balance/${year}`);
  
  try {
    const adminUser = req.user;
    console.log(`[${reqId}] [Admin Leave API] ==> Admin:`, adminUser.name, `(ID: ${adminUser.id})`);
    
    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid driver ID is required'
      });
    }
    
    if (!year || isNaN(year)) {
      return res.status(400).json({
        success: false,
        message: 'Valid year is required'
      });
    }
    
    const usedAnnualLeaves = await getDriverAnnualLeaveUsage(parseInt(driverId), parseInt(year));
    const totalAnnualLeaves = 12; // Company policy: 12 annual leaves per year
    
    const leaveBalance = {
      driverId: parseInt(driverId),
      year: parseInt(year),
      totalAnnualLeaves,
      usedAnnualLeaves,
      remainingAnnualLeaves: totalAnnualLeaves - usedAnnualLeaves
    };
    
    const response = {
      success: true,
      data: leaveBalance,
      message: `Leave balance retrieved for driver ${driverId} in ${year}`
    };
    
    console.log(`[${reqId}] [Admin Leave API] ==> Leave balance:`, leaveBalance);
    
    res.json(response);
    
  } catch (error) {
    console.error(`[${reqId}] [Admin Leave API] ==> Error:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leave balance',
      error: error.message
    });
  }
});

// Update leave request status (approve/reject)
router.patch('/leave-requests/:id/approve', requireAdminOnly, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> PATCH /api/admin/leave-requests/${req.params.id}/approve`);
    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> Body:`, req.body);

    const leaveRequestId = parseInt(req.params.id);
    const { notes } = req.body;

    if (isNaN(leaveRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave request ID'
      });
    }

    const result = await adminLeaveDb.updateLeaveRequestStatus(
      leaveRequestId,
      'approved',
      notes || '',
      req.user.id,
      req.user.name
    );

    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> Leave request ${leaveRequestId} approved by ${req.user.name}`);

    res.json({
      success: true,
      data: result,
      message: `Leave request approved successfully for ${result.driverName}`
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [Admin Leave API] ==> Error approving leave request:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve leave request',
      error: error.message
    });
  }
});

router.patch('/leave-requests/:id/reject', requireAdminOnly, async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> PATCH /api/admin/leave-requests/${req.params.id}/reject`);
    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> Body:`, req.body);

    const leaveRequestId = parseInt(req.params.id);
    const { notes } = req.body;

    if (isNaN(leaveRequestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave request ID'
      });
    }

    if (!notes || notes.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const result = await adminLeaveDb.updateLeaveRequestStatus(
      leaveRequestId,
      'rejected',
      notes,
      req.user.id,
      req.user.name
    );

    console.log(`[${new Date().toISOString()}] [Admin Leave API] ==> Leave request ${leaveRequestId} rejected by ${req.user.name}`);

    res.json({
      success: true,
      data: result,
      message: `Leave request rejected for ${result.driverName}`
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [Admin Leave API] ==> Error rejecting leave request:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject leave request',
      error: error.message
    });
  }
});

module.exports = router;