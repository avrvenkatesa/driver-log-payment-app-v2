const express = require('express');
const router = express.Router();
const { requireAdminOnly } = require('../auth/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const AdvanceEligibilityService = require('../services/AdvanceEligibilityService');

// Database connection
const dbPath = path.join(process.cwd(), 'company.db');

// Utility function for IST conversion
function convertToIST(utcTimestamp) {
    if (!utcTimestamp) return null;
    const date = new Date(utcTimestamp);
    return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }) + ' IST';
}

// Admin Endpoints

// GET /api/admin/advance-config - Get advance payment configuration
router.get('/advance-config', requireAdminOnly, async (req, res) => {
    try {
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> GET /api/admin/advance-config`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
        
        const db = new sqlite3.Database(dbPath);
        
        // Get current configuration
        const config = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM advance_payment_config ORDER BY created_at DESC LIMIT 1`,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        db.close();
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: 'CONFIGURATION_NOT_FOUND',
                message: 'Advance payment configuration not found'
            });
        }
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Configuration retrieved successfully`);
        
        res.json({
            success: true,
            message: 'Advance payment configuration retrieved successfully',
            data: {
                maxAdvancePercent: config.max_advance_percent,
                maxMonthlyRequests: config.max_monthly_requests,
                minAdvanceAmount: config.min_advance_amount,
                maxAdvanceAmount: config.max_advance_amount,
                eligibilityMonths: config.eligibility_months,
                createdAt: convertToIST(config.created_at),
                updatedAt: convertToIST(config.updated_at)
            }
        });
        
    } catch (error) {
        console.error('[Admin Advance] Error retrieving configuration:', error);
        res.status(500).json({
            success: false,
            error: 'CONFIGURATION_RETRIEVAL_FAILED',
            message: 'Failed to retrieve advance payment configuration',
            details: error.message
        });
    }
});

// PUT /api/admin/advance-config - Update advance payment configuration
router.put('/advance-config', requireAdminOnly, async (req, res) => {
    try {
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> PUT /api/admin/advance-config`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
        
        const { 
            maxAdvancePercent, 
            maxMonthlyRequests, 
            minAdvanceAmount, 
            maxAdvanceAmount, 
            eligibilityMonths,
            notes 
        } = req.body;
        
        // Validation
        if (!maxAdvancePercent || maxAdvancePercent < 10 || maxAdvancePercent > 100) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_ADVANCE_PERCENT',
                message: 'Max advance percent must be between 10% and 100%'
            });
        }
        
        if (!maxMonthlyRequests || maxMonthlyRequests < 1 || maxMonthlyRequests > 12) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_MONTHLY_REQUESTS',
                message: 'Max monthly requests must be between 1 and 12'
            });
        }
        
        if (!minAdvanceAmount || minAdvanceAmount < 100 || minAdvanceAmount > 10000) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_MIN_AMOUNT',
                message: 'Min advance amount must be between ₹100 and ₹10,000'
            });
        }
        
        if (!maxAdvanceAmount || maxAdvanceAmount < minAdvanceAmount || maxAdvanceAmount > 100000) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_MAX_AMOUNT',
                message: 'Max advance amount must be between min amount and ₹1,00,000'
            });
        }
        
        if (!eligibilityMonths || eligibilityMonths < 1 || eligibilityMonths > 24) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_ELIGIBILITY_MONTHS',
                message: 'Eligibility months must be between 1 and 24'
            });
        }
        
        const db = new sqlite3.Database(dbPath);
        const timestamp = new Date().toISOString();
        
        // Update configuration
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE advance_payment_config 
                SET max_advance_percent = ?, max_monthly_requests = ?, 
                    min_advance_amount = ?, max_advance_amount = ?, 
                    eligibility_months = ?, updated_at = ?`,
                [maxAdvancePercent, maxMonthlyRequests, minAdvanceAmount, maxAdvanceAmount, eligibilityMonths, timestamp],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
        
        // Create audit log
        const auditId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO advance_payment_audit 
                (advance_id, admin_id, action, old_data, new_data, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    null,
                    req.user.id,
                    'config_updated',
                    JSON.stringify({ type: 'configuration_update' }),
                    JSON.stringify({
                        maxAdvancePercent,
                        maxMonthlyRequests,
                        minAdvanceAmount,
                        maxAdvanceAmount,
                        eligibilityMonths
                    }),
                    notes || `Configuration updated by ${req.user.name}`,
                    timestamp
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        db.close();
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Configuration updated successfully`);
        
        res.json({
            success: true,
            message: 'Advance payment configuration updated successfully',
            data: {
                maxAdvancePercent,
                maxMonthlyRequests,
                minAdvanceAmount,
                maxAdvanceAmount,
                eligibilityMonths,
                updatedBy: req.user.name,
                updatedAt: convertToIST(timestamp),
                auditId
            }
        });
        
    } catch (error) {
        console.error('[Admin Advance] Error updating configuration:', error);
        res.status(500).json({
            success: false,
            error: 'CONFIGURATION_UPDATE_FAILED',
            message: 'Failed to update advance payment configuration',
            details: error.message
        });
    }
});

