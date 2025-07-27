import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";

export function useAdminAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/admin/auth/user"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/auth/user", {
          credentials: "include",
        });
        
        if (res.status === 401) {
          return null; // Not authenticated
        }
        
        if (!res.ok) {
          throw new Error(`${res.status}: ${res.statusText}`);
        }
        
        return await res.json();
      } catch (error) {
        console.error("Admin auth check failed:", error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/admin/auth/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth/user"] });
      queryClient.clear(); // Clear all cached data
      // Redirect to login page
      window.location.href = "/login";
    },
    onError: (error) => {
      console.error("Admin logout failed:", error);
      // Even if the request fails, clear local state and redirect
      queryClient.setQueryData(["/api/admin/auth/user"], null);
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin/auth/login", credentials);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/auth/user"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth/user"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    logout: () => logoutMutation.mutate(),
    login: loginMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    isLoggingIn: loginMutation.isPending,
  };
}