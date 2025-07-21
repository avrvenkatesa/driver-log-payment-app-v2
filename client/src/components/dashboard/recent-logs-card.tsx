import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Truck, Clock, AlertTriangle } from "lucide-react";
import type { DriverLog } from "@shared/schema";

type DriverLogWithName = DriverLog & { driverName: string };

export function RecentLogsCard() {
  const { data: logs = [], isLoading } = useQuery<DriverLogWithName[]>({
    queryKey: ["/api/logs/recent"],
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Car className="text-[var(--material-blue)] text-sm h-4 w-4" />;
      case "completed":
        return <Truck className="text-[var(--material-green)] text-sm h-4 w-4" />;
      case "on_break":
        return <Clock className="text-yellow-600 text-sm h-4 w-4" />;
      case "alert":
        return <AlertTriangle className="text-[var(--material-red)] text-sm h-4 w-4" />;
      default:
        return <Car className="text-[var(--material-blue)] text-sm h-4 w-4" />;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100";
      case "completed":
        return "bg-green-100";
      case "on_break":
        return "bg-yellow-100";
      case "alert":
        return "bg-red-100";
      default:
        return "bg-blue-100";
    }
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      case "on_break":
        return "On Break";
      case "alert":
        return "Alert";
      default:
        return "Unknown";
    }
  };

  return (
    <Card className="bg-white material-shadow-1">
      <CardHeader className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Recent Log Entries</h3>
          <Button variant="ghost" className="text-[var(--material-blue)] text-sm font-medium hover:text-[var(--material-blue-dark)]">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-4 p-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-48"></div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg">
                <div className={`w-10 h-10 ${getStatusBgColor(log.status)} rounded-full flex items-center justify-center`}>
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{log.driverName}</p>
                  <p className="text-xs text-[var(--material-grey)]">{log.activity}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900">{formatTime(log.startTime)}</p>
                  <p className="text-xs text-[var(--material-grey)]">{getStatusText(log.status)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
