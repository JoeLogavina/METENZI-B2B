import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { WalletProvider } from "@/contexts/WalletContext";
import { usePreloadRoutes } from "@/hooks/usePreloadRoutes";
import { useDataPreload } from "@/hooks/useDataPreload";
import { 
  ShopLoadingFallback, 
  CartLoadingFallback, 
  AdminLoadingFallback, 
  WalletLoadingFallback, 
  OrdersLoadingFallback,
  CheckoutLoadingFallback 
} from "@/components/ui/loading-fallback";

// TIER 2 ENTERPRISE OPTIMIZATION: Code Splitting & Lazy Loading
// Route-based code splitting for optimal bundle size and loading performance

// Public pages (loaded immediately for faster initial render)
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import AdminLogin from "@/pages/admin-login";
import NotFound from "@/pages/not-found";

// Private pages (lazy-loaded to reduce initial bundle size)
const B2BShop = lazy(() => import("@/pages/b2b-shop"));
const CartPage = lazy(() => import("@/pages/cart"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const AdminPanel = lazy(() => import("@/pages/admin-panel"));
const WalletPage = lazy(() => import("@/pages/wallet-page"));
const OrdersPage = lazy(() => import("@/pages/orders"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const { preloadOnHover } = usePreloadRoutes();
  const { preloadDataOnHover } = useDataPreload();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/admin-login" component={AdminLogin} />
        </>
      ) : (
        <>
          <Route path="/" component={() => (
            <Suspense fallback={<ShopLoadingFallback />}>
              <B2BShop />
            </Suspense>
          )} />
          <Route path="/b2b-shop" component={() => (
            <Suspense fallback={<ShopLoadingFallback />}>
              <B2BShop />
            </Suspense>
          )} />
          <Route path="/cart" component={() => (
            <Suspense fallback={<CartLoadingFallback />}>
              <CartPage />
            </Suspense>
          )} />
          <Route path="/checkout" component={() => (
            <Suspense fallback={<CheckoutLoadingFallback />}>
              <CheckoutPage />
            </Suspense>
          )} />
          <Route path="/wallet" component={() => (
            <Suspense fallback={<WalletLoadingFallback />}>
              <WalletPage />
            </Suspense>
          )} />
          <Route path="/orders" component={() => (
            <Suspense fallback={<OrdersLoadingFallback />}>
              <OrdersPage />
            </Suspense>
          )} />
          <Route path="/admin-panel" component={() => (
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminPanel />
            </Suspense>
          )} />
          <Route path="/admin" component={() => <Redirect to="/admin-panel" />} />
          <Route path="/auth" component={() => <Redirect to="/" />} />
          <Route path="/admin-login" component={() => <Redirect to="/admin-panel" />} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalletProvider>
          <Toaster />
          <Router />
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
