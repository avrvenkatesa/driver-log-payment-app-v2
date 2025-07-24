const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * Authentication Service
 * Provides JWT-based authentication functionality
 */
class AuthService {
  
  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  static async hashPassword(password) {
    try {
      const saltRounds = 12; // High security for production
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Password hashing error:`, error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - Match result
   */
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Password verification error:`, error);
      throw new Error('Password verification failed');
    }
  }

  /**
   * Generate JWT token for user (driver or admin)
   * @param {Object} user - User object
   * @returns {string} - JWT token
   */
  static generateToken(user) {
    try {
      const payload = {
        userId: user.id,
        driverId: user.id, // Backward compatibility
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role || 'driver', // RBAC: Include user role
        isActive: user.is_active,
        aud: 'driver-log-app',
        iss: 'driver-log-pro'
      };

      console.log(`[${new Date().toISOString()}] 🔐 Generating JWT token for ${user.role || 'driver'}: ${user.name}`);

      return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256'
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Token generation error:`, error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} - Decoded token payload
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Token verification error:`, error.message);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Find driver by identifier (phone, email, or name)
   * @param {string} identifier - Phone, email, or name
   * @returns {Promise<Object|null>} - Driver object or null
   */
  static async findDriverByIdentifier(identifier) {
    try {
      const { driverHelpers } = require('../database/index.js');
      
      console.log(`[${new Date().toISOString()}] 🔍 Searching for driver with identifier: ${identifier}`);
      
      // Try phone first (more specific)
      if (identifier.match(/^\+?\d+[\d\-\s]*$/)) {
        console.log(`[${new Date().toISOString()}] 📞 Trying phone search for: ${identifier}`);
        const driver = await driverHelpers.getDriverByPhone(identifier);
        if (driver) {
          console.log(`[${new Date().toISOString()}] ✅ Found driver by phone: ${driver.name} (ID: ${driver.id})`);
          return driver;
        }
      }
      
      // Try email
      if (identifier.includes('@')) {
        console.log(`[${new Date().toISOString()}] 📧 Trying email search for: ${identifier}`);
        const driver = await driverHelpers.getDriverByEmail(identifier);
        if (driver) {
          console.log(`[${new Date().toISOString()}] ✅ Found driver by email: ${driver.name} (ID: ${driver.id})`);
          return driver;
        }
      }
      
      // Try name (exact match first, then case-insensitive)
      console.log(`[${new Date().toISOString()}] 👤 Trying name search for: ${identifier}`);
      const driver = await driverHelpers.getDriverByName(identifier);
      if (driver) {
        console.log(`[${new Date().toISOString()}] ✅ Found driver by name: ${driver.name} (ID: ${driver.id})`);
        return driver;
      }
      
      console.log(`[${new Date().toISOString()}] ❌ No driver found with identifier: ${identifier}`);
      return null;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Error finding driver:`, error.message);
      return null;
    }
  }

  /**
   * Auto-register new driver
   * @param {string} identifier - Phone, email, or name
   * @param {string} password - Plain text password
   * @returns {Promise<Object>} - New driver object
   */
  static async autoRegisterDriver(identifier, password) {
    try {
      console.log(`[${new Date().toISOString()}] 🔐 Starting auto-registration for: ${identifier}`);
      
      if (!password || password.length < 3) {
        throw new Error('Password must be at least 3 characters long');
      }

      const hashedPassword = await this.hashPassword(password);
      console.log(`[${new Date().toISOString()}] ✅ Password hashed successfully (length: ${hashedPassword.length})`);
      
      // Determine if identifier is phone, email, or name
      let driverData = {
        is_active: 1,
        is_phone_verified: 0,
        password_hash: hashedPassword  // CRITICAL: Ensure password is stored
      };

      if (identifier.includes('@')) {
        // Email identifier
        driverData.email = identifier;
        driverData.name = identifier.split('@')[0]; // Use email prefix as name
        driverData.phone = `+auto-${Date.now()}`; // Generate unique phone
        console.log(`[${new Date().toISOString()}] 📧 Auto-registering email user: ${identifier}`);
      } else if (identifier.match(/^\+?\d+[\d\-\s]*$/)) {
        // Phone identifier
        driverData.phone = identifier;
        driverData.name = `Driver ${identifier.slice(-4)}`; // Use last 4 digits
        console.log(`[${new Date().toISOString()}] 📞 Auto-registering phone user: ${identifier}`);
      } else {
        // Name identifier
        driverData.name = identifier;
        driverData.phone = `+auto-${Date.now()}`; // Generate unique phone
        console.log(`[${new Date().toISOString()}] 👤 Auto-registering name user: ${identifier}`);
      }

      console.log(`[${new Date().toISOString()}] 💾 Creating driver with data:`, {
        name: driverData.name,
        phone: driverData.phone,
        email: driverData.email || 'null',
        has_password: !!driverData.password_hash,
        password_length: driverData.password_hash ? driverData.password_hash.length : 0
      });

      const { driverHelpers } = require('../database/index.js');
      const newDriver = await driverHelpers.createDriver(driverData);
      
      // CRITICAL: Verify password was stored
      if (!newDriver.password_hash) {
        console.error(`[${new Date().toISOString()}] 🚨 CRITICAL: Password not stored for new driver ID: ${newDriver.id}`);
        throw new Error('Password storage failed during auto-registration');
      }
      
      console.log(`[${new Date().toISOString()}] ✅ Auto-registered driver successfully:`, {
        id: newDriver.id,
        name: newDriver.name,
        identifier: identifier,
        has_password: !!newDriver.password_hash
      });
      
      return newDriver;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Auto-registration error for ${identifier}:`, error);
      throw new Error(`Failed to auto-register driver: ${error.message}`);
    }
  }

  /**
   * Login a driver with identifier and password
   * @param {string} identifier - Phone, email, or name
   * @param {string} password - Plain text password
   * @returns {Promise<Object>} - Login result with token and driver info
   */
  static async login(identifier, password) {
    try {
      console.log(`[${new Date().toISOString()}] 🔐 Login attempt for: ${identifier}`);
      
      // CRITICAL FIX: Find existing driver first
      let driver = await this.findDriverByIdentifier(identifier);

      if (driver) {
        console.log(`[${new Date().toISOString()}] ✅ Existing driver found: ${driver.name} (ID: ${driver.id})`);
        
        // Check if driver is active
        if (!driver.is_active) {
          throw new Error('Driver account is deactivated');
        }

        // CRITICAL: Verify password for existing user
        if (!driver.password_hash) {
          console.error(`[${new Date().toISOString()}] 🚨 CRITICAL: Existing driver has no password hash! ID: ${driver.id}`);
          throw new Error('Driver account has no password set - contact administrator');
        }
        
        const isValidPassword = await this.verifyPassword(password, driver.password_hash);
        if (!isValidPassword) {
          console.log(`[${new Date().toISOString()}] ❌ Invalid password for existing driver: ${identifier}`);
          throw new Error('Invalid password');
        }

        console.log(`[${new Date().toISOString()}] ✅ Existing driver authenticated successfully: ${identifier}`);
        
        // Generate token
        const token = this.generateToken(driver);
        
        return {
          success: true,
          message: 'Login successful',
          token,
          driver: {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            email: driver.email,
            role: driver.role || 'driver', // RBAC: Include role in response
            is_active: driver.is_active,
            is_phone_verified: driver.is_phone_verified
          },
          isNewUser: false
        };
      }

      // CRITICAL FIX: Only auto-register if driver doesn't exist
      console.log(`[${new Date().toISOString()}] ℹ️ No existing driver found - auto-registering: ${identifier}`);
      driver = await this.autoRegisterDriver(identifier, password);
      
      // CRITICAL: Verify the new driver has password stored
      if (!driver.password_hash) {
        console.error(`[${new Date().toISOString()}] 🚨 CRITICAL: Auto-registered driver missing password! ID: ${driver.id}`);
        throw new Error('Auto-registration failed - password not stored');
      }
      
      // Generate token for new driver
      const token = this.generateToken(driver);
      
      return {
        success: true,
        message: 'Driver auto-registered and logged in successfully',
        token,
        driver: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          role: driver.role || 'driver', // RBAC: Include role in response
          is_active: driver.is_active,
          is_phone_verified: driver.is_phone_verified
        },
        isNewUser: true
      };
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Login error for ${identifier}:`, error.message);
      throw error;
    }
  }

  /**
   * Register a new driver
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} - Registration result
   */
  static async register(userData) {
    try {
      const { name, phone, email, password } = userData;
      console.log(`[${new Date().toISOString()}] 📝 Registration attempt for: ${phone || email || name}`);

      if (!name || !phone || !password) {
        throw new Error('Name, phone, and password are required');
      }

      if (password.length < 3) {
        throw new Error('Password must be at least 3 characters long');
      }

      // CRITICAL: Check if driver already exists (prevent duplicates)
      const existingDriver = await this.findDriverByIdentifier(phone);
      if (existingDriver) {
        console.log(`[${new Date().toISOString()}] ❌ Driver already exists with phone: ${phone} (ID: ${existingDriver.id})`);
        throw new Error('Driver with this phone number already exists');
      }

      // Check email if provided
      if (email) {
        const existingEmailDriver = await this.findDriverByIdentifier(email);
        if (existingEmailDriver) {
          console.log(`[${new Date().toISOString()}] ❌ Driver already exists with email: ${email} (ID: ${existingEmailDriver.id})`);
          throw new Error('Driver with this email already exists');
        }
      }

      // CRITICAL: Hash password properly
      const hashedPassword = await this.hashPassword(password);
      console.log(`[${new Date().toISOString()}] ✅ Password hashed for registration (length: ${hashedPassword.length})`);

      // CRITICAL: Create driver with all required fields
      const driverData = {
        name,
        phone,
        email,
        password_hash: hashedPassword,  // CRITICAL: Ensure password is included
        is_active: 1,
        is_phone_verified: 0
      };

      console.log(`[${new Date().toISOString()}] 💾 Creating driver with registration data:`, {
        name: driverData.name,
        phone: driverData.phone,
        email: driverData.email || 'null',
        has_password: !!driverData.password_hash,
        password_length: driverData.password_hash ? driverData.password_hash.length : 0
      });

      const { driverHelpers } = require('../database/index.js');
      const newDriver = await driverHelpers.createDriver(driverData);

      // CRITICAL: Verify password was stored
      if (!newDriver.password_hash) {
        console.error(`[${new Date().toISOString()}] 🚨 CRITICAL: Registration failed - password not stored for driver ID: ${newDriver.id}`);
        throw new Error('Registration failed - password not stored properly');
      }

      console.log(`[${new Date().toISOString()}] ✅ Driver registered successfully:`, {
        id: newDriver.id,
        name: newDriver.name,
        phone: newDriver.phone,
        has_password: !!newDriver.password_hash
      });

      return {
        success: true,
        message: 'Driver registered successfully',
        driverId: newDriver.id
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Registration error:`, error.message);
      throw error;
    }
  }

  /**
   * Create test account as specified
   */
  static async createTestAccount() {
    try {
      const testPhone = '+1234567890';
      const testPassword = 'password123';

      // Check if test account already exists
      const existingDriver = await this.findDriverByIdentifier(testPhone);
      if (existingDriver) {
        console.log(`[${new Date().toISOString()}] ℹ️ Test account already exists: ${testPhone}`);
        return existingDriver;
      }

      // Create test account
      const hashedPassword = await this.hashPassword(testPassword);
      const { driverHelpers } = require('../database/index.js');
      const testDriver = await driverHelpers.createDriver({
        name: 'Test Driver',
        phone: testPhone,
        email: 'test@driverlog.com',
        password_hash: hashedPassword,
        is_active: 1,
        is_phone_verified: 1
      });

      console.log(`[${new Date().toISOString()}] ✅ Test account created: ${testPhone}`);
      return testDriver;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Test account creation error:`, error);
      throw error;
    }
  }
}

/**
 * RBAC: Role-Based Access Control Middleware Functions
 */

/**
 * Basic authentication middleware for protected routes
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No valid authorization token provided'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = AuthService.verifyToken(token);
    
    // Add user info to request object (includes role for RBAC)
    req.user = {
      id: decoded.userId || decoded.driverId, // Support both formats
      driverId: decoded.driverId, // Backward compatibility
      name: decoded.name,
      phone: decoded.phone,
      email: decoded.email,
      role: decoded.role || 'driver', // RBAC: Default to driver role
      isActive: decoded.isActive
    };
    
    // Backward compatibility - keep req.driver
    req.driver = req.user;
    
    console.log(`[${new Date().toISOString()}] 🔐 Authenticated ${req.user.role}: ${req.user.name} (ID: ${req.user.id})`);
    
    next();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Authentication middleware error:`, error.message);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * RBAC: Admin-only access middleware
 * Blocks drivers from accessing admin endpoints
 */
const requireAdminOnly = async (req, res, next) => {
  try {
    // First run standard authentication
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Check if user has admin role
    if (req.user.role !== 'admin') {
      console.log(`[${new Date().toISOString()}] 🚫 Access denied: ${req.user.role} "${req.user.name}" attempted admin access`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required. Only administrators can access this resource.'
      });
    }
    
    console.log(`[${new Date().toISOString()}] ✅ Admin access granted: ${req.user.name}`);
    next();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Admin middleware error:`, error.message);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
};

/**
 * RBAC: Driver or Admin access middleware
 * Allows both drivers and admins (admin can monitor driver functions)
 */
const requireDriverOrAdmin = async (req, res, next) => {
  try {
    // First run standard authentication
    await new Promise((resolve, reject) => {
      authMiddleware(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Both drivers and admins can access
    if (req.user.role === 'driver' || req.user.role === 'admin') {
      console.log(`[${new Date().toISOString()}] ✅ Driver/Admin access granted: ${req.user.role} "${req.user.name}"`);
      next();
    } else {
      console.log(`[${new Date().toISOString()}] 🚫 Access denied: Unknown role "${req.user.role}" for user "${req.user.name}"`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Driver or admin access required'
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Driver/Admin middleware error:`, error.message);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
};

module.exports = {
  AuthService,
  authMiddleware,
  requireAdminOnly,
  requireDriverOrAdmin
};