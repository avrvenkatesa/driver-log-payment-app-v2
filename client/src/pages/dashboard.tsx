import { NavigationDrawer } from "@/components/layout/navigation-drawer";
import { TopAppBar } from "@/components/layout/top-app-bar";
import { MetricsGrid } from "@/components/dashboard/metrics-grid";
import { RecentLogsCard } from "@/components/dashboard/recent-logs-card";
import { PayrollOverviewCard } from "@/components/dashboard/payroll-overview-card";
import { DriversTable } from "@/components/dashboard/drivers-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-material-background">
      <NavigationDrawer />
      
      <main className="flex-1 overflow-hidden">
        <TopAppBar />
        
        <div className="flex-1 overflow-y-auto p-6">
          <MetricsGrid />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <RecentLogsCard />
            <PayrollOverviewCard />
          </div>
          
          <DriversTable />
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <Button 
          size="lg"
          className="w-14 h-14 rounded-full material-shadow-3 bg-[var(--material-blue)] hover:bg-[var(--material-blue-dark)] transition-all duration-200 hover:scale-105"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
