// Test data creation for payroll calculations
// Creates realistic shift data for July 2025 to test payroll functionality

const { dbConnection } = require('./connection');

/**
 * Create comprehensive test shift data for July 2025
 * Includes various scenarios: regular shifts, overtime, Sunday work, early/late shifts
 */
async function createTestShiftData() {
    try {
        console.log('[Test Data] ==> Creating test shift data for July 2025...');
        
        // Clear existing July 2025 data first
        await dbConnection.query(`DELETE FROM shifts WHERE strftime('%Y-%m', clock_in_time) = '2025-07'`);
        console.log('[Test Data] ==> Cleared existing July 2025 shift data');
        
        const testShifts = [
            // Driver 1 (John Martinez) - Regular worker with some overtime
            // Week 1 (July 1-6, 2025)
            {
                driver_id: 1,
                clock_in_time: '2025-07-01T09:00:00.000Z',  // Tuesday 9 AM (1 hour late)
                clock_out_time: '2025-07-01T18:00:00.000Z', // 6 PM (9 hours, 1 hour overtime)
                start_odometer: 15000,
                end_odometer: 15120,
                shift_duration_minutes: 540,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-02T08:00:00.000Z',  // Wednesday 8 AM (regular)
                clock_out_time: '2025-07-02T17:00:00.000Z', // 5 PM (9 hours, 1 hour overtime)
                start_odometer: 15120,
                end_odometer: 15250,
                shift_duration_minutes: 540,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-03T07:30:00.000Z',  // Thursday 7:30 AM (30 min early = overtime)
                clock_out_time: '2025-07-03T16:30:00.000Z', // 4:30 PM (9 hours, 30 min overtime)
                start_odometer: 15250,
                end_odometer: 15380,
                shift_duration_minutes: 540,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-04T08:00:00.000Z',  // Friday 8 AM
                clock_out_time: '2025-07-04T20:30:00.000Z', // 8:30 PM (12.5 hours, 30 min overtime)
                start_odometer: 15380,
                end_odometer: 15520,
                shift_duration_minutes: 750,
                total_distance: 140,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-05T08:00:00.000Z',  // Saturday 8 AM
                clock_out_time: '2025-07-05T17:00:00.000Z', // 5 PM (9 hours, 1 hour overtime)
                start_odometer: 15520,
                end_odometer: 15650,
                shift_duration_minutes: 540,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-06T09:00:00.000Z',  // Sunday 9 AM (ALL OVERTIME)
                clock_out_time: '2025-07-06T15:00:00.000Z', // 3 PM (6 hours, ALL overtime)
                start_odometer: 15650,
                end_odometer: 15750,
                shift_duration_minutes: 360,
                total_distance: 100,
                status: 'completed'
            },
            
            // Week 2 (July 7-13, 2025) - More regular shifts
            {
                driver_id: 1,
                clock_in_time: '2025-07-07T08:00:00.000Z',  // Monday 8 AM
                clock_out_time: '2025-07-07T17:00:00.000Z', // 5 PM (9 hours, 1 hour overtime)
                start_odometer: 15750,
                end_odometer: 15880,
                shift_duration_minutes: 540,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-08T08:00:00.000Z',  // Tuesday 8 AM
                clock_out_time: '2025-07-08T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 15880,
                end_odometer: 16000,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-09T08:00:00.000Z',  // Wednesday 8 AM
                clock_out_time: '2025-07-09T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 16000,
                end_odometer: 16120,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-10T08:00:00.000Z',  // Thursday 8 AM
                clock_out_time: '2025-07-10T17:00:00.000Z', // 5 PM (9 hours, 1 hour overtime)
                start_odometer: 16120,
                end_odometer: 16250,
                shift_duration_minutes: 540,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-11T08:00:00.000Z',  // Friday 8 AM
                clock_out_time: '2025-07-11T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 16250,
                end_odometer: 16370,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-12T08:00:00.000Z',  // Saturday 8 AM
                clock_out_time: '2025-07-12T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 16370,
                end_odometer: 16490,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-13T10:00:00.000Z',  // Sunday 10 AM (ALL OVERTIME)
                clock_out_time: '2025-07-13T16:00:00.000Z', // 4 PM (6 hours, ALL overtime)
                start_odometer: 16490,
                end_odometer: 16590,
                shift_duration_minutes: 360,
                total_distance: 100,
                status: 'completed'
            },
            
            // Week 3 (July 14-20, 2025) - Mixed regular and overtime
            {
                driver_id: 1,
                clock_in_time: '2025-07-14T06:00:00.000Z',  // Monday 6 AM (2 hours early = overtime)
                clock_out_time: '2025-07-14T16:00:00.000Z', // 4 PM (10 hours, 2 hours overtime)
                start_odometer: 16590,
                end_odometer: 16720,
                shift_duration_minutes: 600,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-15T08:00:00.000Z',  // Tuesday 8 AM
                clock_out_time: '2025-07-15T21:00:00.000Z', // 9 PM (13 hours, 1 hour overtime)
                start_odometer: 16720,
                end_odometer: 16850,
                shift_duration_minutes: 780,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-16T08:00:00.000Z',  // Wednesday 8 AM
                clock_out_time: '2025-07-16T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 16850,
                end_odometer: 16970,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-17T08:00:00.000Z',  // Thursday 8 AM
                clock_out_time: '2025-07-17T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 16970,
                end_odometer: 17090,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-18T08:00:00.000Z',  // Friday 8 AM
                clock_out_time: '2025-07-18T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 17090,
                end_odometer: 17210,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-19T08:00:00.000Z',  // Saturday 8 AM
                clock_out_time: '2025-07-19T17:00:00.000Z', // 5 PM (9 hours, 1 hour overtime)
                start_odometer: 17210,
                end_odometer: 17340,
                shift_duration_minutes: 540,
                total_distance: 130,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-20T08:00:00.000Z',  // Sunday 8 AM (ALL OVERTIME)
                clock_out_time: '2025-07-20T14:00:00.000Z', // 2 PM (6 hours, ALL overtime)
                start_odometer: 17340,
                end_odometer: 17440,
                shift_duration_minutes: 360,
                total_distance: 100,
                status: 'completed'
            },
            
            // Week 4 (July 21-27, 2025) - Final week
            {
                driver_id: 1,
                clock_in_time: '2025-07-21T08:00:00.000Z',  // Monday 8 AM
                clock_out_time: '2025-07-21T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 17440,
                end_odometer: 17560,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-22T08:00:00.000Z',  // Tuesday 8 AM
                clock_out_time: '2025-07-22T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 17560,
                end_odometer: 17680,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-23T08:00:00.000Z',  // Wednesday 8 AM
                clock_out_time: '2025-07-23T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 17680,
                end_odometer: 17800,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-24T08:00:00.000Z',  // Thursday 8 AM
                clock_out_time: '2025-07-24T16:00:00.000Z', // 4 PM (8 hours, regular)
                start_odometer: 17800,
                end_odometer: 17920,
                shift_duration_minutes: 480,
                total_distance: 120,
                status: 'completed'
            },
            {
                driver_id: 1,
                clock_in_time: '2025-07-25T08:00:00.000Z',  // Friday 8 AM
                clock_out_time: '2025-07-25T17:00:00.000Z', // 5 PM (9 hours, 1 hour overtime)
                start_odometer: 17920,
                end_odometer: 18050,
                shift_duration_minutes: 540,
                total_distance: 130,
                status: 'completed'
            }
        ];
        
        console.log(`[Test Data] ==> Inserting ${testShifts.length} test shifts...`);
        
        for (const shift of testShifts) {
            const insertQuery = `
                INSERT INTO shifts (
                    driver_id, clock_in_time, clock_out_time, start_odometer, 
                    end_odometer, shift_duration_minutes, total_distance, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await dbConnection.query(insertQuery, [
                shift.driver_id,
                shift.clock_in_time,
                shift.clock_out_time,
                shift.start_odometer,
                shift.end_odometer,
                shift.shift_duration_minutes,
                shift.total_distance,
                shift.status
            ]);
        }
        
        console.log(`[Test Data] ==> Successfully created ${testShifts.length} test shifts for July 2025`);
        
        // Summary of test data created
        const summaryQuery = `
            SELECT 
                COUNT(*) as total_shifts,
                SUM(shift_duration_minutes) / 60.0 as total_hours,
                SUM(total_distance) as total_distance,
                MIN(clock_in_time) as first_shift,
                MAX(clock_out_time) as last_shift
            FROM shifts 
            WHERE strftime('%Y-%m', clock_in_time) = '2025-07'
        `;
        
        const summary = await dbConnection.query(summaryQuery);
        console.log('[Test Data] ==> Summary:', summary[0]);
        
        return {
            success: true,
            shiftsCreated: testShifts.length,
            summary: summary[0]
        };
        
    } catch (error) {
        console.error('[Test Data] ==> Error creating test data:', error);
        throw new Error(`Failed to create test data: ${error.message}`);
    }
}

module.exports = { createTestShiftData };