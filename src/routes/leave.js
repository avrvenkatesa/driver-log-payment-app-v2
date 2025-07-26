const express = require('express');
const router = express.Router();
const leaveDatabase = require('../database/leave.js');
const authMiddleware = require('../auth/auth.js');

/**
 * Leave Management API Routes
 * Story 12: Leave Management Foundation
 */

/**
 * Convert UTC timestamp to IST format
 */
function convertToIST(utcTimestamp) {
    try {
        const date = new Date(utcTimestamp);
        const istFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        return istFormatter.format(date) + ' IST';
    } catch (error) {
        console.error('[IST Convert] Error:', error);
        return utcTimestamp;
    }
}

/**
 * Validate leave request data
 */
function validateLeaveRequest(data) {
    const errors = [];
    
    // Validate leave_date
    if (!data.leave_date) {
        errors.push('Leave date is required');
    } else {
        const leaveDate = new Date(data.leave_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (leaveDate < today) {
            errors.push('Leave date cannot be in the past');
        }
        
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        
        if (leaveDate > oneYearFromNow) {
            errors.push('Cannot request leave more than 1 year in advance');
        }
    }
    
    // Validate leave_type
    const validLeaveTypes = ['annual', 'sick', 'emergency'];
    if (data.leave_type && !validLeaveTypes.includes(data.leave_type)) {
        errors.push('Leave type must be annual, sick, or emergency');
    }
    
    // Validate reason (now mandatory)
    if (!data.reason || data.reason.trim().length === 0) {
        errors.push('Reason is required for leave requests');
    }
    
    return errors;
}

/**
 * POST /api/driver/leave-request
 * Submit a new leave request
 */
router.post('/leave-request', authMiddleware.requireDriverOrAdmin, async (req, res) => {
    try {
        console.log(`[${Date.now()}] [Leave API] ==> POST /api/driver/leave-request`);
        console.log(`[${Date.now()}] [Leave API] ==> Driver: ${req.user.name} (ID: ${req.user.id})`);
        console.log(`[${Date.now()}] [Leave API] ==> Request data:`, req.body);
        
        const { leave_date, leave_type, reason } = req.body;
        const driver_id = req.user.id;
        
        // Validate request data
        const validationErrors = validateLeaveRequest({ leave_date, leave_type, reason });
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: validationErrors.join(', '),
                details: { errors: validationErrors }
            });
        }
        
        // Check for existing leave request on the same date
        const existingRequest = await leaveDatabase.checkExistingLeaveRequest(driver_id, leave_date);
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                error: 'DUPLICATE_DATE',
                message: 'You already have a leave request for this date',
                details: {
                    leave_date,
                    existing_request_id: existingRequest.id,
                    existing_status: existingRequest.status
                }
            });
        }
        
        // Submit leave request
        const leaveRequest = await leaveDatabase.submitLeaveRequest({
            driver_id,
            leave_date,
            leave_type: leave_type || 'annual',
            reason
        });
        
        // Calculate remaining annual leave balance
        const leaveYear = new Date(leave_date).getFullYear();
        const annualBalance = await leaveDatabase.calculateAnnualLeaveBalance(driver_id, leaveYear);
        
        console.log(`[${Date.now()}] [Leave API] ==> Leave request submitted successfully`);
        console.log(`[${Date.now()}] [Leave API] ==> Request ID: ${leaveRequest.id}, Balance: ${annualBalance.remaining} days`);
        
        // Enhanced timestamp formatting for UX
        const requestedAtIST = convertToIST(leaveRequest.requested_at);
        const submissionTime = new Date(leaveRequest.requested_at);
        
        res.status(201).json({
            success: true,
            message: 'Leave request submitted successfully',
            data: {
                leaveRequestId: leaveRequest.id,
                leave_date: leaveRequest.leave_date,
                leave_type: leaveRequest.leave_type,
                reason: leaveRequest.reason,
                status: leaveRequest.status,
                remainingAnnualLeave: annualBalance.remaining,
                requested_at: requestedAtIST,
                requested_timestamp: leaveRequest.requested_at,
                formatted_time: submissionTime.toLocaleTimeString('en-IN', { 
                    timeZone: 'Asia/Kolkata', 
                    hour12: true, 
                    hour: 'numeric', 
                    minute: '2-digit' 
                }),
                submission_precision: 'microsecond'
            }
        });
        
    } catch (error) {
        console.error(`[${Date.now()}] [Leave API] ==> Error submitting leave request:`, error);
        
        if (error.code === 'DUPLICATE_DATE') {
            return res.status(400).json({
                success: false,
                error: error.code,
                message: error.message,
                details: error.details
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Unable to process leave request. Please try again.',
            details: { timestamp: convertToIST(new Date().toISOString()) }
        });
    }
});

