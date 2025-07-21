import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function TopAppBar() {
  return (
    <header className="bg-white material-shadow-1 border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium text-gray-900">Dashboard</h2>
            <p className="text-sm text-[var(--material-grey)] mt-1">
              Monitor driver logs and payroll overview
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* System Status */}
            <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-[var(--material-green)] rounded-full"></div>
              <span className="text-sm font-medium text-[var(--material-green)]">
                System Online
              </span>
            </div>
            
            {/* Action Button */}
            <Button className="bg-[var(--material-blue)] hover:bg-[var(--material-blue-dark)] text-white material-shadow-1">
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
