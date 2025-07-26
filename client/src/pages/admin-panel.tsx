import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  ShoppingCart, 
  Key, 
  Package, 
  BarChart3,
  Settings,
  Shield,
  FileText,
  X
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  totalSales: string;
  activeKeys: number;
  totalProducts: number;
}

export default function AdminPanel() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("dashboard");

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || ((user as any)?.role !== 'admin' && (user as any)?.role !== 'super_admin'))) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, (user as any)?.role, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard"],
    enabled: isAuthenticated && ((user as any)?.role === 'admin' || (user as any)?.role === 'super_admin'),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && (user as any)?.role === 'super_admin' && activeSection === 'users',
  });

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

  if (!isAuthenticated || ((user as any)?.role !== 'admin' && (user as any)?.role !== 'super_admin')) {
    return null;
  }

  const sidebarItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard', allowed: true },
    { id: 'users', icon: Users, label: 'User Management', allowed: (user as any)?.role === 'super_admin' },
    { id: 'products', icon: Package, label: 'Product Management', allowed: true },
    { id: 'keys', icon: Key, label: 'Key Management', allowed: true },
    { id: 'permissions', icon: Shield, label: 'Permissions', allowed: (user as any)?.role === 'super_admin' },
    { id: 'reports', icon: FileText, label: 'Reports', allowed: true },
  ].filter(item => item.allowed);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeItem="admin" userRole={(user as any)?.role} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Admin Sidebar */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
            <p className="text-sm text-gray-500 capitalize">{(user as any)?.role?.replace('_', ' ')} Access</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeSection === item.id
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Admin Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 capitalize">
              {activeSection === 'dashboard' ? 'Dashboard Overview' : activeSection.replace('_', ' ')}
            </h3>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {activeSection === 'dashboard' && (
              <div className="space-y-8">
                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Users</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {statsLoading ? '...' : stats?.totalUsers || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <ShoppingCart className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Sales</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {statsLoading ? '...' : stats?.totalSales || '€0'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Key className="h-6 w-6 text-purple-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Active Keys</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {statsLoading ? '...' : stats?.activeKeys || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Package className="h-6 w-6 text-orange-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Products</p>
                          <p className="text-2xl font-semibold text-gray-900">
                            {statsLoading ? '...' : stats?.totalProducts || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>System Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        Welcome to the admin dashboard. Use the sidebar to navigate between different management sections.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'users' && user?.role === 'super_admin' && (
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading users...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="table-header">
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {users.map((userItem: any) => (
                            <tr key={userItem.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                                    <Users className="h-4 w-4 text-gray-600" />
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {userItem.firstName} {userItem.lastName}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900">{userItem.email}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                                  userItem.role === 'super_admin' 
                                    ? 'bg-red-100 text-red-800'
                                    : userItem.role === 'admin'
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {userItem.role?.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                                  userItem.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {userItem.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <Button variant="outline" size="sm">
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(activeSection === 'products' || activeSection === 'keys' || activeSection === 'permissions' || activeSection === 'reports') && (
              <Card>
                <CardHeader>
                  <CardTitle className="capitalize">{activeSection.replace('_', ' ')} Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Settings className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-4">
                      {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} management section coming soon.
                    </p>
                    <p className="text-sm text-gray-400">
                      This feature will be available in the next update.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
