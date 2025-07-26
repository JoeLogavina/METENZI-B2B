import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Filter, Grid, List, Plus, Minus, Package, User, Settings, BarChart3, FileText, Users, CreditCard, HelpCircle, ChevronDown, Calendar, LogOut } from "lucide-react";
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

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<ProductWithStock[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.region) params.append('region', filters.region);
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.search) params.append('search', filters.search);
      if (filters.priceMin) params.append('priceMin', filters.priceMin);
      if (filters.priceMax) params.append('priceMax', filters.priceMax);
      
      const res = await fetch(`/api/products?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    },
    enabled: isAuthenticated,
  });

  // Fetch cart items
  const { data: cartItems = [], isLoading: cartLoading } = useQuery<any[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      await apiRequest("POST", "/api/cart", { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Success",
        description: "Item added to cart successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive",
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
    { icon: BarChart3, label: "REPORTS", active: false, href: "/reports", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: CreditCard, label: "INVOICES", active: false, href: "/invoices", allowed: user?.role === 'admin' || user?.role === 'super_admin' },

    { icon: Settings, label: "SETTINGS", active: false, href: "/settings", allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/support", allowed: true },
  ].filter(item => item.allowed);

  return (
    <div className="min-h-screen bg-[#f5f6f5] flex font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Sidebar */}
      <div className="w-64 bg-[#4D585A] text-white flex-shrink-0">
        <div className="p-4 border-b border-[#3a4446]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#4D9DE0] rounded flex items-center justify-center">
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
              className={`flex items-center px-4 py-3 text-sm transition-colors duration-200 cursor-pointer ${
                item.active 
                  ? 'bg-[#4D9DE0] text-white border-r-2 border-[#3ba3e8]' 
                  : 'text-gray-300 hover:bg-[#5a6668]'
              }`}
              onClick={() => {
                console.log('Sidebar item clicked:', item.label, 'href:', item.href);
                setLocation(item.href);
              }}
            >
              <item.icon className="w-4 h-4 mr-3" />
              <span className="uppercase tracking-[0.5px] font-medium text-xs">{item.label}</span>
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-[#4D585A] border-b border-[#3a4446] px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Package className="w-6 h-6 text-white" />
              <div>
                <h1 className="text-2xl font-semibold text-white uppercase tracking-[0.5px]">B2B SOFTWARE SHOP</h1>
                <p className="text-sm text-gray-300">Enterprise Software Solutions</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-white flex items-center">
                <User className="w-4 h-4 mr-1" />
                <span className="font-medium">{user?.username}</span>
              </div>
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
                    className="relative bg-[#4D9DE0] hover:bg-[#3ba3e8] text-white border-0 px-5 py-2 rounded-[5px] font-medium transition-colors duration-200"
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
                      <h3 className="text-sm font-semibold uppercase tracking-[0.5px] text-[#4D585A]">Shopping Cart Preview</h3>
                    </div>
                    <div className="p-4 max-h-60 overflow-y-auto">
                      {cartItems.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Your cart is empty</p>
                      ) : (
                        <div className="space-y-3">
                          {cartItems.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-[#4D585A] truncate">{item.product?.name}</p>
                                <p className="text-xs text-gray-500">€{item.product?.price} × {item.quantity}</p>
                              </div>
                              <div className="text-sm font-mono font-semibold text-[#4D585A]">
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
                          <span className="text-sm font-semibold text-[#4D585A]">Total:</span>
                          <span className="font-mono font-semibold text-[#4D585A]">
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
                  className="pl-10 border-[#ddd] rounded-[5px] focus:border-[#4D9DE0] transition-colors duration-200"
                />
              </div>
              <Select value={filters.region || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, region: value === 'all' ? '' : value }))}>
                <SelectTrigger className="w-32 border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]">
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
                <SelectTrigger className="w-32 border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]">
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
                <SelectTrigger className="w-32 border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]">
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
                <h3 className="font-semibold text-sm uppercase tracking-[0.5px] text-[#4D585A]">Advanced Filters</h3>
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
                  <thead className="bg-[#4D585A] text-white">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">SKU</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">IMAGE</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">PRODUCT</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">PRICE</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">REGION</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">PLATFORM</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">STOCK</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">QUANTITY</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.5px]">ACTION</th>
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
                          isLoading={addToCartMutation.isPending}
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
      <td className="px-3 py-3 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
        {product.id.slice(0, 8).toUpperCase()}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="w-10 h-10 bg-gray-200 rounded-[5px] flex items-center justify-center">
          <Package className="w-6 h-6 text-gray-400" />
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="text-sm font-semibold text-gray-900">{product.name}</div>
        <div className="text-sm text-gray-500">{product.description}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="text-sm font-mono font-semibold text-gray-900">€{product.price}</div>
        <div className="text-xs text-gray-500">per license</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <Badge variant="outline" className="text-xs border-[#ddd] text-gray-700">
          {product.region}
        </Badge>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex items-center">
          {product.platform === 'Windows' && (
            <span className="text-xs bg-[#4D9DE0] text-white px-2 py-1 rounded-[5px] mr-1 font-medium">Windows</span>
          )}
          {product.platform === 'macOS' && (
            <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded-[5px] mr-1 font-medium">macOS</span>
          )}
          {product.platform === 'Linux' && (
            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-[5px] mr-1 font-medium">Linux</span>
          )}
          {product.platform === 'Both' && (
            <>
              <span className="text-xs bg-[#4D9DE0] text-white px-2 py-1 rounded-[5px] mr-1 font-medium">Windows</span>
              <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded-[5px] mr-1 font-medium">macOS</span>
            </>
          )}
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap text-sm font-mono font-semibold text-gray-900">
        {product.stockCount || 0}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="flex items-center space-x-2">
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
      <td className="px-3 py-3 whitespace-nowrap">
        <Button
          size="sm"
          onClick={() => onAddToCart(quantity)}
          disabled={isLoading}
          className="bg-[#4D9DE0] hover:bg-[#3ba3e8] text-white border-0 px-4 py-2 rounded-[5px] font-semibold uppercase tracking-[0.5px] transition-colors duration-200"
        >
          {isLoading ? "..." : "ADD"}
        </Button>
      </td>
    </tr>
  );
}
