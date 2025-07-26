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
import { ShoppingCart, Search, Filter, Grid, List, Plus, Minus, Package, User, Settings, BarChart3, FileText, Users, CreditCard, HelpCircle } from "lucide-react";
import { type ProductWithStock } from "@shared/schema";

export default function B2BShop() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
  const [isCartOpen, setIsCartOpen] = useState(false);
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
    { icon: Package, label: "B2B SHOP", active: true },
    { icon: Grid, label: "CATALOG", active: false },
    { icon: Users, label: "CLIENTS", active: false },
    { icon: FileText, label: "ORDERS", active: false },
    { icon: BarChart3, label: "REPORTS", active: false },
    { icon: CreditCard, label: "INVOICES", active: false },
    { icon: Settings, label: "SETTINGS", active: false },
    { icon: HelpCircle, label: "SUPPORT", active: false },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-700 text-white flex-shrink-0">
        <div className="p-4 border-b border-gray-600">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">B2B PORTAL</h2>
              <p className="text-xs text-gray-300">ENTERPRISE</p>
            </div>
          </div>
        </div>
        
        <nav className="mt-4">
          {sidebarItems.map((item, index) => (
            <div
              key={index}
              className={`flex items-center px-4 py-3 text-sm ${
                item.active 
                  ? 'bg-blue-600 text-white border-r-2 border-blue-400' 
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              <item.icon className="w-4 h-4 mr-3" />
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Package className="w-6 h-6 text-gray-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">B2B SOFTWARE SHOP</h1>
                <p className="text-sm text-gray-500">Enterprise Software Solutions</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-blue-600 flex items-center">
                <Package className="w-4 h-4 mr-1" />
                {products.length} available
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCartOpen(true)}
                className="relative"
              >
                <ShoppingCart className="h-4 w-4" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Search and Filters */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
              <Select value={filters.region} onValueChange={(value) => setFilters(prev => ({ ...prev, region: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Regions</SelectItem>
                  <SelectItem value="Global">Global</SelectItem>
                  <SelectItem value="EU">EU</SelectItem>
                  <SelectItem value="US">US</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.platform} onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Platforms</SelectItem>
                  <SelectItem value="Windows">Windows</SelectItem>
                  <SelectItem value="macOS">macOS</SelectItem>
                  <SelectItem value="Linux">Linux</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="text-sm"
              >
                <Filter className="w-4 h-4 mr-1" />
                Advanced Filters
              </Button>
              <Select value={viewMode} onValueChange={(value: 'table' | 'grid') => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">List View</SelectItem>
                  <SelectItem value="grid">Grid View</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <Card className="p-4">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Price (EUR)</label>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="From"
                        value={filters.priceMin}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                        className="text-sm"
                      />
                      <Input
                        placeholder="To"
                        value={filters.priceMax}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Stock Level</label>
                    <Select value={filters.stockLevel} onValueChange={(value) => setFilters(prev => ({ ...prev, stockLevel: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All stock levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All stock levels</SelectItem>
                        <SelectItem value="low">Low Stock</SelectItem>
                        <SelectItem value="medium">Medium Stock</SelectItem>
                        <SelectItem value="high">High Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Date Added</label>
                    <Select value={filters.dateAdded} onValueChange={(value) => setFilters(prev => ({ ...prev, dateAdded: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Search SKU</label>
                    <Input
                      placeholder="Enter SKU..."
                      value={filters.sku}
                      onChange={(e) => setFilters(prev => ({ ...prev, sku: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({
                      region: "", platform: "", search: "", priceMin: "", priceMax: "",
                      stockLevel: "", dateAdded: "", sku: ""
                    })}
                  >
                    Clear filters
                  </Button>
                  <Button size="sm">Apply Filters</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Products Section */}
        <div className="flex-1 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Found {products.length} products</h3>
            <div className="text-sm text-gray-500 flex items-center">
              <List className="w-4 h-4 mr-1" />
              List View
            </div>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">IMAGE</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">PRODUCT</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">PRICE</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">REGION</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">PLATFORM</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">STOCK</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">QUANTITY</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">ACTION</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
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

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Shopping Cart</h3>
              <Button variant="ghost" size="sm" onClick={() => setIsCartOpen(false)}>
                ×
              </Button>
            </div>
            <div className="space-y-4">
              {cartItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty</p>
              ) : (
                cartItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="font-medium">{item.product?.name}</p>
                      <p className="text-sm text-gray-500">€{item.product?.price} × {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">€{(item.product?.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cartItems.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold">Total:</span>
                  <span className="font-semibold">
                    €{cartItems.reduce((sum: number, item: any) => sum + (item.product?.price * item.quantity), 0).toFixed(2)}
                  </span>
                </div>
                <Button className="w-full">Proceed to Checkout</Button>
              </div>
            )}
          </div>
        </div>
      )}
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
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {product.id.slice(0, 8).toUpperCase()}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
          <Package className="w-6 h-6 text-gray-400" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="text-sm font-medium text-gray-900">{product.name}</div>
        <div className="text-sm text-gray-500">{product.description}</div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">€{product.price}</div>
        <div className="text-xs text-gray-500">per license</div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <Badge variant="outline" className="text-xs">
          {product.region}
        </Badge>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center">
          {product.supportedPlatforms.includes('Windows') && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1">Windows</span>
          )}
          {product.supportedPlatforms.includes('macOS') && (
            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded mr-1">macOS</span>
          )}
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
        {product.stockCount || 0}
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-8 h-8 p-0"
          >
            <Minus className="w-3 h-3" />
          </Button>
          <span className="w-8 text-center text-sm">{quantity}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(quantity + 1)}
            className="w-8 h-8 p-0"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <Button
          size="sm"
          onClick={() => onAddToCart(quantity)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? "..." : "ADD"}
        </Button>
      </td>
    </tr>
  );
}
