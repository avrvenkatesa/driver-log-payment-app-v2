const express = require('express');
const { AuthService, authMiddleware } = require('../auth/auth');

const router = express.Router();

/**
 * Login endpoint
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Identifier and password are required'
      });
    }
    
    const result = await AuthService.login(identifier, password);
    console.log(`[${new Date().toISOString()}] ✅ Login successful: ${identifier}`);
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Login error:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * Registration endpoint
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    
    // Basic validation
    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Name, phone, and password are required'
      });
    }
    
    // Phone format validation
    if (!phone.match(/^[\+]?[\d\-\s\(\)]{8,}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid phone number format'
      });
    }
    
    const result = await AuthService.register({ name, phone, email, password });
    console.log(`[${new Date().toISOString()}] ✅ Registration successful: ${phone}`);
    
    res.status(201).json(result);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Registration error:`, error.message);
    const status = error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({
      success: false,
      error: 'Registration failed',
      message: error.message
    });
  }
});

/**
 * Get current user info
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const driverId = req.driver.id;
    const { driverHelpers } = require('../database/index');
    const driver = await driverHelpers.getDriverById(driverId);
    
    res.json({
      success: true,
      data: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        isActive: driver.is_active,
        isPhoneVerified: driver.is_phone_verified,
        createdAt: driver.created_at
      }
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Get user info error:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get user info',
      message: error.message
    });
  }
});

/**
 * Create test account
 * POST /api/auth/create-test-account
 */
router.post('/create-test-account', async (req, res) => {
  try {
    const testDriver = await AuthService.createTestAccount();
    
    res.json({
      success: true,
      message: 'Test account created or already exists',
      account: {
        phone: '+1234567890',
        password: 'password123',
        name: testDriver.name,
        id: testDriver.id
      }
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Test account creation error:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create test account',
      message: error.message
    });
  }
});

module.exports = router;