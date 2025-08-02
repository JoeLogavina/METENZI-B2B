import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export type Currency = 'EUR' | 'KM';
export type TenantType = 'admin' | 'eur-shop' | 'km-shop';

export interface TenantContext {
  type: TenantType;
  currency: Currency;
  isAdmin: boolean;
  isShop: boolean;
}

interface TenantContextType {
  tenant: TenantContext;
  formatPrice: (amount: number | string) => string;
  getCurrencySymbol: () => string;
  switchTenantCurrency: (currency: Currency) => void;
}

const TenantContextInstance = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<TenantContext>(() => {
    // Detect tenant from current URL path
    const path = window.location.pathname;
    
    // Initial tenant setup based on URL path
    
    if (path.startsWith('/admin')) {
      return {
        type: 'admin',
        currency: 'EUR',
        isAdmin: true,
        isShop: false
      };
    } else if (path.startsWith('/shop/km') || path.startsWith('/km')) {
      return {
        type: 'km-shop',
        currency: 'KM',
        isAdmin: false,
        isShop: true
      };
    } else {
      // Default to EUR shop
      return {
        type: 'eur-shop',
        currency: 'EUR',
        isAdmin: false,
        isShop: true
      };
    }
  });

  // Update tenant based on user's tenantId when user data becomes available
  useEffect(() => {
    if (user?.tenantId) {
      // Update tenant context based on authenticated user
      
      const path = window.location.pathname;
      let newTenant: TenantContext;
      
      if (path.startsWith('/admin')) {
        newTenant = {
          type: 'admin',
          currency: user.tenantId === 'km' ? 'KM' : 'EUR',
          isAdmin: true,
          isShop: false
        };
      } else if (user.tenantId === 'km') {
        newTenant = {
          type: 'km-shop',
          currency: 'KM',
          isAdmin: false,
          isShop: true
        };
      } else {
        newTenant = {
          type: 'eur-shop',
          currency: 'EUR',
          isAdmin: false,
          isShop: true
        };
      }
      
      // Update tenant context
      setTenant(newTenant);
    }
  }, [user?.tenantId]);

  // Update tenant context when route changes
  useEffect(() => {
    const handleRouteChange = () => {
      const path = window.location.pathname;
      
      let newTenant: TenantContext;
      
      if (path.startsWith('/admin')) {
        newTenant = {
          type: 'admin',
          currency: tenant.currency, // Preserve admin's selected currency
          isAdmin: true,
          isShop: false
        };
      } else if (path.startsWith('/shop/km') || path.startsWith('/km')) {
        newTenant = {
          type: 'km-shop',
          currency: 'KM',
          isAdmin: false,
          isShop: true
        };
      } else {
        newTenant = {
          type: 'eur-shop',
          currency: 'EUR',
          isAdmin: false,
          isShop: true
        };
      }
      
      // Route change detected, updating tenant
      setTenant(newTenant);
    };

    // Listen for route changes (for single-page app navigation)
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [tenant.currency]);

  const getCurrencySymbol = (): string => {
    switch (tenant.currency) {
      case 'EUR': return '€';
      case 'KM': return 'KM';
      default: return '€';
    }
  };

  const formatPrice = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const symbol = getCurrencySymbol();
    
    if (tenant.currency === 'KM') {
      return `${numAmount.toFixed(2)} ${symbol}`;
    } else {
      return `${symbol}${numAmount.toFixed(2)}`;
    }
  };

  const switchTenantCurrency = (currency: Currency) => {
    if (tenant.isAdmin) {
      // Only admin can switch currency dynamically
      setTenant(prev => ({ ...prev, currency }));
    }
  };

  const value: TenantContextType = {
    tenant,
    formatPrice,
    getCurrencySymbol,
    switchTenantCurrency
  };

  return (
    <TenantContextInstance.Provider value={value}>
      {children}
    </TenantContextInstance.Provider>
  );
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContextInstance);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

// Utility hooks for common tenant checks
export function useIsAdmin(): boolean {
  const { tenant } = useTenant();
  return tenant.isAdmin;
}

export function useIsShop(): boolean {
  const { tenant } = useTenant();
  return tenant.isShop;
}

export function useCurrency(): Currency {
  const { tenant } = useTenant();
  return tenant.currency;
}