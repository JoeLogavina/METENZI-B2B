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
  List,
  Minus,
  Plus
} from "lucide-react";
import ProductCard from "@/components/optimized/ProductCard";
import AdvancedProductFilters from "@/components/AdvancedProductFilters";
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
    queryKey: ["/api/products", "km-shop", debouncedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value && value !== "all") {
          params.append(key, value);
        }
      });

      const res = await fetch(`/api/products?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache', // Force fresh data
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Products API failed: ${res.status}`);
      }
      const data = await res.json();
      
      // Filter and transform for KM pricing - check all possible field names
      const filteredProducts = data
        .filter((product: any) => {
          // Check both priceKm and price_km field names
          const kmPrice = product.priceKm || product.price_km;
          const hasKmPrice = kmPrice && parseFloat(kmPrice) > 0;
          return hasKmPrice;
        })
        .map((product: any) => ({
          ...product,
          price: parseFloat(product.priceKm || product.price_km), // Use KM price as primary price
          displayPrice: parseFloat(product.priceKm || product.price_km),
          currency: 'KM'
        }));
      
      return filteredProducts;
    },
    enabled: isAuthenticated,
    staleTime: 0, // Force fresh data
    gcTime: 0, // No caching
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false, // Disable retry to see errors quickly
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

        {/* Main Content Area with Vertical Filters */}
        <div className="flex-1 flex overflow-hidden">
          {/* Advanced Filters Sidebar */}
          <div className="w-80 bg-white border-r border-[#ddd] p-4 overflow-y-auto">
            <AdvancedProductFilters
              filters={{
                search: filters.search,
                categoryId: "",
                region: filters.region,
                platform: filters.platform,
                priceMin: filters.priceMin,
                priceMax: filters.priceMax,
                stockLevel: filters.stockLevel,
                dateAdded: filters.dateAdded,
                sku: filters.sku,
                priceRange: [0, 1000] as [number, number],
                availability: [] as string[],
                sortBy: "",
                sortOrder: "asc" as "asc" | "desc"
              }}
              onFiltersChange={(advancedFilters) => {
                setFilters({
                  search: advancedFilters.search,
                  region: advancedFilters.region,
                  platform: advancedFilters.platform,
                  priceMin: advancedFilters.priceMin,
                  priceMax: advancedFilters.priceMax,
                  stockLevel: advancedFilters.stockLevel,
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
              <h3 className="text-sm font-semibold text-gray-700">Found {products.length} KM products</h3>
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
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.5px]">PRICE (KM)</th>
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
                          Loading KM products...
                        </td>
                      </tr>
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                          No KM products found
                        </td>
                      </tr>
                    ) : (
                      products.map((product: ProductWithStock) => (
                        <KMProductRow
                          key={product.id}
                          product={product}
                          onAddToCart={handleAddToCart}
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

function KMProductRow({ product, onAddToCart, isLoading }: { 
  product: ProductWithStock; 
  onAddToCart: (product: ProductWithStock) => void;
  isLoading: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const { formatPrice } = useTenant();

  return (
    <tr className="hover:bg-[#f8f8f8] transition-colors duration-200">
      <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-mono font-medium text-gray-900">
        {product.sku || product.id.slice(0, 8).toUpperCase()}
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="w-10 h-10 bg-gray-200 rounded-[5px] flex items-center justify-center mx-auto overflow-hidden">
          <Package className="w-6 h-6 text-gray-400" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="text-sm font-semibold text-gray-900">
          {product.name}
        </div>
        <div className="text-sm text-gray-500">{product.description}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-center">
        <div className="text-sm font-mono font-semibold text-[#FFB20F]">
          {formatPrice(product.priceKm || product.price)}
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
          onClick={() => onAddToCart(product)}
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