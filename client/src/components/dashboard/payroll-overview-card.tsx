import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Info, FileText, Download } from "lucide-react";

export function PayrollOverviewCard() {
  const payrollData = [
    {
      title: "Weekly Payroll",
      subtitle: "March 18-24, 2024",
      amount: "$127,650",
      status: "Processed",
      icon: CheckCircle,
      bgColor: "bg-green-50",
      iconColor: "text-[var(--material-green)]",
      statusColor: "text-[var(--material-green)]",
    },
    {
      title: "Current Week",
      subtitle: "March 25-31, 2024",
      amount: "$89,420",
      status: "In Progress",
      icon: Clock,
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-600",
      statusColor: "text-yellow-600",
    },
    {
      title: "Overtime Hours",
      subtitle: "This month total",
      amount: "342.5 hrs",
      status: "$17,125 value",
      icon: Info,
      bgColor: "bg-blue-50",
      iconColor: "text-[var(--material-blue)]",
      statusColor: "text-[var(--material-blue)]",
    },
  ];

  return (
    <Card className="bg-white material-shadow-1">
      <CardHeader className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Payroll Overview</h3>
          <Button variant="ghost" className="text-[var(--material-blue)] text-sm font-medium hover:text-[var(--material-blue-dark)]">
            Process Payments
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {payrollData.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className={`flex items-center justify-between p-4 ${item.bgColor} rounded-lg`}>
                <div className="flex items-center space-x-3">
                  <Icon className={`${item.iconColor} h-5 w-5`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-[var(--material-grey)]">{item.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{item.amount}</p>
                  <p className={`text-xs ${item.statusColor}`}>{item.status}</p>
                </div>
              </div>
            );
          })}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <Button className="bg-[var(--material-blue)] text-white hover:bg-[var(--material-blue-dark)]">
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
              <Button variant="outline" className="border-[var(--material-blue)] text-[var(--material-blue)] hover:bg-blue-50">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
