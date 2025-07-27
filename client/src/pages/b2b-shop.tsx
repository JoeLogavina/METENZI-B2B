import { useEffect, useState } from "react";
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
import { ShoppingCart, Search, Filter, Grid, List, Plus, Minus, Package, User, Settings, BarChart3, FileText, Users, CreditCard, HelpCircle, ChevronDown, Calendar, LogOut, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { type ProductWithStock } from "@shared/schema";

export default function B2BShop() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
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
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isCartHovered, setIsCartHovered] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
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
  if (!isAuthenticated) {
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
  const { data: products = [], isLoading: productsLoading, isFetching: productsIsFetching } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products", debouncedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedFilters.region) params.append('region', debouncedFilters.region);
      if (debouncedFilters.platform) params.append('platform', debouncedFilters.platform);
      if (debouncedFilters.search) params.append('search', debouncedFilters.search);
      if (debouncedFilters.priceMin) params.append('priceMin', debouncedFilters.priceMin);
      if (debouncedFilters.priceMax) params.append('priceMax', debouncedFilters.priceMax);
      
      const res = await fetch(`/api/products?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes fresh data
    gcTime: 30 * 60 * 1000, // 30 minutes cache retention
    refetchOnWindowFocus: false, // Prevent excessive refetches
    retry: 2, // Retry failed requests twice
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });

  // Fetch cart items with enterprise caching strategy
  const { data: cartItems = [], isLoading: cartLoading } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes fresh data (cart changes frequently)
    gcTime: 10 * 60 * 1000, // 10 minutes cache retention
    refetchOnWindowFocus: false, // Don't refetch when user returns to tab
    refetchOnReconnect: true, // Refetch when connection restored
    retry: 2, // Retry failed requests twice
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });

  // Track which product is currently being added to cart
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  // Enterprise-grade optimistic updates with instant UI response
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId, quantity: number }) => {
      // Don't set loading state here - let optimistic update handle UX
      const response = await apiRequest("POST", "/api/cart", { productId, quantity });
      return response.json();
    },
    onMutate: async ({ productId, quantity }) => {
      // Instant UI response - set loading state immediately
      setAddingProductId(productId);
      
      // Cancel any outgoing cart queries to prevent overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      
      // Snapshot the previous value
      const previousCart = queryClient.getQueryData(["/api/cart"]);
      
      // Find product details for optimistic update
      const product = products.find(p => p.id === productId);
      
      if (product) {
        // Optimistically update cart immediately
        queryClient.setQueryData(["/api/cart"], (old: any[]) => {
          const existingItem = old?.find(item => item.productId === productId);
          if (existingItem) {
            // Update quantity if item exists
            return old.map(item => 
              item.productId === productId 
                ? { ...item, quantity: item.quantity + quantity }
                : item
            );
          } else {
            // Add new item with optimistic data
            return [...(old || []), {
              id: `optimistic-${productId}-${Date.now()}`,
              productId,
              quantity,
              product,
              userId: user?.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }];
          }
        });
        
        // Show success toast immediately for better UX
        toast({
          title: "Added to Cart",
          description: `${product.name} added successfully`,
        });
        
        // Clear loading state after optimistic update (faster UX)
        setTimeout(() => setAddingProductId(null), 200);
      }
      
      return { previousCart, productId, quantity, product };
    },
    onSuccess: (serverResponse, variables, context) => {
      // Replace optimistic data with server response
      queryClient.setQueryData(["/api/cart"], (old: any[]) => {
        if (!old) return [serverResponse];
        
        // Replace optimistic item with server response
        const optimisticId = `optimistic-${variables.productId}-`;
        return old.map(item => 
          item.id.startsWith(optimisticId) ? serverResponse : item
        );
      });
    },
    onError: (error, variables, context) => {
      // Clear loading state
      setAddingProductId(null);
      
      // Rollback the optimistic update on error
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      
      // Show error notification (overrides success toast)
      toast({
        title: "Error",
        description: context?.product ? 
          `Failed to add ${context.product.name} to cart. Please try again.` :
          "Failed to add item to cart. Please try again.",
        variant: "destructive",
      });
      
      if (isUnauthorizedError(error)) {
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
    },
    onSettled: () => {
      // Always clear loading state and sync with server
      setAddingProductId(null);
      // Gentle background sync without disrupting UX
      queryClient.invalidateQueries({ 
        queryKey: ["/api/cart"],
        refetchType: 'none', // Don't trigger immediate refetch
      });
    },
  });

  const handleAddToCart = (product: ProductWithStock, quantity: number) => {
    addToCartMutation.mutate({ productId: product.id, quantity });
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
    { icon: Package, label: "B2B SHOP", active: true, href: "/", allowed: true },
    { icon: Grid, label: "CATALOG", active: false, href: "/catalog", allowed: true },
    { icon: Users, label: "CLIENTS", active: false, href: "/clients", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: FileText, label: "ORDERS", active: false, href: "/orders", allowed: true },
    { icon: CreditCard, label: "MY WALLET", active: false, href: "/wallet", allowed: true },
    { icon: BarChart3, label: "REPORTS", active: false, href: "/reports", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: CreditCard, label: "INVOICES", active: false, href: "/invoices", allowed: user?.role === 'admin' || user?.role === 'super_admin' },

    { icon: Settings, label: "SETTINGS", active: false, href: "/settings", allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/support", allowed: true },
  ].filter(item => item.allowed);

  return (
    <div className="min-h-screen bg-[#f5f6f5] flex font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Sidebar */}
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
                // Navigation tracking removed for production
                setLocation(item.href);
              }}
            >
              <item.icon className="w-6 h-6 mr-3" />
              <span className="uppercase tracking-[0.5px] font-medium text-sm">{item.label}</span>
            </div>
          ))}
        </nav>
      </div>
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-[#6E6F71] border-b border-[#5a5b5d] px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Package className="w-6 h-6 text-white" />
              <div>
                <h1 className="text-2xl font-semibold text-white uppercase tracking-[0.5px]">B2B SOFTWARE SHOP</h1>
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
                                <p className="text-xs text-gray-500">€{item.product?.price} × {item.quantity}</p>
                              </div>
                              <div className="text-sm font-mono font-semibold text-[#FFB20F]">
                                €{(item.product?.price * item.quantity).toFixed(2)}
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
                            €{cartItems.reduce((sum: number, item: any) => sum + (item.product?.price * item.quantity), 0).toFixed(2)}
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

        {/* Top Search Bar */}
        <div className="bg-[#f8f8f8] border-b border-[#ddd] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 border-[#ddd] rounded-[5px] focus:border-[#FFB20F] transition-colors duration-200"
                />
                {/* Subtle performance indicator */}
                {productsIsFetching && filters.search && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FFB20F] border-t-transparent"></div>
                  </div>
                )}
              </div>
              <Select value={filters.region || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, region: value === 'all' ? '' : value }))}>
                <SelectTrigger className="w-32 border-[#ddd] rounded-[5px] focus:border-[#FFB20F]">
                  <SelectValue placeholder="Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="Global">Global</SelectItem>
                  <SelectItem value="EU">EU</SelectItem>
                  <SelectItem value="US">US</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.platform || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value === 'all' ? '' : value }))}>
                <SelectTrigger className="w-32 border-[#ddd] rounded-[5px] focus:border-[#FFB20F]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="Windows">Windows</SelectItem>
                  <SelectItem value="macOS">macOS</SelectItem>
                  <SelectItem value="Linux">Linux</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
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

        {/* Main Content Area with Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Advanced Filters Sidebar */}
          <div className="w-80 bg-white border-r border-[#ddd] p-4 overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center mb-3">
                <ChevronDown className="w-4 h-4 mr-2 text-gray-600" />
                <h3 className="font-semibold text-sm uppercase tracking-[0.5px] text-[#6E6F71]">Advanced Filters</h3>
              </div>
            </div>

            {/* Price Filter */}
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <span className="w-3 h-3 mr-2">€</span>
                <label className="text-sm font-semibold text-gray-700">Price (BAM)</label>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="From"
                  value={filters.priceMin}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                  className="text-sm border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                />
                <Input
                  placeholder="To"
                  value={filters.priceMax}
                  onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                  className="text-sm border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                />
              </div>
            </div>

            {/* Stock Level Filter */}
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <Package className="w-3 h-3 mr-2 text-gray-600" />
                <label className="text-sm font-semibold text-gray-700">Stock Level</label>
              </div>
              <Select value={filters.stockLevel || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, stockLevel: value === 'all' ? '' : value }))}>
                <SelectTrigger className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]">
                  <SelectValue placeholder="All stock levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stock levels</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="medium">Medium Stock</SelectItem>
                  <SelectItem value="high">High Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Added Filter */}
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <Calendar className="w-3 h-3 mr-2 text-gray-600" />
                <label className="text-sm font-semibold text-gray-700">Date Added</label>
              </div>
              <Select value={filters.dateAdded || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, dateAdded: value === 'all' ? '' : value }))}>
                <SelectTrigger className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search SKU Filter */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-700 block mb-2">Search SKU</label>
              <Input
                placeholder="Enter SKU..."
                value={filters.sku}
                onChange={(e) => setFilters(prev => ({ ...prev, sku: e.target.value }))}
                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
              />
            </div>

            {/* Filter Actions */}
            <div className="space-y-2">
              <Button
                onClick={() => setFilters({
                  region: "", platform: "", search: "", priceMin: "", priceMax: "",
                  stockLevel: "", dateAdded: "", sku: ""
                })}
                className="w-full bg-transparent text-[#4D9DE0] border border-[#4D9DE0] hover:bg-[#4D9DE0] hover:text-white rounded-[5px] font-medium transition-colors duration-200"
              >
                Clear filters
              </Button>
              <Button 
                className="w-full bg-[#4D9DE0] hover:bg-[#3ba3e8] text-white border-0 rounded-[5px] font-medium transition-colors duration-200"
              >
                Apply Filters
              </Button>
            </div>
          </div>

          {/* Products Section */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Found {products.length} products</h3>
              <div className="text-sm text-gray-500 flex items-center">
                <List className="w-4 h-4 mr-1" />
                List View
              </div>
            </div>

            {/* Product Table */}
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
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          No products found
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <ProductRow
                          key={product.id}
                          product={product}
                          onAddToCart={(quantity) => addToCartMutation.mutate({ productId: product.id, quantity })}
                          isLoading={addingProductId === product.id}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product, onAddToCart, isLoading }: { 
  product: ProductWithStock; 
  onAddToCart: (quantity: number) => void;
  isLoading: boolean;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <tr className="hover:bg-[#f8f8f8] transition-colors duration-200">
      <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-mono font-medium text-gray-900">
        {product.sku || product.id.slice(0, 8).toUpperCase()}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="w-10 h-10 bg-gray-200 rounded-[5px] flex items-center justify-center mx-auto">
          <Package className="w-6 h-6 text-gray-400" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="text-sm font-semibold text-gray-900">{product.name}</div>
        <div className="text-sm text-gray-500">{product.description}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="text-sm font-mono font-semibold text-[#FFB20F]">€{product.price}</div>
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
