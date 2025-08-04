import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Grid,
  FileText,
  CreditCard,
  Settings,
  HelpCircle,
  BarChart3,
  Users,
  Building2,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MyBranches from "@/components/b2b/MyBranches";
import { useDeviceDetection } from "@/hooks/mobile/useDeviceDetection";
import { MobileSidebar } from "@/components/mobile/MobileSidebar";

export default function MyBranchesPage() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { isMobile } = useDeviceDetection();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "Please log in to access your branches",
        variant: "destructive",
      });
      setLocation('/auth');
      return;
    }
  }, [isAuthenticated, isLoading, toast, setLocation]);

  // Ensure only B2B users can access this page
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.role !== 'b2b_user') {
      toast({
        title: "Access Denied",
        description: "This section is only available for B2B users",
        variant: "destructive",
      });
      setLocation('/');
      return;
    }
  }, [user, isLoading, isAuthenticated, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const sidebarItems = [
    { icon: Package, label: "B2B SHOP", active: false, href: "/", allowed: true },
    { icon: Grid, label: "CATALOG", active: false, href: "/catalog", allowed: true },
    { icon: Building2, label: "MY BRANCHES", active: true, href: "/my-branches", allowed: true },
    { icon: FileText, label: "ORDERS", active: false, href: "/orders", allowed: true },
    { icon: CreditCard, label: "MY WALLET", active: false, href: "/wallet", allowed: true },
    { icon: BarChart3, label: "REPORTS", active: false, href: "/reports", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: CreditCard, label: "INVOICES", active: false, href: "/invoices", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: Settings, label: "SETTINGS", active: false, href: "/settings", allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/support", allowed: true },
  ].filter(item => item.allowed);

  // Use mobile sidebar layout for screens ≤768px
  const shouldUseMobileSidebar = isMobile || (typeof window !== 'undefined' && window.innerWidth <= 768);

  return (
    <div className="min-h-screen bg-[#f5f6f5] flex font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Conditional Sidebar Rendering */}
      {shouldUseMobileSidebar ? (
        <MobileSidebar sidebarItems={sidebarItems} user={user} />
      ) : (
        <div className="w-64 text-white flex-shrink-0 bg-[#404040]">
          <div className="p-4 border-b border-[#5a5b5d]">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#FFB20F] rounded flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-sm uppercase tracking-[0.5px]">B2B PORTAL</h2>
                <p className="text-xs text-gray-300 uppercase tracking-[0.5px]">ENTERPRISE</p>
              </div>
            </div>
          </div>

          <nav className="mt-4">
            {sidebarItems.map((item, index) => (
              <div
                key={index}
                className={`flex items-center px-4 py-3 text-lg transition-colors duration-200 cursor-pointer ${
                  item.active 
                    ? 'bg-[#FFB20F] text-white border-r-2 border-[#e6a00e]' 
                    : 'text-white hover:bg-[#7a7b7d]'
                }`}
                onClick={() => {
                  setLocation(item.href);
                }}
              >
                <item.icon className="w-6 h-6 mr-3" />
                <span className="uppercase tracking-[0.5px] font-medium text-sm">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>
      )}
      
      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${shouldUseMobileSidebar ? 'ml-16' : ''}`}>
        {/* Header */}
        <header className="bg-[#6E6F71] border-b border-[#5a5b5d] px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Building2 className="h-6 w-6 text-[#FFB20F]" />
              <div>
                <h1 className="text-xl font-bold text-white uppercase tracking-[0.5px]">MY BRANCHES</h1>
                <p className="text-sm text-gray-300">Manage your company structure</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                <p className="font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-xs">{user.companyName}</p>
              </div>
              <Button
                onClick={logout}
                disabled={isLoggingOut}
                variant="outline"
                size="sm"
                className="border-gray-400 text-gray-300 hover:bg-gray-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          <MyBranches />
        </main>
      </div>
    </div>
  );
}