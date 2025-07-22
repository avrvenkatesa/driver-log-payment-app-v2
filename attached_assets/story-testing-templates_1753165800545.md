# User Story Testing Templates - Driver Log Payment App

## 📋 How to Use These Templates

1. **Copy the relevant story template** when you start implementing a story
2. **Follow the test steps** systematically
3. **Mark each acceptance criterion** as ✅ PASS or ❌ FAIL
4. **Document any issues** in the Notes section
5. **Only proceed to merge** when ALL criteria show ✅ PASS

---

## 🏗️ **Story 1: Project Setup & Basic Server**

### **User Story:**
As a developer, I want to set up the basic project structure with Express.js server, so that I have a solid foundation for the application.

### **Acceptance Criteria Testing:**

#### **✅ AC-1: Express.js server running on port 5000**
**Test Steps:**
```bash
npm run dev
```
**Expected Result:** Server starts and shows "running on port 5000" in console  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-2: Basic folder structure created**
**Test Steps:**
```bash
ls -la src/
ls -la public/
ls -la database/
```
**Expected Result:** Folders exist: src/routes, src/models, src/middleware, public/css, public/js, database/  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-3: Package.json with core dependencies**
**Test Steps:**
```bash
cat package.json | grep -A 10 "dependencies"
```
**Expected Result:** Contains express, cors, dotenv, sqlite3, bcryptjs, jsonwebtoken, body-parser  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-4: Environment variable support**
**Test Steps:**
```bash
# Check if dotenv is loaded and no .env errors in console
npm run dev
```
**Expected Result:** No environment variable errors, dotenv loads properly  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-5: CORS configuration for cross-origin requests**
**Test Steps:**
```bash
curl -H "Origin: http://localhost:3000" -v http://localhost:5000/api/health
```
**Expected Result:** Response includes CORS headers (Access-Control-Allow-Origin)  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-6: Basic health check endpoint (/api/health)**
**Test Steps:**
```bash
curl http://localhost:5000/api/health
```
**Expected Result:** Returns JSON with message, timestamp, version, status  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-7: Error handling middleware**
**Test Steps:**
```bash
curl http://localhost:5000/nonexistent
```
**Expected Result:** Returns 404 error with proper error message  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-8: Console logging for debugging**
**Test Steps:**
```bash
# Start server and make requests, observe console output
npm run dev
curl http://localhost:5000/api/health
```
**Expected Result:** Console shows request logs with status codes and timestamps  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

### **Story 1 Overall Status:** [ ] ✅ ALL PASS - READY TO MERGE [ ] ❌ ISSUES FOUND  
**Tested By:** ________________ **Date:** ________________

---

## 🗄️ **Story 2: Database Setup & Connection**

### **User Story:**
As a developer, I want to set up SQLite database with core tables, so that the application can store and retrieve data.

### **Acceptance Criteria Testing:**

#### **✅ AC-1: SQLite3 database file created (driver_logs.db)**
**Test Steps:**
```bash
ls -la database/
file database/driver_logs.db
```
**Expected Result:** driver_logs.db file exists and is SQLite database  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-2: Database initialization script**
**Test Steps:**
```bash
npm run db:init
```
**Expected Result:** Script runs without errors, creates database tables  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-3: Drivers table created with all required fields**
**Test Steps:**
```bash
sqlite3 database/driver_logs.db ".schema drivers"
```
**Expected Result:** Table contains: id, name, email, phone, password_hash, verification_code, verification_expires_at, is_phone_verified, is_active, created_at  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-4: Database connection helper functions**
**Test Steps:**
```bash
# Test database connection in application
node -e "const {initializeDatabase} = require('./database'); initializeDatabase().then(() => console.log('OK'))"
```
**Expected Result:** Connection successful, no errors  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-5: Basic CRUD operations for drivers table**
**Test Steps:**
```bash
# Test creating, reading, updating driver record
node -e "const {dbHelpers} = require('./database'); dbHelpers.createDriver({name:'Test', phone:'123', email:'test@test.com', password_hash:'test'}).then(console.log)"
```
**Expected Result:** Can create, read, update driver records without errors  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-6: Database error handling**
**Test Steps:**
```bash
# Test with invalid operations or connection issues
```
**Expected Result:** Proper error handling, no crashes  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-7: Test data insertion capability**
**Test Steps:**
```bash
npm run db:seed
```
**Expected Result:** Test data inserted successfully, can query results  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

