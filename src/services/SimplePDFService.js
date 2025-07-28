// Simple HTML-based PDF service for environments without full Chrome support
class SimplePDFService {
    
    generatePayrollHTML(payrollData, options) {
        const { title, period, generatedAt, year, month } = options;
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[parseInt(month) - 1];
        
        // Calculate totals
        const totals = {
            baseSalary: 0,
            overtimeHours: 0,
            overtimePay: 0,
            fuelAllowance: 0,
            grossEarnings: 0,
            leaveDeduction: 0,
            pfDeduction: 0,
            esiDeduction: 0,
            taxDeduction: 0,
            advanceDeduction: 0,
            totalDeductions: 0,
            totalEarnings: 0,
            workingDays: 0
        };
        
        const driversHtml = payrollData.map(driver => {
            const breakdown = driver.breakdown || {};
            totals.baseSalary += breakdown.baseSalary || 0;
            totals.overtimeHours += breakdown.overtimeHours || 0;
            totals.overtimePay += breakdown.overtimePay || 0;
            totals.fuelAllowance += breakdown.fuelAllowance || 0;
            totals.grossEarnings += breakdown.grossEarnings || 0;
            totals.leaveDeduction += breakdown.leaveDeduction || 0;
            totals.pfDeduction += breakdown.pfDeduction || 0;
            totals.esiDeduction += breakdown.esiDeduction || 0;
            totals.taxDeduction += breakdown.taxDeduction || 0;
            totals.advanceDeduction += breakdown.advanceDeduction || 0;
            totals.totalDeductions += breakdown.totalDeductions || 0;
            totals.totalEarnings += breakdown.totalEarnings || 0;
            totals.workingDays += breakdown.workingDays || 0;
            
            return `
                <tr>
                    <td><strong>${driver.driverName || 'Unknown Driver'}</strong></td>
                    <td class="currency">${this.formatCurrency(breakdown.baseSalary || 0)}</td>
                    <td style="text-align: center;">${(breakdown.overtimeHours || 0).toFixed(1)}</td>
                    <td class="currency">${this.formatCurrency(breakdown.overtimePay || 0)}</td>
                    <td class="currency">${this.formatCurrency(breakdown.fuelAllowance || 0)}</td>
                    <td class="currency">${this.formatCurrency(breakdown.totalDeductions || 0)}</td>
                    <td class="currency total-cell">${this.formatCurrency(breakdown.totalEarnings || 0)}</td>
                </tr>
            `;
        }).join('');
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Monthly Payroll Report - ${monthName} ${year}</title>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
        
        body { 
            font-family: 'Arial', sans-serif; 
            margin: 20px;
            color: #333;
            line-height: 1.4;
            background: white;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 8px;
        }
        .report-title {
            font-size: 20px;
            color: #666;
            margin-bottom: 12px;
        }
        .report-period {
            font-size: 14px;
            color: #888;
            margin-bottom: 5px;
        }
        .summary-section {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #007bff;
        }
        .summary-title {
            font-size: 16px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
        }
        .stat-item {
            text-align: center;
        }
        .stat-value {
            font-size: 18px;
            font-weight: bold;
            color: #28a745;
        }
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th, td {
            border: 1px solid #dee2e6;
            padding: 12px 8px;
            text-align: left;
        }
        th {
            background-color: #007bff;
            color: white;
            font-weight: bold;
            text-align: center;
        }
        .currency {
            text-align: right;
            font-family: 'Courier New', monospace;
            font-weight: 500;
        }
        .total-row {
            background-color: #e9ecef;
            font-weight: bold;
            border-top: 2px solid #007bff;
        }
        .total-cell {
            background-color: #28a745;
            color: white;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .no-print {
            margin: 20px 0;
            text-align: center;
        }
        .print-btn {
            background: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .print-btn:hover {
            background: #0056b3;
        }
        .download-btn {
            background: #28a745;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-left: 10px;
        }
        .download-btn:hover {
            background: #1e7e34;
        }
    </style>
</head>
<body>
    <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print PDF</button>
        <button class="download-btn" onclick="downloadPDF()">💾 Download PDF</button>
    </div>
    
    <div class="header">
        <div class="company-name">Driver Log Payment System</div>
        <div class="report-title">Monthly Payroll Report</div>
        <div class="report-period"><strong>Period: ${monthName} ${year}</strong></div>
        <div class="report-period">Generated: ${generatedAt}</div>
    </div>
    
    <div class="summary-section">
        <div class="summary-title">Payroll Summary</div>
        <div class="summary-stats">
            <div class="stat-item">
                <div class="stat-value">${payrollData.length}</div>
                <div class="stat-label">Total Drivers</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${this.formatCurrency(totals.totalEarnings)}</div>
                <div class="stat-label">Total Payroll</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${totals.overtimeHours.toFixed(1)} hrs</div>
                <div class="stat-label">Total Overtime</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${this.formatCurrency(totals.fuelAllowance)}</div>
                <div class="stat-label">Fuel Allowance</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${this.formatCurrency(totals.totalDeductions)}</div>
                <div class="stat-label">Total Deductions</div>
            </div>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Driver Name</th>
                <th>Base Salary</th>
                <th>Overtime Hours</th>
                <th>Overtime Pay</th>
                <th>Fuel Allowance</th>
                <th>Total Deductions</th>
                <th>Net Pay</th>
            </tr>
        </thead>
        <tbody>
            ${driversHtml}
            <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td class="currency"><strong>${this.formatCurrency(totals.baseSalary)}</strong></td>
                <td style="text-align: center;"><strong>${totals.overtimeHours.toFixed(1)}</strong></td>
                <td class="currency"><strong>${this.formatCurrency(totals.overtimePay)}</strong></td>
                <td class="currency"><strong>${this.formatCurrency(totals.fuelAllowance)}</strong></td>
                <td class="currency"><strong>${this.formatCurrency(totals.totalDeductions)}</strong></td>
                <td class="currency total-cell"><strong>${this.formatCurrency(totals.totalEarnings)}</strong></td>
            </tr>
        </tbody>
    </table>
    
    <div class="deductions-section" style="margin-top: 30px;">
        <h3 style="text-align: center; color: #333; margin-bottom: 20px;">Deductions Breakdown</h3>
        <table style="font-size: 12px;">
            <thead>
                <tr>
                    <th>Driver Name</th>
                    <th>Leave Deduction</th>
                    <th>PF (12%)</th>
                    <th>ESI (0.75%)</th>
                    <th>Tax (5%)</th>
                    <th>Advance Payments</th>
                    <th>Total Deductions</th>
                </tr>
            </thead>
            <tbody>
                ${payrollData.map(driver => {
                    const b = driver.breakdown;
                    return `
                        <tr>
                            <td style="font-weight: bold;">${driver.driverName}</td>
                            <td class="currency">${this.formatCurrency(b.leaveDeduction || 0)}</td>
                            <td class="currency">${this.formatCurrency(b.pfDeduction || 0)}</td>
                            <td class="currency">${this.formatCurrency(b.esiDeduction || 0)}</td>
                            <td class="currency">${this.formatCurrency(b.taxDeduction || 0)}</td>
                            <td class="currency">${this.formatCurrency(b.advanceDeduction || 0)}</td>
                            <td class="currency"><strong>${this.formatCurrency(b.totalDeductions || 0)}</strong></td>
                        </tr>
                    `;
                }).join('')}
                <tr class="total-row">
                    <td><strong>TOTAL</strong></td>
                    <td class="currency"><strong>${this.formatCurrency(totals.leaveDeduction || 0)}</strong></td>
                    <td class="currency"><strong>${this.formatCurrency(totals.pfDeduction || 0)}</strong></td>
                    <td class="currency"><strong>${this.formatCurrency(totals.esiDeduction || 0)}</strong></td>
                    <td class="currency"><strong>${this.formatCurrency(totals.taxDeduction || 0)}</strong></td>
                    <td class="currency"><strong>${this.formatCurrency(totals.advanceDeduction || 0)}</strong></td>
                    <td class="currency total-cell"><strong>${this.formatCurrency(totals.totalDeductions)}</strong></td>
                </tr>
            </tbody>
        </table>
    </div>
    
    <div class="footer">
        <p><strong>Driver Log Payment System | Confidential Document</strong></p>
        <p>This document contains confidential payroll information. Distribution is restricted.</p>
        <p>Generated on ${generatedAt} | System Version 2.0</p>
    </div>
    
    <script>
        function downloadPDF() {
            const element = document.documentElement;
            const opt = {
                margin:       1,
                filename:     'Payroll_Report_${monthName}_${year}.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            
            // Use browser's print dialog as fallback
            window.print();
        }
    </script>
</body>
</html>
        `;
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            currencyDisplay: 'symbol'
        }).format(amount || 0);
    }
}

module.exports = new SimplePDFService();