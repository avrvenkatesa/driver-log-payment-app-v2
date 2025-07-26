const dbConnection = require('./connection');

/**
 * Admin Leave Management Database Functions
 * Handles admin operations for leave request management
 */

// Get all leave requests with driver information
async function getAllLeaveRequests(status = 'all', page = 1, limit = 10, startDate, endDate) {
  console.log('[Admin Leave DB] Getting leave requests with filters:', { status, page, limit, startDate, endDate });
  
  try {
    // Base query with driver information join
    let query = `
      SELECT 
        lr.id,
        lr.driver_id as driverId,
        lr.leave_date as leaveDate,
        lr.leave_type as leaveType,
        lr.reason,
        lr.status,
        lr.requested_at as requestedAt,
        lr.approved_by as approvedBy,
        lr.approved_at as approvedAt,
        lr.notes,
        d.name as driverName,
        d.phone as driverPhone,
        d.email as driverEmail
      FROM leave_requests lr
      JOIN drivers d ON lr.driver_id = d.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Add status filter
    if (status !== 'all') {
      query += ' AND lr.status = ?';
      params.push(status);
    }
    
    // Add date range filters
    if (startDate) {
      query += ' AND lr.leave_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND lr.leave_date <= ?';
      params.push(endDate);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY lr.requested_at DESC';
    
    if (limit) {
      const offset = (page - 1) * limit;
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
    
    console.log('[Admin Leave DB] Executing query:', query);
    console.log('[Admin Leave DB] Parameters:', params);
    
    const leaveRequests = await dbConnection.query(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as totalCount
      FROM leave_requests lr
      JOIN drivers d ON lr.driver_id = d.id
      WHERE 1=1
    `;
    
    const countParams = [];
    
    if (status !== 'all') {
      countQuery += ' AND lr.status = ?';
      countParams.push(status);
    }
    
    if (startDate) {
      countQuery += ' AND lr.leave_date >= ?';
      countParams.push(startDate);
    }
    
    if (endDate) {
      countQuery += ' AND lr.leave_date <= ?';
      countParams.push(endDate);
    }
    
    const countResult = await dbConnection.query(countQuery, countParams);
    const totalCount = countResult[0]?.totalCount || 0;
    
    console.log('[Admin Leave DB] Found', leaveRequests.length, 'leave requests, total:', totalCount);
    
    return {
      leaveRequests,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limit
    };
    
  } catch (error) {
    console.error('[Admin Leave DB] Error getting leave requests:', error);
    throw error;
  }
}

// Get leave requests summary statistics
async function getLeaveRequestsSummary() {
  console.log('[Admin Leave DB] Getting leave requests summary');
  
  try {
    const query = `
      SELECT 
        COUNT(*) as totalRequests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingRequests,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedRequests,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejectedRequests,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledRequests
      FROM leave_requests
    `;
    
    const result = await dbConnection.query(query);
    const summary = result[0] || {};
    
    console.log('[Admin Leave DB] Summary calculated:', summary);
    
    return {
      totalRequests: summary.totalRequests || 0,
      pendingRequests: summary.pendingRequests || 0,
      approvedRequests: summary.approvedRequests || 0,
      rejectedRequests: summary.rejectedRequests || 0,
      cancelledRequests: summary.cancelledRequests || 0
    };
    
  } catch (error) {
    console.error('[Admin Leave DB] Error getting summary:', error);
    throw error;
  }
}

// Get single leave request by ID with driver information
async function getLeaveRequestById(leaveRequestId) {
  console.log('[Admin Leave DB] Getting leave request by ID:', leaveRequestId);
  
  try {
    const query = `
      SELECT 
        lr.id,
        lr.driver_id as driverId,
        lr.leave_date as leaveDate,
        lr.leave_type as leaveType,
        lr.reason,
        lr.status,
        lr.requested_at as requestedAt,
        lr.approved_by as approvedBy,
        lr.approved_at as approvedAt,
        lr.notes,
        d.name as driverName,
        d.phone as driverPhone,
        d.email as driverEmail
      FROM leave_requests lr
      JOIN drivers d ON lr.driver_id = d.id
      WHERE lr.id = ?
    `;
    
    const result = await dbConnection.query(query, [leaveRequestId]);
    
    if (result.length === 0) {
      throw new Error(`Leave request with ID ${leaveRequestId} not found`);
    }
    
    console.log('[Admin Leave DB] Found leave request:', result[0]);
    return result[0];
    
  } catch (error) {
    console.error('[Admin Leave DB] Error getting leave request by ID:', error);
    throw error;
  }
}

