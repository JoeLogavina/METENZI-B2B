import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Shield, ArrowLeft } from "lucide-react";
import { Redirect } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function AdminLogin() {
  const { user, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  // Redirect if already authenticated admin - using React Router
  if (isAuthenticated && user && ['admin', 'super_admin'].includes((user as any).role)) {
    return <Redirect to="/admin-panel" />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (userData) => {
      // Update user data in cache
      queryClient.setQueryData(["/api/user"], userData);
      
      // Check if user has admin role
      if (userData && ['admin', 'super_admin'].includes(userData.role)) {
        toast({
          title: "Admin Login Successful",
          description: "Welcome to Admin Panel!",
        });
        
        // Invalidate queries to refresh auth state
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }, 100);
      } else {
        toast({
          title: "Access Denied",
          description: "Admin privileges required to access this portal.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error?.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-[#f5f6f5] font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Header */}
      <header className="bg-[#4D585A] border-b border-[#3a4446] px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => window.location.href = '/'}
              className="text-white hover:bg-[#3a4446] p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#4D9DE0] rounded flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white uppercase tracking-[0.5px]">
                  ADMIN PORTAL
                </h1>
                <p className="text-sm text-gray-300">Secure Administrative Access</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Login Form */}
      <div className="flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-md w-full">
          <Card className="shadow-lg border-0">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto w-16 h-16 bg-[#4D9DE0]/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-[#4D9DE0]" />
              </div>
              <CardTitle className="text-2xl font-bold text-[#4D585A] uppercase tracking-[0.5px]">
                ADMIN ACCESS
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Secure login for administrative personnel
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    ADMIN USERNAME
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    className="mt-1 border-gray-300 focus:border-[#4D9DE0] focus:ring-[#4D9DE0]"
                    placeholder="Enter admin username"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PASSWORD
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="mt-1 border-gray-300 focus:border-[#4D9DE0] focus:ring-[#4D9DE0]"
                    placeholder="Enter password"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-[#4D9DE0] hover:bg-[#4a94d1] text-white font-medium py-2.5 rounded-[5px] transition-all duration-200 uppercase tracking-[0.5px]"
                >
                  {isLoggingIn ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      AUTHENTICATING...
                    </div>
                  ) : (
                    'ACCESS ADMIN PORTAL'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-xs text-gray-500">
                    For B2B customer access, return to the{' '}
                    <button
                      onClick={() => window.location.href = '/auth'}
                      className="text-[#4D9DE0] hover:underline font-medium"
                    >
                      main login page
                    </button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Security Notice */}
      <div className="max-w-md mx-auto px-4 pb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-amber-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-amber-800 uppercase tracking-[0.5px]">
                SECURITY NOTICE
              </h4>
              <p className="text-xs text-amber-700 mt-1">
                This portal is restricted to authorized administrative personnel only. 
                All access attempts are logged and monitored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}