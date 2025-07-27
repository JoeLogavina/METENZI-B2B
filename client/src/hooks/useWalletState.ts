import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

// Unified wallet data interface
export interface WalletBalance {
  depositBalance: string;
  creditLimit: string;
  creditUsed: string;
  availableCredit: string;
  totalAvailable: string;
  isOverlimit: boolean;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  balanceAfter: string;
  orderId?: string;
}

export interface WalletData {
  id: string;
  userId: string;
  balance: WalletBalance;
  recentTransactions: WalletTransaction[];
}

// Event system for real-time updates
class WalletEventBus {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

export const walletEventBus = new WalletEventBus();

// Unified wallet query keys
export const WALLET_QUERY_KEYS = {
  wallet: (userId?: string) => userId ? ['/api/wallet', userId] : ['/api/wallet'],
  transactions: (userId?: string) => userId ? ['/api/wallet', userId, 'transactions'] : ['/api/wallet', 'transactions'],
  all: () => ['/api/wallet'],
} as const;

/**
 * Unified wallet state management hook
 * Consolidates all wallet-related queries and mutations
 */
export function useWalletState() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Main wallet data query
  const {
    data: walletData,
    isLoading,
    error,
    refetch
  } = useQuery<{ data: WalletData }>({
    queryKey: WALLET_QUERY_KEYS.wallet(user?.id),
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Transaction history query
  const {
    data: transactions = [],
    isLoading: transactionsLoading
  } = useQuery<WalletTransaction[]>({
    queryKey: WALLET_QUERY_KEYS.transactions(user?.id),
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/wallet/transactions");
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });

  // Cache invalidation helper with throttling to prevent infinite loops
  const invalidateWalletCache = React.useCallback(() => {
    console.log('Invalidating wallet cache for user:', user?.id);
    queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEYS.all() });
    
    // Also invalidate the old checkout query key format for compatibility
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet-balance", user.id] });
    }
  }, [user?.id, queryClient]);

  // Optimistic update helper
  const updateWalletOptimistically = (newBalance: Partial<WalletBalance>) => {
    if (!user?.id || !walletData) return;

    const updatedWallet = {
      ...walletData,
      data: {
        ...walletData.data,
        balance: {
          ...walletData.data.balance,
          ...newBalance
        }
      }
    };

    queryClient.setQueryData(WALLET_QUERY_KEYS.wallet(user.id), updatedWallet);
  };

  // Payment processing mutation with optimistic updates
  const processPaymentMutation = useMutation({
    mutationFn: async ({ amount, description }: { amount: number; description: string }) => {
      if (!walletData?.data?.balance) {
        throw new Error("Wallet data not available");
      }

      const currentBalance = parseFloat(walletData.data.balance.totalAvailable);
      if (currentBalance < amount) {
        throw new Error(`Insufficient balance. Available: €${currentBalance.toFixed(2)}, Required: €${amount.toFixed(2)}`);
      }

      // Emit payment start event
      walletEventBus.emit('payment:started', { amount, description });

      return { amount, description };
    },
    onMutate: async ({ amount }) => {
      // Optimistic update
      if (!walletData?.data?.balance) return;

      const currentDeposit = parseFloat(walletData.data.balance.depositBalance);
      const currentCredit = parseFloat(walletData.data.balance.creditUsed);
      const creditLimit = parseFloat(walletData.data.balance.creditLimit);

      let newDepositBalance = currentDeposit;
      let newCreditUsed = currentCredit;

      // Use deposit first, then credit (enterprise requirement)
      if (currentDeposit >= amount) {
        newDepositBalance = currentDeposit - amount;
      } else {
        newDepositBalance = 0;
        const remainingAmount = amount - currentDeposit;
        newCreditUsed = Math.min(currentCredit + remainingAmount, creditLimit);
      }

      const newTotalAvailable = newDepositBalance + (creditLimit - newCreditUsed);

      updateWalletOptimistically({
        depositBalance: newDepositBalance.toFixed(2),
        creditUsed: newCreditUsed.toFixed(2),
        availableCredit: (creditLimit - newCreditUsed).toFixed(2),
        totalAvailable: newTotalAvailable.toFixed(2),
      });

      return { amount };
    },
    onSuccess: (data) => {
      // Emit payment success event
      walletEventBus.emit('payment:completed', data);
      
      // Invalidate cache to get fresh data from server (only on successful payment)
      setTimeout(() => {
        invalidateWalletCache();
      }, 1000); // Small delay to ensure backend processing is complete
    },
    onError: (error, variables, context) => {
      console.error("Payment processing failed:", error);
      
      // Revert optimistic update
      invalidateWalletCache();
      
      // Emit payment error event
      walletEventBus.emit('payment:failed', { error: error.message, ...variables });

      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Refresh wallet data mutation
  const refreshWalletMutation = useMutation({
    mutationFn: async () => {
      await refetch();
      return true;
    },
    onSuccess: () => {
      walletEventBus.emit('wallet:refreshed', { userId: user?.id });
    },
  });

  return {
    // Data
    walletData: walletData?.data,
    balance: walletData?.data?.balance,
    transactions,
    
    // Loading states
    isLoading,
    transactionsLoading,
    isProcessingPayment: processPaymentMutation.isPending,
    isRefreshing: refreshWalletMutation.isPending,
    
    // Error states
    error,
    paymentError: processPaymentMutation.error,
    
    // Actions
    processPayment: processPaymentMutation.mutate,
    refreshWallet: refreshWalletMutation.mutate,
    invalidateCache: invalidateWalletCache,
    
    // Event system
    eventBus: walletEventBus,
    
    // Utilities
    formatCurrency: (amount: string | number) => `€${parseFloat(amount.toString()).toFixed(2)}`,
    hasInsufficientBalance: (requiredAmount: number) => {
      if (!walletData?.data?.balance) return true;
      return parseFloat(walletData.data.balance.totalAvailable) < requiredAmount;
    },
  };
}

/**
 * Hook for components that only need wallet balance (lightweight)
 */
export function useWalletBalance() {
  const { balance, isLoading, error, formatCurrency, hasInsufficientBalance } = useWalletState();
  
  return {
    balance,
    isLoading,
    error,
    formatCurrency,
    hasInsufficientBalance,
  };
}

/**
 * Hook for listening to wallet events
 */
export function useWalletEvents(events: string[], callback: (event: string, data: any) => void) {
  const { eventBus } = useWalletState();
  
  React.useEffect(() => {
    const unsubscribers = events.map(event => 
      eventBus.subscribe(event, (data) => callback(event, data))
    );
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [events, callback, eventBus]);
}