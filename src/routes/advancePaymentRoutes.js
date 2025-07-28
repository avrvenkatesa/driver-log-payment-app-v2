const express = require('express');
const router = express.Router();
const { requireDriverOrAdmin, requireAdminOnly } = require('../auth/auth');
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

// Driver Endpoints

// POST /api/driver/advance-request - Request advance payment
router.post('/advance-request', requireDriverOrAdmin, async (req, res) => {
    try {
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> POST /api/driver/advance-request`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Driver: ${req.user.name} (ID: ${req.user.id})`);
        
        const { requestedAmount, advanceType = 'regular', reason, paymentMethod = 'bank_transfer' } = req.body;
        
        // Validate required fields
        if (!requestedAmount || !reason) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_REQUIRED_FIELDS',
                message: 'Requested amount and reason are required'
            });
        }
        
        if (requestedAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_AMOUNT',
                message: 'Requested amount must be greater than 0'
            });
        }
        
        // Check eligibility
        const eligibilityService = new AdvanceEligibilityService();
        const eligibility = await eligibilityService.calculateEligibility(req.user.id, requestedAmount);
        
        if (!eligibility.eligible) {
            return res.status(400).json({
                success: false,
                error: 'ELIGIBILITY_CHECK_FAILED',
                message: 'Advance request not eligible',
                details: {
                    restrictions: eligibility.restrictions,
                    availableAmount: eligibility.availableAmount,
                    maxAdvanceLimit: eligibility.maxAdvanceAmount
                }
            });
        }
        
        // Create advance request
        const db = new sqlite3.Database(dbPath);
        
        const advanceRequest = await new Promise((resolve, reject) => {
            const requestDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            db.run(
                `INSERT INTO advance_payments 
                 (driver_id, request_date, requested_amount, advance_type, reason, payment_method, requested_by, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.user.id, requestDate, requestedAmount, advanceType, reason, paymentMethod, req.user.id, 'pending'],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Get the created record
                        db.get(
                            `SELECT * FROM advance_payments WHERE id = ?`,
                            [this.lastID],
                            (err, row) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ ...row, id: this.lastID });
                                }
                            }
                        );
                    }
                }
            );
        });
        
        // Create audit log entry
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO advance_payment_audit 
                 (advance_payment_id, action, new_values, changed_by, notes) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    advanceRequest.id,
                    'requested',
                    JSON.stringify({
                        requestedAmount,
                        advanceType,
                        reason,
                        paymentMethod,
                        status: 'pending'
                    }),
                    req.user.id,
                    `Advance payment request submitted by ${req.user.name}`
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        db.close();
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Request created successfully: ID ${advanceRequest.id}, Amount: ₹${requestedAmount}`);
        
        res.json({
            success: true,
            message: 'Advance request submitted successfully',
            data: {
                advanceId: advanceRequest.id,
                requestedAmount,
                status: 'pending',
                eligibilityCheck: {
                    approved: true,
                    availableLimit: eligibility.availableAmount,
                    monthlyEarningsEstimate: eligibility.monthlyEarningsEstimate
                },
                expectedProcessingTime: '24-48 hours'
            }
        });
        
    } catch (error) {
        console.error('[Advance Payment] Error creating advance request:', error);
        res.status(500).json({
            success: false,
            error: 'REQUEST_CREATION_FAILED',
            message: 'Failed to create advance request',
            details: error.message
        });
    }
});