// GET /api/admin/advance-requests - Get all advance requests with filtering
router.get('/advance-requests', requireAdminOnly, async (req, res) => {
    try {
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> GET /api/admin/advance-requests`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
        
        const { status, limit = 10, page = 1, driverId } = req.query;
        const offset = (page - 1) * limit;
        
        const db = new sqlite3.Database(dbPath);
        
        // Build query with optional filters
        let whereClause = '1=1';
        let queryParams = [];
        
        if (status) {
            whereClause += ' AND ap.status = ?';
            queryParams.push(status);
        }
        
        if (driverId) {
            whereClause += ' AND ap.driver_id = ?';
            queryParams.push(driverId);
        }
        
        // Get advance requests with driver information
        const requests = await new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    ap.*,
                    d.name as driver_name,
                    d.phone as driver_phone,
                    approver.name as approved_by_name
                FROM advance_payments ap
                LEFT JOIN drivers d ON ap.driver_id = d.id
                LEFT JOIN drivers approver ON ap.approved_by = approver.id
                WHERE ${whereClause}
                ORDER BY ap.request_date DESC, ap.created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            db.all(query, [...queryParams, limit, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Get total count for pagination
        const totalCount = await new Promise((resolve, reject) => {
            const countQuery = `
                SELECT COUNT(*) as total
                FROM advance_payments ap
                WHERE ${whereClause}
            `;
            
            db.get(countQuery, queryParams, (err, row) => {
                if (err) reject(err);
                else resolve(row?.total || 0);
            });
        });
        
        // Get summary statistics
        const summary = await new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0];
            
            db.all(`
                SELECT 
                    status,
                    COUNT(*) as count,
                    SUM(CASE WHEN status = 'pending' THEN requested_amount ELSE 0 END) as pending_amount,
                    SUM(CASE WHEN status = 'approved' AND DATE(approved_at) = ? THEN approved_amount ELSE 0 END) as approved_today,
                    SUM(CASE WHEN status = 'rejected' AND DATE(updated_at) = ? THEN 1 ELSE 0 END) as rejected_today
                FROM advance_payments
                GROUP BY status
            `, [today, today], (err, rows) => {
                if (err) reject(err);
                else {
                    const stats = rows.reduce((acc, row) => {
                        acc[row.status] = row.count;
                        return acc;
                    }, {});
                    
                    const pendingAmount = rows.find(r => r.status === 'pending')?.pending_amount || 0;
                    const approvedToday = rows.reduce((sum, r) => sum + (r.approved_today || 0), 0);
                    const rejectedToday = rows.reduce((sum, r) => sum + (r.rejected_today || 0), 0);
                    
                    resolve({
                        pendingRequests: stats.pending || 0,
                        pendingAmount,
                        approvedToday,
                        rejectedToday
                    });
                }
            });
        });
        
        // Format requests for response
        const formattedRequests = await Promise.all(requests.map(async (request) => {
            // Get eligibility check for each request
            const eligibilityService = new AdvanceEligibilityService();
            const eligibility = await eligibilityService.calculateEligibility(request.driver_id, request.requested_amount);
            
            return {
                id: request.id,
                driverId: request.driver_id,
                driverName: request.driver_name,
                driverPhone: request.driver_phone,
                requestedAmount: request.requested_amount,
                approvedAmount: request.approved_amount || 0,
                advanceType: request.advance_type,
                reason: request.reason,
                requestDate: request.request_date,
                status: request.status,
                paymentMethod: request.payment_method,
                paymentReference: request.payment_reference,
                approvedBy: request.approved_by_name,
                approvedAt: request.approved_at ? convertToIST(request.approved_at) : null,
                rejectedReason: request.rejected_reason,
                eligibilityCheck: {
                    eligible: eligibility.eligible,
                    availableLimit: eligibility.availableAmount,
                    outstandingAmount: eligibility.currentOutstanding,
                    restrictions: eligibility.restrictions
                }
            };
        }));
        
        db.close();
        
        const totalPages = Math.ceil(totalCount / limit);
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Retrieved ${requests.length} advance requests (page ${page}/${totalPages})`);
        
        res.json({
            success: true,
            data: {
                requests: formattedRequests,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalRequests: totalCount,
                    limit: parseInt(limit)
                },
                summary
            }
        });
        
    } catch (error) {
        console.error('[Admin Advance] Error retrieving advance requests:', error);
        res.status(500).json({
            success: false,
            error: 'REQUESTS_RETRIEVAL_FAILED',
            message: 'Failed to retrieve advance requests',
            details: error.message
        });
    }
});

