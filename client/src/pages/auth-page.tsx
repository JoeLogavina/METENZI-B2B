import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Building2 } from "lucide-react";
import { Redirect } from "wouter";

export default function AuthPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  // Get redirect parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const redirectParam = urlParams.get('redirect');

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return res;
    },
    onSuccess: (data) => {
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      
      // Update user data in cache immediately
      queryClient.setQueryData(["/api/user"], data);
      
      // Force immediate invalidation to trigger auth state update
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Validate tenant access for specific redirect parameters
      const userTenant = data.tenantId;
      const userRole = data.role;
      
      if (redirectParam === 'eur' && userTenant !== 'eur') {
        toast({
          title: "Access denied",
          description: "Your account does not have access to the EUR panel.",
          variant: "destructive",
        });
        return;
      }
      
      if (redirectParam === 'km' && userTenant !== 'km') {
        toast({
          title: "Access denied", 
          description: "Your account does not have access to the KM panel.",
          variant: "destructive",
        });
        return;
      }
      
      if (redirectParam === 'admin' && !['admin', 'super_admin'].includes(userRole)) {
        toast({
          title: "Access denied",
          description: "Your account does not have administrative privileges.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Login Successful",
        description: `Welcome to the ${redirectParam ? redirectParam.toUpperCase() : 'B2B'} panel!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Redirect based on authentication - using React Router redirect instead of window.location
  if (!isLoading && isAuthenticated && user) {
    console.log('Auth redirect logic:', { redirectParam, userTenant: user.tenantId, userRole: user.role });
    
    if (redirectParam === 'admin' && ['admin', 'super_admin'].includes(user.role)) {
      return <Redirect to="/admin-panel" />;
    } else if (user.role === 'admin' || user.role === 'super_admin') {
      return <Redirect to="/admin-panel" />;
    } else if (user.role === 'b2b_user') {
      return <Redirect to="/eur" />;
    } else if (user.tenantId === 'km') {
      return <Redirect to="/km" />;
    } else {
      return <Redirect to="/eur" />;
    }
  }

  // Show loading if checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                {redirectParam === 'admin' ? (
                  <ShieldCheck className="h-6 w-6 text-primary" />
                ) : redirectParam === 'eur' ? (
                  <Building2 className="h-6 w-6 text-blue-600" />
                ) : redirectParam === 'km' ? (
                  <Building2 className="h-6 w-6 text-green-600" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-primary" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                {redirectParam === 'admin' 
                  ? 'Admin Portal Access'
                  : redirectParam === 'eur'
                  ? 'EUR Panel Access'
                  : redirectParam === 'km'
                  ? 'KM Panel Access'
                  : 'Sign in to your account'
                }
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                {redirectParam === 'admin' 
                  ? 'Administrative access for both EUR and KM tenants'
                  : redirectParam === 'eur'
                  ? 'European market B2B software licensing'
                  : redirectParam === 'km'
                  ? 'Bosnian market B2B software licensing'
                  : 'Access your B2B software license portal'
                }
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                    Username
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    className="mt-1"
                    placeholder="Enter your username"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="mt-1"
                    placeholder="Enter your password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-1">
                <p className="text-xs text-gray-500">
                  Admin: admin / Kalendar1
                </p>
                <p className="text-xs text-gray-500">
                  B2B User: b2buser / Kalendar1
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero Section */}
      <div className="hidden lg:block relative flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
        <div className="relative flex items-center justify-center h-full px-8">
          <div className="text-center text-white max-w-md">
            <h1 className="text-4xl font-bold mb-6">
              B2B Software Licenses
            </h1>
            <p className="text-xl text-primary-foreground/90 mb-8">
              Streamlined license management for enterprise customers
            </p>
            <div className="space-y-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Browse and purchase software licenses</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Role-based access control</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Comprehensive admin dashboard</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-white rounded-full" />
                <span>Secure license key management</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}