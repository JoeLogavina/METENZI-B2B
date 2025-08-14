import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Grid,
  FileText,
  CreditCard,
  Settings,
  HelpCircle,
  ShoppingCart,
  Search,
  Filter,
  LogOut,
  User,
  BarChart3,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  Menu,
  X,
  Building2,
} from "lucide-react";
import type { ProductWithStock } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { useDebounce } from "use-debounce";
import AdvancedProductFilters from "@/components/AdvancedProductFilters";
import ProductCard from "@/components/optimized/ProductCard";
import { useDeviceDetection } from "@/hooks/mobile/useDeviceDetection";
import { FrontendSupportManagement } from "@/components/frontend/FrontendSupportManagement";
import UserInstructions from "@/components/UserInstructions";


// EUR-specific shop component with proper tenant isolation
export default function EURShop() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Enforce EUR tenant access (allow admin users to access any tenant)
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      const isB2BUser = user.role === 'b2b_user';
      
      // B2B users can access EUR shop - no redirect needed
      
      // Allow admin users and B2B users to access EUR shop
      // B2B users should be able to access EUR shop regardless of their tenantId
      if (!isAdmin && !isB2BUser) {
        toast({
          title: "Access Denied", 
          description: "You need B2B user access to use the EUR shop.",
          variant: "destructive",
        });
        setLocation('/auth');
        return;
      }
      
      // For non-admin users, allow access but show a notification if they're in wrong tenant
      if (!isAdmin && user.tenantId === 'km') {
        toast({
          title: "Cross-Tenant Access",
          description: "You're accessing EUR shop from KM tenant. Some features may be limited.",
          variant: "default",
        });
      }
    }
  }, [user, isLoading, isAuthenticated, setLocation, toast]);

  const [filters, setFilters] = useState({
    region: "",
    platform: "",
    search: "",
    priceMin: "",
    priceMax: "",
    stockLevel: "",
    dateAdded: "",
    sku: "",
  });

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [isCartHovered, setIsCartHovered] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'shop' | 'support'>('shop');

  // Debounce filters to prevent excessive API calls
  const [debouncedFilters] = useDebounce(filters, 300);

  // Fetch EUR-specific products
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["/api/products", "eur-shop", debouncedFilters],
    queryFn: async () => {

      const params = new URLSearchParams();
      
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const res = await fetch(`/api/products${params.toString() ? `?${params.toString()}` : ''}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Products API failed: ${res.status}`);
      }
      const data = await res.json();
      
      // Ensure we're getting EUR pricing for EUR shop
      return data.map((product: any) => ({
        ...product,
        // Use EUR price as primary price for EUR shop
        displayPrice: product.price,
        currency: 'EUR'
      }));
    },
    enabled: isAuthenticated && user?.tenantId === 'eur',
    retry: 1,
    staleTime: 0,
  });

  // Fetch EUR user's cart
  const {
    data: cartItems = [],
    isLoading: cartLoading,
  } = useQuery({
    queryKey: ["/api/cart", "eur"],
    queryFn: async () => {
      const res = await fetch("/api/cart", {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Cart API failed: ${res.status}`);
      }
      return await res.json();
    },
    enabled: isAuthenticated && user?.tenantId === 'eur',
  });

  // Categories query for filters
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories", {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Categories API failed: ${res.status}`);
      }
      return await res.json();
    },
    enabled: isAuthenticated,
  });

  // Add to cart mutation with EUR-specific handling
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      setAddingProductId(productId);
      
      // Optimistic update for immediate UI feedback
      const product = products.find((p: any) => p.id === productId);
      if (product) {
        const newCartItem = {
          id: `temp-${Date.now()}`,
          productId,
          quantity,
          product: {
            ...product,
            price: product.price // Use EUR price
          }
        };
        
        queryClient.setQueryData(["/api/cart", "eur"], (oldData: any) => [
          ...(oldData || []),
          newCartItem
        ]);
      }

      await apiRequest("POST", "/api/cart", {
        productId,
        quantity,
        tenantId: 'eur' // Ensure EUR cart isolation
      });
    },
    onSuccess: () => {
      setAddingProductId(null);
      toast({
        title: "Added to cart",
        description: "Product added to your EUR cart successfully.",
      });
      
      // Refresh cart data after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/cart", "eur"] });
      }, 50);
    },
    onError: (error: any) => {
      setAddingProductId(null);
      
      // Rollback optimistic update
      queryClient.invalidateQueries({ queryKey: ["/api/cart", "eur"] });
      
      toast({
        title: "Error",
        description: error.message || "Failed to add item to cart.",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = (product: ProductWithStock, quantity: number = 1) => {
    addToCartMutation.mutate({ productId: product.id, quantity });
  };

  const cartItemCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading EUR Shop...</p>
        </div>
      </div>
    );
  }

  // Note: Authentication is handled at route level

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  
  const sidebarItems = [
    { 
      icon: Package, 
      label: "EUR SHOP", 
      active: activeView === 'shop', 
      action: () => setActiveView('shop'), 
      allowed: true 
    },
    { 
      icon: Grid, 
      label: "CATALOG", 
      active: false, 
      action: () => setActiveView('shop'), 
      allowed: true 
    },
    { 
      icon: Building2, 
      label: "MY BRANCHES", 
      active: false, 
      href: "/my-branches", 
      allowed: user?.role === 'b2b_user' 
    },
    { 
      icon: ShoppingCart, 
      label: "MY CART", 
      active: false, 
      href: "/eur/cart", 
      allowed: true 
    },
    { 
      icon: FileText, 
      label: "ORDERS", 
      active: false, 
      href: "/eur/orders", 
      allowed: true 
    },
    { 
      icon: CreditCard, 
      label: "MY WALLET", 
      active: false, 
      href: "/eur/wallet", 
      allowed: true 
    },
    { 
      icon: Settings, 
      label: "SETTINGS", 
      active: false, 
      action: () => setActiveView('shop'), 
      allowed: true 
    },
    { 
      icon: HelpCircle, 
      label: "SUPPORT", 
      active: activeView === 'support', 
      action: () => setActiveView('support'), 
      allowed: true 
    },
    // Admin-only items  
    { 
      icon: Settings, 
      label: "ADMIN PANEL", 
      active: false, 
      href: "/admin-panel", 
      allowed: isAdmin, 
      admin: true 
    },
  ].filter(item => item.allowed);

  const formatEURPrice = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `€${numAmount.toFixed(2)}`;
  };

  // Mobile detection for hamburger menu
  const { isMobile } = useDeviceDetection();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Support notification system - fetch ticket stats for badge count
  const { data: ticketStats } = useQuery({
    queryKey: ["/api/support/tickets/stats"],
    retry: false,
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: isAuthenticated
  });

  // Calculate notification count based on stats API response
  const statsData = (ticketStats as any)?.data;
  const openTickets = parseInt(statsData?.openTickets || '0');
  
  // Get in-progress count from statusBreakdown array
  const statusBreakdown = statsData?.statusBreakdown || [];
  const inProgressCount = statusBreakdown.find((item: any) => item.status === 'in_progress')?.count || '0';
  const inProgressTickets = parseInt(inProgressCount);
  
  const notificationCount = openTickets + inProgressTickets;
  const hasNewNotifications = notificationCount > 0;

  // Keep debug for now to verify functionality
  console.log('✨ Support notifications:', { notificationCount, hasNewNotifications });

  return (
    <div className="min-h-screen bg-[#f5f6f5] flex font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Desktop Sidebar - Show on Desktop */}
      {!isMobile && (
        <div className="w-64 bg-[var(--sidebar-bg)] shadow-sm border-r border-[#ddd] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[rgba(255,255,255,0.1)]">
            <div className="text-white">
              <h1 className="text-xl font-semibold text-center tracking-tight">
                B2B SOFTWARE SHOP (EUR)
              </h1>
              <p className="text-sm text-[#c1c7cd] mt-1 text-center">EUR Currency</p>
              <p className="text-xs text-[#c1c7cd] text-center">Enterprise Solutions</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3">
            <ul className="space-y-1">
              {sidebarItems.map((item, index) => (
                <li key={index}>
                  <button
                    onClick={() => item.action ? item.action() : (item.href && (window.location.href = item.href))}
                    className={`w-full flex items-center px-3 py-2.5 text-sm rounded-md transition-colors duration-200 ${
                      item.active
                        ? 'bg-[#FFB20F] text-black font-semibold'
                        : 'text-white hover:bg-[var(--sidebar-hover)] hover:text-white'
                    } ${item.admin ? 'border-t border-[rgba(255,255,255,0.1)] mt-3 pt-3' : ''}`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium text-sm">{item.label}</span>
                    {/* Support notification badge for desktop */}
                    {item.label === "SUPPORT" && hasNewNotifications && (
                      <span className="ml-auto bg-[#E15554] text-white text-xs rounded-full min-w-[22px] h-6 px-2 flex items-center justify-center font-bold shadow-lg border-2 border-white animate-pulse">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* User section at bottom */}
          <div className="p-3 border-t border-[rgba(255,255,255,0.1)]">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-[#FFB20F] rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-black" />
              </div>
              <div className="ml-3 text-white">
                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-[#c1c7cd]">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              disabled={isLoggingOut}
              className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-[var(--sidebar-hover)] rounded-md transition-colors duration-200"
            >
              <LogOut className="w-4 h-4 mr-3" />
              <span className="text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Hamburger Button */}
      {isMobile && (
        <div className="fixed top-4 left-4 z-40 md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="bg-[var(--sidebar-bg)] text-white p-2 rounded-md shadow-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Menu */}
          <div className="fixed left-0 top-0 h-full w-64 bg-[var(--sidebar-bg)] shadow-xl flex flex-col">
            {/* Header with Close Button */}
            <div className="p-4 border-b border-[rgba(255,255,255,0.1)] flex items-center justify-between">
              <div className="text-white">
                <h1 className="text-lg font-semibold tracking-tight">
                  B2B SOFTWARE SHOP (EUR)
                </h1>
                <p className="text-xs text-[#c1c7cd]">EUR Currency</p>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3">
              <ul className="space-y-1">
                {sidebarItems.map((item, index) => (
                  <li key={index}>
                    <button
                      onClick={() => {
                        if (item.action) {
                          item.action();
                        } else if (item.href) {
                          window.location.href = item.href;
                        }
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center px-3 py-2.5 text-sm rounded-md transition-colors duration-200 ${
                        item.active
                          ? 'bg-[#FFB20F] text-black font-semibold'
                          : 'text-white hover:bg-[var(--sidebar-hover)] hover:text-white'
                      } ${item.admin ? 'border-t border-[rgba(255,255,255,0.1)] mt-3 pt-3' : ''}`}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      <span className="font-medium text-sm">{item.label}</span>
                      {/* Support notification badge for mobile */}
                      {item.label === "SUPPORT" && hasNewNotifications && (
                        <span className="ml-auto bg-[#E15554] text-white text-xs rounded-full min-w-[22px] h-6 px-2 flex items-center justify-center font-bold shadow-lg border-2 border-white animate-pulse">
                          {notificationCount > 99 ? '99+' : notificationCount}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* User section at bottom */}
            <div className="p-3 border-t border-[rgba(255,255,255,0.1)]">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-[#FFB20F] rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-black" />
                </div>
                <div className="ml-3 text-white">
                  <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-[#c1c7cd]">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                disabled={isLoggingOut}
                className="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-[var(--sidebar-hover)] rounded-md transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 mr-3" />
                <span className="text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className={`bg-[#6E6F71] border-b border-[#5a5b5d] px-4 py-3 shadow-[0_2px_5px_rgba(0,0,0,0.1)] ${isMobile ? 'pl-16' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="w-5 h-5 text-white" />
              <div>
                <h1 className="text-xl font-semibold text-white uppercase tracking-[0.5px]">
                  B2B SHOP
                </h1>
                <p className="text-xs text-gray-300">EUR Currency Enterprise Solutions</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                size="sm"
                onClick={logout}
                disabled={isLoggingOut}
                className="relative bg-[#E15554] hover:bg-[#c74443] text-white border-0 px-3 py-2 rounded-[5px] font-medium transition-colors duration-200"
              >
                {isLoggingOut ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
              <div className="relative">
                <Button
                  size="sm"
                  onMouseEnter={() => setIsCartHovered(true)}
                  onMouseLeave={() => setIsCartHovered(false)}
                  onClick={() => setLocation('/eur/cart')}
                  className="relative bg-[#FFB20F] hover:bg-[#e6a00e] text-white border-0 px-4 py-2 rounded-[5px] font-medium transition-colors duration-200"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#E15554] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-mono font-semibold">
                      {cartItemCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Search Bar - Only visible on mobile */}
        {isMobile && (
          <div className="bg-[#6E6F71] px-4 pb-3 border-b border-[#5a5b5d]">
            <div className="relative">
              <input
                type="text"
                placeholder="Keywords, Model #, Item #"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full px-4 py-2.5 pr-10 bg-white border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFB20F] focus:border-[#FFB20F] transition-colors duration-200"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area with Vertical Filters */}
        <div className="flex-1 flex overflow-hidden max-w-full">
          {/* Support View */}
          {activeView === 'support' ? (
            <div className="flex-1 min-w-0">
              <FrontendSupportManagement />
            </div>
          ) : (
            <>
              {/* Advanced Filters Sidebar - Hidden on mobile */}
              <div className={`${isMobile ? 'hidden' : 'w-80'} bg-white border-r border-[#ddd] p-4 overflow-y-auto flex-shrink-0`}>
            <AdvancedProductFilters
              filters={{
                search: filters.search,
                categoryId: "",
                region: filters.region || "all",
                platform: filters.platform || "all",
                priceMin: filters.priceMin,
                priceMax: filters.priceMax,
                stockLevel: filters.stockLevel || "all",
                dateAdded: filters.dateAdded,
                sku: filters.sku,
                priceRange: [0, 1000] as [number, number],
                availability: [] as string[],
                sortBy: "default",
                sortOrder: "asc" as "asc" | "desc"
              }}
              onFiltersChange={(advancedFilters) => {
                setFilters({
                  search: advancedFilters.search,
                  region: advancedFilters.region === "all" ? "" : advancedFilters.region,
                  platform: advancedFilters.platform === "all" ? "" : advancedFilters.platform,
                  priceMin: advancedFilters.priceMin,
                  priceMax: advancedFilters.priceMax,
                  stockLevel: advancedFilters.stockLevel === "all" ? "" : advancedFilters.stockLevel,
                  dateAdded: advancedFilters.dateAdded,
                  sku: advancedFilters.sku,
                });
              }}
              productCount={products.length}
            />
          </div>

          {/* Products Section */}
          <div className="flex-1 p-6 overflow-auto min-w-0 max-w-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Found {products.length} EUR products</h3>
              <div className="text-sm text-gray-500 flex items-center">
                <Package className="w-4 h-4 mr-1" />
                List View
              </div>
            </div>

            {/* Debug Info */}
            <div className="mb-2 p-2 bg-blue-50 text-xs text-blue-700 rounded">
              DEBUG: Screen width: {typeof window !== 'undefined' ? window.innerWidth : 'SSR'}, 
              isMobile: {isMobile ? 'TRUE' : 'FALSE'}
            </div>

            {/* Responsive Product Layout */}
            {isMobile ? (
              /* Mobile Grid Layout - 2 products per row */
              <div className="mobile-grid-2 md:hidden">
                {productsLoading ? (
                  <div className="col-span-2 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-[#FFB20F] mr-2" />
                      Loading EUR products...
                    </div>
                  </div>
                ) : products.length === 0 ? (
                  <div className="col-span-2 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <Package className="h-12 w-12 text-gray-300 mb-2" />
                      <span className="font-semibold">No EUR products found</span>
                      <span className="text-sm">Try adjusting your filters</span>
                    </div>
                  </div>
                ) : (
                  products.map((product: ProductWithStock) => (
                    <MobileProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      isLoading={addingProductId === product.id}
                      isInCart={cartItems.some((item: any) => item.productId === product.id)}
                    />
                  ))
                )}
              </div>
            ) : (
              /* Desktop Table Layout */
              <div className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] overflow-hidden max-w-full">
                <div className="overflow-x-auto max-w-full">
                  <table className="w-full table-fixed min-w-[800px]">
                    <thead className="bg-[#6E6F71] text-white">
                      <tr>
                        <th className="w-[10%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">SKU</th>
                        <th className="w-[8%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">IMAGE</th>
                        <th className="w-[25%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">PRODUCT</th>
                        <th className="w-[10%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">PRICE</th>
                        <th className="w-[10%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">REGION</th>
                        <th className="w-[12%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">PLATFORM</th>
                        <th className="w-[8%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">STOCK</th>
                        <th className="w-[8%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">QUANTITY</th>
                        <th className="w-[9%] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#e5e5e5]">
                      {productsLoading ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-[#FFB20F] mr-2" />
                              Loading EUR products...
                            </div>
                          </td>
                        </tr>
                      ) : products.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center">
                              <Package className="h-12 w-12 text-gray-300 mb-2" />
                              <span className="font-semibold">No EUR products found</span>
                              <span className="text-sm">Try adjusting your filters</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        products.map((product: ProductWithStock) => (
                          <CompactProductRow
                            key={product.id}
                            product={product}
                            onAddToCart={handleAddToCart}
                            isLoading={addingProductId === product.id}
                            isInCart={cartItems.some((item: any) => item.productId === product.id)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile Product Card Component for 2-column grid
function MobileProductCard({ 
  product, 
  onAddToCart, 
  isLoading,
  isInCart 
}: { 
  product: ProductWithStock; 
  onAddToCart: (product: ProductWithStock) => void;
  isLoading: boolean;
  isInCart: boolean;
}) {
  const [quantity, setQuantity] = useState(1);

  const formatEURPrice = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `€${numAmount.toFixed(2)}`;
  };

  return (
    <div className="mobile-product-card">
      {/* Product Image */}
      <div className="mobile-product-image">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name}
            className="w-full h-full object-cover rounded"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        <Package className={`w-4 h-4 text-gray-400 ${product.imageUrl ? 'hidden' : ''}`} />
      </div>

      {/* Product Name */}
      <h3 className="text-xs font-medium text-gray-900 mb-1 line-clamp-2 leading-tight h-8">
        {product.name}
      </h3>
      
      {/* Price */}
      <div className="text-sm font-bold text-[#FFB20F] mb-1">
        {formatEURPrice(product.price)}
      </div>

      {/* Region/Platform - Compact */}
      <div className="text-xs text-gray-500 mb-1">
        {product.region} • {product.platform}
      </div>

      {/* Stock - Compact */}
      <div className="flex items-center justify-center mb-1.5">
        {product.stockCount > 10 ? (
          <span className="text-xs bg-[#4CAF50] text-white px-1.5 py-0.5 rounded">
            {product.stockCount}
          </span>
        ) : product.stockCount > 5 ? (
          <span className="text-xs bg-[#FF9800] text-white px-1.5 py-0.5 rounded">
            {product.stockCount}
          </span>
        ) : product.stockCount > 0 ? (
          <span className="text-xs bg-[#F44336] text-white px-1.5 py-0.5 rounded">
            {product.stockCount}
          </span>
        ) : (
          <span className="text-xs text-gray-500 px-1.5 py-0.5 border rounded">
            Out
          </span>
        )}
      </div>

      {/* Action Button */}
      <Button 
        size="sm"
        onClick={() => onAddToCart(product)}
        disabled={isLoading || product.stockCount === 0 || isInCart}
        className="w-full bg-[#FFB20F] hover:bg-[#e6a00e] text-black font-medium text-xs py-1 h-7"
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isInCart ? (
          "Added"
        ) : (
          "Add to Cart"
        )}
      </Button>
    </div>
  );
}

function CompactProductRow({ 
  product, 
  onAddToCart, 
  isLoading,
  isInCart 
}: { 
  product: ProductWithStock; 
  onAddToCart: (product: ProductWithStock) => void;
  isLoading: boolean;
  isInCart: boolean;
}) {
  const [quantity, setQuantity] = useState(1);

  const formatEURPrice = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `€${numAmount.toFixed(2)}`;
  };

  return (
    <tr className="hover:bg-[#f8f8f8] transition-colors duration-200">
      {/* SKU */}
      <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-mono font-medium text-gray-900">
        {product.sku || product.id.slice(0, 8).toUpperCase()}
      </td>
      
      {/* IMAGE */}
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="w-12 h-12 bg-gray-50 rounded-[5px] flex items-center justify-center mx-auto overflow-hidden border border-gray-200">
          {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover rounded-[3px]"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
              onLoad={() => {
                console.log(`✅ Table image loaded: ${product.imageUrl} for ${product.name}`);
              }}
            />
          ) : null}
          <Package className={`w-6 h-6 text-gray-400 ${product.imageUrl ? 'hidden' : ''}`} />
        </div>
      </td>
      
      {/* PRODUCT */}
      <td className="px-3 py-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {product.name}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {product.description}
            </div>
          </div>
        </div>
      </td>
      
      {/* PRICE */}
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="text-sm font-mono font-semibold text-[#FFB20F]">
          {formatEURPrice(product.price)}
        </div>
        <div className="text-xs text-gray-500">per license</div>
      </td>
      
      {/* REGION */}
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <Badge variant="outline" className="text-xs border-[#ddd] text-gray-700">
          {product.region}
        </Badge>
      </td>
      
      {/* PLATFORM */}
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="flex items-center justify-center">
          <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
            {product.platform}
          </Badge>
        </div>
      </td>
      
      {/* STOCK */}
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="flex items-center justify-center">
          {product.stockCount > 10 ? (
            <Badge variant="default" className="bg-[#4CAF50] text-white text-xs px-2 py-1">
              {product.stockCount}
            </Badge>
          ) : product.stockCount > 5 ? (
            <Badge variant="secondary" className="bg-[#FF9800] text-white text-xs px-2 py-1">
              {product.stockCount}
            </Badge>
          ) : product.stockCount > 0 ? (
            <Badge variant="destructive" className="bg-[#F44336] text-white text-xs px-2 py-1">
              {product.stockCount}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs px-2 py-1 text-gray-500">
              Out
            </Badge>
          )}
        </div>
      </td>
      
      {/* QUANTITY */}
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="flex items-center justify-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="h-6 w-6 p-0 border-[#ddd] hover:bg-[#f0f0f0]"
          >
            -
          </Button>
          <Input
            type="number"
            min="1"
            max={product.stockCount}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 h-6 text-xs text-center border-[#ddd] focus:border-[#FFB20F]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))}
            className="h-6 w-6 p-0 border-[#ddd] hover:bg-[#f0f0f0]"
          >
            +
          </Button>
        </div>
      </td>
      
      {/* ACTION */}
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="flex items-center justify-center space-x-2">
          {/* UserInstructions Button */}
          <UserInstructions 
            product={product} 
            tenantId="eur"
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="border-[#FFB20F] text-[#FFB20F] hover:bg-[#FFB20F] hover:text-white px-3 py-1 rounded-[5px] text-xs font-medium transition-colors duration-200"
              >
                GUIDE
              </Button>
            }
          />
          
          {/* Add to Cart Button */}
          <Button
            size="sm"
            onClick={() => onAddToCart(product)}
            disabled={product.stockCount === 0 || isLoading || isInCart}
            className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white border-0 px-4 py-1 rounded-[5px] text-xs font-medium transition-colors duration-200 disabled:bg-gray-300"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                ADD
              </div>
            ) : isInCart ? (
              'IN CART'
            ) : (
              'ADD'
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}