### **Story 2 Overall Status:** [ ] ✅ ALL PASS - READY TO MERGE [ ] ❌ ISSUES FOUND  
**Tested By:** ________________ **Date:** ________________

---

## 🔐 **Story 3: Authentication System**

### **User Story:**
As a developer, I want to implement JWT-based authentication, so that users can securely log in and access protected routes.

### **Acceptance Criteria Testing:**

#### **✅ AC-1: JWT token generation and verification**
**Test Steps:**
```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"test","password":"password"}'
```
**Expected Result:** Returns JWT token on successful login  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-2: Password hashing with bcrypt**
**Test Steps:**
```bash
# Register new user and verify password is hashed in database
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"name":"Test User","phone":"123456","password":"testpass"}'
sqlite3 database/driver_logs.db "SELECT password_hash FROM drivers WHERE phone='123456'"
```
**Expected Result:** Password stored as bcrypt hash, not plain text  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-3: Login endpoint (/api/auth/login)**
**Test Steps:**
```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"test","password":"password"}'
```
**Expected Result:** Returns success with token and driver info  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-4: Registration endpoint (/api/auth/register)**
**Test Steps:**
```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"name":"New User","phone":"987654","password":"newpass"}'
```
**Expected Result:** Creates new user successfully  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-5: Authentication middleware for protected routes**
**Test Steps:**
```bash
# Test without token
curl http://localhost:5000/api/driver/status
# Test with valid token
curl -H "Authorization: Bearer [TOKEN]" http://localhost:5000/api/driver/status
```
**Expected Result:** Rejects requests without token, accepts with valid token  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-6: Token expiration handling (24 hours)**
**Test Steps:**
```bash
# Verify token payload contains correct expiration
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.decode('[TOKEN]'))"
```
**Expected Result:** Token expires in 24 hours (86400 seconds)  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-7: Auto-registration for new identifiers**
**Test Steps:**
```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"newuser123","password":"password"}'
```
**Expected Result:** Creates new user automatically and logs them in  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-8: Test account creation**
**Test Steps:**
```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"+1234567890","password":"password123"}'
```
**Expected Result:** Test account (+1234567890/password123) works  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

### **Story 3 Overall Status:** [ ] ✅ ALL PASS - READY TO MERGE [ ] ❌ ISSUES FOUND  
**Tested By:** ________________ **Date:** ________________

---

## 📱 **Story 4: Driver Dashboard & Status**

### **User Story:**
As a driver, I want to see my current shift status, so that I know whether I'm currently clocked in or out.

### **Acceptance Criteria Testing:**

#### **✅ AC-1: Driver status endpoint (/api/driver/status)**
**Test Steps:**
```bash
curl -H "Authorization: Bearer [TOKEN]" http://localhost:5000/api/driver/status
```
**Expected Result:** Returns current shift status (active/inactive)  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-2: Active shift detection logic**
**Test Steps:**
```bash
# Clock in, then check status, then clock out and check again
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -d '{"startOdometer":1000}'
curl -H "Authorization: Bearer [TOKEN]" http://localhost:5000/api/driver/status
```
**Expected Result:** Correctly identifies active/inactive shift status  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-3: Basic HTML dashboard page**
**Test Steps:**
```bash
curl http://localhost:5000/
```
**Expected Result:** Returns HTML dashboard page  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-4: Status display (active/inactive shift)**
**Test Steps:**
- Open dashboard in browser
- Check if status shows correctly based on actual shift state
**Expected Result:** Dashboard displays current shift status accurately  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-5: User authentication check**
**Test Steps:**
```bash
# Access dashboard without authentication
curl http://localhost:5000/api/driver/status
```
**Expected Result:** Requires authentication, rejects unauthorized access  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-6: Error handling for unauthorized access**
**Test Steps:**
```bash
curl http://localhost:5000/api/driver/status
curl -H "Authorization: Bearer invalid-token" http://localhost:5000/api/driver/status
```
**Expected Result:** Returns proper 401/403 errors for unauthorized access  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

