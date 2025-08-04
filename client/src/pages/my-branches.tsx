import { useAuth } from "@/hooks/useAuth";
import { MyBranches } from "@/components/b2b/MyBranches";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function MyBranchesPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/auth");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Redirect non-B2B users
  useEffect(() => {
    if (user && user.role !== 'b2b_user') {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-spanish-yellow mx-auto"></div>
          <p className="mt-2 text-corporate-gray">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || user.role !== 'b2b_user') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <MyBranches />
      </div>
    </div>
  );
}