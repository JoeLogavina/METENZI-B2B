import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Trash2
} from "lucide-react";

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
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    console.log("Admin panel auth check:", { isLoading, isAuthenticated, userRole: (user as any)?.role, user });
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
    <div className="min-h-screen bg-[#f5f6f5] font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Admin Header */}
      <header className="bg-[#6E6F71] border-b border-[#5a5b5d] px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
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
        <div className="w-64 bg-[#6E6F71] text-white flex-shrink-0">
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
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-2 text-[#6E6F71]">Loading users...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="table-header">
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-medium text-[#6E6F71] uppercase">User</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-[#6E6F71] uppercase">Email</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-[#6E6F71] uppercase">Role</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-[#6E6F71] uppercase">Status</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-[#6E6F71] uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(Array.isArray(users) ? users : users?.data || []).map((userItem: any) => (
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Price</th>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#FFB20F] font-mono">
                                €{product.price}
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
                                    setEditingProduct(product);
                                    setShowProductForm(true);
                                  }}
                                  className="text-[#FFB20F] border-[#FFB20F] hover:bg-[#FFB20F] hover:text-white"
                                >
                                  Edit
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
                          console.log('Submitted data:', data);
                          console.log('Product being edited:', editingProduct);
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
    purchasePrice: product?.purchasePrice || '',
    b2bPrice: product?.b2bPrice || '',
    retailPrice: product?.retailPrice || '',
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
      purchasePrice: formData.purchasePrice || null,
      b2bPrice: formData.b2bPrice || null,
      retailPrice: formData.retailPrice || null,
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

    try {
      const response = await fetch(`/api/admin/license-keys/${product.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          keys: licenseKeys,
          ignoreDuplicates: false
        }),
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
        description: `Added ${result.data.added.length} license keys`,
        variant: "default",
      });

      setLicenseKeys('');
      queryClient.invalidateQueries({ queryKey: [`/api/admin/license-keys/${product.id}`] });
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
        description: `Added ${result.data.added.length} license keys (${duplicateWarning.length} duplicates ignored)`,
        variant: "default",
      });

      setLicenseKeys('');
      setDuplicateWarning([]);
      setShowDuplicateDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/license-keys/${product.id}`] });
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
            Product Details
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
                {licenseKeys.split('\n').filter(k => k.trim()).length} keys ready to add
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
                    {duplicateWarning.map((key, index) => (
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