### **Story 4 Overall Status:** [ ] ✅ ALL PASS - READY TO MERGE [ ] ❌ ISSUES FOUND  
**Tested By:** ________________ **Date:** ________________

---

## ⏰ **Story 5: Clock In Functionality**

### **User Story:**
As a driver, I want to clock in at the start of my shift, so that my work time is tracked accurately.

### **Acceptance Criteria Testing:**

#### **✅ AC-1: Shifts table creation in database**
**Test Steps:**
```bash
sqlite3 database/driver_logs.db ".schema shifts"
```
**Expected Result:** Shifts table exists with all required columns  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-2: Clock-in endpoint (/api/driver/clock-in)**
**Test Steps:**
```bash
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{"startOdometer":1000}'
```
**Expected Result:** Successfully clocks in driver  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-3: Odometer reading validation (required, numeric)**
**Test Steps:**
```bash
# Test without odometer
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{}'
# Test with invalid odometer
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{"startOdometer":"abc"}'
```
**Expected Result:** Rejects invalid/missing odometer readings  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-4: IST timestamp recording**
**Test Steps:**
```bash
# Clock in and check database timestamp
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{"startOdometer":1000}'
sqlite3 database/driver_logs.db "SELECT clock_in_time FROM shifts ORDER BY id DESC LIMIT 1"
```
**Expected Result:** Timestamp recorded in IST format  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-5: One active shift per driver validation**
**Test Steps:**
```bash
# Clock in twice without clocking out
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{"startOdometer":1000}'
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{"startOdometer":1100}'
```
**Expected Result:** Second clock-in rejected with appropriate error  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-6: Clock-in UI form**
**Test Steps:**
- Access dashboard in browser
- Use clock-in form interface
**Expected Result:** Form allows odometer input and submits successfully  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-7: Success/error notifications**
**Test Steps:**
- Use UI to clock in successfully
- Try to clock in again (should show error)
**Expected Result:** Shows appropriate success/error messages  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-8: Automatic status update after clock-in**
**Test Steps:**
```bash
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{"startOdometer":1000}'
curl -H "Authorization: Bearer [TOKEN]" http://localhost:5000/api/driver/status
```
**Expected Result:** Status shows active shift after clock-in  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

#### **✅ AC-9: Start odometer ≥ previous end odometer validation**
**Test Steps:**
```bash
# Complete a shift, then try to start new shift with lower odometer
# [Previous shift ended at 2000]
curl -H "Authorization: Bearer [TOKEN]" -X POST http://localhost:5000/api/driver/clock-in -H "Content-Type: application/json" -d '{"startOdometer":1500}'
```
**Expected Result:** Rejects start odometer less than previous end  
**Status:** [ ] ✅ PASS [ ] ❌ FAIL  
**Notes:** ________________________________

### **Story 5 Overall Status:** [ ] ✅ ALL PASS - READY TO MERGE [ ] ❌ ISSUES FOUND  
**Tested By:** ________________ **Date:** ________________

---

## 📋 **Testing Workflow:**

1. **Copy relevant story template** when implementing
2. **Test each acceptance criterion** systematically  
3. **Mark PASS/FAIL** for each criterion
4. **Document issues** in Notes sections
5. **Only merge when ALL criteria are ✅ PASS**

## 🎯 **Quality Gates:**

- **All acceptance criteria must be ✅ PASS**
- **No ❌ FAIL items allowed before merge**
- **Notes must document any workarounds or edge cases**
- **Manual testing required even if automated tests pass**

This ensures every story meets quality standards before integration! 🚀