const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection
const dbPath = path.join(process.cwd(), 'company.db');

async function createAdvancePaymentTables() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        // Create advance_payments table
        const createAdvancePaymentsTable = `
            CREATE TABLE IF NOT EXISTS advance_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                driver_id INTEGER NOT NULL,
                request_date DATE NOT NULL,
                requested_amount REAL NOT NULL,
                approved_amount REAL DEFAULT 0,
                advance_type TEXT DEFAULT 'regular',
                reason TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                
                -- Approval workflow
                requested_by INTEGER,
                approved_by INTEGER,
                approved_at DATETIME,
                rejected_reason TEXT,
                
                -- Payment tracking
                paid_at DATETIME,
                payment_method TEXT DEFAULT 'bank_transfer',
                payment_reference TEXT,
                
                -- Settlement tracking
                settled_against_payroll_month TEXT,
                settled_at DATETIME,
                settlement_amount REAL DEFAULT 0,
                
                -- Timestamps and audit
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                -- Foreign keys
                FOREIGN KEY (driver_id) REFERENCES drivers (id),
                FOREIGN KEY (approved_by) REFERENCES drivers (id)
            )
        `;
        
        // Create advance_payment_config table
        const createAdvanceConfigTable = `
            CREATE TABLE IF NOT EXISTS advance_payment_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                max_advance_percentage REAL DEFAULT 60.0,
                max_requests_per_month INTEGER DEFAULT 3,
                min_advance_amount REAL DEFAULT 500.0,
                max_advance_amount REAL DEFAULT 20000.0,
                approval_required_above REAL DEFAULT 5000.0,
                
                -- Business rules
                allow_multiple_outstanding BOOLEAN DEFAULT 1,
                require_reason BOOLEAN DEFAULT 1,
                auto_settle_on_payroll BOOLEAN DEFAULT 1,
                
                -- Approval settings
                admin_approval_required BOOLEAN DEFAULT 1,
                emergency_advance_allowed BOOLEAN DEFAULT 1,
                
                -- Audit
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT DEFAULT 'Default advance payment configuration',
                
                FOREIGN KEY (created_by) REFERENCES drivers (id)
            )
        `;
        
        // Create advance_payment_audit table
        const createAdvanceAuditTable = `
            CREATE TABLE IF NOT EXISTS advance_payment_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                advance_payment_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                old_values TEXT,
                new_values TEXT,
                changed_by INTEGER,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                
                FOREIGN KEY (advance_payment_id) REFERENCES advance_payments (id),
                FOREIGN KEY (changed_by) REFERENCES drivers (id)
            )
        `;
        
        // Create indexes
        const createIndexes = [
            `CREATE INDEX IF NOT EXISTS idx_advance_payments_driver_id ON advance_payments(driver_id)`,
            `CREATE INDEX IF NOT EXISTS idx_advance_payments_status ON advance_payments(status)`,
            `CREATE INDEX IF NOT EXISTS idx_advance_payments_request_date ON advance_payments(request_date)`,
            `CREATE INDEX IF NOT EXISTS idx_advance_audit_advance_id ON advance_payment_audit(advance_payment_id)`
        ];
        
        // Insert default configuration
        const insertDefaultConfig = `
            INSERT OR REPLACE INTO advance_payment_config (
                id, max_advance_percentage, max_requests_per_month, min_advance_amount, 
                max_advance_amount, approval_required_above, allow_multiple_outstanding,
                require_reason, auto_settle_on_payroll, admin_approval_required,
                emergency_advance_allowed, created_by, notes
            ) VALUES (
                1, 60.0, 3, 500.0, 20000.0, 5000.0, 1, 1, 1, 1, 1, NULL, 
                'Default advance payment configuration - 60% limit, 3 requests per month'
            )
        `;
        
        // Execute all table creation and setup
        db.serialize(() => {
            db.run(createAdvancePaymentsTable, (err) => {
                if (err) {
                    console.error('[Advance Payments] Error creating advance_payments table:', err);
                } else {
                    console.log('[Advance Payments] ✅ advance_payments table created/verified');
                }
            });
            
            db.run(createAdvanceConfigTable, (err) => {
                if (err) {
                    console.error('[Advance Payments] Error creating advance_payment_config table:', err);
                } else {
                    console.log('[Advance Payments] ✅ advance_payment_config table created/verified');
                }
            });
            
            db.run(createAdvanceAuditTable, (err) => {
                if (err) {
                    console.error('[Advance Payments] Error creating advance_payment_audit table:', err);
                } else {
                    console.log('[Advance Payments] ✅ advance_payment_audit table created/verified');
                }
            });
            
            // Create indexes
            createIndexes.forEach((indexSQL, i) => {
                db.run(indexSQL, (err) => {
                    if (err) {
                        console.error(`[Advance Payments] Error creating index ${i + 1}:`, err);
                    } else {
                        console.log(`[Advance Payments] ✅ Index ${i + 1} created/verified`);
                    }
                });
            });
            
            // Insert default configuration
            db.run(insertDefaultConfig, (err) => {
                if (err) {
                    console.error('[Advance Payments] Error inserting default config:', err);
                } else {
                    console.log('[Advance Payments] ✅ Default configuration inserted/updated');
                }
            });
            
            db.close((err) => {
                if (err) {
                    console.error('[Advance Payments] Database close error:', err);
                    reject(err);
                } else {
                    console.log('[Advance Payments] ✅ Database schema setup completed successfully');
                    resolve();
                }
            });
        });
    });
}

module.exports = {
    createAdvancePaymentTables
};