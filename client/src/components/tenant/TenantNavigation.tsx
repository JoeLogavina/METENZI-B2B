import React from 'react';
import { Link, useLocation } from 'wouter';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, CreditCard, FileText, BarChart3, Users, Settings } from 'lucide-react';
import { TenantIndicator } from './TenantSwitcher';

export function TenantNavigation() {
  const { tenant } = useTenant();
  const [location] = useLocation();

  const navigationItems = [
    {
      label: 'Shop',
      icon: ShoppingCart,
      href: tenant.type === 'km-shop' ? '/shop/km' : '/shop/eur',
      active: location.startsWith('/shop') || location === '/b2b-shop' || location === '/'
    },
    {
      label: 'Cart',
      icon: Package,
      href: '/cart',
      active: location === '/cart'
    },
    {
      label: 'Wallet',
      icon: CreditCard,
      href: '/wallet',
      active: location === '/wallet'
    },
    {
      label: 'Orders',
      icon: FileText,
      href: '/orders',
      active: location === '/orders'
    }
  ];

  // Add admin navigation items
  if (tenant.isAdmin) {
    navigationItems.push(
      {
        label: 'Admin Panel',
        icon: BarChart3,
        href: '/admin-panel',
        active: location.startsWith('/admin')
      }
    );
  }

  return (
    <nav className="flex flex-col space-y-2">
      <div className="mb-4">
        <TenantIndicator />
      </div>
      
      {navigationItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={item.active ? "default" : "ghost"}
              className="w-full justify-start"
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}

export function TenantHeader() {
  const { tenant, getCurrencySymbol } = useTenant();

  const getShopTitle = () => {
    switch (tenant.type) {
      case 'admin':
        return `Admin Dashboard (${tenant.currency})`;
      case 'eur-shop':
        return 'B2B Software Store - EUR';
      case 'km-shop':
        return 'B2B Software Store - KM';
      default:
        return 'B2B Software Store';
    }
  };

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {getShopTitle()}
        </h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Currency: {getCurrencySymbol()}
          </span>
          {tenant.isAdmin && (
            <div className="flex space-x-2">
              <Link href="/shop/eur">
                <Button size="sm" variant="outline">
                  EUR Shop
                </Button>
              </Link>
              <Link href="/shop/km">
                <Button size="sm" variant="outline">
                  KM Shop
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}