// Update leave request status (approve/reject)
async function updateLeaveRequestStatus(leaveRequestId, status, notes, adminId, adminName) {
  console.log('[Admin Leave DB] Updating leave request status:', {
    leaveRequestId,
    status,
    adminId,
    adminName
  });
  
  try {
    // First get the current leave request
    const currentRequest = await getLeaveRequestById(leaveRequestId);
    
    // Validate status transition
    if (currentRequest.status !== 'pending') {
      throw new Error(`Cannot update leave request: current status is ${currentRequest.status}, only pending requests can be modified`);
    }
    
    // Validate new status
    if (!['approved', 'rejected'].includes(status)) {
      throw new Error(`Invalid status: ${status}. Only 'approved' or 'rejected' allowed`);
    }
    
    // Update the leave request
    const updateQuery = `
      UPDATE leave_requests 
      SET 
        status = ?,
        notes = ?,
        approved_by = ?,
        approved_at = datetime('now')
      WHERE id = ?
    `;
    
    await dbConnection.query(updateQuery, [status, notes, adminName, leaveRequestId]);
    
    console.log('[Admin Leave DB] Leave request updated successfully');
    
    // Get the updated leave request
    const updatedRequest = await getLeaveRequestById(leaveRequestId);
    
    return {
      leaveRequestId: parseInt(leaveRequestId),
      driverName: updatedRequest.driverName,
      leaveDate: updatedRequest.leaveDate,
      previousStatus: currentRequest.status,
      newStatus: status,
      approvedBy: adminName,
      approvedAt: updatedRequest.approvedAt,
      notes: notes
    };
    
  } catch (error) {
    console.error('[Admin Leave DB] Error updating leave request:', error);
    throw error;
  }
}

// Get driver's annual leave usage for balance calculation
async function getDriverAnnualLeaveUsage(driverId, year) {
  console.log('[Admin Leave DB] Getting annual leave usage for driver:', driverId, 'year:', year);
  
  try {
    const query = `
      SELECT COUNT(*) as usedAnnualLeaves
      FROM leave_requests 
      WHERE 
        driver_id = ? 
        AND leave_type = 'annual' 
        AND status = 'approved'
        AND strftime('%Y', leave_date) = ?
    `;
    
    const result = await dbConnection.query(query, [driverId, year.toString()]);
    const usedLeaves = result[0]?.usedAnnualLeaves || 0;
    
    console.log('[Admin Leave DB] Driver', driverId, 'has used', usedLeaves, 'annual leaves in', year);
    
    return usedLeaves;
    
  } catch (error) {
    console.error('[Admin Leave DB] Error getting annual leave usage:', error);
    throw error;
  }
}

// Get recent leave management activity
async function getRecentLeaveActivity(limit = 10) {
  console.log('[Admin Leave DB] Getting recent leave activity, limit:', limit);
  
  try {
    const query = `
      SELECT 
        lr.id,
        lr.driver_id as driverId,
        lr.leave_date as leaveDate,
        lr.leave_type as leaveType,
        lr.status,
        lr.approved_by as approvedBy,
        lr.approved_at as approvedAt,
        lr.notes,
        d.name as driverName
      FROM leave_requests lr
      JOIN drivers d ON lr.driver_id = d.id
      WHERE lr.status IN ('approved', 'rejected')
      ORDER BY lr.approved_at DESC
      LIMIT ?
    `;
    
    const activities = await dbConnection.query(query, [limit]);
    
    console.log('[Admin Leave DB] Found', activities.length, 'recent activities');
    
    return activities;
    
  } catch (error) {
    console.error('[Admin Leave DB] Error getting recent activity:', error);
    throw error;
  }
}

module.exports = {
  getAllLeaveRequests,
  getLeaveRequestsSummary,
  getLeaveRequestById,
  updateLeaveRequestStatus,
  getDriverAnnualLeaveUsage,
  getRecentLeaveActivity
};