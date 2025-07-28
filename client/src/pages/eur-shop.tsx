import { useEffect } from "react";
import { useLocation } from "wouter";
import B2BShop from "./b2b-shop";

export default function EurShop() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to the tenant-aware route
    setLocation("/shop/eur");
  }, [setLocation]);

  return <B2BShop />;
}