/**
 * GET /api/driver/leave-requests/:year?
 * Get leave requests for a driver by year
 */
router.get('/leave-requests/:year?', authMiddleware.requireDriverOrAdmin, async (req, res) => {
    try {
        console.log(`[${Date.now()}] [Leave API] ==> GET /api/driver/leave-requests`);
        console.log(`[${Date.now()}] [Leave API] ==> Driver: ${req.user.name} (ID: ${req.user.id})`);
        
        const driver_id = req.user.id;
        const year = req.params.year ? parseInt(req.params.year) : new Date().getFullYear();
        
        console.log(`[${Date.now()}] [Leave API] ==> Fetching leave requests for year: ${year}`);
        
        // Validate year parameter
        if (isNaN(year) || year < 2020 || year > 2030) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_YEAR',
                message: 'Year must be between 2020 and 2030',
                details: { provided_year: req.params.year }
            });
        }
        
        // Get leave requests and annual balance
        const [leaveRequests, annualBalance] = await Promise.all([
            leaveDatabase.getDriverLeaveRequests(driver_id, year),
            leaveDatabase.calculateAnnualLeaveBalance(driver_id, year)
        ]);
        
        // Format leave requests with enhanced IST timestamps and relative time
        const formattedRequests = leaveRequests.map(request => {
            const requestedAt = new Date(request.requested_at);
            const now = new Date();
            const diffMs = now - requestedAt;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            
            let relativeTime;
            if (diffMs < 60 * 60 * 1000) { // Less than 1 hour
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                relativeTime = diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
            } else if (diffHours < 24) { // Less than 1 day
                relativeTime = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
            } else if (diffDays === 1) {
                relativeTime = 'Yesterday';
            } else if (diffDays < 7) {
                relativeTime = `${diffDays} days ago`;
            } else {
                relativeTime = convertToIST(request.requested_at).split(',')[0]; // Just the date
            }
            
            return {
                id: request.id,
                leave_date: request.leave_date,
                leave_type: request.leave_type,
                reason: request.reason,
                status: request.status,
                requested_at: convertToIST(request.requested_at),
                requested_timestamp: request.requested_at,
                relative_time: relativeTime,
                formatted_time: requestedAt.toLocaleTimeString('en-IN', { 
                    timeZone: 'Asia/Kolkata', 
                    hour12: true, 
                    hour: 'numeric', 
                    minute: '2-digit' 
                }),
                approved_by: request.approved_by,
                approved_at: request.approved_at ? convertToIST(request.approved_at) : null,
                notes: request.notes
            };
        });
        
        console.log(`[${Date.now()}] [Leave API] ==> Found ${leaveRequests.length} leave requests`);
        console.log(`[${Date.now()}] [Leave API] ==> Annual balance: ${annualBalance.remaining}/${annualBalance.total} days`);
        
        res.json({
            success: true,
            data: {
                year: year,
                annualLeaveBalance: annualBalance,
                leaveRequests: formattedRequests,
                summary: {
                    totalRequests: leaveRequests.length,
                    pendingRequests: leaveRequests.filter(r => r.status === 'pending').length,
                    approvedRequests: leaveRequests.filter(r => r.status === 'approved').length,
                    rejectedRequests: leaveRequests.filter(r => r.status === 'rejected').length
                }
            }
        });
        
    } catch (error) {
        console.error(`[${Date.now()}] [Leave API] ==> Error fetching leave requests:`, error);
        
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Unable to fetch leave requests. Please try again.',
            details: { timestamp: convertToIST(new Date().toISOString()) }
        });
    }
});

/**
 * GET /api/driver/leave-balance/:year?
 * Get current leave balance for a driver
 */
