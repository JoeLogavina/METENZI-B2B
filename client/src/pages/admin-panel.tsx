import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users, 
  ShoppingCart, 
  Key, 
  Package, 
  BarChart3,
  Settings,
  Shield,
  FileText,
  X,
  Plus,
  Edit,
  Trash2,
  Wallet,
  DollarSign
} from "lucide-react";
import WalletManagement from "@/components/wallet-management";
import UserForm from "@/components/user-form";
import PriceManagementPage from "@/pages/admin/price-management";
import { formatAdminPrice, convertEurToKm } from "@/lib/currency-utils";

interface DashboardStats {
  totalUsers: number;
  totalSales: string;
  activeKeys: number;
  totalProducts: number;
}

export default function AdminPanel() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Check if we're on the edit product page
  const urlParams = new URLSearchParams(window.location.search);
  const urlEditProductId = urlParams.get('id');
  const isEditProductPage = window.location.pathname === '/admin/products/edit' && urlEditProductId;
  
  // Edit product ID state
  const [editProductId, setEditProductId] = useState(urlEditProductId);
  
  const [activeSection, setActiveSection] = useState(isEditProductPage ? "edit-product" : "dashboard");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  // Edit product states
  const [editProductFormData, setEditProductFormData] = useState({
    name: '',
    description: '',
    htmlDescription: '',
    warranty: '',
    category: '',
    platform: '',
    region: '',
    imageUrl: '',
    isActive: true
  });
  const [editEurPricing, setEditEurPricing] = useState({
    price: '',
    purchasePrice: '',
    retailPrice: '',
    stock: ''
  });
  const [editKmPricing, setEditKmPricing] = useState({
    priceKm: '',
    purchasePriceKm: '',
    retailPriceKm: ''
  });
  const [editActiveTab, setEditActiveTab] = useState('details');
  const [editLicenseKeys, setEditLicenseKeys] = useState('');
  const [editUnsavedChanges, setEditUnsavedChanges] = useState(false);

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
    select: (data: any) => Array.isArray(data) ? data : (data?.data || []),
  });

  // Fetch wallet data for B2B users
  const { data: walletData = [], isLoading: walletLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/wallets"],
    enabled: isAuthenticated && (user as any)?.role === 'super_admin' && activeSection === 'users',
    select: (data) => Array.isArray(data) ? data : [],
  });

  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["/api/admin/products"],
    queryFn: async () => {
      const res = await fetch('/api/admin/products', {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    },
    enabled: isAuthenticated && activeSection === 'products',
    staleTime: 0,
    gcTime: 0,
  });

  // Edit product data queries
  const { data: editProductData, isLoading: editProductLoading } = useQuery({
    queryKey: [`/api/admin/products/${editProductId}`],
    enabled: !!editProductId && isAuthenticated && activeSection === 'edit-product',
  });
  
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    enabled: isAuthenticated && (activeSection === 'products' || activeSection === 'edit-product')
  });
  
  const { data: editProductLicenseKeys = [], refetch: refetchEditLicenseKeys } = useQuery({
    queryKey: [`/api/admin/license-keys/${editProductId}`],
    enabled: !!editProductId && isAuthenticated && activeSection === 'edit-product'
  });

  // Toggle product status function
  const toggleProductStatus = async (productId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product status');
      }

      toast({
        title: "Success",
        description: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
      });

      refetchProducts();
      // Also invalidate the B2B shop products cache
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update product status",
        variant: "destructive",
      });
    }
  };

  // Toggle user status function
  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const response = await apiRequest('PATCH', `/api/admin/users/${userId}/status`, {
        isActive
      });

      toast({
        title: "Success",
        description: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  // User form submission function
  const handleUserSubmit = async (userData: any) => {
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PATCH' : 'POST';
      
      await apiRequest(method, url, userData);
      
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      
      setShowUserForm(false);
      setEditingUser(null);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to save user');
    }
  };

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
    { id: 'price-management', icon: DollarSign, label: 'Price Management', allowed: true },
    { id: 'edit-product', icon: Edit, label: 'Edit Product', allowed: true, hidden: !isEditProductPage },
    { id: 'keys', icon: Key, label: 'Key Management', allowed: true },
    { id: 'wallets', icon: Wallet, label: 'Wallet Management', allowed: true },
    { id: 'permissions', icon: Shield, label: 'Permissions', allowed: (user as any)?.role === 'super_admin' },
    { id: 'reports', icon: FileText, label: 'Reports', allowed: true },
  ].filter(item => item.allowed && !item.hidden);

  return (
    <div className="min-h-screen bg-[#f5f6f5] font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Admin Header */}
      <header className="border-b border-[#5a5b5d] px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)] bg-[#343d3f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-[#FFB20F] rounded flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white uppercase tracking-[0.5px]">ADMIN PORTAL</h1>
              <p className="text-sm text-gray-300">System Administration & Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-white flex items-center">
              <Users className="w-4 h-4 mr-1" />
              <span className="font-medium capitalize">{(user as any)?.role?.replace('_', ' ')}</span>
            </div>
            <div className="text-sm text-white flex items-center">
              <Users className="w-4 h-4 mr-1" />
              <span className="font-medium">{(user as any)?.username}</span>
            </div>
            <Button
              size="sm"
              onClick={() => window.location.href = "/"}
              className="bg-[#4D9DE0] hover:bg-[#4a94d1] text-white border-0 px-4 py-2 rounded-[5px] font-medium transition-colors duration-200"
            >
              B2B PORTAL
            </Button>
            <Button
              size="sm"
              onClick={logout}
              disabled={isLoggingOut}
              className="bg-[#E15554] hover:bg-[#c74443] text-white border-0 px-4 py-2 rounded-[5px] font-medium transition-colors duration-200"
            >
              {isLoggingOut ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                "LOGOUT"
              )}
            </Button>
          </div>
        </div>
      </header>
      <div className="flex h-[calc(100vh-80px)]">
        {/* Admin Sidebar */}
        <div className="w-64 text-white flex-shrink-0 bg-[#23252f]">
          <div className="p-4 border-b border-[#5a5b5d]">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#FFB20F] rounded flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-sm uppercase tracking-[0.5px]">ADMIN PANEL</h2>
                <p className="text-xs text-gray-300 uppercase tracking-[0.5px]">MANAGEMENT</p>
              </div>
            </div>
          </div>
          
          <nav className="mt-4">
            {sidebarItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center px-4 py-3 text-lg transition-colors duration-200 cursor-pointer ${
                  activeSection === item.id
                    ? 'bg-[#FFB20F] text-white border-r-2 border-[#e6a00e]' 
                    : 'text-white hover:bg-[#7a7b7d]'
                }`}
              >
                <item.icon className="w-6 h-6 mr-3" />
                <span className="uppercase tracking-[0.5px] font-medium text-sm">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* Admin Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
              {activeSection === 'dashboard' ? 'DASHBOARD OVERVIEW' : activeSection.replace('_', ' ').toUpperCase()}
            </h3>
          </div>
          
          <div className="flex-1 overflow-auto p-6 bg-[#f5f6f5]">
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
                          <p className="text-sm font-medium text-[#6E6F71]">Total Users</p>
                          <p className="text-2xl font-semibold text-[#6E6F71]">
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
                          <p className="text-sm font-medium text-[#6E6F71]">Total Sales</p>
                          <p className="text-2xl font-semibold text-[#FFB20F]">
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
                          <p className="text-sm font-medium text-[#6E6F71]">Active Keys</p>
                          <p className="text-2xl font-semibold text-[#6E6F71]">
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
                          <p className="text-sm font-medium text-[#6E6F71]">Products</p>
                          <p className="text-2xl font-semibold text-[#6E6F71]">
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
                      <p className="text-[#6E6F71]">
                        Welcome to the admin dashboard. Use the sidebar to navigate between different management sections.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'users' && user?.role === 'super_admin' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">USER MANAGEMENT</h3>
                    <p className="text-[#6E6F71]">Manage B2B users and administrators</p>
                  </div>
                  <Button
                    onClick={() => setShowUserForm(true)}
                    className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    ADD USER
                  </Button>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[#6E6F71] uppercase tracking-[0.5px]">ALL USERS</h4>
                      <div className="text-sm text-[#6E6F71]">
                        {(users || []).length} users
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#6E6F71]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">User</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Wallet Balance</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {usersLoading ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F] mx-auto"></div>
                              <p className="mt-2 text-[#6E6F71]">Loading users...</p>
                            </td>
                          </tr>
                        ) : (users || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center">
                              <Users className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No users found</h3>
                              <p className="mt-1 text-sm text-[#6E6F71]">Get started by creating a new user account.</p>
                            </td>
                          </tr>
                        ) : (
                          (users || []).map((userData: any) => {
                            // Find wallet data for this user
                            const userWallet = walletData.find((wallet: any) => wallet.id === userData.id);
                            
                            return (
                              <tr key={userData.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                      <div className="h-10 w-10 bg-[#6E6F71] rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">
                                          {userData.firstName?.charAt(0) || userData.username?.charAt(0) || 'U'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-[#6E6F71]">
                                        <button
                                          onClick={() => setLocation(`/admin/users/edit?id=${userData.id}`)}
                                          className="text-[#FFB20F] hover:text-[#e6a00e] underline cursor-pointer"
                                        >
                                          {userData.firstName} {userData.lastName}
                                        </button>
                                      </div>
                                      <div className="text-sm text-gray-500">@{userData.username}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6E6F71]">
                                  {userData.email || 'No email'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    userData.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                                    userData.role === 'admin' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {userData.role?.replace('_', ' ') || 'Unknown'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {userData.role === 'b2b_user' && userWallet ? (
                                    <div className="text-sm">
                                      <div className="text-[#6E6F71] font-medium">
                                        €{userWallet.balance.totalAvailable}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Deposits: €{userWallet.balance.depositBalance} | Credit: €{userWallet.balance.availableCredit}
                                      </div>
                                    </div>
                                  ) : userData.role === 'b2b_user' ? (
                                    <div className="text-sm text-gray-500">Loading...</div>
                                  ) : (
                                    <div className="text-sm text-gray-400">N/A</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    userData.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {userData.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingUser(userData);
                                      setShowUserForm(true);
                                    }}
                                    className="text-[#FFB20F] border-[#FFB20F] hover:bg-[#FFB20F] hover:text-white"
                                  >
                                    Edit
                                  </Button>
                                  {userData.role === 'b2b_user' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setActiveSection('wallet-management');
                                        // You could also set selected user here
                                      }}
                                      className="text-[#6E6F71] border-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
                                    >
                                      <Wallet className="w-4 h-4 mr-1" />
                                      Wallet
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleUserStatus(userData.id, !userData.isActive)}
                                    className={userData.isActive ? 'text-red-600 border-red-600 hover:bg-red-600 hover:text-white' : 'text-green-600 border-green-600 hover:bg-green-600 hover:text-white'}
                                  >
                                    {userData.isActive ? 'Deactivate' : 'Activate'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'price-management' && (
              <PriceManagementPage />
            )}

            {activeSection === 'products' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">PRODUCT MANAGEMENT</h3>
                    <p className="text-[#6E6F71]">Manage software products visible to B2B users</p>
                  </div>
                  <Button
                    onClick={() => setShowProductForm(true)}
                    className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    ADD PRODUCT
                  </Button>
                </div>

                {/* Products Table */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-[#6E6F71] uppercase tracking-[0.5px]">ALL PRODUCTS</h4>
                      <div className="text-sm text-[#6E6F71]">
                        {(products?.data || []).length} products
                      </div>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#6E6F71]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Price (EUR / KM)</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Stock</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productsLoading ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4D9DE0] mx-auto"></div>
                              <p className="mt-2 text-[#6E6F71]">Loading products...</p>
                            </td>
                          </tr>
                        ) : (products?.data || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center">
                              <Package className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No products</h3>
                              <p className="mt-1 text-sm text-[#6E6F71]">Get started by creating a new product.</p>
                            </td>
                          </tr>
                        ) : (
                          (products?.data || []).map((product: any) => (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-lg bg-[#4D9DE0] flex items-center justify-center">
                                      <Package className="h-5 w-5 text-white" />
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-[#6E6F71]">{product.name}</div>
                                    <div className="text-sm text-[#6E6F71]">{product.platform}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {product.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium font-mono">
                                <div className="space-y-1">
                                  <div className="text-[#FFB20F]">€{product.price}</div>
                                  {product.priceKm && (
                                    <div className="text-[#6E6F71] text-xs">{product.priceKm} KM</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6E6F71] font-mono">
                                {product.stock}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  product.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {product.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditProductId(product.id);
                                    window.history.pushState({}, '', `/admin/products/edit?id=${product.id}`);
                                    setActiveSection('edit-product');
                                  }}
                                  className="text-[#FFB20F] border-[#FFB20F] hover:bg-[#FFB20F] hover:text-white"
                                >
                                  Advanced Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleProductStatus(product.id, !product.isActive)}
                                  className={product.isActive ? 'text-red-600 border-red-600 hover:bg-red-600 hover:text-white' : 'text-green-600 border-green-600 hover:bg-green-600 hover:text-white'}
                                >
                                  {product.isActive ? 'Deactivate' : 'Activate'}
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Product Form Modal */}
            {showProductForm && (
              <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="uppercase tracking-[0.5px]">
                      {editingProduct ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}
                    </DialogTitle>
                  </DialogHeader>
                  <ProductForm 
                    product={editingProduct}
                    onSubmit={async (data) => {
                      try {
                        const url = editingProduct 
                          ? `/api/admin/products/${editingProduct.id}`
                          : '/api/admin/products';
                        const method = editingProduct ? 'PUT' : 'POST';
                        
                        const response = await fetch(url, {
                          method,
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        });

                        if (!response.ok) {
                          const errorData = await response.json();
                          console.error('Product save error:', errorData);
                          throw new Error(errorData.message || 'Failed to save product');
                        }

                        toast({
                          title: "Success",
                          description: `Product ${editingProduct ? 'updated' : 'created'} successfully`,
                        });

                        setShowProductForm(false);
                        setEditingProduct(null);
                        refetchProducts();
                        // Also invalidate the B2B shop products cache
                        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: `Failed to ${editingProduct ? 'update' : 'create'} product`,
                          variant: "destructive",
                        });
                      }
                    }}
                    onCancel={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}

            {activeSection === 'edit-product' && (
              <EditProductIntegratedSection 
                editProductId={editProductId}
                editProductData={editProductData}
                editProductLoading={editProductLoading}
                editProductLicenseKeys={editProductLicenseKeys}
                refetchEditLicenseKeys={refetchEditLicenseKeys}
                categories={categories}
                editProductFormData={editProductFormData}
                setEditProductFormData={setEditProductFormData}
                editEurPricing={editEurPricing}
                setEditEurPricing={setEditEurPricing}
                editKmPricing={editKmPricing}
                setEditKmPricing={setEditKmPricing}
                editActiveTab={editActiveTab}
                setEditActiveTab={setEditActiveTab}
                editLicenseKeys={editLicenseKeys}
                setEditLicenseKeys={setEditLicenseKeys}
                editUnsavedChanges={editUnsavedChanges}
                setEditUnsavedChanges={setEditUnsavedChanges}
                setActiveSection={setActiveSection}
                queryClient={queryClient}
                toast={toast}
              />
            )}

            {activeSection === 'wallets' && <WalletManagement />}

            {(activeSection === 'keys' || activeSection === 'permissions' || activeSection === 'reports') && (
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
      {/* User Form Modal */}
      {showUserForm && (
        <Dialog open={showUserForm} onOpenChange={setShowUserForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-[0.5px]">
                {editingUser ? 'EDIT USER' : 'ADD NEW USER'}
              </DialogTitle>
            </DialogHeader>
            <UserForm 
              user={editingUser}
              onSubmit={handleUserSubmit}
              onCancel={() => {
                setShowUserForm(false);
                setEditingUser(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

}

// Edit Product Integrated Section Component
function EditProductIntegratedSection({
  editProductId,
  editProductData,
  editProductLoading,
  editProductLicenseKeys,
  refetchEditLicenseKeys,
  categories,
  editProductFormData,
  setEditProductFormData,
  editEurPricing,
  setEditEurPricing,
  editKmPricing,
  setEditKmPricing,
  editActiveTab,
  setEditActiveTab,
  editLicenseKeys,
  setEditLicenseKeys,
  editUnsavedChanges,
  setEditUnsavedChanges,
  setActiveSection,
  queryClient,
  toast
}: any) {
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Update form data when product loads
  useEffect(() => {
    if (editProductData && typeof editProductData === 'object') {
      // Handle both direct product data and wrapped in { data: product }
      const prod = editProductData.data || editProductData;
      console.log('Loading product data for edit:', prod);
      
      setEditProductFormData({
        name: prod.name || '',
        description: prod.description || '',
        htmlDescription: prod.htmlDescription || '',
        warranty: prod.warranty || '',
        category: prod.categoryId || '',
        platform: prod.platform || '',
        region: prod.region || '',
        imageUrl: prod.imageUrl || '',
        isActive: prod.isActive ?? true
      });

      setEditEurPricing({
        price: prod.price || '',
        purchasePrice: prod.purchasePrice || '',
        retailPrice: prod.retailPrice || '',
        stock: (prod.stockCount || prod.stock)?.toString() || ''
      });

      setEditKmPricing({
        priceKm: prod.priceKm || '',
        purchasePriceKm: prod.purchasePriceKm || '',
        retailPriceKm: prod.resellerPriceKm || ''
      });
    }
  }, [editProductData]);

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Please select a valid image file (JPG, PNG, GIF, or WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error", 
        description: "Image file size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/admin/products/${editProductId}/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const result = await response.json();
      
      // Update the form with the new image URL
      setEditProductFormData({ 
        ...editProductFormData, 
        imageUrl: result.data.imageUrl 
      });
      setEditUnsavedChanges(true);

      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });

      // Clear the file input
      event.target.value = '';
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const submitData = {
        ...editProductFormData,
        ...editEurPricing,
        ...editKmPricing,
        categoryId: editProductFormData.category,
        stock: editEurPricing.stock ? parseInt(editEurPricing.stock) : undefined
      };

      console.log('Submitting product data:', submitData);

      const response = await fetch(`/api/admin/products/${editProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submitData)
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to save product');
      }

      const result = await response.json();
      console.log('Success response:', result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      setEditUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${editProductId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      });
    }
  });

  // License keys mutation
  const saveKeysMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const response = await fetch(`/api/admin/license-keys/${editProductId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keys })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save license keys');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License keys saved successfully",
      });
      setEditLicenseKeys('');
      refetchEditLicenseKeys();
    },
    onError: (error: any) => {
      if (error.message.includes('duplicate')) {
        const duplicates = error.message.match(/Duplicate keys: (.+)/)?.[1]?.split(', ') || [];
        setDuplicateWarning(duplicates);
        setShowDuplicateDialog(true);
      } else {
        toast({
          title: "Error", 
          description: error.message || "Failed to save license keys",
          variant: "destructive",
        });
      }
    }
  });

  const handleSaveProduct = () => {
    console.log('Save button clicked');
    console.log('Form data:', editProductFormData);
    console.log('EUR pricing:', editEurPricing);
    console.log('KM pricing:', editKmPricing);
    saveProductMutation.mutate();
  };

  const handleSaveKeys = () => {
    const keys = editLicenseKeys.split('\n').filter((k: string) => k.trim()).map((k: string) => k.trim());
    if (keys.length > 0) {
      saveKeysMutation.mutate(keys);
    }
  };

  const handleSaveKeysIgnoreDuplicates = () => {
    const keys = editLicenseKeys.split('\n').filter((k: string) => k.trim()).map((k: string) => k.trim());
    // Remove duplicates from the keys array
    const uniqueKeys = keys.filter((key: string) => !duplicateWarning.includes(key));
    if (uniqueKeys.length > 0) {
      saveKeysMutation.mutate(uniqueKeys);
    }
    setShowDuplicateDialog(false);
    setDuplicateWarning([]);
  };

  const handleGoBack = () => {
    window.history.pushState({}, '', '/admin-panel');
    setActiveSection('products');
  };

  if (editProductLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F]"></div>
        <span className="ml-2 text-gray-600">Loading product...</span>
      </div>
    );
  }

  if (!editProductData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Product not found</p>
        <Button onClick={handleGoBack} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
          >
            ← Back to Products
          </Button>
          <div>
            <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
              ADVANCED EDIT PRODUCT
            </h3>
            <p className="text-[#6E6F71]">Editing: {editProductData?.data?.name || editProductData?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {editUnsavedChanges && (
            <span className="text-sm text-orange-600 font-medium">
              Unsaved changes
            </span>
          )}
          <Button
            onClick={handleSaveProduct}
            disabled={saveProductMutation.isPending}
            className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
          >
            {saveProductMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : null}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                type="button"
                onClick={() => setEditActiveTab('details')}
                className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                  editActiveTab === "details"
                    ? "border-[#FFB20F] text-[#FFB20F]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Product Details
              </button>
              <button
                type="button"
                onClick={() => setEditActiveTab('eur-pricing')}
                className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                  editActiveTab === "eur-pricing"
                    ? "border-[#FFB20F] text-[#FFB20F]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                EUR Pricing
              </button>
              <button
                type="button"
                onClick={() => setEditActiveTab('km-pricing')}
                className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                  editActiveTab === "km-pricing"
                    ? "border-[#FFB20F] text-[#FFB20F]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                KM Pricing
              </button>
              <button
                type="button"
                onClick={() => setEditActiveTab('keys')}
                className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                  editActiveTab === "keys"
                    ? "border-[#FFB20F] text-[#FFB20F]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                License Keys
              </button>
            </nav>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Product Details Tab */}
          {editActiveTab === "details" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PRODUCT NAME
                  </Label>
                  <Input
                    id="name"
                    value={editProductFormData.name}
                    onChange={(e) => {
                      setEditProductFormData({ ...editProductFormData, name: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    CATEGORY
                  </Label>
                  <Select 
                    value={editProductFormData.category} 
                    onValueChange={(value) => {
                      setEditProductFormData({ ...editProductFormData, category: value });
                      setEditUnsavedChanges(true);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    BASIC DESCRIPTION
                  </Label>
                  <Textarea
                    id="description"
                    value={editProductFormData.description}
                    onChange={(e) => {
                      setEditProductFormData({ ...editProductFormData, description: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    rows={4}
                    placeholder="Brief product description for listings"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="htmlDescription" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    DETAILED HTML DESCRIPTION
                  </Label>
                  <Textarea
                    id="htmlDescription"
                    value={editProductFormData.htmlDescription}
                    onChange={(e) => {
                      setEditProductFormData({ ...editProductFormData, htmlDescription: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1 font-mono text-sm"
                    rows={8}
                    placeholder="Rich HTML content with images, formatting, etc."
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    <p>• Supports full HTML including images, tables, lists</p>
                    <p>• Use &lt;img src="..." alt="..." /&gt; for images</p>
                    <p>• Use &lt;b&gt;, &lt;i&gt;, &lt;u&gt; for formatting</p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="imageUpload" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PRODUCT IMAGE
                  </Label>
                  <div className="mt-1 flex flex-col space-y-3">
                    {editProductFormData.imageUrl && (
                      <div className="relative">
                        <img 
                          src={editProductFormData.imageUrl} 
                          alt="Current product image" 
                          className="h-32 w-32 object-cover rounded-lg border border-gray-300"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setEditProductFormData({ ...editProductFormData, imageUrl: '' });
                            setEditUnsavedChanges(true);
                          }}
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    )}
                    <div className="relative">
                      <input
                        id="imageUpload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#FFB20F] file:text-white hover:file:bg-[#e6a00e] file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FFB20F]"></div>
                            <span className="text-sm text-gray-600">Uploading...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      <p>• Supported formats: JPG, PNG, GIF, WebP</p>
                      <p>• Maximum file size: 5MB</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="warranty" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    WARRANTY INFORMATION
                  </Label>
                  <Textarea
                    id="warranty"
                    value={editProductFormData.warranty}
                    onChange={(e) => {
                      setEditProductFormData({ ...editProductFormData, warranty: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    rows={3}
                    placeholder="Warranty terms, duration, coverage details..."
                  />
                </div>

                <div>
                  <Label htmlFor="region" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    REGION
                  </Label>
                  <Select 
                    value={editProductFormData.region} 
                    onValueChange={(value) => {
                      setEditProductFormData({ ...editProductFormData, region: value });
                      setEditUnsavedChanges(true);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Global">Global</SelectItem>
                      <SelectItem value="EU">Europe</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="Asia">Asia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="platform" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PLATFORM
                  </Label>
                  <Select 
                    value={editProductFormData.platform} 
                    onValueChange={(value) => {
                      setEditProductFormData({ ...editProductFormData, platform: value });
                      setEditUnsavedChanges(true);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Windows">Windows</SelectItem>
                      <SelectItem value="Mac">Mac</SelectItem>
                      <SelectItem value="Linux">Linux</SelectItem>
                      <SelectItem value="Both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4 border-t">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editProductFormData.isActive}
                  onChange={(e) => {
                    setEditProductFormData({ ...editProductFormData, isActive: e.target.checked });
                    setEditUnsavedChanges(true);
                  }}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active (visible to B2B users)
                </Label>
              </div>
            </div>
          )}

          {/* EUR Pricing Tab */}
          {editActiveTab === "eur-pricing" && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-green-800 mb-1">EUR Currency Pricing</h4>
                <p className="text-sm text-green-600">
                  Configure all pricing in Euros (€) for the primary market. 
                  These prices are displayed to B2B customers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    B2B PRICE (€)
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={editEurPricing.price}
                    onChange={(e) => {
                      setEditEurPricing({ ...editEurPricing, price: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    required
                    placeholder="Primary B2B price"
                  />
                </div>

                <div>
                  <Label htmlFor="purchasePrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PURCHASE PRICE (€)
                  </Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    step="0.01"
                    value={editEurPricing.purchasePrice}
                    onChange={(e) => {
                      setEditEurPricing({ ...editEurPricing, purchasePrice: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    placeholder="Internal cost price"
                  />
                </div>

                <div>
                  <Label htmlFor="retailPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    RETAIL PRICE (€)
                  </Label>
                  <Input
                    id="retailPrice"
                    type="number"
                    step="0.01"
                    value={editEurPricing.retailPrice}
                    onChange={(e) => {
                      setEditEurPricing({ ...editEurPricing, retailPrice: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    placeholder="Recommended retail price"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="stock" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    STOCK QUANTITY
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    value={editEurPricing.stock}
                    onChange={(e) => {
                      setEditEurPricing({ ...editEurPricing, stock: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    placeholder="Available license count"
                  />
                </div>
              </div>
            </div>
          )}

          {/* KM Pricing Tab */}
          {editActiveTab === "km-pricing" && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-blue-800 mb-1">KM Currency Pricing</h4>
                <p className="text-sm text-blue-600">
                  Configure pricing in Convertible Marks (KM) for the Bosnian market. 
                  These prices are used for regional B2B customers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    B2B PRICE (KM)
                  </Label>
                  <Input
                    id="priceKm"
                    type="number"
                    step="0.01"
                    value={editKmPricing.priceKm}
                    onChange={(e) => {
                      setEditKmPricing({ ...editKmPricing, priceKm: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    placeholder="Primary B2B price in KM"
                  />
                </div>

                <div>
                  <Label htmlFor="purchasePriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PURCHASE PRICE (KM)
                  </Label>
                  <Input
                    id="purchasePriceKm"
                    type="number"
                    step="0.01"
                    value={editKmPricing.purchasePriceKm}
                    onChange={(e) => {
                      setEditKmPricing({ ...editKmPricing, purchasePriceKm: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    placeholder="Internal cost in KM"
                  />
                </div>

                <div>
                  <Label htmlFor="retailPriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    RETAIL PRICE (KM)
                  </Label>
                  <Input
                    id="retailPriceKm"
                    type="number"
                    step="0.01"
                    value={editKmPricing.retailPriceKm}
                    onChange={(e) => {
                      setEditKmPricing({ ...editKmPricing, retailPriceKm: e.target.value });
                      setEditUnsavedChanges(true);
                    }}
                    className="mt-1"
                    placeholder="Recommended retail price in KM"
                  />
                </div>
              </div>
            </div>
          )}

          {/* License Keys Tab */}
          {editActiveTab === "keys" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-[0.5px]">
                    License Key Management
                  </h4>
                  <p className="text-sm text-gray-600">
                    Current keys: {Array.isArray(editProductLicenseKeys) ? editProductLicenseKeys.length : 0}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="licenseKeys" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    Add New License Keys (One per line)
                  </Label>
                  <Textarea
                    id="licenseKeys"
                    value={editLicenseKeys}
                    onChange={(e) => setEditLicenseKeys(e.target.value)}
                    className="mt-1 font-mono text-sm"
                    rows={10}
                    placeholder={`Enter license keys, one per line:
ABCD1-EFGH2-IJKL3-MNOP4-QRST5
XYZ12-ABC34-DEF56-GHI78-JKL90
...`}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {editLicenseKeys.split('\n').filter((k: string) => k.trim()).length} keys ready to add
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSaveKeys}
                    disabled={!editLicenseKeys.trim() || saveKeysMutation.isPending}
                    className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                  >
                    {saveKeysMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : null}
                    Save Keys
                  </Button>
                </div>
              </div>

              {/* Existing Keys Display */}
              {Array.isArray(editProductLicenseKeys) && editProductLicenseKeys.length > 0 && (
                <div className="border-t pt-6">
                  <h5 className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] mb-3">
                    Existing License Keys
                  </h5>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="space-y-1 font-mono text-xs">
                      {editProductLicenseKeys.map((key: any, index: number) => (
                        <div key={index} className="flex items-center justify-between">
                          <span className="text-gray-800">{key.keyValue}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            key.isUsed 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {key.isUsed ? 'Used' : 'Available'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Product Form Component
function ProductForm({ 
  product, 
  onSubmit, 
  onCancel 
}: { 
  product?: any; 
  onSubmit: (data: any) => void; 
  onCancel: () => void; 
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState("details");
  const [licenseKeys, setLicenseKeys] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || '',
    priceKm: product?.priceKm || '',
    purchasePrice: product?.purchasePrice || '',
    purchasePriceKm: product?.purchasePriceKm || '',
    b2bPrice: product?.b2bPrice || '',
    b2bPriceKm: product?.b2bPriceKm || '',
    retailPrice: product?.retailPrice || '',
    retailPriceKm: product?.retailPriceKm || '',
    imageUrl: product?.imageUrl || '',
    category: product?.categoryId || '',
    platform: product?.platform || '',
    region: product?.region || '',
    stock: product?.stockCount || product?.stock || '',
    isActive: product?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare data for submission - keep price as string since backend expects it
    const submitData: any = {
      name: formData.name,
      description: formData.description,
      price: formData.price,
      priceKm: formData.priceKm || null,
      purchasePrice: formData.purchasePrice || null,
      purchasePriceKm: formData.purchasePriceKm || null,
      b2bPrice: formData.b2bPrice || null,
      b2bPriceKm: formData.b2bPriceKm || null,
      retailPrice: formData.retailPrice || null,
      retailPriceKm: formData.retailPriceKm || null,
      imageUrl: formData.imageUrl || null,
      platform: formData.platform,
      region: formData.region,
      isActive: formData.isActive,
    };

    // Only include category if it's provided and not empty
    if (formData.category && formData.category.trim()) {
      submitData.categoryId = formData.category;
    }

    // Only include stock if it's provided (since it's not required)
    if (formData.stock && formData.stock.trim()) {
      submitData.stock = parseInt(formData.stock);
    }

    onSubmit(submitData);
  };

  const handleSaveKeys = async () => {
    if (!product?.id || !licenseKeys.trim()) {
      toast({
        title: "Error",
        description: "Please enter license keys to save",
        variant: "destructive",
      });
      return;
    }

    
    // Parse and validate keys
    const keyValues = licenseKeys
      .split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0);
    

    try {
      const requestBody = {
        keys: licenseKeys,
        ignoreDuplicates: false
      };
      

      const response = await fetch(`/api/admin/license-keys/${product.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.status === 409) {
        // Handle duplicates
        setDuplicateWarning(result.data.duplicates);
        setShowDuplicateDialog(true);
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save keys');
      }

      toast({
        title: "Success",
        description: `Added ${result.data.added.length} license keys. Stock updated to ${result.data.stats.available} available keys.`,
        variant: "default",
      });

      setLicenseKeys('');
      queryClient.invalidateQueries({ queryKey: [`/api/admin/license-keys/${product.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save license keys",
        variant: "destructive",
      });
    }
  };

  const handleSaveKeysIgnoreDuplicates = async () => {
    if (!product?.id) return;

    try {
      const response = await fetch(`/api/admin/license-keys/${product.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          keys: licenseKeys,
          ignoreDuplicates: true
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save keys');
      }

      toast({
        title: "Success", 
        description: `Added ${result.data.added.length} license keys (${duplicateWarning.length} duplicates ignored). Stock updated to ${result.data.stats.available} available keys.`,
        variant: "default",
      });

      setLicenseKeys('');
      setDuplicateWarning([]);
      setShowDuplicateDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/license-keys/${product.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save license keys",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setCurrentTab("details")}
            className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
              currentTab === "details"
                ? "border-[#FFB20F] text-[#FFB20F]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            EUR Details
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab("km-pricing")}
            className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
              currentTab === "km-pricing"
                ? "border-[#FFB20F] text-[#FFB20F]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            KM Pricing
          </button>
          {product?.id && (
            <button
              type="button"
              onClick={() => setCurrentTab("keys")}
              className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                currentTab === "keys"
                  ? "border-[#FFB20F] text-[#FFB20F]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              License Keys
            </button>
          )}
          {product?.id && (
            <button
              type="button"
              onClick={() => setCurrentTab("keys")}
              className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                currentTab === "keys"
                  ? "border-[#FFB20F] text-[#FFB20F]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              License Keys
            </button>
          )}
        </nav>
      </div>

      {/* Product Details Tab */}
      {currentTab === "details" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                PRODUCT NAME
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="category" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                CATEGORY
              </Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5f7c2d93-0865-489c-bc73-8c7521ca978d">Development Tools</SelectItem>
                  <SelectItem value="04c7d498-572f-46ca-bc54-2be8812035d4">Design Software</SelectItem>
                  <SelectItem value="dbe15a4f-3eab-44f0-bfcf-8427259ad19c">Business Applications</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                DESCRIPTION
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="price" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                DISPLAY PRICE (€)
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="priceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                PRICE (KM) - Bosnian Mark
              </Label>
              <Input
                id="priceKm"
                type="number"
                step="0.01"
                value={formData.priceKm}
                onChange={(e) => setFormData({ ...formData, priceKm: e.target.value })}
                className="mt-1"
                placeholder="Optional - for future tenant"
              />
              <p className="text-xs text-gray-500 mt-1">
                For future Bosnian market tenant (1 EUR ≈ 1.96 KM)
              </p>
            </div>

            <div>
              <Label htmlFor="purchasePrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                PURCHASE PRICE (€)
              </Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                className="mt-1"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="b2bPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                B2B PRICE (€)
              </Label>
              <Input
                id="b2bPrice"
                type="number"
                step="0.01"
                value={formData.b2bPrice}
                onChange={(e) => setFormData({ ...formData, b2bPrice: e.target.value })}
                className="mt-1"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="retailPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                RETAIL PRICE (€)
              </Label>
              <Input
                id="retailPrice"
                type="number"
                step="0.01"
                value={formData.retailPrice}
                onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                className="mt-1"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="stock" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                STOCK
              </Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="mt-1"
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="imageUrl" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                IMAGE URL
              </Label>
              <Input
                id="imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="mt-1"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <Label htmlFor="platform" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                PLATFORM
              </Label>
              <Select 
                value={formData.platform} 
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Windows">Windows</SelectItem>
                  <SelectItem value="Mac">Mac</SelectItem>
                  <SelectItem value="Linux">Linux</SelectItem>
                  <SelectItem value="Web">Web</SelectItem>
                  <SelectItem value="Windows, Mac">Windows & Mac</SelectItem>
                  <SelectItem value="Windows, Mac, Linux">Windows, Mac & Linux</SelectItem>
                  <SelectItem value="All Platforms">All Platforms</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="region" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                REGION
              </Label>
              <Select 
                value={formData.region} 
                onValueChange={(value) => setFormData({ ...formData, region: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Global">Global</SelectItem>
                  <SelectItem value="EU">Europe</SelectItem>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="Asia">Asia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active (visible to B2B users)
              </Label>
            </div>

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="px-6"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white px-6"
              >
                {product ? 'UPDATE' : 'CREATE'} PRODUCT
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* KM Pricing Tab */}
      {currentTab === "km-pricing" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                DISPLAY PRICE (KM)
              </Label>
              <Input
                id="priceKm"
                type="number"
                step="0.01"
                value={formData.priceKm}
                onChange={(e) => setFormData({ ...formData, priceKm: e.target.value })}
                className="mt-1"
                placeholder="Bosnian Mark price"
              />
              <p className="text-xs text-gray-500 mt-1">
                For future Bosnian market tenant (1 EUR ≈ 1.96 KM)
              </p>
            </div>

            <div>
              <Label htmlFor="purchasePriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                PURCHASE PRICE (KM)
              </Label>
              <Input
                id="purchasePriceKm"
                type="number"
                step="0.01"
                value={formData.purchasePriceKm}
                onChange={(e) => setFormData({ ...formData, purchasePriceKm: e.target.value })}
                className="mt-1"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="b2bPriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                B2B PRICE (KM)
              </Label>
              <Input
                id="b2bPriceKm"
                type="number"
                step="0.01"
                value={formData.b2bPriceKm}
                onChange={(e) => setFormData({ ...formData, b2bPriceKm: e.target.value })}
                className="mt-1"
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="retailPriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                RETAIL PRICE (KM)
              </Label>
              <Input
                id="retailPriceKm"
                type="number"
                step="0.01"
                value={formData.retailPriceKm}
                onChange={(e) => setFormData({ ...formData, retailPriceKm: e.target.value })}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="px-6"
            >
              CANCEL
            </Button>
            <Button
              type="submit"
              className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white px-6"
            >
              {product ? 'UPDATE' : 'CREATE'} PRODUCT
            </Button>
          </div>
        </form>
      )}

      {/* License Keys Tab */}
      {currentTab === "keys" && product?.id && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 uppercase tracking-[0.5px]">
                License Key Management
              </h4>
              <p className="text-sm text-gray-600">
                Add license keys for {product.name}. Each line represents one key.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="licenseKeys" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                License Keys (One per line)
              </Label>
              <Textarea
                id="licenseKeys"
                value={licenseKeys}
                onChange={(e) => setLicenseKeys(e.target.value)}
                className="mt-1 font-mono text-sm"
                rows={20}
                placeholder={`Enter license keys, one per line:
ABCD1-EFGH2-IJKL3-MNOP4-QRST5
XYZ12-ABC34-DEF56-GHI78-JKL90
...`}
              />
              <p className="mt-2 text-xs text-gray-500">
                Format: 3-6 blocks with 5-6 characters each. Spaces between blocks are allowed.
              </p>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-600">
                {licenseKeys.split('\n').filter((k: string) => k.trim()).length} keys ready to add
              </div>
              
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="px-6"
                >
                  CLOSE
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveKeys}
                  disabled={!licenseKeys.trim()}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white px-6"
                >
                  SAVE KEYS
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning Dialog */}
      {showDuplicateDialog && (
        <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600 uppercase tracking-[0.5px]">
                Duplicate Keys Found
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  The following keys already exist:
                </p>
                <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-md">
                  <ul className="text-xs font-mono space-y-1">
                    {duplicateWarning.map((key: string, index: number) => (
                      <li key={index} className="text-red-600">{key}</li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDuplicateDialog(false)}
                  className="px-4"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveKeysIgnoreDuplicates}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white px-4"
                >
                  Save Anyway
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
