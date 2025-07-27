import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface OptimisticOrderUpdate {
  orderId: string;
  licenseKeys?: Array<{
    id: string;
    licenseKey: string;
    productName: string;
  }>;
}

export function useOptimisticOrders() {
  const queryClient = useQueryClient();

  const updateOrderOptimistically = useMutation({
    mutationFn: async (update: OptimisticOrderUpdate) => {
      // This is an optimistic update - we immediately update the UI
      // The actual server response will override this if different
      
      // Get current orders from cache
      const currentOrders = queryClient.getQueryData(["/api/orders"]) as any[] || [];
      
      // Find and update the specific order
      const updatedOrders = currentOrders.map(order => {
        if (order.id === update.orderId && update.licenseKeys) {
          // Add license keys to order items
          const updatedItems = order.items.map((item: any) => {
            const matchingKey = update.licenseKeys?.find(key => 
              key.productName === item.product.name && !item.licenseKey
            );
            
            if (matchingKey) {
              return {
                ...item,
                licenseKeyId: matchingKey.id,
                licenseKey: {
                  id: matchingKey.id,
                  licenseKey: matchingKey.licenseKey
                }
              };
            }
            return item;
          });
          
          return {
            ...order,
            items: updatedItems,
            status: 'completed',
            paymentStatus: 'paid'
          };
        }
        return order;
      });

      // Immediately update the cache
      queryClient.setQueryData(["/api/orders"], updatedOrders);
      
      // Return the update for the mutation
      return update;
    },
    onError: () => {
      // If optimistic update fails, refetch the real data
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    }
  });

  const invalidateOrdersCache = () => {
    // Force refetch of orders data
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
  };

  return {
    updateOrderOptimistically: updateOrderOptimistically.mutate,
    invalidateOrdersCache,
    isUpdating: updateOrderOptimistically.isPending
  };
}