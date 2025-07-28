import { useEffect, useState, useMemo, Suspense } from "react";
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
  Eye,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import ProductCard from "@/components/optimized/ProductCard";
import type { ProductWithStock } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { useDebounce } from "use-debounce";

// KM-specific shop component with proper tenant isolation
export default function KMShop() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Simple authentication check without tenant enforcement (causes redirect loops)
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setLocation('/auth');
    }
  }, [isLoading, isAuthenticated, setLocation]);

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
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  // Debounce filters to prevent excessive API calls
  const [debouncedFilters] = useDebounce(filters, 300);

  // Fetch KM-specific products
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["/api/products", "km", debouncedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value && value !== "all") {
          params.append(key, value);
        }
      });

      const res = await apiRequest("GET", `/api/products?${params.toString()}`);
      const data = await res.json();
      
      // Filter and transform for KM pricing
      return data
        .filter((product: any) => product.priceKm && product.priceKm > 0) // Only products with KM pricing
        .map((product: any) => ({
          ...product,
          price: parseFloat(product.priceKm), // Use KM price as primary price
          displayPrice: parseFloat(product.priceKm),
          currency: 'KM'
        }));
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch KM user's cart
  const {
    data: cartItems = [],
    isLoading: cartLoading,
  } = useQuery({
    queryKey: ["/api/cart"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/cart");
      return await res.json();
    },
    enabled: isAuthenticated,
  });

  // Categories query for filters
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/categories");
      return await res.json();
    },
    enabled: isAuthenticated,
  });

  // Add to cart mutation with KM-specific handling
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
            price: product.priceKm || product.price // Use KM price
          }
        };
        
        queryClient.setQueryData(["/api/cart", "km"], (oldData: any) => [
          ...(oldData || []),
          newCartItem
        ]);
      }

      await apiRequest("POST", "/api/cart", {
        productId,
        quantity,
        tenantId: 'km' // Ensure KM cart isolation
      });
    },
    onSuccess: () => {
      setAddingProductId(null);
      toast({
        title: "Added to cart",
        description: "Product added to your KM cart successfully.",
      });
      
      // Refresh cart data after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/cart", "km"] });
      }, 50);
    },
    onError: (error: any) => {
      setAddingProductId(null);
      
      // Rollback optimistic update
      queryClient.invalidateQueries({ queryKey: ["/api/cart", "km"] });
      
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
          <p className="mt-2 text-gray-600">Loading KM Shop...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.tenantId !== 'km') {
    return null;
  }

  const sidebarItems = [
    { icon: Package, label: "KM SHOP", active: true, href: "/shop/km", allowed: true },
    { icon: Grid, label: "CATALOG", active: false, href: "/shop/km", allowed: true },
    { icon: FileText, label: "ORDERS", active: false, href: "/km/orders", allowed: true },
    { icon: CreditCard, label: "MY WALLET", active: false, href: "/km/wallet", allowed: true },
    { icon: Settings, label: "SETTINGS", active: false, href: "/shop/km", allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/shop/km", allowed: true },
  ].filter(item => item.allowed);

  const formatKMPrice = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${numAmount.toFixed(2)} KM`;
  };

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
              <h2 className="font-semibold text-sm uppercase tracking-[0.5px]">KM PORTAL</h2>
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
              onClick={() => setLocation(item.href)}
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
                <h1 className="text-2xl font-semibold text-white uppercase tracking-[0.5px]">
                  B2B SOFTWARE SHOP (KM)
                </h1>
                <p className="text-sm text-gray-300">KM Currency Enterprise Solutions</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
                <Button
                  size="sm"
                  onMouseEnter={() => setIsCartHovered(true)}
                  onMouseLeave={() => setIsCartHovered(false)}
                  onClick={() => setLocation('/cart')}
                  className="relative bg-[#FFB20F] hover:bg-[#e6a00e] text-white border-0 px-5 py-2 rounded-[5px] font-medium transition-colors duration-200"
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

        {/* Content */}
        <div className="flex-1 p-6">
          {/* Filters */}
          <div className="bg-white rounded-[8px] shadow-[0_2px_10px_rgba(0,0,0,0.1)] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#6E6F71]">Product Filters</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center"
              >
                <Filter className="w-4 h-4 mr-2" />
                Advanced Filters
                {showAdvancedFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search products..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
              
              <Select 
                value={filters.region} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, region: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="Worldwide">Worldwide</SelectItem>
                  <SelectItem value="Europe">Europe</SelectItem>
                  <SelectItem value="US">US</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.platform} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Platforms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="Windows">Windows</SelectItem>
                  <SelectItem value="Mac">Mac</SelectItem>
                  <SelectItem value="Linux">Linux</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showAdvancedFilters && (
              <>
                <Separator className="my-4" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input
                    placeholder="Min Price (KM)"
                    value={filters.priceMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                    type="number"
                  />
                  <Input
                    placeholder="Max Price (KM)"
                    value={filters.priceMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                    type="number"
                  />
                  <Select 
                    value={filters.stockLevel} 
                    onValueChange={(value) => setFilters(prev => ({ ...prev, stockLevel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Stock Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stock Levels</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="low_stock">Low Stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Search SKU"
                    value={filters.sku}
                    onChange={(e) => setFilters(prev => ({ ...prev, sku: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          {/* Products Grid */}
          <div className="bg-white rounded-[8px] shadow-[0_2px_10px_rgba(0,0,0,0.1)] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#6E6F71]">
                KM Products ({products.length})
              </h2>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">KM Currency</Badge>
              </div>
            </div>

            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#FFB20F]" />
                <span className="ml-2 text-gray-600">Loading KM products...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No KM products found</h3>
                <p className="text-gray-500">Try adjusting your filters to see more products.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product: ProductWithStock) => (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{product.name}</h3>
                      <Badge variant={product.stockCount > 0 ? "default" : "destructive"} className="text-xs">
                        {product.stockCount > 0 ? `${product.stockCount} in stock` : 'Out of stock'}
                      </Badge>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-lg font-bold text-[#FFB20F]">
                        {formatKMPrice(product.priceKm || product.price)}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stockCount === 0 || addingProductId === product.id}
                        className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                      >
                        {addingProductId === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}