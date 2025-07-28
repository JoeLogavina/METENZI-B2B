import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Currency } from '@/contexts/TenantContext';

interface TenantSwitcherProps {
  className?: string;
}

export function TenantSwitcher({ className }: TenantSwitcherProps) {
  const { tenant, switchTenantCurrency } = useTenant();

  if (!tenant.isAdmin) {
    return null; // Only show for admin users
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm font-medium text-gray-700">Currency:</span>
      <Select 
        value={tenant.currency} 
        onValueChange={(value: Currency) => switchTenantCurrency(value)}
      >
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="EUR">EUR</SelectItem>
          <SelectItem value="KM">KM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function TenantIndicator({ className }: TenantSwitcherProps) {
  const { tenant, getCurrencySymbol } = useTenant();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
        {tenant.type === 'admin' ? `Admin (${tenant.currency})` : 
         tenant.type === 'eur-shop' ? 'EUR Shop' : 
         'KM Shop'}
      </div>
      <span className="text-sm text-gray-600">
        {getCurrencySymbol()}
      </span>
    </div>
  );
}