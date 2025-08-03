import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Search, 
  Filter, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Package, 
  User, 
  LogOut, 
  Loader2, 
  Eye,
  Menu,
  ChevronDown,
  Star,
  Heart,
  Share2
} from "lucide-react";
import { type ProductWithStock } from "@shared/schema";
import { useTenant } from '@/contexts/TenantContext';
import { MobileProductCard } from "@/components/mobile/MobileProductCard";
import { MobileProductFilters } from "@/components/mobile/MobileProductFilters";
import { MobileCartDrawer } from "@/components/mobile/MobileCartDrawer";
import { MobileProductModal } from "@/components/mobile/MobileProductModal";

interface MobileB2BShopProps {
  filters: any;
  setFilters: (filters: any) => void;
  viewMode: 'table' | 'grid';
  setViewMode: (mode: 'table' | 'grid') => void;
  products: ProductWithStock[];
  productsLoading: boolean;
  selectedProduct: ProductWithStock | null;
  setSelectedProduct: (product: ProductWithStock | null) => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

export function MobileB2BShop({
  filters,
  setFilters,
  products,
  productsLoading,
  selectedProduct,
  setSelectedProduct,
  isModalOpen,
  setIsModalOpen
}: MobileB2BShopProps) {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showFilters, setShowFilters] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [sortBy, setSortBy] = useState('name');

  // Fetch cart data
  const { data: cart = [] } = useQuery({
    queryKey: ["/api/cart"],
    queryFn: async () => {
      const response = await fetch("/api/cart", { credentials: "include" });
      if (!response.ok) throw new Error('Failed to fetch cart');
      return response.json();
    },
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId, quantity }),
      });
      if (!response.ok) throw new Error('Failed to add to cart');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to Cart",
        description: "Product added successfully",
      });
    },
  });

  // Sorted and filtered products
  const sortedProducts = useMemo(() => {
    let filtered = [...products];
    
    // Apply sorting
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        break;
      case 'price-high':
        filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'stock':
        filtered.sort((a, b) => b.stockCount - a.stockCount);
        break;
      default:
        break;
    }
    
    return filtered;
  }, [products, sortBy]);

  const cartItemCount = cart.reduce((sum: number, item: any) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-[#6E6F71]">B2B Shop</h1>
              <p className="text-xs text-gray-500">{user?.companyName}</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="relative"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartItemCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {cartItemCount}
              </Badge>
            )}
          </Button>
        </div>
        
        {/* Search and Filter Bar */}
        <div className="px-4 pb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 pr-4"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filter Products</SheetTitle>
                </SheetHeader>
                <MobileProductFilters 
                  filters={filters} 
                  setFilters={setFilters}
                  onClose={() => setShowFilters(false)}
                />
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Sort:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const options = ['name', 'price-low', 'price-high', 'stock'];
                  const currentIndex = options.indexOf(sortBy);
                  const nextIndex = (currentIndex + 1) % options.length;
                  setSortBy(options[nextIndex]);
                }}
                className="flex items-center space-x-1"
              >
                <span className="text-xs">
                  {sortBy === 'name' && 'Name'}
                  {sortBy === 'price-low' && 'Price ↑'}
                  {sortBy === 'price-high' && 'Price ↓'}
                  {sortBy === 'stock' && 'Stock'}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="p-4">
        {productsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#FFB20F]" />
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedProducts.map((product) => (
              <MobileProductCard
                key={product.id}
                product={product}
                onAddToCart={(quantity: number) =>
                  addToCartMutation.mutate({ productId: product.id, quantity })
                }
                onViewDetails={() => {
                  setSelectedProduct(product);
                  setIsModalOpen(true);
                }}
                isAddingToCart={addToCartMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile Cart Drawer */}
      <MobileCartDrawer 
        open={showCart} 
        onOpenChange={setShowCart}
        cart={cart}
      />

      {/* Mobile Product Modal */}
      <MobileProductModal
        product={selectedProduct}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onAddToCart={(quantity: number) => {
          if (selectedProduct) {
            addToCartMutation.mutate({ productId: selectedProduct.id, quantity });
          }
        }}
        isAddingToCart={addToCartMutation.isPending}
      />
    </div>
  );
}