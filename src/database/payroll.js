const dbConnection = require('./connection');

/**
 * Payroll Configuration Database Operations
 * Story 9: Handles payroll configuration management and history
 */
class PayrollConfigDatabase {
  
  /**
   * Initialize payroll configuration table and default values
   */
  async initializePayrollConfig() {
    try {
      // Create payroll_config_history table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS payroll_config_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monthly_salary REAL NOT NULL CHECK(monthly_salary > 0),
          overtime_rate REAL NOT NULL CHECK(overtime_rate > 0),
          fuel_allowance REAL NOT NULL CHECK(fuel_allowance > 0),
          working_hours REAL DEFAULT 8 CHECK(working_hours > 0 AND working_hours <= 24),
          changed_by TEXT,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `;
      
      await dbConnection.run(createTableSQL);
      console.log(`[${new Date().toISOString()}] ✅ Payroll config table created successfully`);
      
      // Check if default configuration exists
      const existingConfig = await dbConnection.get(
        'SELECT COUNT(*) as count FROM payroll_config_history'
      );
      
      if (existingConfig.count === 0) {
        // Insert default configuration
        const defaultConfigSQL = `
          INSERT INTO payroll_config_history 
          (monthly_salary, overtime_rate, fuel_allowance, working_hours, changed_by, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const defaultValues = [
          27000,  // Monthly Salary: ₹27,000 per month
          100,    // Overtime Rate: ₹100 per hour
          33.30,  // Fuel Allowance: ₹33.30 per working day
          8,      // Working Hours: 8 hours per day
          'SYSTEM',
          'Initial configuration setup - Indian market standard rates'
        ];
        
        const result = await dbConnection.run(defaultConfigSQL, defaultValues);
        console.log(`[${new Date().toISOString()}] ✅ Default payroll configuration inserted (ID: ${result.lastID})`);
      } else {
        console.log(`[${new Date().toISOString()}] ✅ Payroll configuration already exists (${existingConfig.count} records)`);
      }
      
      return { success: true, message: 'Payroll configuration initialized successfully' };
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error initializing payroll config:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get current (latest) payroll configuration
   */
  async getCurrentConfig() {
    try {
      const sql = `
        SELECT 
          id,
          monthly_salary,
          overtime_rate,
          fuel_allowance,
          working_hours,
          changed_by,
          changed_at,
          notes
        FROM payroll_config_history 
        ORDER BY changed_at DESC, id DESC 
        LIMIT 1
      `;
      
      const config = await dbConnection.get(sql);
      
      if (!config) {
        // If no config exists, initialize with defaults
        await this.initializePayrollConfig();
        return await this.getCurrentConfig();
      }
      
      console.log(`[${new Date().toISOString()}] ✅ Current payroll config retrieved (ID: ${config.id})`);
      return config;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting current config:`, error.message);
      throw error;
    }
  }
  
  /**
   * Save new payroll configuration
   */
  async saveConfig(configData) {
    try {
      const { monthly_salary, overtime_rate, fuel_allowance, working_hours, changed_by, notes } = configData;
      
      // Validate input data
      this.validateConfigData(configData);
      
      const sql = `
        INSERT INTO payroll_config_history 
        (monthly_salary, overtime_rate, fuel_allowance, working_hours, changed_by, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        parseFloat(monthly_salary),
        parseFloat(overtime_rate),
        parseFloat(fuel_allowance),
        parseFloat(working_hours || 8),
        changed_by || 'ADMIN',
        notes || ''
      ];
      
      const result = await dbConnection.run(sql, params);
      
      console.log(`[${new Date().toISOString()}] ✅ New payroll config saved (ID: ${result.lastID})`);
      
      // Return the newly created configuration
      return await this.getConfigById(result.lastID);
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error saving payroll config:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get payroll configuration by ID
   */
  async getConfigById(id) {
    try {
      const sql = `
        SELECT 
          id,
          monthly_salary,
          overtime_rate,
          fuel_allowance,
          working_hours,
          changed_by,
          changed_at,
          notes
        FROM payroll_config_history 
        WHERE id = ?
      `;
      
      const config = await dbConnection.get(sql, [id]);
      return config;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting config by ID:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get payroll configuration history with pagination
   */
  async getConfigHistory(limit = 50, offset = 0) {
    try {
      const sql = `
        SELECT 
          id,
          monthly_salary,
          overtime_rate,
          fuel_allowance,
          working_hours,
          changed_by,
          changed_at,
          notes
        FROM payroll_config_history 
        ORDER BY changed_at DESC, id DESC
        LIMIT ? OFFSET ?
      `;
      
      const history = await dbConnection.query(sql, [limit, offset]);
      
      // Get total count for pagination
      const countResult = await dbConnection.get('SELECT COUNT(*) as total FROM payroll_config_history');
      const total = countResult.total;
      
      console.log(`[${new Date().toISOString()}] ✅ Payroll config history retrieved (${history.length} records, ${total} total)`);
      
      return {
        history,
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + limit) < total
        }
      };
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting config history:`, error.message);
      throw error;
    }
  }
  
  /**
   * Get simplified current configuration (for other modules)
   */
  async getSimplifiedConfig() {
    try {
      const config = await this.getCurrentConfig();
      
      if (!config) {
        throw new Error('No payroll configuration found');
      }
      
      return {
        monthly_salary: config.monthly_salary,
        overtime_rate: config.overtime_rate,
        fuel_allowance: config.fuel_allowance,
        working_hours: config.working_hours,
        effective_date: config.changed_at
      };
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error getting simplified config:`, error.message);
      throw error;
    }
  }
  
  /**
   * Validate payroll configuration data
   */
  validateConfigData(data) {
    const errors = [];
    
    // Monthly salary validation
    if (!data.monthly_salary || data.monthly_salary < 1000 || data.monthly_salary > 500000) {
      errors.push('Monthly salary must be between ₹1,000 and ₹5,00,000');
    }
    
    // Overtime rate validation
    if (!data.overtime_rate || data.overtime_rate < 10 || data.overtime_rate > 1000) {
      errors.push('Overtime rate must be between ₹10 and ₹1,000 per hour');
    }
    
    // Fuel allowance validation
    if (!data.fuel_allowance || data.fuel_allowance < 1 || data.fuel_allowance > 500) {
      errors.push('Fuel allowance must be between ₹1 and ₹500 per day');
    }
    
    // Working hours validation
    if (data.working_hours && (data.working_hours < 1 || data.working_hours > 24)) {
      errors.push('Working hours must be between 1 and 24 hours per day');
    }
    
    // Notes length validation
    if (data.notes && data.notes.length > 500) {
      errors.push('Notes cannot exceed 500 characters');
    }
    
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }
  }
  
  /**
   * Calculate potential payroll impact of configuration changes
   */
  async calculateConfigImpact(newConfig) {
    try {
      const currentConfig = await this.getCurrentConfig();
      
      if (!currentConfig) {
        return { impact: 'No previous configuration to compare' };
      }
      
      const salaryChange = newConfig.monthly_salary - currentConfig.monthly_salary;
      const salaryChangePercent = (salaryChange / currentConfig.monthly_salary) * 100;
      
      const overtimeChange = newConfig.overtime_rate - currentConfig.overtime_rate;
      const overtimeChangePercent = (overtimeChange / currentConfig.overtime_rate) * 100;
      
      const fuelChange = newConfig.fuel_allowance - currentConfig.fuel_allowance;
      const fuelChangePercent = (fuelChange / currentConfig.fuel_allowance) * 100;
      
      return {
        salary: {
          change: salaryChange,
          changePercent: salaryChangePercent.toFixed(2),
          significant: Math.abs(salaryChangePercent) > 20
        },
        overtime: {
          change: overtimeChange,
          changePercent: overtimeChangePercent.toFixed(2),
          significant: Math.abs(overtimeChangePercent) > 20
        },
        fuel: {
          change: fuelChange,
          changePercent: fuelChangePercent.toFixed(2),
          significant: Math.abs(fuelChangePercent) > 20
        },
        overallSignificant: Math.abs(salaryChangePercent) > 20 || Math.abs(overtimeChangePercent) > 20
      };
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error calculating config impact:`, error.message);
      throw error;
    }
  }
  
  /**
   * Health check for payroll configuration system
   */
  async healthCheck() {
    try {
      const config = await this.getCurrentConfig();
      const historyCount = await dbConnection.get('SELECT COUNT(*) as count FROM payroll_config_history');
      
      return {
        status: 'healthy',
        currentConfig: !!config,
        configCount: historyCount.count,
        lastUpdated: config ? config.changed_at : null
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

// Create singleton instance
const payrollDB = new PayrollConfigDatabase();

module.exports = payrollDB;