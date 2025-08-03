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
} from "lucide-react";
import type { ProductWithStock } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useTenant } from "@/contexts/TenantContext";
import { useDebounce } from "use-debounce";
import AdvancedProductFilters from "@/components/AdvancedProductFilters";
import ProductCard from "@/components/optimized/ProductCard";

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
      
      // Allow admin users to access any tenant shop, otherwise enforce tenant restriction
      if (!isAdmin && user.tenantId !== 'eur') {
        toast({
          title: "Access Denied",
          description: "You don't have access to the EUR shop. Redirecting to your tenant.",
          variant: "destructive",
        });
        
        if (user.tenantId === 'km') {
          setLocation('/km');
        } else {
          setLocation('/auth');
        }
        return;
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
    { icon: Package, label: "EUR SHOP", active: true, href: "/eur", allowed: true },
    { icon: Grid, label: "CATALOG", active: false, href: "/eur", allowed: true },
    { icon: ShoppingCart, label: "MY CART", active: false, href: "/eur/cart", allowed: true },
    { icon: FileText, label: "ORDERS", active: false, href: "/orders", allowed: true },
    { icon: CreditCard, label: "MY WALLET", active: false, href: "/wallet", allowed: true },
    { icon: Settings, label: "SETTINGS", active: false, href: "/eur", allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/eur", allowed: true },
    // Admin-only items  
    { icon: Settings, label: "ADMIN PANEL", active: false, href: "/admin-panel", allowed: isAdmin, admin: true },
  ].filter(item => item.allowed);

  const formatEURPrice = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `€${numAmount.toFixed(2)}`;
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
              <h2 className="font-semibold text-sm uppercase tracking-[0.5px]">EUR PORTAL</h2>
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-[#6E6F71] border-b border-[#5a5b5d] px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Package className="w-6 h-6 text-white" />
              <div>
                <h1 className="text-2xl font-semibold text-white uppercase tracking-[0.5px]">
                  B2B SOFTWARE SHOP (EUR)
                </h1>
                <p className="text-sm text-gray-300">EUR Currency Enterprise Solutions</p>
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
                  onClick={() => setLocation('/eur/cart')}
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

        {/* Main Content Area with Vertical Filters */}
        <div className="flex-1 flex overflow-hidden">
          {/* Advanced Filters Sidebar */}
          <div className="w-80 bg-white border-r border-[#ddd] p-4 overflow-y-auto">
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
          <div className="flex-1 p-6 overflow-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Found {products.length} EUR products</h3>
              <div className="text-sm text-gray-500 flex items-center">
                <Grid className="w-4 h-4 mr-1" />
                Grid View
              </div>
            </div>

            {/* Product Grid using ProductCard */}
            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#FFB20F]" />
                <span className="ml-2 text-gray-500">Loading EUR products...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No EUR products found</h3>
                <p className="text-gray-500">Try adjusting your filters to see more products.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product: ProductWithStock) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isInCart={cartItems.some((item: any) => item.productId === product.id)}
                    onAddToCart={(productId) => handleAddToCart(product)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}