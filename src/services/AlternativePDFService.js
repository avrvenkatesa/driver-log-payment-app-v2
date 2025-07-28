const PDFDocument = require('pdfkit');

class AlternativePDFService {
    static async generatePayrollPDF(payrollData, options = {}) {
        console.log('[Alternative PDF Service] Generating PDF using PDFKit...');
        
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ 
                    size: 'A4', 
                    margin: 50,
                    bufferPages: true 
                });
                
                const buffers = [];
                doc.on('data', buffer => buffers.push(buffer));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    console.log('[Alternative PDF Service] PDF generated successfully using PDFKit');
                    resolve(pdfBuffer);
                });
                doc.on('error', reject);
                
                // Generate PDF content
                this.generatePayrollContent(doc, payrollData, options);
                
                doc.end();
                
            } catch (error) {
                console.error('[Alternative PDF Service] Error:', error);
                reject(error);
            }
        });
    }
    
    static generatePayrollContent(doc, payrollData, options) {
        const { title, period, generatedAt, year, month } = options;
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthName = monthNames[parseInt(month) - 1] || 'Unknown';
        
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
        
        payrollData.forEach(driver => {
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
        });
        
        // Header
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#007bff');
        doc.text('Driver Log Payment System', 50, 50);
        
        doc.fontSize(18).font('Helvetica').fillColor('#666');
        doc.text('Monthly Payroll Report', 50, 80);
        
        doc.fontSize(14).font('Helvetica').fillColor('#333');
        doc.text(`Period: ${monthName} ${year}`, 50, 110);
        doc.text(`Generated: ${generatedAt}`, 50, 130);
        
        // Summary section
        doc.rect(50, 160, 500, 80).fillAndStroke('#f8f9fa', '#007bff');
        doc.fillColor('#007bff').fontSize(14).font('Helvetica-Bold');
        doc.text('Payroll Summary', 60, 175);
        
        doc.fillColor('#333').fontSize(12).font('Helvetica');
        doc.text(`Total Drivers: ${payrollData.length}`, 60, 195);
        doc.text(`Total Payroll: ${this.formatCurrency(totals.totalEarnings)}`, 200, 195);
        doc.text(`Total Overtime: ${totals.overtimeHours.toFixed(1)} hrs`, 380, 195);
        doc.text(`Fuel Allowance: ${this.formatCurrency(totals.fuelAllowance)}`, 60, 215);
        
        // Table header
        let yPosition = 280;
        doc.rect(50, yPosition - 10, 500, 25).fillAndStroke('#007bff', '#007bff');
        doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
        
        const headers = ['Driver Name', 'Base Salary', 'OT Hours', 'OT Pay', 'Fuel', 'Deductions', 'Net Pay'];
        const columnWidths = [90, 65, 45, 65, 45, 75, 75];
        let xPosition = 55;
        
        headers.forEach((header, i) => {
            doc.text(header, xPosition, yPosition - 5);
            xPosition += columnWidths[i];
        });
        
        // Table rows
        yPosition += 25;
        doc.fillColor('#333').fontSize(9).font('Helvetica');
        
        payrollData.forEach((driver, index) => {
            const breakdown = driver.breakdown || {};
            
            // Alternating row colors
            if (index % 2 === 0) {
                doc.rect(50, yPosition - 5, 500, 20).fillAndStroke('#f8f9fa', '#f8f9fa');
            }
            
            xPosition = 55;
            const rowData = [
                driver.driverName || 'Unknown',
                this.formatCurrency(breakdown.baseSalary || 0),
                (breakdown.overtimeHours || 0).toFixed(1),
                this.formatCurrency(breakdown.overtimePay || 0),
                this.formatCurrency(breakdown.fuelAllowance || 0),
                this.formatCurrency(breakdown.totalDeductions || 0),
                this.formatCurrency(breakdown.totalEarnings || 0)
            ];
            
            doc.fillColor('#333');
            rowData.forEach((data, i) => {
                if (i === 0) {
                    doc.font('Helvetica-Bold');
                } else {
                    doc.font('Helvetica');
                }
                doc.text(data, xPosition, yPosition, { width: columnWidths[i] - 5, align: i === 0 ? 'left' : 'right' });
                xPosition += columnWidths[i];
            });
            
            yPosition += 20;
            
            // Add new page if needed
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }
        });
        
        // Total row
        yPosition += 10;
        doc.rect(50, yPosition - 5, 500, 25).fillAndStroke('#e9ecef', '#007bff');
        doc.fillColor('#333').fontSize(10).font('Helvetica-Bold');
        
        xPosition = 55;
        const totalRowData = [
            'TOTAL',
            this.formatCurrency(totals.baseSalary),
            totals.overtimeHours.toFixed(1),
            this.formatCurrency(totals.overtimePay),
            this.formatCurrency(totals.fuelAllowance),
            this.formatCurrency(totals.totalDeductions),
            this.formatCurrency(totals.totalEarnings)
        ];
        
        totalRowData.forEach((data, i) => {
            doc.text(data, xPosition, yPosition, { width: columnWidths[i] - 5, align: i === 0 ? 'left' : 'right' });
            xPosition += columnWidths[i];
        });
        
        // Footer
        doc.fontSize(8).fillColor('#666').font('Helvetica');
        doc.text('Driver Log Payment System | Confidential Document', 50, doc.page.height - 60);
        doc.text('This document contains confidential payroll information. Distribution is restricted.', 50, doc.page.height - 45);
        doc.text(`Generated on ${generatedAt} | System Version 2.0`, 50, doc.page.height - 30);
    }
    
    static formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            currencyDisplay: 'symbol'
        }).format(amount || 0);
    }
}

module.exports = AlternativePDFService;