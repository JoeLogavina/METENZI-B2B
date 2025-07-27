import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useWalletState, walletEventBus, WalletData, WalletBalance } from '@/hooks/useWalletState';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface WalletContextType {
  walletData?: WalletData;
  balance?: WalletBalance;
  isLoading: boolean;
  error: Error | null;
  processPayment: (data: { amount: number; description: string }) => void;
  refreshWallet: () => void;
  invalidateCache: () => void;
  formatCurrency: (amount: string | number) => string;
  hasInsufficientBalance: (amount: number) => boolean;
  isProcessingPayment: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const wallet = useWalletState();

  // Global wallet event handlers
  useEffect(() => {
    if (!user) return;

    const unsubscribers = [
      // Payment events
      walletEventBus.subscribe('payment:started', (data) => {
        console.log('Payment started:', data);
        toast({
          title: "Processing Payment",
          description: `Processing payment of €${data.amount.toFixed(2)}...`,
        });
      }),

      walletEventBus.subscribe('payment:completed', (data) => {
        console.log('Payment completed:', data);
        toast({
          title: "Payment Successful",
          description: `Payment of €${data.amount.toFixed(2)} completed successfully`,
          variant: "default",
        });
      }),

      walletEventBus.subscribe('payment:failed', (data) => {
        console.error('Payment failed:', data);
        // Error toast handled in mutation
      }),

      // Wallet refresh events
      walletEventBus.subscribe('wallet:refreshed', (data) => {
        console.log('Wallet refreshed for user:', data.userId);
      }),

      // Order completion events (for external integrations)
      walletEventBus.subscribe('order:completed', (data) => {
        console.log('Order completed, refreshing wallet:', data);
        setTimeout(() => {
          wallet.refreshWallet();
        }, 500);
      }),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [user, toast, wallet.refreshWallet]);

  // Auto-refresh wallet data on user change (removed to prevent infinite loop)
  // The wallet hook already handles user changes internally

  const contextValue: WalletContextType = {
    walletData: wallet.walletData,
    balance: wallet.balance,
    isLoading: wallet.isLoading,
    error: wallet.error,
    processPayment: wallet.processPayment,
    refreshWallet: wallet.refreshWallet,
    invalidateCache: wallet.invalidateCache,
    formatCurrency: wallet.formatCurrency,
    hasInsufficientBalance: wallet.hasInsufficientBalance,
    isProcessingPayment: wallet.isProcessingPayment,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Global wallet event emitter for external components
export const emitWalletEvent = (event: string, data: any) => {
  walletEventBus.emit(event, data);
};