// GET /api/driver/advance-eligibility - Check advance eligibility
router.get('/advance-eligibility', requireDriverOrAdmin, async (req, res) => {
    try {
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> GET /api/driver/advance-eligibility`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Driver: ${req.user.name} (ID: ${req.user.id})`);
        
        const eligibilityService = new AdvanceEligibilityService();
        const eligibility = await eligibilityService.calculateEligibility(req.user.id);
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Eligibility calculated: Available ₹${(eligibility.availableAmount || 0).toLocaleString('en-IN')}`);
        
        res.json({
            success: true,
            data: eligibility
        });
        
    } catch (error) {
        console.error('[Advance Payment] Error checking eligibility:', error);
        res.status(500).json({
            success: false,
            error: 'ELIGIBILITY_CHECK_FAILED',
            message: 'Failed to check advance eligibility',
            details: error.message
        });
    }
});

// GET /api/driver/advance-history/:year? - Get advance payment history
router.get('/advance-history/:year?', requireDriverOrAdmin, async (req, res) => {
    try {
        const year = req.params.year || new Date().getFullYear();
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> GET /api/driver/advance-history/${year}`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Driver: ${req.user.name} (ID: ${req.user.id})`);
        
        const db = new sqlite3.Database(dbPath);
        
        // Get advance history for the year
        const advances = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM advance_payments 
                WHERE driver_id = ? 
                AND strftime('%Y', request_date) = ? 
                ORDER BY request_date DESC`,
                [req.user.id, year.toString()],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
        
        // Get current outstanding balance
        const eligibilityService = new AdvanceEligibilityService();
        const eligibility = await eligibilityService.calculateEligibility(req.user.id);
        
        // Calculate summary
        const summary = {
            totalRequests: advances.length,
            approvedRequests: advances.filter(a => ['approved', 'paid', 'settled'].includes(a.status)).length,
            rejectedRequests: advances.filter(a => a.status === 'rejected').length,
            pendingRequests: advances.filter(a => a.status === 'pending').length,
            totalAdvanceAmount: advances.filter(a => ['approved', 'paid', 'settled'].includes(a.status))
                .reduce((sum, a) => sum + (a.approved_amount || 0), 0),
            settledAmount: advances.filter(a => a.status === 'settled')
                .reduce((sum, a) => sum + (a.settlement_amount || 0), 0)
        };
        
        // Format advances for response
        const formattedAdvances = advances.map(advance => ({
            id: advance.id,
            requestDate: advance.request_date,
            requestedAmount: advance.requested_amount,
            approvedAmount: advance.approved_amount || 0,
            status: advance.status,
            advanceType: advance.advance_type,
            reason: advance.reason,
            approvedAt: advance.approved_at ? convertToIST(advance.approved_at) : null,
            paidAt: advance.paid_at ? convertToIST(advance.paid_at) : null,
            settledAgainstMonth: advance.settled_against_payroll_month,
            rejectedReason: advance.rejected_reason || null,
            paymentMethod: advance.payment_method,
            paymentReference: advance.payment_reference
        }));
        
        db.close();
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Retrieved ${advances.length} advance records for year ${year}`);
        
        res.json({
            success: true,
            data: {
                year: parseInt(year),
                currentBalance: {
                    outstandingAdvances: eligibility.currentOutstanding,
                    availableAdvanceLimit: eligibility.availableAmount,
                    maxAdvanceLimit: eligibility.maxAdvanceAmount,
                    monthlyEarningsEstimate: eligibility.monthlyEarningsEstimate
                },
                advances: formattedAdvances,
                summary
            }
        });
        
    } catch (error) {
        console.error('[Advance Payment] Error retrieving advance history:', error);
        res.status(500).json({
            success: false,
            error: 'HISTORY_RETRIEVAL_FAILED',
            message: 'Failed to retrieve advance payment history',
            details: error.message
        });
    }
});

// GET /api/driver/advance-requests - Get driver's advance requests
router.get('/advance-requests', requireDriverOrAdmin, async (req, res) => {
    try {
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> GET /api/driver/advance-requests`);
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Driver: ${req.user.name} (ID: ${req.user.id})`);
        
        const { status, limit = 10, page = 1 } = req.query;
        const offset = (page - 1) * limit;
        
        const db = new sqlite3.Database(dbPath);
        
        // Build WHERE clause
        let whereClause = 'WHERE driver_id = ?';
        let queryParams = [req.user.id];
        
        if (status) {
            whereClause += ' AND status = ?';
            queryParams.push(status);
        }
        
        // Get requests with pagination
        const requests = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM advance_payments 
                 ${whereClause}
                 ORDER BY request_date DESC, id DESC
                 LIMIT ? OFFSET ?`,
                [...queryParams, limit, offset],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
        
        // Get total count
        const totalCount = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM advance_payments ${whereClause}`,
                queryParams,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.count || 0);
                }
            );
        });
        
        db.close();
        
        // Format response data
        const formattedRequests = requests.map(request => ({
            ...request,
            request_date: convertToIST(request.request_date),
            approved_date: convertToIST(request.approved_date),
            paid_date: convertToIST(request.paid_date),
            settled_date: convertToIST(request.settled_date),
            created_at: convertToIST(request.created_at),
            updated_at: convertToIST(request.updated_at)
        }));
        
        console.log(`[1753604${Date.now().toString().slice(-6)}] [Advance Payment] ==> Retrieved ${requests.length} advance requests for driver ${req.user.id}`);
        
        res.json({
            success: true,
            data: {
                requests: formattedRequests,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalRequests: totalCount,
                    limit: parseInt(limit)
                },
                summary: {
                    totalRequests: totalCount,
                    pendingRequests: formattedRequests.filter(r => r.status === 'pending').length,
                    approvedRequests: formattedRequests.filter(r => r.status === 'approved').length,
                    paidRequests: formattedRequests.filter(r => r.status === 'paid').length
                }
            }
        });
        
    } catch (error) {
        console.error('[Advance Payment] Error fetching advance requests:', error);
        res.status(500).json({
            success: false,
            error: 'FETCH_REQUESTS_FAILED',
            message: 'Failed to fetch advance requests',
            details: error.message
        });
    }
});

module.exports = router;