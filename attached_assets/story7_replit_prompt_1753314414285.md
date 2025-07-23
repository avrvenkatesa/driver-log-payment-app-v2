# Story 7: Shift History & Reports - Replit Agent Prompt

## 🤖 **PRIMARY PROMPT FOR REPLIT AGENT:**

```
Implement Story 7: Shift History & Reports for the Driver Log Payment App.

USER STORY:
As a driver, I want to view my shift history and reports, so that I can track my work patterns and earnings over time.

ACCEPTANCE CRITERIA TO IMPLEMENT:
✅ AC-1: Daily shift history endpoint (/api/driver/shifts/daily/:date)
✅ AC-2: Weekly shift history endpoint (/api/driver/shifts/weekly/:year/:week)
✅ AC-3: Monthly shift summary endpoint (/api/driver/shifts/monthly/:year/:month)
✅ AC-4: Shift history UI page/section on dashboard
✅ AC-5: Date range filtering (today, this week, this month, custom range)
✅ AC-6: Shift details display (duration, distance, times, odometer readings)
✅ AC-7: Summary statistics (total hours, total distance, shift count)
✅ AC-8: Export functionality (download shift data)
✅ AC-9: Pagination for large datasets (limit/offset or cursor-based)

TECHNICAL SPECIFICATIONS:

API ENDPOINT REQUIREMENTS:
- GET /api/driver/shifts/daily/:date (YYYY-MM-DD format)
- GET /api/driver/shifts/weekly/:year/:week (ISO week numbers)
- GET /api/driver/shifts/monthly/:year/:month
- GET /api/driver/shifts/export?start=date&end=date&format=csv|json
- All endpoints protected (require JWT authentication)
- Return paginated results with metadata

RESPONSE FORMAT:
```json
{
  "success": true,
  "data": {
    "shifts": [...],
    "summary": {
      "totalShifts": 15,
      "totalHours": 120.5,
      "totalDistance": 2400,
      "totalEarnings": 8500 // if payroll implemented
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "hasNext": true
    }
  }
}
```

DATABASE QUERIES:
- Query completed shifts only (status = 'completed')
- Include all shift data (times, odometers, calculations)
- Order by clock_in_time DESC (newest first)
- Filter by date ranges using clock_in_time
- Join with drivers table for driver information

UI REQUIREMENTS:
- Add new "Shift History" section to dashboard
- Date range picker (today, week, month, custom)
- Tabular display of shift data with sortable columns
- Summary cards showing totals and averages
- Export button for downloading data
- Pagination controls for navigation
- Loading states and error handling
- Mobile-responsive design

SHIFT DISPLAY COLUMNS:
- Date (formatted for user's timezone)
- Clock In Time
- Clock Out Time  
- Duration (formatted as hours:minutes)
- Start Odometer
- End Odometer
- Distance
- Status
- Actions (view details, edit if needed)

FILTERING & SEARCH:
- Date range selection
- Status filter (if multiple statuses exist)
- Search by date or shift details
- Sort by any column (date, duration, distance)

INTEGRATION REQUIREMENTS:
- Build on existing shifts database table
- Use existing authentication system
- Integrate with current dashboard UI
- Maintain consistent styling with existing components
- Ensure timezone handling (IST display)

ERROR HANDLING:
- Invalid date ranges
- No shifts found for period
- Authentication failures
- Database errors
- Export failures

PERFORMANCE CONSIDERATIONS:
- Implement pagination to handle large datasets
- Add database indexes on clock_in_time for fast queries
- Cache summary calculations where possible
- Optimize queries to avoid N+1 problems

Please implement comprehensive shift history and reporting functionality that allows drivers to view, filter, and export their shift data with professional UI and robust backend support.
```

## 🧪 **TESTING VERIFICATION COMMANDS:**

After implementation, test using:

```bash
# 1. Setup authentication token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"identifier":"+1234567890","password":"password123"}' | jq -r '.token')

# 2. Test daily shifts (use actual date)
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/driver/shifts/daily/2025-07-23

# 3. Test weekly shifts (current week)
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/driver/shifts/weekly/2025/30

# 4. Test monthly shifts (current month)
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/driver/shifts/monthly/2025/07

# 5. Test export functionality
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/driver/shifts/export?start=2025-07-01&end=2025-07-31&format=json

# 6. Test pagination
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/driver/shifts/monthly/2025/07?page=1&limit=10

# 7. Test dashboard UI
curl http://localhost:5000/ | grep -i "history\|shifts"

# 8. Verify database performance
sqlite3 database/driver_logs.db "EXPLAIN QUERY PLAN SELECT * FROM shifts WHERE driver_id = 1 AND clock_in_time >= '2025-07-01' ORDER BY clock_in_time DESC"
```

## 📋 **SUCCESS CRITERIA:**

✅ Daily, weekly, and monthly shift endpoints working  
✅ Date range filtering implemented correctly  
✅ Shift history UI integrated into dashboard  
✅ Summary statistics calculated accurately  
✅ Export functionality works for CSV/JSON  
✅ Pagination handles large datasets  
✅ Professional UI with sorting and filtering  
✅ Mobile-responsive design  
✅ Proper error handling and validation  
✅ Performance optimized for large datasets