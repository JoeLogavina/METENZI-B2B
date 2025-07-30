import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Grid,
  FileText,
  CreditCard,
  Settings,
  HelpCircle,
  ShoppingCart,
  Filter,
  LogOut,
  User,
  BarChart3,
  Users,
  List,
  Loader2,
} from "lucide-react";
import ProductCard from "@/components/optimized/ProductCard";
import type { ProductWithStock } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { useDebounce } from "use-debounce";
import { EnhancedProductFilters, type ProductFilters } from "@/components/enhanced/EnhancedProductFilters";

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

  const [filters, setFilters] = useState<ProductFilters>({
    search: "",
    categoryId: null,
    region: "",
    priceRange: { min: null, max: null },
    sortBy: "name",
    sortOrder: "asc"
  });

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isCartHovered, setIsCartHovered] = useState(false);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  // Debounce filters to prevent excessive API calls  
  const [debouncedFilters] = useDebounce(filters, 300);

  // Fetch KM-specific products
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["/api/products", debouncedFilters],
    queryFn: () => apiRequest("/api/products", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch cart items for KM tenant
  const { data: cartItems = [] } = useQuery({
    queryKey: ["/api/cart", "km"],
    queryFn: () => apiRequest("/api/cart"),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) => {
      setAddingProductId(productId);
      
      // Optimistic update - add item to cart immediately
      queryClient.setQueryData(["/api/cart", "km"], (oldData: any) => {
        if (!oldData) return [{ productId, quantity, tenantId: 'km' }];
        
        const existingItemIndex = oldData.findIndex((item: any) => item.productId === productId);
        if (existingItemIndex >= 0) {
          const updated = [...oldData];
          updated[existingItemIndex] = { ...updated[existingItemIndex], quantity: updated[existingItemIndex].quantity + quantity };
          return updated;
        }
        
        return [...oldData, { productId, quantity, tenantId: 'km' }];
      });

      return apiRequest("/api/cart", {
        method: "POST",
        body: JSON.stringify({
          productId,
          quantity,
          tenantId: 'km' // Ensure KM cart isolation
        }),
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

  // Allow admin users to access any tenant shop
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  if (!isAuthenticated || (!isAdmin && user?.tenantId !== 'km')) {
    return null;
  }
  
  const sidebarItems = [
    { icon: Package, label: "KM SHOP", active: true, href: "/km", allowed: true },
    { icon: Grid, label: "CATALOG", active: false, href: "/km", allowed: true },
    { icon: ShoppingCart, label: "MY CART", active: false, href: "/km/cart", allowed: true },
    { icon: FileText, label: "ORDERS", active: false, href: "/orders", allowed: true },
    { icon: CreditCard, label: "MY WALLET", active: false, href: "/wallet", allowed: true },
    { icon: Settings, label: "SETTINGS", active: false, href: "/km", allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/km", allowed: true },
    // Admin-only items  
    { icon: Settings, label: "ADMIN PANEL", active: false, href: "/admin-panel", allowed: isAdmin, admin: true },
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
                  : (item as any).admin
                  ? 'text-white hover:bg-[#5a5b5d] border-l-2 border-yellow-400'
                  : 'text-white hover:bg-[#7a7b7d]'
              }`}
              onClick={() => setLocation(item.href)}
            >
              <item.icon className="w-6 h-6 mr-3" />
              <span className="uppercase tracking-[0.5px] font-medium text-sm">{item.label}</span>
              {(item as any).admin && (
                <span className="ml-auto text-xs bg-yellow-400 text-black px-2 py-1 rounded">ADMIN</span>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Vertical Filters Panel */}
        <div className="w-80 bg-white border-r border-gray-200 flex-shrink-0">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#6E6F71]">Product Filters</h3>
          </div>
          <div className="p-4 h-full overflow-y-auto">
            <EnhancedProductFilters
              filters={filters}
              onFiltersChange={setFilters}
              className="space-y-4"
            />
          </div>
        </div>
        
        {/* Products Content Area */}
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
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Products Section */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Found {products.length} KM products</h3>
              <div className="text-sm text-gray-500 flex items-center">
                <List className="w-4 h-4 mr-1" />
                List View
              </div>
            </div>

            {/* Product Grid */}
            {productsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading products...</p>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500">Try adjusting your filters to see more results.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product: ProductWithStock) => (
                  <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{product.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                        </div>
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center ml-3">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-lg font-bold text-[#FFB20F]">
                          {formatKMPrice(product.priceKm || product.price)}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {product.region}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          Stock: {product.stockCount || 0}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(product)}
                          disabled={addingProductId === product.id || product.stockCount === 0}
                          className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white border-0 px-4 py-2 rounded-md font-medium transition-colors duration-200 disabled:opacity-50"
                        >
                          {addingProductId === product.id ? (
                            <div className="flex items-center">
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              Adding...
                            </div>
                          ) : product.stockCount === 0 ? "Out of Stock" : "Add to Cart"}
                        </Button>
                      </div>
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