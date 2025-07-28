import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { parsePrice, formatPrice, calculateTotal } from "@/lib/price-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, Package, CreditCard, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "wouter";

interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: string;
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    region: string;
    platform: string;
    stockCount: number;
  };
}

export default function CartPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

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

  // ENTERPRISE CART DATA FETCHING WITH PROPER ERROR HANDLING
  const { data: cartItems = [], isLoading: cartLoading, error: cartError } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds fresh
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) return false;
      return failureCount < 2;
    },
  });

  // ENTERPRISE UPDATE QUANTITY WITH OPTIMISTIC UPDATES
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await apiRequest("PATCH", `/api/cart/${itemId}`, { quantity });
      return response;
    },
    onMutate: async ({ itemId, quantity }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      
      // Snapshot previous value
      const previousCart = queryClient.getQueryData(["/api/cart"]);
      
      // Optimistically update cart
      queryClient.setQueryData(["/api/cart"], (old: CartItem[]) => {
        return old?.map(item => 
          item.id === itemId ? { ...item, quantity } : item
        ) || [];
      });
      
      return { previousCart, itemId, quantity };
    },
    onSuccess: (response, variables) => {
      // Update with server response
      queryClient.setQueryData(["/api/cart"], (old: CartItem[]) => {
        return old?.map(item => 
          item.id === variables.itemId ? { ...item, quantity: variables.quantity } : item
        ) || [];
      });
      
      toast({
        title: "Updated",
        description: "Quantity updated successfully",
      });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/auth", 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to update quantity. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ENTERPRISE REMOVE ITEM WITH OPTIMISTIC UPDATES
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("DELETE", `/api/cart/${itemId}`);
      return response;
    },
    onMutate: async (itemId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      
      // Snapshot previous value
      const previousCart = queryClient.getQueryData(["/api/cart"]);
      
      // Find item being removed for better UX
      const removedItem = (previousCart as CartItem[])?.find(item => item.id === itemId);
      
      // Optimistically remove item
      queryClient.setQueryData(["/api/cart"], (old: CartItem[]) => {
        return old?.filter(item => item.id !== itemId) || [];
      });
      
      // Show immediate feedback
      if (removedItem) {
        toast({
          title: "Removed",
          description: `${removedItem.product.name} removed from cart`,
        });
      }
      
      return { previousCart, itemId, removedItem };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/auth", 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to remove item. Please try again.",
        variant: "destructive",
      });
    },
  });

  // ENTERPRISE CLEAR CART WITH OPTIMISTIC UPDATES
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/cart");
      return response;
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/cart"] });
      
      // Snapshot previous value
      const previousCart = queryClient.getQueryData(["/api/cart"]);
      const itemCount = (previousCart as CartItem[])?.length || 0;
      
      // Optimistically clear cart
      queryClient.setQueryData(["/api/cart"], []);
      
      // Show immediate feedback
      toast({
        title: "Cart Cleared",
        description: `${itemCount} items removed from cart`,
      });
      
      return { previousCart, itemCount };
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousCart) {
        queryClient.setQueryData(["/api/cart"], context.previousCart);
      }
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/auth", 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to clear cart. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: (response, variables, context) => {
      // Success is already handled in onMutate, so just confirm
      console.log("Cart cleared successfully on server");
    },
  });

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateQuantityMutation.mutate({ itemId, quantity: newQuantity });
  };

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId);
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    clearCartMutation.mutate();
  };

  const totalAmount = cartItems.reduce((sum, item) => {
    // Add comprehensive safety checks for product and price
    if (!item.product || !item.product.price) {
      console.warn('Cart item missing product data:', item);
      return sum;
    }
    
    // Parse price safely and validate
    const price = parsePrice(item.product.price);
    if (isNaN(price) || price < 0) {
      console.warn('Invalid price for cart item:', item.product.price, item);
      return sum;
    }
    
    // Validate quantity
    const quantity = item.quantity || 0;
    if (quantity <= 0) {
      console.warn('Invalid quantity for cart item:', quantity, item);
      return sum;
    }
    
    return sum + calculateTotal(price, quantity);
  }, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4D9DE0] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f5f6f5] font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Header */}
      <header className="bg-[#4D585A] text-white px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/b2b-shop">
              <Button variant="ghost" size="sm" className="text-white hover:bg-[#5a6668] rounded-[5px] transition-colors duration-200">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Shop
              </Button>
            </Link>
            <div className="border-l border-[#3a4446] pl-4">
              <ShoppingCart className="w-6 h-6 mr-3 inline" />
              <h1 className="text-2xl font-semibold uppercase tracking-[0.5px] inline">Shopping Cart</h1>
            </div>
          </div>
          <div className="text-sm">
            <span className="font-mono font-medium">{totalItems}</span> items
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {cartLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4D9DE0] mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading cart...</p>
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some products to get started</p>
            <Link href="/b2b-shop">
              <Button className="bg-[#4D9DE0] hover:bg-[#3ba3e8] text-white rounded-[5px] font-medium transition-colors duration-200">
                <Package className="w-4 h-4 mr-2" />
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-[#4D585A] uppercase tracking-[0.5px]">Cart Items</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearCart}
                  disabled={clearCartMutation.isPending}
                  className="text-[#E15554] border-[#E15554] hover:bg-[#E15554] hover:text-white rounded-[5px] transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Cart
                </Button>
              </div>

              {cartItems.map((item) => {
                // Add safety check for product data
                if (!item.product) {
                  console.warn('Cart item missing product data:', item);
                  return null;
                }
                
                return (
                <Card key={item.id} className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] border-[#ddd]">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-200 rounded-[5px] flex items-center justify-center flex-shrink-0">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#4D585A] truncate">{item.product.name || 'Unknown Product'}</h3>
                        <p className="text-sm text-gray-500 truncate">{item.product.description || 'No description'}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline" className="text-xs border-[#ddd] text-gray-700">
                            {item.product.region || 'Unknown'}
                          </Badge>
                          <span className="text-xs bg-[#4D9DE0] text-white px-2 py-1 rounded-[5px] font-medium">
                            {item.product.platform || 'Unknown'}
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <div className="font-mono font-semibold text-[#4D585A]">
                          {formatPrice(item.product.price)}
                        </div>
                        <div className="text-xs text-gray-500">per license</div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updateQuantityMutation.isPending}
                          className="w-8 h-8 p-0 border-[#ddd] rounded-[5px] hover:bg-[#f8f8f8] transition-colors duration-200"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-12 text-center font-mono font-semibold">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          disabled={updateQuantityMutation.isPending}
                          className="w-8 h-8 p-0 border-[#ddd] rounded-[5px] hover:bg-[#f8f8f8] transition-colors duration-200"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Total Price */}
                      <div className="text-right min-w-[80px]">
                        <div className="font-mono font-semibold text-lg text-[#4D585A]">
                          {formatPrice(calculateTotal(item.product.price, item.quantity))}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={removeItemMutation.isPending}
                        className="text-[#E15554] hover:bg-[#f8f8f8] rounded-[5px] transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] border-[#ddd] sticky top-6">
                <CardHeader className="bg-[#4D585A] text-white rounded-t-[8px]">
                  <CardTitle className="text-lg font-semibold uppercase tracking-[0.5px]">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Items ({totalItems})</span>
                      <span className="font-mono font-semibold">€{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-mono font-semibold">€{(totalAmount * 0.21).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-[#e5e5e5] pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-[#4D585A] uppercase tracking-[0.5px]">Total</span>
                        <span className="font-mono font-semibold text-xl text-[#4D585A]">
                          €{(totalAmount * 1.21).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Link href="/checkout">
                      <Button className="w-full bg-[#4D9DE0] hover:bg-[#3ba3e8] text-white rounded-[5px] font-semibold uppercase tracking-[0.5px] py-3 transition-colors duration-200">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Proceed to Checkout
                      </Button>
                    </Link>
                    <Link href="/b2b-shop">
                      <Button
                        variant="outline"
                        className="w-full border-[#ddd] text-gray-700 hover:bg-[#f8f8f8] rounded-[5px] font-medium transition-colors duration-200"
                      >
                        Continue Shopping
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}