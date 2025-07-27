import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import AdminLogin from "@/pages/admin-login";
import B2BShop from "@/pages/b2b-shop";
import CartPage from "@/pages/cart";
import CheckoutPage from "@/pages/checkout";
import AdminPanel from "@/pages/admin-panel";
import WalletPage from "@/pages/wallet-page";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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
          <Route path="/" component={B2BShop} />
          <Route path="/b2b-shop" component={B2BShop} />
          <Route path="/cart" component={CartPage} />
          <Route path="/checkout" component={CheckoutPage} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/admin-panel" component={AdminPanel} />
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
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