router.get('/leave-balance/:year?', authMiddleware.requireDriverOrAdmin, async (req, res) => {
    try {
        console.log(`[${Date.now()}] [Leave API] ==> GET /api/driver/leave-balance`);
        
        const driver_id = req.user.id;
        const year = req.params.year ? parseInt(req.params.year) : new Date().getFullYear();
        
        // Validate year parameter
        if (isNaN(year) || year < 2020 || year > 2030) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_YEAR',
                message: 'Year must be between 2020 and 2030'
            });
        }
        
        const annualBalance = await leaveDatabase.calculateAnnualLeaveBalance(driver_id, year);
        
        console.log(`[${Date.now()}] [Leave API] ==> Leave balance retrieved: ${annualBalance.remaining}/${annualBalance.total} days`);
        
        res.json({
            success: true,
            data: {
                annualLeaveBalance: annualBalance,
                calculatedAt: convertToIST(new Date().toISOString())
            }
        });
        
    } catch (error) {
        console.error(`[${Date.now()}] [Leave API] ==> Error fetching leave balance:`, error);
        
        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Unable to fetch leave balance. Please try again.'
        });
    }
});

/**
 * DELETE /api/driver/leave-request/:id
 * Cancel a leave request (driver with 4-hour restriction)
 */
router.delete('/leave-request/:id', authMiddleware.requireDriverOrAdmin, async (req, res) => {
    try {
        const timestamp = Date.now();
        console.log(`[${timestamp}] [Leave API] ==> DELETE /api/driver/leave-request`);
        console.log(`[${timestamp}] [Leave API] ==> User: ${req.user.name} (ID: ${req.user.id})`);

        const leaveRequestId = parseInt(req.params.id);
        const { reason } = req.body;

        // Validate cancellation reason
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Cancellation reason is required'
            });
        }

        // Get the leave request first to check permissions and time restrictions
        const leaveRequests = await leaveDatabase.getDriverLeaveRequests(req.user.id, new Date().getFullYear());
        const leaveRequest = leaveRequests.find(lr => lr.id === leaveRequestId);

        if (!leaveRequest) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Leave request not found or you do not have permission to cancel it'
            });
        }

        if (leaveRequest.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: 'ALREADY_CANCELLED',
                message: 'Leave request is already cancelled'
            });
        }

        // Check 4-hour rule for drivers (admins can override)
        const canCancelData = leaveDatabase.canDriverCancelLeave(leaveRequest.leave_date);
        
        if (req.user.role === 'driver' && !canCancelData.canCancel) {
            return res.status(400).json({
                success: false,
                error: 'CANCELLATION_TOO_LATE',
                message: 'Cannot cancel leave request less than 4 hours before commencement',
                details: {
                    leaveDate: leaveRequest.leave_date,
                    timeRemaining: canCancelData.timeRemainingText,
                    minimumRequired: canCancelData.minimumRequired
                }
            });
        }

        // Cancel the leave request
        const cancellationResult = await leaveDatabase.cancelLeaveRequest(
            leaveRequestId,
            req.user.role === 'admin' ? `admin_${req.user.id}` : 'driver',
            reason.trim()
        );

        // Restore leave balance if it was annual leave
        const balanceRestored = await leaveDatabase.restoreLeaveBalance(
            req.user.id,
            cancellationResult.leaveType
        );

        // Get updated leave balance
        const updatedBalance = await leaveDatabase.calculateAnnualLeaveBalance(req.user.id);

        console.log(`[${timestamp}] [Leave API] ==> Leave request ${leaveRequestId} cancelled successfully`);

        return res.status(200).json({
            success: true,
            message: 'Leave request cancelled successfully',
            data: {
                leaveRequestId: cancellationResult.leaveRequestId,
                status: cancellationResult.status,
                cancelledAt: convertToIST(cancellationResult.cancelledAt),
                cancelledBy: cancellationResult.cancelledBy,
                cancellationReason: cancellationResult.cancellationReason,
                balanceRestored: balanceRestored,
                remainingAnnualLeave: updatedBalance.remaining,
                formatted_time: convertToIST(cancellationResult.cancelledAt)
            }
        });

    } catch (error) {
        console.error(`[${Date.now()}] [Leave API] ==> Error cancelling leave request:`, error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Failed to cancel leave request',
            details: error.message
        });
    }
});

module.exports = router;