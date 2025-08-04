import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Filter, Grid, List, Plus, Minus, Package, User, Settings, BarChart3, FileText, Users, CreditCard, HelpCircle, ChevronDown, Calendar, LogOut, Loader2, Eye, Building, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { type ProductWithStock } from "@shared/schema";
import { useTenant } from '@/contexts/TenantContext';
import { formatPrice } from '@/utils/price-utils';

// TIER 1 ENTERPRISE OPTIMIZATION: Optimized Components with Memoization
import ProductCard from "@/components/optimized/ProductCard";
import ProductFilters from "@/components/optimized/ProductFilters";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import AdvancedProductFilters from "@/components/AdvancedProductFilters";

// Mobile Components
import { useDeviceDetection } from "@/hooks/mobile/useDeviceDetection";
import { MobileB2BShop } from "@/components/mobile/MobileB2BShop";
import { MobileSidebar } from "@/components/mobile/MobileSidebar";
import { testDeviceDetection } from "@/utils/deviceTest";
import { MobileDebugPanel } from "@/components/debug/MobileDebugPanel";
import { MyBranches } from "@/components/b2b/MyBranches";

export default function B2BShop() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { tenant, formatPrice: tenantFormatPrice } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { isMobile } = useDeviceDetection();

  const [filters, setFilters] = useState({
    search: "",
    categoryId: "",
    region: "",
    platform: "",
    priceMin: "",
    priceMax: "",
    stockLevel: "",
    dateAdded: "",
    sku: "",
    priceRange: [0, 1000] as [number, number],
    availability: [] as string[],
    sortBy: "",
    sortOrder: "asc" as "asc" | "desc"
  });
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isCartHovered, setIsCartHovered] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Navigation state for integrated sections
  const [currentSection, setCurrentSection] = useState<'products' | 'orders' | 'wallet'>('products');
  
  // Branch management integration state
  const [showBranchManager, setShowBranchManager] = useState(false);

  // Product modal state
  const [selectedProduct, setSelectedProduct] = useState<ProductWithStock | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debounce filters to prevent excessive API calls during typing
  const [debouncedFilters] = useDebounce(filters, 300);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFB20F] mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isLoading && !isAuthenticated) {
    toast({
      title: "Authentication Required",
      description: "Please log in to access the B2B portal",
      variant: "destructive",
    });
    window.location.href = "/auth";
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFB20F] mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Fetch products with enterprise-grade performance optimization
  const { data: products = [], isLoading: productsLoading, isFetching: productsIsFetching, error: productsError } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products", debouncedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Basic filters
      if (debouncedFilters.search) params.append('search', debouncedFilters.search);
      if (debouncedFilters.sku) params.append('sku', debouncedFilters.sku);
      if (debouncedFilters.categoryId) params.append('categoryId', debouncedFilters.categoryId);
      
      // Location filters
      if (debouncedFilters.region) params.append('region', debouncedFilters.region);
      if (debouncedFilters.platform) params.append('platform', debouncedFilters.platform);
      
      // Price filters
      if (debouncedFilters.priceMin) params.append('priceMin', debouncedFilters.priceMin);
      if (debouncedFilters.priceMax) params.append('priceMax', debouncedFilters.priceMax);
      
      // Availability filters
      if (debouncedFilters.stockLevel) params.append('stockLevel', debouncedFilters.stockLevel);
      if (debouncedFilters.dateAdded) params.append('dateAdded', debouncedFilters.dateAdded);
      if (debouncedFilters.availability && debouncedFilters.availability.length > 0) {
        params.append('availability', debouncedFilters.availability.join(','));
      }
      
      // Sorting
      if (debouncedFilters.sortBy) params.append('sortBy', debouncedFilters.sortBy);
      if (debouncedFilters.sortOrder) params.append('sortOrder', debouncedFilters.sortOrder);



      const res = await fetch(`/api/products?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });



      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication required');
        }

        // Try to get error message from response
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await res.json();
            throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
          } catch (jsonError) {
            throw new Error(`${res.status}: ${res.statusText}`);
          }
        } else {
          // Server returned HTML error page
          const errorText = await res.text();

          throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await res.json();

      return data;
    },
    enabled: isAuthenticated && !isLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh data
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    refetchOnWindowFocus: false, // Prevent excessive refetches
    retry: (failureCount, error) => {
      if (error?.message?.includes('Authentication required')) {
        return false;
      }
      return failureCount < 2;
    },
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });

  // Fetch cart items with optimized caching for instant updates
  const { data: cartItems = [], isLoading: cartLoading } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds fresh data (allow optimistic updates to work)
    gcTime: 5 * 60 * 1000, // 5 minutes cache retention
    refetchOnWindowFocus: false, // Don't refetch when user returns to tab
    refetchOnReconnect: true, // Refetch when connection restored
    retry: 1, // Reduce retries for faster failure handling
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });

  // Track which product is currently being added to cart
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  // Optimized cart mutation with instant UI feedback  
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string, quantity: number }) => {
      const response = await apiRequest("POST", "/api/cart", { productId, quantity });
      return response.json();
    },
    onMutate: async (variables) => {
      // Set loading state for UI feedback
      setAddingProductId(variables.productId);
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      
      // Snapshot previous cart data
      const previousCart = queryClient.getQueryData(["/api/cart"]);
      
      // Find the product being added
      const product = products.find(p => p.id === variables.productId);
      
      if (product && Array.isArray(previousCart)) {
        // Create optimistic cart item
        const optimisticItem = {
          id: `temp-${Date.now()}-${variables.productId}`,
          userId: user?.id,
          productId: variables.productId,
          quantity: variables.quantity,
          createdAt: new Date().toISOString(),
          product: product
        };
        
        // Check if item already exists
        const existingItemIndex = previousCart.findIndex(
          (item: any) => item.productId === variables.productId
        );
        
        let optimisticCart;
        if (existingItemIndex >= 0) {
          // Update existing item quantity
          optimisticCart = [...previousCart];
          optimisticCart[existingItemIndex] = {
            ...optimisticCart[existingItemIndex],
            quantity: optimisticCart[existingItemIndex].quantity + variables.quantity
          };
        } else {
          // Add new item
          optimisticCart = [...previousCart, optimisticItem];
        }
        
        // Immediately update cart UI
        queryClient.setQueryData(["/api/cart"], optimisticCart);
        
        // Show instant success toast
        toast({
          title: "Added to Cart",
          description: `${product.name} added successfully`,
        });
      }
      
      return { previousCart };
    },
    onSuccess: (serverResponse, variables) => {
      // Clear loading state
      setAddingProductId(null);
      
      // Silently sync with server in background (don't block UI)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      }, 50);
    },
    onError: (error, variables, context) => {
      // Clear loading state
      setAddingProductId(null);
      
      // Rollback optimistic update
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }

      // Find product for error message
      const product = products.find(p => p.id === variables.productId);

      toast({
        title: "Error",
        description: product ? 
          `Failed to add ${product.name} to cart. Please try again.` :
          "Failed to add item to cart. Please try again.",
        variant: "destructive",
      });

      if (isUnauthorizedError(error)) {
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
    },
  });

  const handleAddToCart = (product: ProductWithStock, quantity: number) => {
    addToCartMutation.mutate({ productId: product.id, quantity });
  };

  // Modal handlers
  const handleProductClick = (product: ProductWithStock) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const cartItemCount = cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const sidebarItems = [
    { icon: Package, label: "PRODUCTS", active: currentSection === 'products', section: 'products' as const, href: "", allowed: true },
    { icon: FileText, label: "ORDERS", active: currentSection === 'orders', section: 'orders' as const, href: "", allowed: true },
    { icon: CreditCard, label: "MY WALLET", active: currentSection === 'wallet', section: 'wallet' as const, href: "", allowed: true },
    { icon: Users, label: "CLIENTS", active: false, href: "/clients", section: null, allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: BarChart3, label: "REPORTS", active: false, href: "/reports", section: null, allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: Settings, label: "SETTINGS", active: false, href: "/settings", section: null, allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/support", section: null, allowed: true },
  ].filter(item => item.allowed);

  // Mobile-responsive layout with collapsible sidebar
  const deviceTest = typeof window !== 'undefined' ? testDeviceDetection() : null;
  
  console.log('🔍 B2B Shop render check:', { 
    isMobile, 
    deviceTest,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'SSR',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR'
  });

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
                if (item.section) {
                  setCurrentSection(item.section);
                } else if (item.href) {
                  setLocation(item.href);
                }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Package className="w-6 h-6 text-white" />
              <div>
                <h1 className="text-2xl font-semibold text-white uppercase tracking-[0.5px]">
                  B2B SOFTWARE SHOP ({tenant.currency})
                </h1>
                <p className="text-sm text-gray-300">Enterprise Software Solutions</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {(user?.role === 'admin' || user?.role === 'super_admin') && (
                <Button
                  size="sm"
                  onClick={() => window.location.href = "/admin"}
                  className="bg-[#4D9DE0] hover:bg-[#4a94d1] text-white border-0 px-4 py-2 rounded-[5px] font-medium transition-colors duration-200 flex items-center"
                >
                  <User className="w-4 h-4 mr-1" />
                  <span className="font-medium capitalize">{user?.role?.replace('_', ' ')}</span>
                </Button>
              )}
              <div className="text-sm text-white flex items-center">
                <Package className="w-4 h-4 mr-1" />
                <span className="font-mono font-medium">{products.length}</span> available
              </div>
              <Button
                size="sm"
                onClick={logout}
                disabled={isLoggingOut}
                className="relative bg-[#E15554] hover:bg-[#c74443] text-white border-0 px-4 py-2 rounded-[5px] font-medium transition-colors duration-200"
              >
                {isLoggingOut ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
              <div className="relative">
                <Link href="/cart">
                  <Button
                    size="sm"
                    onMouseEnter={() => setIsCartHovered(true)}
                    onMouseLeave={() => setIsCartHovered(false)}
                    className="relative bg-[#FFB20F] hover:bg-[#e6a00e] text-white border-0 px-5 py-2 rounded-[5px] font-medium transition-colors duration-200"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {cartItemCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#E15554] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-mono font-semibold">
                        {cartItemCount}
                      </span>
                    )}
                  </Button>
                </Link>

                {/* Cart Hover Preview */}
                {isCartHovered && (
                  <div 
                    className="absolute right-0 top-12 w-80 bg-white rounded-[8px] shadow-[0_8px_25px_rgba(0,0,0,0.15)] border border-[#ddd] z-50"
                    onMouseEnter={() => setIsCartHovered(true)}
                    onMouseLeave={() => setIsCartHovered(false)}
                  >
                    <div className="p-4 border-b border-[#e5e5e5]">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.5px] text-[#6E6F71]">Shopping Cart Preview</h3>
                    </div>
                    <div className="p-4 max-h-60 overflow-y-auto">
                      {cartItems.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Your cart is empty</p>
                      ) : (
                        <div className="space-y-3">
                          {cartItems.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-[#6E6F71] truncate">{item.product?.name}</p>
                                <p className="text-xs text-gray-500">
                                  {tenantFormatPrice(tenant.currency === 'KM' ? (item.product?.priceKm || item.product?.price) : item.product?.price)} × {item.quantity}
                                </p>
                              </div>
                              <div className="text-sm font-mono font-semibold text-[#FFB20F]">
                                {tenantFormatPrice((tenant.currency === 'KM' ? (item.product?.priceKm || item.product?.price) : item.product?.price) * item.quantity)}
                              </div>
                            </div>
                          ))}
                          {cartItems.length > 3 && (
                            <p className="text-xs text-gray-500 text-center">
                              +{cartItems.length - 3} more items
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {cartItems.length > 0 && (
                      <div className="p-4 border-t border-[#e5e5e5]">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-semibold text-[#6E6F71]">Total:</span>
                          <span className="font-mono font-semibold text-[#FFB20F]">
                            {tenantFormatPrice(cartItems.reduce((sum: number, item: any) => {
                              const price = tenant.currency === 'KM' ? (item.product?.priceKm || item.product?.price) : item.product?.price;
                              return sum + (price * item.quantity);
                            }, 0))}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          Click cart icon to view full cart
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Based on Current Section */}
        {currentSection === 'products' && (
          <>
            {/* View Mode Toggle Bar */}
            <div className="bg-[#f8f8f8] border-b border-[#ddd] p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Use the filter panel on the left to refine your product search
                </div>
                <div className="flex items-center space-x-2">
                  <Select value={viewMode} onValueChange={(value: 'table' | 'grid') => setViewMode(value)}>
                    <SelectTrigger className="w-32 border-[#ddd] rounded-[5px] focus:border-[#FFB20F]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">List View</SelectItem>
                      <SelectItem value="grid">Grid View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Main Content Area with Advanced Filters */}
            <div className="flex-1 flex overflow-hidden">
          {/* Advanced Filters Sidebar */}
          <div className="w-80 bg-white border-r border-[#ddd] p-4 overflow-y-auto">
            <AdvancedProductFilters
              filters={filters}
              onFiltersChange={setFilters}
              productCount={products.length}
            />
          </div>

          {/* Products Section */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Found {products.length} products</h3>
              <div className="flex items-center space-x-3">
                {/* Branch Management Button for B2B Users */}
                {user?.role === 'b2b_user' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBranchManager(!showBranchManager)}
                    className="border-[#FFB20F] text-[#FFB20F] hover:bg-[#FFB20F] hover:text-white transition-colors"
                  >
                    <Building className="w-4 h-4 mr-2" />
                    {showBranchManager ? 'Hide Branches' : 'Manage Branches'}
                  </Button>
                )}
                <div className="text-sm text-gray-500 flex items-center">
                  {viewMode === 'table' ? (
                    <>
                      <List className="w-4 h-4 mr-1" />
                      List View
                    </>
                  ) : (
                    <>
                      <Grid className="w-4 h-4 mr-1" />
                      Grid View
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Branch Management Panel */}
            {showBranchManager && user?.role === 'b2b_user' && (
              <div className="mb-6 bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#6E6F71]">Branch Management</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBranchManager(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <MyBranches />
              </div>
            )}

            {/* Render different views based on viewMode */}
            {viewMode === 'table' ? (
              /* Product Table */
              <div className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-[#6E6F71] text-white">
                      <tr>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">SKU</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">IMAGE</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">PRODUCT</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">PRICE</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">REGION</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">PLATFORM</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">STOCK</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">QUANTITY</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[#e5e5e5]">
                      {productsLoading ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            Loading products...
                          </td>
                        </tr>
                      ) : productsError ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-red-500">
                            Error loading products: {productsError.message}
                            <br />
                            <small>User authenticated: {isAuthenticated ? 'Yes' : 'No'}</small>
                          </td>
                        </tr>
                      ) : products.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                            No products found
                            <br />
                            <small>User authenticated: {isAuthenticated ? 'Yes' : 'No'}</small>
                          </td>
                        </tr>
                      ) : (
                        products.map((product) => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            onAddToCart={(quantity) => addToCartMutation.mutate({ productId: product.id, quantity })}
                            onProductClick={() => handleProductClick(product)}
                            isLoading={addingProductId === product.id}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Product Grid */
              <div className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] p-6">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#FFB20F]" />
                    <span className="ml-2 text-gray-500">Loading products...</span>
                  </div>
                ) : productsError ? (
                  <div className="text-center py-12">
                    <div className="text-red-500 mb-2">Error loading products: {productsError.message}</div>
                    <small className="text-gray-500">User authenticated: {isAuthenticated ? 'Yes' : 'No'}</small>
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500 mb-2">No products found</div>
                    <small className="text-gray-500">User authenticated: {isAuthenticated ? 'Yes' : 'No'}</small>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map((product) => (
                      <div key={product.id} onClick={() => handleProductClick(product)} className="cursor-pointer">
                        <ProductCard
                          product={product}
                          isInCart={cartItems.some(item => item.productId === product.id)}
                          onAddToCart={(productId) => addToCartMutation.mutate({ productId, quantity: 1 })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
          </>
        )}




        {/* Orders Section */}
        {currentSection === 'orders' && (
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] p-6">
                <h2 className="text-xl font-semibold text-[#6E6F71] mb-4">My Orders</h2>
                <p className="text-gray-600">Orders section coming soon...</p>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Section */}
        {currentSection === 'wallet' && (
          <div className="flex-1 overflow-auto">
            <div className="p-6">
              <div className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] p-6">
                <h2 className="text-xl font-semibold text-[#6E6F71] mb-4">My Wallet</h2>
                <p className="text-gray-600">Wallet section coming soon...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAddToCart={handleAddToCart}
        isInCart={cartItems.some(item => item.productId === selectedProduct?.id)}
        isLoading={addingProductId === selectedProduct?.id}
      />
      
      {/* Mobile Debug Panel - Temporary for testing */}
      <MobileDebugPanel />
    </div>
  );
}

function ProductRow({ product, onAddToCart, onProductClick, isLoading }: { 
  product: ProductWithStock; 
  onAddToCart: (quantity: number) => void;
  onProductClick: () => void;
  isLoading: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const { tenant, formatPrice: tenantFormatPrice } = useTenant();

  return (
    <tr className="hover:bg-[#f8f8f8] transition-colors duration-200">
      <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-mono font-medium text-gray-900">
        {product.sku || product.id.slice(0, 8).toUpperCase()}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-[5px] flex items-center justify-center mx-auto overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-gray-200" onClick={onProductClick}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover rounded-[5px]"
              onLoad={() => {
                console.log(`✅ Table image loaded: ${product.imageUrl} for ${product.name}`);
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                console.error(`❌ Table image failed: ${product.imageUrl} for ${product.name}`);
                console.error('Trying alternative image path...');
                // Hide the failed image
                target.style.display = 'none';
                // Show fallback icon
                const container = target.parentElement!;
                container.innerHTML = '<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
              }}
            />
          ) : (
            <Package className="w-6 h-6 text-gray-400" />
          )}
        </div>
      </td>
      <td className="px-3 py-3 cursor-pointer hover:bg-blue-50" onClick={onProductClick}>
        <div className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center">
          {product.name}
          <Eye className="w-3 h-3 ml-1 opacity-60" />
        </div>
        <div className="text-sm text-gray-500">{product.description}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="text-sm font-mono font-semibold text-[#FFB20F]">
          {tenantFormatPrice(tenant.currency === 'KM' ? (product.priceKm || product.price) : product.price)}
        </div>
        <div className="text-xs text-gray-500">per license</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <Badge variant="outline" className="text-xs border-[#ddd] text-gray-700">
          {product.region}
        </Badge>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="flex items-center justify-center flex-wrap gap-1">
          {product.platform?.includes('Windows') && (
            <span className="text-xs bg-[#4D9DE0] text-white px-2 py-1 rounded-[5px] font-medium">Windows</span>
          )}
          {product.platform?.includes('Mac') && (
            <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded-[5px] font-medium">Mac</span>
          )}
          {product.platform?.includes('Linux') && (
            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-[5px] font-medium">Linux</span>
          )}
          {product.platform?.includes('Web') && (
            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-[5px] font-medium">Web</span>
          )}
          {!product.platform?.includes('Windows') && !product.platform?.includes('Mac') && !product.platform?.includes('Linux') && !product.platform?.includes('Web') && (
            <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded-[5px] font-medium">{product.platform || 'Unknown'}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="text-sm font-mono font-semibold text-gray-900">
          {product.stockCount || 0}
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-8 h-8 p-0 border-[#ddd] rounded-[5px] hover:bg-[#f8f8f8] transition-colors duration-200"
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="w-8 text-center text-sm font-mono font-semibold">{quantity}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(quantity + 1)}
            className="w-8 h-8 p-0 border-[#ddd] rounded-[5px] hover:bg-[#f8f8f8] transition-colors duration-200"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <Button
          size="sm"
          onClick={() => onAddToCart(quantity)}
          disabled={isLoading || product.stockCount === 0}
          className="bg-[#FFB20F] hover:bg-[#E69B00] text-white border-0 px-4 py-2 rounded-[5px] font-semibold uppercase tracking-[0.5px] transition-colors duration-200 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="flex items-center">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Adding...
            </div>
          ) : product.stockCount === 0 ? "OUT OF STOCK" : "ADD"}
        </Button>
      </td>
    </tr>
  );
}