// PUT /api/admin/advance-request/:advanceId/approve - Approve advance request
router.put('/advance-request/:advanceId/approve', requireAdminOnly, async (req, res) => {
    try {
        const { advanceId } = req.params;
        const { approvedAmount, paymentMethod, paymentReference, notes } = req.body;
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> PUT /api/admin/advance-request/${advanceId}/approve`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Approved Amount: ₹${approvedAmount}`);
        
        if (!approvedAmount || approvedAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_APPROVED_AMOUNT',
                message: 'Approved amount must be greater than 0'
            });
        }
        
        const db = new sqlite3.Database(dbPath);
        
        // Get current advance request
        const currentRequest = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM advance_payments WHERE id = ?`,
                [advanceId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!currentRequest) {
            db.close();
            return res.status(404).json({
                success: false,
                error: 'ADVANCE_REQUEST_NOT_FOUND',
                message: 'Advance request not found'
            });
        }
        
        if (currentRequest.status !== 'pending') {
            db.close();
            return res.status(400).json({
                success: false,
                error: 'INVALID_STATUS',
                message: `Cannot approve advance request with status: ${currentRequest.status}`
            });
        }
        
        // Check if approved amount is within eligibility
        const eligibilityService = new AdvanceEligibilityService();
        const eligibility = await eligibilityService.calculateEligibility(currentRequest.driver_id, approvedAmount);
        
        // Admin can override monthly limits, but not exceed available balance
        const hasAvailableBalance = approvedAmount <= eligibility.availableAmount;
        const onlyMonthlyLimitExceeded = eligibility.restrictions.length === 1 && 
            eligibility.restrictions[0].includes('Monthly request limit exceeded');
        
        if (!eligibility.eligible && !(hasAvailableBalance && onlyMonthlyLimitExceeded)) {
            db.close();
            return res.status(400).json({
                success: false,
                error: 'APPROVAL_EXCEEDS_ELIGIBILITY',
                message: 'Approved amount exceeds driver eligibility',
                details: {
                    restrictions: eligibility.restrictions,
                    availableAmount: eligibility.availableAmount,
                    note: 'Admin can override monthly limits but cannot exceed available balance'
                }
            });
        }
        
        // Log admin override if applicable
        if (!eligibility.eligible && hasAvailableBalance && onlyMonthlyLimitExceeded) {
            console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> ADMIN OVERRIDE: Monthly limit exceeded but approved (Available: ₹${eligibility.availableAmount}, Approved: ₹${approvedAmount})`);
        }
        
        // Update advance request
        const approvedAt = new Date().toISOString();
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE advance_payments 
                SET approved_amount = ?, status = 'approved', approved_by = ?, approved_at = ?, 
                    payment_method = ?, payment_reference = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [approvedAmount, req.user.id, approvedAt, paymentMethod, paymentReference, advanceId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Create audit log entry
        const auditId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO advance_payment_audit 
                 (advance_payment_id, action, old_values, new_values, changed_by, notes) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    advanceId,
                    'approved',
                    JSON.stringify({
                        status: currentRequest.status,
                        approved_amount: currentRequest.approved_amount
                    }),
                    JSON.stringify({
                        status: 'approved',
                        approved_amount: approvedAmount,
                        approved_by: req.user.id,
                        approved_at: approvedAt,
                        payment_method: paymentMethod,
                        payment_reference: paymentReference
                    }),
                    req.user.id,
                    notes || `Advance request approved by ${req.user.name}`
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        db.close();
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Advance request ${advanceId} approved successfully`);
        
        res.json({
            success: true,
            message: 'Advance request approved successfully',
            data: {
                advanceId: parseInt(advanceId),
                approvedAmount,
                status: 'approved',
                approvedBy: req.user.name,
                approvedAt: convertToIST(approvedAt),
                auditId
            }
        });
        
    } catch (error) {
        console.error('[Admin Advance] Error approving advance request:', error);
        res.status(500).json({
            success: false,
            error: 'APPROVAL_FAILED',
            message: 'Failed to approve advance request',
            details: error.message
        });
    }
});

// PUT /api/admin/advance-request/:advanceId/reject - Reject advance request
router.put('/advance-request/:advanceId/reject', requireAdminOnly, async (req, res) => {
    try {
        const { advanceId } = req.params;
        const { rejectionReason, notes } = req.body;
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> PUT /api/admin/advance-request/${advanceId}/reject`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Admin: ${req.user.name} (ID: ${req.user.id})`);
        
        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                error: 'REJECTION_REASON_REQUIRED',
                message: 'Rejection reason is required'
            });
        }
        
        const db = new sqlite3.Database(dbPath);
        
        // Get current advance request
        const currentRequest = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM advance_payments WHERE id = ?`,
                [advanceId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!currentRequest) {
            db.close();
            return res.status(404).json({
                success: false,
                error: 'ADVANCE_REQUEST_NOT_FOUND',
                message: 'Advance request not found'
            });
        }
        
        if (currentRequest.status !== 'pending') {
            db.close();
            return res.status(400).json({
                success: false,
                error: 'INVALID_STATUS',
                message: `Cannot reject advance request with status: ${currentRequest.status}`
            });
        }
        
        // Update advance request
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE advance_payments 
                SET status = 'rejected', rejected_reason = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
                [rejectionReason, advanceId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // Create audit log entry
        const auditId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO advance_payment_audit 
                 (advance_payment_id, action, old_values, new_values, changed_by, notes) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    advanceId,
                    'rejected',
                    JSON.stringify({
                        status: currentRequest.status
                    }),
                    JSON.stringify({
                        status: 'rejected',
                        rejected_reason: rejectionReason
                    }),
                    req.user.id,
                    notes || `Advance request rejected by ${req.user.name}: ${rejectionReason}`
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        db.close();
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Admin Advance] ==> Advance request ${advanceId} rejected`);
        
        res.json({
            success: true,
            message: 'Advance request rejected',
            data: {
                advanceId: parseInt(advanceId),
                status: 'rejected',
                rejectedBy: req.user.name,
                rejectionReason,
                auditId
            }
        });
        
    } catch (error) {
        console.error('[Admin Advance] Error rejecting advance request:', error);
        res.status(500).json({
            success: false,
            error: 'REJECTION_FAILED',
            message: 'Failed to reject advance request',
            details: error.message
        });
    }
});

module.exports = router;