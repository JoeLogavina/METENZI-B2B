import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, Plus, Minus, Loader2, CreditCard } from "lucide-react";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: any[];
  isLoading: boolean;
}

export default function CartModal({ isOpen, onClose, cartItems, isLoading }: CartModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingOrder, setProcessingOrder] = useState(false);

  // Update cart item mutation
  const updateCartMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      await apiRequest("PUT", `/api/cart/${id}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
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
        description: "Failed to update cart item",
        variant: "destructive",
      });
    },
  });

  // Remove from cart mutation
  const removeFromCartMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cart/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Success",
        description: "Item removed from cart",
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
        description: "Failed to remove item from cart",
        variant: "destructive",
      });
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/orders");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setProcessingOrder(false);
      onClose();
      toast({
        title: "Order Successful!",
        description: "Your license keys have been delivered to your account.",
      });
    },
    onError: (error) => {
      setProcessingOrder(false);
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
        title: "Order Failed",
        description: error.message || "Failed to process order",
        variant: "destructive",
      });
    },
  });

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    updateCartMutation.mutate({ id, quantity });
  };

  const removeItem = (id: string) => {
    removeFromCartMutation.mutate(id);
  };

  const handleCheckout = () => {
    setProcessingOrder(true);
    createOrderMutation.mutate();
  };

  const totalAmount = cartItems?.reduce((sum, item) => 
    sum + (parseFloat(item.product.price) * item.quantity), 0
  ) || 0;

  const totalItems = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5" />
            <span>Shopping Cart ({totalItems} items)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading cart...</span>
            </div>
          ) : cartItems?.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Add some products to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems?.map((item) => (
                <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-16 h-12 bg-gray-200 rounded border flex items-center justify-center flex-shrink-0">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">No Image</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.product.name}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline">{item.product.region}</Badge>
                      <Badge variant="outline">{item.product.platform}</Badge>
                      <span className="text-sm text-gray-500">SKU: {item.product.sku}</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      €{parseFloat(item.product.price).toLocaleString()}
                      <span className="text-sm text-gray-500 font-normal"> per license</span>
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1 || updateCartMutation.isPending}
                      className="w-8 h-8 p-0"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={updateCartMutation.isPending}
                      className="w-8 h-8 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      €{(parseFloat(item.product.price) * item.quantity).toLocaleString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      disabled={removeFromCartMutation.isPending}
                      className="text-red-600 hover:text-red-700 p-0 h-auto mt-1"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems?.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-2xl font-bold text-primary">
                  €{totalAmount.toLocaleString()}
                </span>
              </div>
              
              <div className="flex space-x-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Continue Shopping
                </Button>
                <Button
                  onClick={handleCheckout}
                  disabled={processingOrder}
                  className="flex-1"
                >
                  {processingOrder ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Checkout
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
