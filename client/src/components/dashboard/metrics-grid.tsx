import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, CreditCard, Shield } from "lucide-react";
import type { SystemMetrics } from "@shared/schema";

export function MetricsGrid() {
  const { data: metrics, isLoading } = useQuery<SystemMetrics>({
    queryKey: ["/api/metrics"],
  });

  const metricCards = [
    {
      title: "Active Drivers",
      value: metrics?.activeDrivers?.toString() || "0",
      change: "+12.5%",
      changeText: "from last month",
      icon: Users,
      bgColor: "bg-blue-50",
      iconColor: "text-[var(--material-blue)]",
    },
    {
      title: "Total Hours Today",
      value: metrics?.totalHoursToday || "0",
      change: "+8.2%",
      changeText: "from yesterday",
      icon: Clock,
      bgColor: "bg-green-50",
      iconColor: "text-[var(--material-green)]",
    },
    {
      title: "Pending Payments",
      value: `$${metrics?.pendingPayments || "0"}`,
      change: "23 drivers",
      changeText: "awaiting payment",
      icon: CreditCard,
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-600",
    },
    {
      title: "System Uptime",
      value: `${metrics?.systemUptime || "0"}%`,
      change: "Excellent",
      changeText: "last 30 days",
      icon: Shield,
      bgColor: "bg-green-50",
      iconColor: "text-[var(--material-green)]",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="material-shadow-1">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                </div>
                <div className="mt-4 flex items-center">
                  <div className="h-4 bg-gray-200 rounded w-16 mr-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index} className="bg-white material-shadow-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--material-grey)]">{metric.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
                </div>
                <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${metric.iconColor} text-xl h-6 w-6`} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-[var(--material-green)] text-sm font-medium">
                  {metric.change}
                </span>
                <span className="text-xs text-[var(--material-grey)] ml-2">
                  {metric.changeText}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
