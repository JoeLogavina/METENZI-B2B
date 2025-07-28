import { Switch, Route, Redirect, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { WalletProvider } from "@/contexts/WalletContext";
import { TenantProvider } from "@/contexts/TenantContext";
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
const EURShop = lazy(() => import("@/pages/eur-shop"));
const KMShop = lazy(() => import("@/pages/km-shop"));
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
          {/* Root route - redirect based on tenant */}
          <Route path="/" component={() => {
            const { user } = useAuth();
            const [location, setLocation] = useLocation();
            
            useEffect(() => {
              if (user?.tenantId === 'km') {
                setLocation('/shop/km');
              } else if (user?.tenantId === 'eur') {
                setLocation('/shop/eur');
              } else {
                setLocation('/shop/eur'); // Default to EUR
              }
            }, [user, setLocation]);
            
            return (
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-gray-600">Redirecting to your tenant...</p>
                </div>
              </div>
            );
          }} />
          
          {/* Tenant-specific B2B Shop Routes */}
          <Route path="/shop/eur" component={() => (
            <Suspense fallback={<ShopLoadingFallback />}>
              <EURShop />
            </Suspense>
          )} />
          <Route path="/shop/km" component={() => (
            <Suspense fallback={<ShopLoadingFallback />}>
              <KMShop />
            </Suspense>
          )} />
          
          {/* Legacy routes redirect to tenant-specific shops */}
          <Route path="/eur" component={() => {
            const [, setLocation] = useLocation();
            useEffect(() => setLocation('/shop/eur'), [setLocation]);
            return null;
          }} />
          <Route path="/km" component={() => {
            const [, setLocation] = useLocation();
            useEffect(() => setLocation('/shop/km'), [setLocation]);
            return null;
          }} />
          <Route path="/b2b-shop" component={() => {
            const { user } = useAuth();
            const [, setLocation] = useLocation();
            useEffect(() => {
              if (user?.tenantId === 'km') {
                setLocation('/shop/km');
              } else {
                setLocation('/shop/eur');
              }
            }, [user, setLocation]);
            return null;
          }} />
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
          <Route path="/admin/products/edit" component={() => (
            <Suspense fallback={<AdminLoadingFallback />}>
              <AdminPanel />
            </Suspense>
          )} />

          <Route path="/admin" component={() => <Redirect to="/admin-panel" />} />
          <Route path="/admin-login" component={() => <Redirect to="/admin-panel" />} />
          <Route path="/auth" component={() => <Redirect to="/" />} />
        </>
      )}
      {/* Fallback for any unmatched routes */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TenantProvider>
          <WalletProvider>
            <Toaster />
            <Router />
          </WalletProvider>
        </TenantProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
