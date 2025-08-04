import { 
  ShoppingCart,
  Package,
  Users,
  FileText,
  BarChart3,
  Receipt,
  Settings,
  HelpCircle,
  Building2,
  Activity,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

interface SidebarProps {
  activeItem: string;
  userRole?: string;
}

export default function Sidebar({ activeItem, userRole }: SidebarProps) {
  const [location] = useLocation();

  const menuItems = [
    { id: 'b2b-shop', icon: ShoppingCart, label: 'B2B SHOP', href: '/', allowed: true },
    { id: 'catalog', icon: Package, label: 'CATALOG', href: '/catalog', allowed: true },
    { id: 'clients', icon: Users, label: 'CLIENTS', href: '/clients', allowed: userRole === 'admin' || userRole === 'super_admin' },
    { id: 'orders', icon: FileText, label: 'ORDERS', href: '/orders', allowed: true },
    { id: 'reports', icon: BarChart3, label: 'REPORTS', href: '/reports', allowed: userRole === 'admin' || userRole === 'super_admin' },
    { id: 'invoices', icon: Receipt, label: 'INVOICES', href: '/invoices', allowed: userRole === 'admin' || userRole === 'super_admin' },
    { id: 'admin', icon: Settings, label: 'ADMIN PANEL', href: '/admin', allowed: userRole === 'admin' || userRole === 'super_admin' },
    { id: 'monitoring', icon: Activity, label: 'MONITORING', href: '/monitoring', allowed: userRole === 'admin' || userRole === 'super_admin' },
    { id: 'alerts', icon: AlertTriangle, label: 'ALERTS', href: '/alerts', allowed: userRole === 'admin' || userRole === 'super_admin' },
    { id: 'settings', icon: Settings, label: 'SETTINGS', href: '/settings', allowed: true },
    { id: 'support', icon: HelpCircle, label: 'SUPPORT', href: '/support', allowed: true },
  ].filter(item => item.allowed);

  return (
    <div className="w-70 sidebar-bg text-white flex-shrink-0 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">B2B PORTAL</h1>
            <p className="text-xs text-gray-300">ENTERPRISE</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-6">
        <div className="px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = activeItem === item.id;
            const IconComponent = item.icon;
            
            // TIER 2 OPTIMIZATION: Hover-based preloading for navigation
            const getPreloadProps = () => {
              const routeName = item.href.replace('/', '') || 'b2b-shop';
              const dataEndpoint = routeName === 'orders' ? '/api/orders' : 
                                 routeName === 'wallet' ? '/api/wallet' : null;
              
              return {
                onMouseEnter: () => {
                  // Preload route bundle
                  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                    requestIdleCallback(() => {
                      import(`@/pages/${routeName === 'b2b-shop' ? 'b2b-shop' : routeName === 'orders' ? 'orders' : routeName === 'wallet' ? 'wallet-page' : routeName === 'admin-panel' ? 'admin-panel' : 'cart'}`).catch(() => {});
                    });
                  }
                  // Preload data if applicable
                  if (dataEndpoint) {
                    import("@/lib/queryClient").then(({ queryClient }) => {
                      if (!queryClient.getQueryData([dataEndpoint])) {
                        queryClient.prefetchQuery({
                          queryKey: [dataEndpoint],
                          staleTime: 5 * 60 * 1000,
                          gcTime: 30 * 60 * 1000,
                        }).catch(() => {});
                      }
                    });
                  }
                }
              };
            };

            return (
              <Link key={item.id} href={item.href}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start h-12 px-4 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                  {...getPreloadProps()}
                >
                  <IconComponent className="w-5 h-5 mr-3" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-600">
        <div className="text-xs text-gray-400">
          <p>B2B Portal v4.1</p>
          <p>Enterprise Edition</p>
        </div>
      </div>
    </div>
  );
}
