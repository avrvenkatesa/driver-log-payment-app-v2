import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  CreditCard, 
  BarChart3, 
  Shield,
  Truck,
  User
} from "lucide-react";

export function NavigationDrawer() {
  const [location] = useLocation();

  const navigationItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/drivers", icon: Users, label: "Drivers" },
    { href: "/logs", icon: Clock, label: "Time Logs" },
    { href: "/payroll", icon: CreditCard, label: "Payroll" },
    { href: "/reports", icon: BarChart3, label: "Reports" },
    { href: "/health", icon: Shield, label: "System Health" },
  ];

  const isActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  return (
    <nav className="w-64 bg-white material-shadow-2 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[var(--material-blue)] rounded-lg flex items-center justify-center">
            <Truck className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-lg font-medium text-gray-900">Driver Log Pro</h1>
            <p className="text-sm text-[var(--material-grey)]">Enterprise System</p>
          </div>
        </div>
      </div>
      
      {/* Navigation Menu */}
      <div className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <a
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg ${
                      isActive(item.href)
                        ? "bg-blue-50 text-[var(--material-blue)]"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="text-lg mr-3 h-5 w-5" />
                    {item.label}
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      
      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[var(--material-green)] rounded-full flex items-center justify-center">
            <User className="text-white text-sm h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Admin User</p>
            <p className="text-xs text-[var(--material-grey)]">System Administrator</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
