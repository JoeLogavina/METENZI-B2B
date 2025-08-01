import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Shield, Lock, AlertTriangle } from "lucide-react";
import { useCsrf } from "@/hooks/use-csrf";

interface LoginFormData {
  username: string;
  password: string;
}

export default function AdminLoginSecure() {
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const { toast } = useToast();
  const { token: csrfToken, loading: csrfLoading } = useCsrf();

  const maxAttempts = 5;
  const isBlocked = loginAttempts >= maxAttempts;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isBlocked) {
      toast({
        title: "Access Blocked",
        description: "Too many failed attempts. Please wait 15 minutes before trying again.",
        variant: "destructive",
      });
      return;
    }

    if (!csrfToken) {
      toast({
        title: "Security Error",
        description: "Security token not available. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (response.ok) {
        const user = await response.json();
        toast({
          title: "Login Successful",
          description: `Welcome back, ${user.username}!`,
        });
        
        // Reset attempts on successful login
        setLoginAttempts(0);
        
        // Redirect to admin panel
        window.location.href = "/admin-panel";
      } else {
        const errorData = await response.json().catch(() => ({}));
        
        // Increment failed attempts
        setLoginAttempts(prev => prev + 1);
        
        if (response.status === 429) {
          toast({
            title: "Rate Limited",
            description: errorData.message || "Too many login attempts. Please wait before trying again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: errorData.message || "Invalid credentials",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      toast({
        title: "Connection Error",
        description: "Unable to connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-[#FFB20F]/10 rounded-full border border-[#FFB20F]/20">
              <Shield className="w-12 h-12 text-[#FFB20F]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            SECURE ADMIN ACCESS
          </h1>
          <p className="text-slate-300 text-sm">
            Enhanced security portal with rate limiting and CSRF protection
          </p>
        </div>

        {/* Login Form */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-white flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-[#FFB20F]" />
              Administrator Login
            </CardTitle>
            <CardDescription className="text-slate-400">
              Protected with advanced security measures
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-200">
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-[#FFB20F] focus:ring-[#FFB20F]/20"
                  placeholder="Enter admin username"
                  required
                  disabled={isLoading || isBlocked || csrfLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-[#FFB20F] focus:ring-[#FFB20F]/20 pr-10"
                    placeholder="Enter password"
                    required
                    disabled={isLoading || isBlocked || csrfLoading}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    disabled={isLoading || isBlocked}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Security Status */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Attempts: {loginAttempts}/{maxAttempts}</span>
                <span className={`px-2 py-1 rounded ${csrfToken ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                  {csrfLoading ? 'Loading...' : csrfToken ? 'CSRF Protected' : 'Security Loading'}
                </span>
              </div>

              {isBlocked && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Access Temporarily Blocked</span>
                  </div>
                  <p className="text-xs text-red-300 mt-1">
                    Too many failed attempts. Please wait 15 minutes before trying again.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className={`w-full ${
                  isBlocked 
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                    : 'bg-[#FFB20F] hover:bg-[#FFB20F]/90 text-black font-semibold'
                } transition-all duration-200`}
                disabled={isLoading || isBlocked || csrfLoading || !csrfToken}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </div>
                ) : isBlocked ? (
                  "Access Blocked"
                ) : (
                  "Secure Login"
                )}
              </Button>
            </form>

            {/* Security Features */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-3">Security Features Active:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-green-400">
                    <Shield className="w-3 h-3" />
                    <span>Rate Limiting</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <Lock className="w-3 h-3" />
                    <span>CSRF Protection</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <Shield className="w-3 h-3" />
                    <span>Secure Headers</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-400">
                    <Lock className="w-3 h-3" />
                    <span>Session Security</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="text-center">
                <p className="text-xs text-slate-500">
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

        {/* Security Notice */}
        <div className="max-w-md mx-auto px-4">
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-amber-400 mt-0.5 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-amber-300 uppercase tracking-[0.5px]">
                  ENHANCED SECURITY NOTICE
                </h4>
                <p className="text-xs text-amber-200 mt-1">
                  This portal is protected with advanced security measures including rate limiting, 
                  CSRF protection, and session monitoring. All access attempts are logged and monitored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}