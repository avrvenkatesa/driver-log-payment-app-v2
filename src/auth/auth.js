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
   * Generate JWT token for driver
   * @param {Object} driver - Driver object
   * @returns {string} - JWT token
   */
  static generateToken(driver) {
    try {
      const payload = {
        driverId: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        isActive: driver.is_active,
        aud: 'driver-log-app',
        iss: 'driver-log-pro'
      };

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
      
      // Try phone first
      if (identifier.match(/^\+?\d+[\d\-\s]*$/)) {
        const driver = await driverHelpers.getDriverByPhone(identifier);
        if (driver) return driver;
      }
      
      // Try email
      if (identifier.includes('@')) {
        const driver = await driverHelpers.getDriverByEmail(identifier);
        if (driver) return driver;
      }
      
      // Try name
      const driver = await driverHelpers.getDriverByName(identifier);
      return driver;
      
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
      const hashedPassword = await this.hashPassword(password);
      
      // Determine if identifier is phone, email, or name
      let driverData = {
        is_active: 1,
        is_phone_verified: 0,
        password_hash: hashedPassword
      };

      if (identifier.includes('@')) {
        // Email identifier
        driverData.email = identifier;
        driverData.name = identifier.split('@')[0]; // Use email prefix as name
        driverData.phone = `+auto-${Date.now()}`; // Generate unique phone
      } else if (identifier.match(/^\+?\d+[\d\-\s]*$/)) {
        // Phone identifier
        driverData.phone = identifier;
        driverData.name = `Driver ${identifier.slice(-4)}`; // Use last 4 digits
      } else {
        // Name identifier
        driverData.name = identifier;
        driverData.phone = `+auto-${Date.now()}`; // Generate unique phone
      }

      const { driverHelpers } = require('../database/index.js');
      const newDriver = await driverHelpers.createDriver(driverData);
      console.log(`[${new Date().toISOString()}] ✅ Auto-registered new driver: ${identifier}`);
      
      return newDriver;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Auto-registration error:`, error);
      throw new Error('Failed to auto-register driver');
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
      // Find existing driver
      let driver = await this.findDriverByIdentifier(identifier);

      // Auto-register if driver doesn't exist
      if (!driver) {
        console.log(`[${new Date().toISOString()}] ℹ️ Auto-registering new driver: ${identifier}`);
        driver = await this.autoRegisterDriver(identifier, password);
        
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
            is_active: driver.is_active,
            is_phone_verified: driver.is_phone_verified
          },
          isNewUser: true
        };
      }

      // Check if driver is active
      if (!driver.is_active) {
        throw new Error('Driver account is deactivated');
      }

      // Verify password
      if (!driver.password_hash) {
        throw new Error('Driver account has no password set');
      }
      
      const isValidPassword = await this.verifyPassword(password, driver.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid password');
      }

      console.log(`[${new Date().toISOString()}] ✅ Driver logged in successfully: ${identifier}`);
      
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
          is_active: driver.is_active,
          is_phone_verified: driver.is_phone_verified
        },
        isNewUser: false
      };
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Login error for ${identifier}:`, error);
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

      if (!name || !phone || !password) {
        throw new Error('Name, phone, and password are required');
      }

      // Check if driver already exists
      const existingDriver = await this.findDriverByIdentifier(phone);
      if (existingDriver) {
        throw new Error('Driver with this phone number already exists');
      }

      // Check email if provided
      if (email) {
        const existingEmailDriver = await this.findDriverByIdentifier(email);
        if (existingEmailDriver) {
          throw new Error('Driver with this email already exists');
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create driver
      const driverData = {
        name,
        phone,
        email,
        password_hash: hashedPassword,
        is_active: 1,
        is_phone_verified: 0
      };

      const { driverHelpers } = require('../database/index.js');
      const newDriver = await driverHelpers.createDriver(driverData);

      console.log(`[${new Date().toISOString()}] ✅ New driver registered: ${phone}`);

      return {
        success: true,
        message: 'Driver registered successfully',
        driverId: newDriver.id
      };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Registration error:`, error);
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
 * Authentication middleware for protected routes
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
    
    // Add driver info to request object
    req.driver = {
      id: decoded.driverId,
      name: decoded.name,
      phone: decoded.phone,
      email: decoded.email,
      isActive: decoded.isActive
    };
    
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

module.exports = {
  AuthService,
  authMiddleware
};