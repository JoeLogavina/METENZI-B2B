// TIER 1 ENTERPRISE OPTIMIZATION: Component Memoization
// Prevents unnecessary re-renders and improves performance

import { memo, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Check } from "lucide-react";
import type { ProductWithStock } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from '@/contexts/TenantContext';

interface ProductCardProps {
  product: ProductWithStock;
  isInCart: boolean;
  onAddToCart?: (productId: string) => void;
}

// Memoized ProductCard to prevent unnecessary re-renders
const ProductCard = memo(function ProductCard({ 
  product, 
  isInCart, 
  onAddToCart 
}: ProductCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant, formatPrice } = useTenant();

  // Memoized tenant-aware price formatting
  const formattedPrice = useMemo(() => {
    if (tenant.currency === 'KM' && product.priceKm) {
      return `${parseFloat(product.priceKm).toFixed(2)} KM`;
    }
    return `€${parseFloat(product.price).toFixed(2)}`;
  }, [product.price, product.priceKm, tenant.currency]);

  // Memoized stock status calculation
  const stockStatus = useMemo(() => {
    if (product.stockCount === 0) return { text: 'Out of Stock', variant: 'destructive' as const };
    if (product.stockCount < 10) return { text: 'Low Stock', variant: 'secondary' as const };
    return { text: 'In Stock', variant: 'default' as const };
  }, [product.stockCount]);

  // Memoized add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/cart", {
        productId: product.id,
        quantity: 1,
      });
    },
    onSuccess: () => {
      // Optimistic update - immediately show success
      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart.`,
      });

      // Invalidate cart queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api", "cart"] });
      
      // Call parent callback for immediate UI updates
      onAddToCart?.(product.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add item to cart.",
        variant: "destructive",
      });
    },
  });

  // Memoized click handler to prevent recreation on every render
  const handleAddToCart = useCallback(() => {
    if (!isInCart && product.stockCount > 0) {
      addToCartMutation.mutate();
    }
  }, [isInCart, product.stockCount, addToCartMutation]);

  // Memoized button content to prevent unnecessary recalculation
  const buttonContent = useMemo(() => {
    if (addToCartMutation.isPending) {
      return (
        <>
          <ShoppingCart className="mr-2 h-4 w-4 animate-spin" />
          Adding...
        </>
      );
    }
    
    if (isInCart) {
      return (
        <>
          <Check className="mr-2 h-4 w-4" />
          In Cart
        </>
      );
    }
    
    return (
      <>
        <ShoppingCart className="mr-2 h-4 w-4" />
        Add to Cart
      </>
    );
  }, [addToCartMutation.isPending, isInCart]);

  return (
    <Card className="h-full flex flex-col">
      {/* Product Image */}
      {product.imageUrl && (
        <div className="aspect-video relative overflow-hidden rounded-t-lg">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = `
                <div class="w-full h-full bg-gray-100 flex items-center justify-center">
                  <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
              `;
            }}
          />
        </div>
      )}
      
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
          <Badge variant={stockStatus.variant} className="ml-2 shrink-0">
            {stockStatus.text}
          </Badge>
        </div>
        <CardDescription className="line-clamp-3 flex-grow">
          {product.description || "No description available"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Price:</span>
            <span className="text-lg font-bold text-yellow-600">{formattedPrice}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Region:</span>
            <Badge variant="outline">{product.region}</Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Platform:</span>
            <Badge variant="outline">{product.platform}</Badge>
          </div>
          
          {product.stockCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available:</span>
              <span className="text-sm font-medium">{product.stockCount} licenses</span>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter>
        <Button
          onClick={handleAddToCart}
          disabled={product.stockCount === 0 || isInCart || addToCartMutation.isPending}
          className="w-full"
          variant={isInCart ? "secondary" : "default"}
        >
          {buttonContent}
        </Button>
      </CardFooter>
    </Card>
  );
});

export default ProductCard;