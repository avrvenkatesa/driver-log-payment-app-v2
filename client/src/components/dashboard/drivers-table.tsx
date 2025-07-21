import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, RefreshCw } from "lucide-react";
import type { Driver } from "@shared/schema";

export function DriversTable() {
  const { data: drivers = [], isLoading, refetch } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "on_break":
        return "secondary";
      case "hours_alert":
        return "destructive";
      case "off_duty":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "on_break":
        return "On Break";
      case "hours_alert":
        return "Hours Alert";
      case "off_duty":
        return "Off Duty";
      default:
        return "Unknown";
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-100";
      case "on_break":
        return "bg-yellow-100";
      case "hours_alert":
        return "bg-red-100";
      case "off_duty":
        return "bg-gray-100";
      default:
        return "bg-gray-100";
    }
  };

  const getStatusIconColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-[var(--material-blue)]";
      case "on_break":
        return "text-yellow-600";
      case "hours_alert":
        return "text-[var(--material-red)]";
      case "off_duty":
        return "text-[var(--material-grey)]";
      default:
        return "text-[var(--material-grey)]";
    }
  };

  const formatLastUpdate = (date: Date | string) => {
    const now = new Date();
    const updateTime = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - updateTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
    return updateTime.toLocaleDateString();
  };

  return (
    <Card className="bg-white material-shadow-1">
      <CardHeader className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Active Drivers Status</h3>
          <div className="flex items-center space-x-3">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_break">On Break</SelectItem>
                <SelectItem value="off_duty">Off Duty</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-left px-6 py-3 text-xs font-medium text-[var(--material-grey)] uppercase tracking-wider">
                  Driver
                </TableHead>
                <TableHead className="text-left px-6 py-3 text-xs font-medium text-[var(--material-grey)] uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-left px-6 py-3 text-xs font-medium text-[var(--material-grey)] uppercase tracking-wider">
                  Current Route
                </TableHead>
                <TableHead className="text-left px-6 py-3 text-xs font-medium text-[var(--material-grey)] uppercase tracking-wider">
                  Hours Today
                </TableHead>
                <TableHead className="text-left px-6 py-3 text-xs font-medium text-[var(--material-grey)] uppercase tracking-wider">
                  Last Update
                </TableHead>
                <TableHead className="text-left px-6 py-3 text-xs font-medium text-[var(--material-grey)] uppercase tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-6 py-4">
                      <div className="animate-pulse flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full mr-3"></div>
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-40"></div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                drivers.map((driver) => (
                  <TableRow key={driver.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 ${getStatusBgColor(driver.status)} rounded-full flex items-center justify-center`}>
                          <User className={`${getStatusIconColor(driver.status)} text-sm h-4 w-4`} />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                          <p className="text-xs text-[var(--material-grey)]">ID: {driver.driverId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusVariant(driver.status)} className={`status-${driver.status}`}>
                        {getStatusText(driver.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {driver.currentRoute || "Not assigned"}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {driver.hoursToday} / {driver.maxHours}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-[var(--material-grey)]">
                      {formatLastUpdate(driver.lastUpdate)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-[var(--material-blue)] hover:text-[var(--material-blue-dark)]"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--material-grey)]">
              Showing 1 to {drivers.length} of {drivers.length} drivers
            </p>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button size="sm" className="bg-[var(--material-blue)] text-white">
                1
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
