// TIER 2 ENTERPRISE OPTIMIZATION: Component-Level Lazy Loading
// Heavy components that benefit from dynamic imports

import { lazy } from "react";

// Lazy-load heavy chart/analytics components
export const WalletManagement = lazy(() => 
  import("@/components/wallet-management").then(module => ({
    default: module.default
  }))
);

// Lazy-load heavy UI components that exist
export const ProductTable = lazy(() => 
  import("@/components/product-table").then(module => ({
    default: module.default
  }))
);

export const FiltersPanel = lazy(() => 
  import("@/components/filters-panel").then(module => ({
    default: module.default
  }))
);

export const CartModal = lazy(() => 
  import("@/components/cart-modal").then(module => ({
    default: module.default
  }))
);

// Create lazy-loaded wrapper components with proper typing
export function LazyWalletManagement(props: React.ComponentProps<typeof WalletManagement>) {
  return (
    <WalletManagement {...props} />
  );
}

export function LazyProductTable(props: React.ComponentProps<typeof ProductTable>) {
  return (
    <ProductTable {...props} />
  );
}

export function LazyFiltersPanel(props: React.ComponentProps<typeof FiltersPanel>) {
  return (
    <FiltersPanel {...props} />
  );
}

export function LazyCartModal(props: React.ComponentProps<typeof CartModal>) {
  return (
    <CartModal {...props} />
  );
}