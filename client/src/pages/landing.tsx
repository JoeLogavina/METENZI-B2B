import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ShoppingCart, Shield, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen enterprise-gray">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded flex items-center justify-center">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">B2B Portal</h1>
                <p className="text-sm text-gray-600">Enterprise Software Solutions</p>
              </div>
            </div>
            <Button onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Enterprise Software
            <span className="block text-primary">License Management</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Streamline your B2B software procurement with our comprehensive license key management platform. 
            Secure, scalable, and designed for enterprise needs.
          </p>
          <div className="mt-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* EUR Panel Access */}
              <Card className="border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">EUR Panel</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    European market B2B software licensing with EUR pricing
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/auth?redirect=eur'}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Access EUR Panel
                  </Button>
                </CardContent>
              </Card>

              {/* KM Panel Access */}
              <Card className="border-2 border-green-200 hover:border-green-400 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">KM Panel</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Bosnian market B2B software licensing with KM pricing
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/auth?redirect=km'}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Access KM Panel
                  </Button>
                </CardContent>
              </Card>

              {/* Admin Panel Access */}
              <Card className="border-2 border-yellow-200 hover:border-yellow-400 transition-colors cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-6 w-6 text-yellow-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Panel</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Administrative control for both EUR and KM tenants
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/auth?redirect=admin'}
                    className="w-full bg-yellow-600 hover:bg-yellow-700"
                  >
                    Access Admin Panel
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Multi-Tenant Architecture</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Complete separation between EUR and KM markets with unified administrative control. 
              Each tenant has isolated data, pricing, and user management.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">EUR Marketplace</h3>
                <p className="text-gray-600">
                  European B2B software licensing with EUR pricing, isolated cart, orders, and wallet system.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">KM Marketplace</h3>
                <p className="text-gray-600">
                  Bosnian B2B software licensing with KM pricing, completely separate from EUR tenant.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Unified Admin Control</h3>
                <p className="text-gray-600">
                  Administrative panel with access to both tenants for product management and user oversight.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500">
            <p>&copy; 2025 B2B Portal. Enterprise Edition v4.1</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
