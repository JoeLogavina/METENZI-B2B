// TIER 2 ENTERPRISE OPTIMIZATION: Loading Fallback Component
// Reusable loading component for lazy-loaded routes

import { Loader2 } from "lucide-react";

interface LoadingFallbackProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export function LoadingFallback({ 
  message = "Loading...", 
  size = "md",
  fullScreen = true 
}: LoadingFallbackProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  };

  const containerClasses = fullScreen 
    ? "min-h-screen flex items-center justify-center bg-[#f5f6f5]"
    : "flex items-center justify-center py-12";

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className={`animate-spin rounded-full border-b-2 border-[#4D9DE0] mx-auto ${sizeClasses[size]}`}>
          <Loader2 className={`${sizeClasses[size]} text-transparent`} />
        </div>
        <p className="mt-3 text-gray-600 font-medium">{message}</p>
        <div className="mt-2 text-sm text-gray-400">
          Optimizing your experience...
        </div>
      </div>
    </div>
  );
}

// Specialized loading components for different page types
export function ShopLoadingFallback() {
  return <LoadingFallback message="Loading B2B Shop..." />;
}

export function CartLoadingFallback() {
  return <LoadingFallback message="Loading Shopping Cart..." />;
}

export function AdminLoadingFallback() {
  return <LoadingFallback message="Loading Admin Panel..." />;
}

export function WalletLoadingFallback() {
  return <LoadingFallback message="Loading Wallet..." />;
}

export function OrdersLoadingFallback() {
  return <LoadingFallback message="Loading Orders..." />;
}

export function CheckoutLoadingFallback() {
  return <LoadingFallback message="Processing Checkout..." />;
}