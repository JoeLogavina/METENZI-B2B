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
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    companyName: "",
    firstName: "",
    lastName: "",
    phone: "",
    country: "",
    city: "",
    address: "",
  });

  // Get redirect parameter from URL
  const urlParams = new URLSearchParams(window.location.search);
  const redirectParam = urlParams.get('redirect');

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
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
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (registrationData: any) => {
      const res = await apiRequest("POST", "/api/register", registrationData);
      return res;
    },
    onSuccess: (data) => {
      toast({
        title: "Registration successful",
        description: "Your company account has been created!",
      });
      
      // Update user data in cache immediately
      queryClient.setQueryData(["/api/user"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Registration failed",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoginMode) {
      if (!formData.email || !formData.password) {
        toast({
          title: "Validation Error",
          description: "Please fill in all fields",
          variant: "destructive",
        });
        return;
      }
      loginMutation.mutate({ email: formData.email, password: formData.password });
    } else {
      if (!formData.email || !formData.password || !formData.companyName || !formData.firstName || !formData.lastName) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
      registerMutation.mutate({
        ...formData,
        tenantId: "eur", // Default to EUR tenant
        role: "b2b_user",
        branchType: "main_company"
      });
    }
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
                {isLoginMode ? (
                  redirectParam === 'admin' 
                    ? 'Admin Portal Access'
                    : redirectParam === 'eur'
                    ? 'EUR Panel Access'
                    : redirectParam === 'km'
                    ? 'KM Panel Access'
                    : 'Sign in to your account'
                ) : (
                  'Register Your Company'
                )}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                {isLoginMode ? (
                  redirectParam === 'admin' 
                    ? 'Administrative access for both EUR and KM tenants'
                    : redirectParam === 'eur'
                    ? 'European market B2B software licensing'
                    : redirectParam === 'km'
                    ? 'Bosnian market B2B software licensing'
                    : 'Access your B2B software license portal'
                ) : (
                  'Create your company account for B2B software licensing'
                )}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLoginMode && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                          First Name *
                        </Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          type="text"
                          required
                          value={formData.firstName}
                          onChange={handleChange}
                          className="mt-1"
                          placeholder="Enter first name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                          Last Name *
                        </Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          type="text"
                          required
                          value={formData.lastName}
                          onChange={handleChange}
                          className="mt-1"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                        Company Name *
                      </Label>
                      <Input
                        id="companyName"
                        name="companyName"
                        type="text"
                        required
                        value={formData.companyName}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Enter company name"
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email {!isLoginMode && '*'}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password {!isLoginMode && '*'}
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

                {!isLoginMode && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="text"
                          value={formData.phone}
                          onChange={handleChange}
                          className="mt-1"
                          placeholder="Enter phone number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="country" className="text-sm font-medium text-gray-700">
                          Country
                        </Label>
                        <Input
                          id="country"
                          name="country"
                          type="text"
                          value={formData.country}
                          onChange={handleChange}
                          className="mt-1"
                          placeholder="Enter country"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                        City
                      </Label>
                      <Input
                        id="city"
                        name="city"
                        type="text"
                        value={formData.city}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Enter city"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                        Address
                      </Label>
                      <Input
                        id="address"
                        name="address"
                        type="text"
                        value={formData.address}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Enter address"
                      />
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending || registerMutation.isPending}
                >
                  {(loginMutation.isPending || registerMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {isLoginMode ? "Signing in..." : "Creating account..."}
                    </>
                  ) : (
                    isLoginMode ? "Sign in" : "Register Company"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLoginMode(!isLoginMode)}
                  className="text-sm text-primary hover:underline"
                >
                  {isLoginMode ? "Need to register a new company? Click here" : "Already have an account? Sign in"}
                </button>
              </div>

              {isLoginMode && (
                <div className="mt-4 text-center space-y-1">
                  <p className="text-xs text-gray-500">
                    Demo accounts - Email/Password:
                  </p>
                  <p className="text-xs text-gray-500">
                    b2b@example.com / password
                  </p>
                  <p className="text-xs text-gray-500">
                    admin@example.com / Kalendar1
                  </p>
                </div>
              )}
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