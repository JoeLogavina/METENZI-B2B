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
  DollarSign,
  CreditCard,
  History,
  UserCheck,
  UserX,
  TreePine,
  Activity,
  AlertTriangle,
  MessageCircle,
  Download,
  Play,
  Monitor,
  AlertCircle,
  Phone,
  BookOpen,
  Mail,
  Bot,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import WalletManagement from "@/components/wallet-management";
import UserForm from "@/components/user-form";
import PriceManagementPage from "@/pages/admin/price-management";
import UserEdit from "@/pages/admin/user-edit";
import { formatAdminPrice, convertEurToKm } from "@/lib/currency-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CategoryManagement } from "@/components/admin/CategoryManagement";
import { EmbeddedKeyManagement } from "@/components/admin/EmbeddedKeyManagement";
import { ComprehensiveProductForm } from "@/components/admin/ComprehensiveProductForm";
import { BranchManagement } from "@/components/admin/BranchManagement";
import { UserDetailView } from "@/components/admin/UserDetailView";
import { AdminSupportManagement } from "@/components/admin/AdminSupportManagement";
import { BrevoNotificationPanel } from "@/components/admin/BrevoNotificationPanel";
import { NotificationAnalyticsDashboard } from "@/components/admin/NotificationAnalyticsDashboard";
import { SmartNotificationsPanel } from "@/components/admin/SmartNotificationsPanel";
import OrdersManagement from "@/components/admin/OrdersManagement";

interface DashboardStats {
  totalUsers: number;
  totalSales: string;
  activeKeys: number;
  totalProducts: number;
}

// State-based navigation types
type AdminView = 
  | 'dashboard'
  | 'users'
  | 'user-detail'
  | 'user-branches'
  | 'products'
  | 'product-detail'
  | 'categories'
  | 'license-keys'
  | 'orders'
  | 'wallet'
  | 'reports'
  | 'settings'
  | 'security'
  | 'support'
  | 'notifications'
  | 'analytics'
  | 'smart-notifications';

interface AdminState {
  currentView: AdminView;
  selectedUserId?: string;
  selectedProductId?: string;
  breadcrumb: Array<{ label: string; view: AdminView; id?: string }>;
}

export default function AdminPanel() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // State-based navigation
  const [adminState, setAdminState] = useState<AdminState>({
    currentView: 'dashboard',
    breadcrumb: [{ label: 'Dashboard', view: 'dashboard' }]
  });


  // Navigation functions
  const navigateTo = (view: AdminView, id?: string, label?: string) => {
    const newBreadcrumb = [...adminState.breadcrumb];
    
    // Find if this view already exists in breadcrumb
    const existingIndex = newBreadcrumb.findIndex(item => item.view === view && item.id === id);
    
    if (existingIndex !== -1) {
      // Truncate breadcrumb to the existing item
      newBreadcrumb.splice(existingIndex + 1);
    } else {
      // Add new breadcrumb item
      if (label) {
        newBreadcrumb.push({ label, view, id });
      }
    }

    setAdminState({
      currentView: view,
      selectedUserId: view === 'user-detail' || view === 'user-branches' ? id : undefined,
      selectedProductId: view === 'product-detail' ? id : undefined,
      breadcrumb: newBreadcrumb
    });
  };

  const navigateBack = () => {
    if (adminState.breadcrumb.length > 1) {
      const newBreadcrumb = [...adminState.breadcrumb];
      newBreadcrumb.pop();
      const previousItem = newBreadcrumb[newBreadcrumb.length - 1];
      
      setAdminState({
        currentView: previousItem.view,
        selectedUserId: previousItem.view === 'user-detail' || previousItem.view === 'user-branches' ? previousItem.id : undefined,
        selectedProductId: previousItem.view === 'product-detail' ? previousItem.id : undefined,
        breadcrumb: newBreadcrumb
      });
    }
  };

  // Helper function to format currency based on user's tenant
  const formatCurrency = (amount: string | number, userTenantId?: string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (userTenantId === 'km') {
      return `${numAmount.toFixed(2)} KM`;
    } else {
      return `€${numAmount.toFixed(2)}`;
    }
  };
  
  const [activeSection, setActiveSection] = useState("dashboard");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());


  // Toggle expand/collapse for company branches
  const toggleCompanyExpansion = (companyId: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyId)) {
      newExpanded.delete(companyId);
    } else {
      newExpanded.add(companyId);
    }
    setExpandedCompanies(newExpanded);
  };

  // Group users hierarchically
  const groupUsersHierarchically = (users: any[]) => {
    const mainCompanies = users.filter(user => user.branchType === 'main_company' || user.branchType === 'main');
    const branches = users.filter(user => user.branchType === 'branch');
    
    const result: any[] = [];
    
    mainCompanies.forEach(company => {
      result.push(company);
      
      if (expandedCompanies.has(company.id)) {
        const companyBranches = branches.filter(branch => branch.parentCompanyId === company.id);
        result.push(...companyBranches);
      }
    });
    
    // Add users without company (admin, etc.)
    const othersUsers = users.filter(user => !user.branchType || (user.branchType !== 'main_company' && user.branchType !== 'main' && user.branchType !== 'branch'));
    result.push(...othersUsers);
    
    return result;
  };
  
  // Admin Support notification system - fetch ticket stats for badge count
  const { data: adminTicketStats } = useQuery({
    queryKey: ["/api/admin/support/tickets/stats"],
    retry: false,
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: isAuthenticated
  });

  // Calculate notification count based on admin stats API response
  const adminStatsData = (adminTicketStats as any)?.data;
  const adminOpenTickets = parseInt(adminStatsData?.open || '0');
  const adminInProgressTickets = parseInt(adminStatsData?.inProgress || '0');
  const adminNotificationCount = adminOpenTickets + adminInProgressTickets;
  const adminHasNewNotifications = adminNotificationCount > 0;

  // Debug log for admin notification system
  console.log('🔧 Admin notifications debug:', {
    adminTicketStats,
    adminStatsData,
    adminOpenTickets,
    adminInProgressTickets,
    adminNotificationCount,
    adminHasNewNotifications
  });

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
    isActive: true,
    allowDuplicateKeys: false,
    // English User Instructions
    installationInstructions: '',
    activationInstructions: '',
    usageInstructions: '',
    systemRequirements: '',
    troubleshootingGuide: '',
    supportContacts: '',
    // KM User Instructions
    installationInstructionsKm: '',
    activationInstructionsKm: '',
    usageInstructionsKm: '',
    systemRequirementsKm: '',
    troubleshootingGuideKm: '',
    supportContactsKm: ''
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
    enabled: isAuthenticated && (user as any)?.role === 'super_admin' && (activeSection === 'users' || activeSection === 'wallets'),
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
  
  const { data: editProductLicenseKeys = [], refetch: refetchEditLicenseKeys, error: licenseKeysError } = useQuery({
    queryKey: [`/api/admin/license-keys/${editProductId}`],
    queryFn: async () => {
      console.log('🔑 Fetching license keys for product:', editProductId);
      const res = await fetch(`/api/admin/license-keys/${editProductId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        console.error('❌ License keys fetch failed:', res.status, res.statusText);
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('✅ License keys data received:', data);
      return data.data || data || [];
    },
    enabled: !!editProductId && isAuthenticated && activeSection === 'edit-product',
    staleTime: 0,
    gcTime: 0
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
    { id: 'orders', icon: ShoppingCart, label: 'Orders Management', allowed: true },
    { id: 'categories', icon: FileText, label: 'Category Management', allowed: true },
    { id: 'products', icon: Package, label: 'Product Management', allowed: true },
    { id: 'price-management', icon: DollarSign, label: 'Price Management', allowed: true },
    { id: 'edit-product', icon: Edit, label: 'Edit Product', allowed: true, hidden: !editProductId },
    { id: 'keys', icon: Key, label: 'Keys Management', allowed: true },
    { id: 'wallets', icon: Wallet, label: 'Wallet Management', allowed: true },
    { id: 'permissions', icon: Shield, label: 'Permissions', allowed: (user as any)?.role === 'super_admin' },
    { id: 'support', icon: MessageCircle, label: 'Support Management', allowed: true },
    { id: 'notifications', icon: Mail, label: 'Email Notifications', allowed: true },
    { id: 'analytics', icon: BarChart3, label: 'Notification Analytics', allowed: true },
    { id: 'smart-notifications', icon: Bot, label: 'Smart Notifications', allowed: true },
    { id: 'monitoring', icon: Activity, label: 'Monitoring', allowed: true },
    { id: 'alerts', icon: AlertTriangle, label: 'Alerts', allowed: true },
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
                {/* Admin Support notification badge */}
                {item.id === 'support' && adminHasNewNotifications && (
                  <span className="ml-auto bg-[#E15554] text-white text-xs rounded-full min-w-[22px] h-6 px-2 flex items-center justify-center font-bold shadow-lg border-2 border-white animate-pulse">
                    {adminNotificationCount > 99 ? '99+' : adminNotificationCount}
                  </span>
                )}
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
                      <p className="text-[#6E6F71] mb-6">
                        Welcome to the admin dashboard. Use the sidebar to navigate between different management sections.
                      </p>

                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'orders' && (
              <OrdersManagement />
            )}

            {activeSection === 'categories' && (
              <CategoryManagement />
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
                          <th className="px-6 py-2 text-center text-xs font-medium text-white uppercase tracking-wider">User</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">Company Name</th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-white uppercase tracking-wider">Email</th>
                          <th className="px-6 py-2 text-center text-xs font-medium text-white uppercase tracking-wider">Role</th>
                          <th className="px-6 py-2 text-center text-xs font-medium text-white uppercase tracking-wider">Wallet Balance</th>
                          <th className="px-6 py-2 text-center text-xs font-medium text-white uppercase tracking-wider">Status</th>
                          <th className="px-6 py-2 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {usersLoading ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F] mx-auto"></div>
                              <p className="mt-2 text-[#6E6F71]">Loading users...</p>
                            </td>
                          </tr>
                        ) : (users || []).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center">
                              <Users className="mx-auto h-12 w-12 text-gray-400" />
                              <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No users found</h3>
                              <p className="mt-1 text-sm text-[#6E6F71]">Get started by creating a new user account.</p>
                            </td>
                          </tr>
                        ) : (
                          groupUsersHierarchically(users || []).map((userData: any, index: number) => {
                            // Find wallet data for this user
                            const userWallet = walletData.find((wallet: any) => wallet.id === userData.id);
                            
                            // Check if this is a main company with branches
                            const isMainCompany = userData.branchType === 'main_company' || userData.branchType === 'main';
                            const hasBranches = isMainCompany && (users || []).some(u => u.parentCompanyId === userData.id);
                            const isBranch = userData.branchType === 'branch';
                            const isExpanded = expandedCompanies.has(userData.id);
                            
                            return (
                              <tr key={userData.id} className={`hover:bg-gray-50 ${isBranch ? 'bg-gray-25' : ''}`}>
                                <td className="px-6 py-2 whitespace-nowrap">
                                  <div className={`flex items-center ${isBranch ? 'ml-8' : ''}`}>
                                    {hasBranches && (
                                      <button
                                        onClick={() => toggleCompanyExpansion(userData.id)}
                                        className="mr-2 p-1 hover:bg-gray-100 rounded"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-[#6E6F71]" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-[#6E6F71]" />
                                        )}
                                      </button>
                                    )}
                                    <div className="flex-shrink-0 h-8 w-8">
                                      <div className={`h-8 w-8 ${isBranch ? 'bg-blue-500' : 'bg-[#6E6F71]'} rounded-full flex items-center justify-center`}>
                                        <span className="text-white text-xs font-medium">
                                          {userData.firstName?.charAt(0) || userData.username?.charAt(0) || 'U'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="ml-3">
                                      <div className="text-sm font-medium text-[#6E6F71]">
                                        <button
                                          onClick={() => {
                                            setEditingUserId(userData.id);
                                            setActiveSection('edit-user');
                                          }}
                                          className="text-[#FFB20F] hover:text-[#e6a00e] underline cursor-pointer"
                                        >
                                          {userData.firstName} {userData.lastName}
                                        </button>
                                        {isBranch && userData.branchName && (
                                          <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                            {userData.branchName}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">@{userData.username}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-sm text-[#6E6F71] text-left">
                                  {userData.companyName || 'No company'}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-sm text-[#6E6F71] text-left">
                                  {userData.email || 'No email'}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-center">
                                  <span className={`px-2 inline-flex text-xs leading-4 font-semibold rounded-full ${
                                    userData.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                                    userData.role === 'admin' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {userData.role?.replace('_', ' ') || 'Unknown'}
                                  </span>
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-center">
                                  {userData.role === 'b2b_user' && userWallet ? (
                                    <div className="text-sm">
                                      <div className="text-[#6E6F71] font-medium">
                                        {formatCurrency(userWallet.balance.totalAvailable, userData.tenantId)}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Deposits: {formatCurrency(userWallet.balance.depositBalance, userData.tenantId)} | Credit: {formatCurrency(userWallet.balance.availableCredit, userData.tenantId)}
                                      </div>
                                    </div>
                                  ) : userData.role === 'b2b_user' ? (
                                    <div className="text-sm text-gray-500">Loading...</div>
                                  ) : (
                                    <div className="text-sm text-gray-400">N/A</div>
                                  )}
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-center">
                                  <span className={`px-2 inline-flex text-xs leading-4 font-semibold rounded-full ${
                                    userData.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {userData.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-6 py-2 whitespace-nowrap text-center text-sm font-medium">
                                  <div className="flex items-center justify-center space-x-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingUser(userData);
                                        setShowUserForm(true);
                                      }}
                                      className="text-[#FFB20F] hover:bg-[#FFB20F] hover:text-white p-1"
                                      title="Edit user"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    {userData.role === 'b2b_user' && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            // Set selected user and navigate to wallet management with auto-selection
                                            setActiveSection('wallet-management');
                                            setTimeout(() => {
                                              // Trigger automatic user selection in wallet management
                                              const event = new CustomEvent('select-wallet-user', { 
                                                detail: { userId: userData.id, userData: userData }
                                              });
                                              window.dispatchEvent(event);
                                            }, 100);
                                          }}
                                          className="text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white p-1"
                                          title="Manage wallet"
                                        >
                                          <Wallet className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setSelectedUser(userData);
                                            setActiveSection('branch-management');
                                          }}
                                          className="text-green-600 hover:bg-green-600 hover:text-white p-1"
                                          title="Manage branches"
                                        >
                                          <TreePine className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                    {userData.role !== 'super_admin' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleUserStatus(userData.id, !userData.isActive)}
                                        className={userData.isActive ? 'text-red-600 hover:bg-red-600 hover:text-white p-1' : 'text-green-600 hover:bg-green-600 hover:text-white p-1'}
                                        title={userData.isActive ? 'Deactivate user' : 'Activate user'}
                                      >
                                        {userData.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                      </Button>
                                    )}
                                  </div>
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

            {activeSection === 'edit-user' && editingUserId && (user as any)?.role === 'super_admin' && (
              <UserEdit
                userId={editingUserId}
                onBack={() => {
                  setEditingUserId(null);
                  setActiveSection('users');
                }}
              />
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
                                    <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
                                      {product.imageUrl ? (
                                        <img 
                                          src={product.imageUrl} 
                                          alt={product.name}
                                          className="w-full h-full object-cover rounded-lg"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            target.nextElementSibling?.classList.remove('hidden');
                                          }}
                                          onLoad={() => {
                                            console.log(`✅ Admin table image loaded: ${product.imageUrl} for ${product.name}`);
                                          }}
                                        />
                                      ) : null}
                                      <Package className={`h-5 w-5 text-gray-400 ${product.imageUrl ? 'hidden' : ''}`} />
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
                                  {product.categoryName || 'Uncategorized'}
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
                                {product.stockCount || 0}
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
                                    setEditingProduct(product);
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

            {/* Branch Management Section */}
            {activeSection === 'branch-management' && selectedUser && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[#6E6F71]">Branch Management</h2>
                    <p className="text-gray-600">Manage branches for {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.companyName})</p>
                  </div>
                  <Button
                    onClick={() => setActiveSection('users')}
                    variant="outline"
                    className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
                  >
                    ← Back to Users
                  </Button>
                </div>
                <BranchManagement 
                  parentUserId={selectedUser.id}
                  parentUserData={selectedUser}
                />
              </div>
            )}

            {/* Comprehensive Product Form Modal */}
            {showProductForm && !editingProduct && (
              <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <ComprehensiveProductForm
                    onCancel={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    onSuccess={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                      refetchProducts();
                      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}

            {/* Simple Product Form for Editing */}
            {showProductForm && editingProduct && (
              <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="uppercase tracking-[0.5px]">
                      EDIT PRODUCT
                    </DialogTitle>
                  </DialogHeader>
                  <ComprehensiveProductForm
                    onCancel={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                    }}
                    onSuccess={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                      refetchProducts();
                      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
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
                licenseKeysError={licenseKeysError}
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

            {activeSection === 'wallet-management' && <WalletManagement />}

            {activeSection === 'keys' && <EmbeddedKeyManagement />}

            {activeSection === 'monitoring' && <MonitoringSection />}

            {activeSection === 'alerts' && <AlertsSection />}

            {activeSection === 'support' && (
              <AdminSupportManagement />
            )}

            {activeSection === 'notifications' && (
              <BrevoNotificationPanel />
            )}

            {activeSection === 'analytics' && (
              <NotificationAnalyticsDashboard />
            )}

            {activeSection === 'smart-notifications' && (
              <SmartNotificationsPanel />
            )}

            {(activeSection === 'permissions' || activeSection === 'reports') && (
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

// Monitoring Section Component with Live Data
function MonitoringSection() {
  const { toast } = useToast();
  const [testingSentry, setTestingSentry] = useState(false);
  const [testingPerformance, setTestingPerformance] = useState(false);

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/monitoring/health'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/monitoring/metrics/summary'],
    refetchInterval: 30000,
  });

  const testSentryCapture = async () => {
    setTestingSentry(true);
    try {
      const response = await fetch('/api/monitoring/test-sentry?trigger=error');
      const data = await response.json();
      
      toast({
        title: "Sentry Test Successful",
        description: "Test error sent to Sentry. Check your Sentry dashboard for the error report.",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Could not send test error to Sentry",
        variant: "destructive",
      });
    } finally {
      setTestingSentry(false);
    }
  };

  const testSentryPerformance = async () => {
    setTestingPerformance(true);
    try {
      const response = await fetch('/api/monitoring/test-performance');
      const data = await response.json();
      
      toast({
        title: "Performance Test Successful",
        description: "Test transaction sent to Sentry. Check your Sentry Performance dashboard for detailed metrics.",
      });
    } catch (error) {
      toast({
        title: "Performance Test Failed",
        description: "Could not send performance test to Sentry",
        variant: "destructive",
      });
    } finally {
      setTestingPerformance(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy': case 'ok': return 'text-green-700 bg-green-50';
      case 'warning': return 'text-yellow-700 bg-yellow-50';
      case 'error': case 'critical': return 'text-red-700 bg-red-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Monitoring - Live Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg ${getStatusColor((healthData as any)?.status)}`}>
              <div className="font-semibold">System Status</div>
              <div className="text-2xl font-bold">
                {healthLoading ? 'Loading...' : (healthData as any)?.status || 'Unknown'}
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-blue-600 font-semibold">Uptime</div>
              <div className="text-2xl font-bold text-blue-700">
                {healthLoading ? 'Loading...' : 
                 (healthData as any)?.uptime ? formatUptime((healthData as any).uptime) : 'N/A'}
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-yellow-600 font-semibold">Memory Usage</div>
              <div className="text-2xl font-bold text-yellow-700">
                {metricsLoading ? 'Loading...' : 
                 (metricsData as any)?.memory ? `${Math.round(((metricsData as any).memory.used / (metricsData as any).memory.total) * 100)}%` : 'N/A'}
              </div>
              {(metricsData as any)?.memory && (
                <div className="text-xs text-yellow-600">
                  {formatBytes((metricsData as any).memory.used)} / {formatBytes((metricsData as any).memory.total)}
                </div>
              )}
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-purple-600 font-semibold">Database Status</div>
              <div className="text-2xl font-bold text-purple-700">
                {healthLoading ? 'Loading...' : 
                 (healthData as any)?.database?.status || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Additional Metrics */}
          {metricsData && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">HTTP Requests</h4>
                <div className="text-sm space-y-1">
                  <div>Total: {(metricsData as any).http?.total || 'N/A'}</div>
                  <div>Success Rate: {(metricsData as any).http?.successRate ? `${((metricsData as any).http.successRate * 100).toFixed(1)}%` : 'N/A'}</div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Performance</h4>
                <div className="text-sm space-y-1">
                  <div>Avg Response: {(metricsData as any).performance?.avgResponseTime ? `${(metricsData as any).performance.avgResponseTime}ms` : 'N/A'}</div>
                  <div>CPU Usage: {(metricsData as any).cpu ? `${Math.round((metricsData as any).cpu * 100)}%` : 'N/A'}</div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">External Monitoring Tools</h3>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/metrics', '_blank')}
              >
                Prometheus Metrics
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/health', '_blank')}
              >
                Health Check
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/api/monitoring/metrics/summary', '_blank')}
              >
                Metrics Summary
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Alerts Section Component with Live Data
function AlertsSection() {
  const { toast } = useToast();
  const [testingSentry, setTestingSentry] = useState(false);
  const [testingPerformance, setTestingPerformance] = useState(false);

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/monitoring/alerts'],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: healthData } = useQuery({
    queryKey: ['/api/monitoring/health'],
    refetchInterval: 30000,
  });

  const testSentryCapture = async () => {
    setTestingSentry(true);
    try {
      const response = await fetch('/api/monitoring/test-sentry?trigger=error');
      const data = await response.json();
      
      toast({
        title: "Sentry Test Successful",
        description: "Test error sent to Sentry. Check your Sentry dashboard for the error report.",
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Could not send test error to Sentry",
        variant: "destructive",
      });
    } finally {
      setTestingSentry(false);
    }
  };

  const testSentryPerformance = async () => {
    setTestingPerformance(true);
    try {
      const response = await fetch('/api/monitoring/test-sentry?trigger=performance');
      const data = await response.json();
      
      toast({
        title: "Performance Test Successful",
        description: `Performance monitoring test completed. Database: ${data.database_duration}ms, Wallet: ${data.wallet_duration}ms, License: ${data.license_duration}ms`,
      });
    } catch (error) {
      toast({
        title: "Performance Test Failed",
        description: "Could not complete performance monitoring test",
        variant: "destructive",
      });
    } finally {
      setTestingPerformance(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'border-red-400 bg-red-50';
      case 'warning': return 'border-yellow-400 bg-yellow-50';
      case 'info': return 'border-blue-400 bg-blue-50';
      default: return 'border-gray-400 bg-gray-50';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'text-red-800';
      case 'warning': return 'text-yellow-800';
      case 'info': return 'text-blue-800';
      default: return 'text-gray-800';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const alertTime = new Date(timestamp).getTime();
    const diffMs = now - alertTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const alerts = (alertsData as any)?.alerts || [];
  const alertStats = (alertsData as any)?.stats || { critical: 0, warning: 0, info: 0 };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alerts Management - Live Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-red-600 font-semibold">Critical Alerts</div>
              <div className="text-2xl font-bold text-red-700">
                {alertsLoading ? 'Loading...' : alertStats.critical}
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-yellow-600 font-semibold">Warning Alerts</div>
              <div className="text-2xl font-bold text-yellow-700">
                {alertsLoading ? 'Loading...' : alertStats.warning}
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-blue-600 font-semibold">Info Alerts</div>
              <div className="text-2xl font-bold text-blue-700">
                {alertsLoading ? 'Loading...' : alertStats.info}
              </div>
            </div>
          </div>
          
          {/* Active Alerts */}
          <div className="space-y-3">
            <h3 className="font-semibold">Active Alerts</h3>
            {alertsLoading ? (
              <div className="p-4 text-center text-gray-500">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                No active alerts - System running smoothly
              </div>
            ) : (
              alerts.map((alert: any, index: number) => (
                <div key={index} className={`p-3 border-l-4 rounded-lg ${getSeverityColor(alert.severity)}`}>
                  <div className={`font-semibold ${getSeverityTextColor(alert.severity)}`}>
                    {alert.title || alert.name}
                  </div>
                  <div className={`text-sm ${getSeverityTextColor(alert.severity)} opacity-80`}>
                    {alert.description || alert.message}
                  </div>
                  <div className={`text-xs ${getSeverityTextColor(alert.severity)} opacity-60`}>
                    {alert.timestamp ? formatTimeAgo(alert.timestamp) : 'Unknown time'}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Health-based Alerts */}
          {(healthData as any)?.alerts && (healthData as any).alerts.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">System Health Alerts</h3>
              <div className="space-y-2">
                {(healthData as any).alerts.map((alert: any, index: number) => (
                  <div key={index} className={`p-3 border-l-4 rounded-lg ${getSeverityColor(alert.severity)}`}>
                    <div className={`font-semibold ${getSeverityTextColor(alert.severity)}`}>
                      {alert.component}: {alert.status}
                    </div>
                    <div className={`text-sm ${getSeverityTextColor(alert.severity)} opacity-80`}>
                      {alert.message}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Alert Configuration</h3>
            <p className="text-sm text-gray-600 mb-3">
              Enterprise monitoring with Sentry, Prometheus, and Grafana integration. 
              Alerts are automatically generated based on system thresholds and health checks.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/api/monitoring/alerts', '_blank')}
              >
                View Raw Data
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('/health', '_blank')}
              >
                Health Status
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={testSentryCapture}
                disabled={testingSentry}
                className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
              >
                {testingSentry ? 'Testing...' : 'Test Sentry Error'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={testSentryPerformance}
                disabled={testingPerformance}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
              >
                {testingPerformance ? 'Testing...' : 'Test Sentry Performance'}
              </Button>

            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Edit Product Integrated Section Component
function EditProductIntegratedSection({
  editProductId,
  editProductData,
  editProductLoading,
  editProductLicenseKeys,
  licenseKeysError,
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
      console.log('KM fields from API response:', {
        installationInstructionsKm: prod.installationInstructionsKm,
        activationInstructionsKm: prod.activationInstructionsKm,
        usageInstructionsKm: prod.usageInstructionsKm,
        systemRequirementsKm: prod.systemRequirementsKm,
        troubleshootingGuideKm: prod.troubleshootingGuideKm,
        supportContactsKm: prod.supportContactsKm
      });
      
      setEditProductFormData({
        name: prod.name || '',
        description: prod.description || '',
        htmlDescription: prod.htmlDescription || '',
        warranty: prod.warranty || '',
        category: prod.categoryId || '',
        platform: prod.platform || '',
        region: prod.region || '',
        imageUrl: prod.imageUrl || '',
        isActive: prod.isActive ?? true,
        allowDuplicateKeys: prod.allowDuplicateKeys ?? false,
        // User Instructions - English (EUR Shop)
        installationInstructions: prod.installationInstructions || '',
        activationInstructions: prod.activationInstructions || '',
        usageInstructions: prod.usageInstructions || '',
        systemRequirements: prod.systemRequirements || '',
        troubleshootingGuide: prod.troubleshootingGuide || '',
        supportContacts: prod.supportContacts || '',
        // User Instructions - Bosnian (KM Shop)
        installationInstructionsKm: prod.installationInstructionsKm || '',
        activationInstructionsKm: prod.activationInstructionsKm || '',
        usageInstructionsKm: prod.usageInstructionsKm || '',
        systemRequirementsKm: prod.systemRequirementsKm || '',
        troubleshootingGuideKm: prod.troubleshootingGuideKm || '',
        supportContactsKm: prod.supportContactsKm || ''
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
      console.log('Debug editProductFormData before submit:', editProductFormData);
      console.log('Debug allowDuplicateKeys before spread:', editProductFormData.allowDuplicateKeys);
      console.log('Debug KM instruction fields:', {
        installationInstructionsKm: editProductFormData.installationInstructionsKm,
        activationInstructionsKm: editProductFormData.activationInstructionsKm,
        usageInstructionsKm: editProductFormData.usageInstructionsKm,
        systemRequirementsKm: editProductFormData.systemRequirementsKm,
        troubleshootingGuideKm: editProductFormData.troubleshootingGuideKm,
        supportContactsKm: editProductFormData.supportContactsKm
      });
      console.log('Debug editEurPricing:', editEurPricing);
      console.log('Debug editKmPricing:', editKmPricing);
      
      const submitData = {
        ...editProductFormData,
        ...editEurPricing,
        ...editKmPricing,
        categoryId: editProductFormData.category || 'cat-software', // Default to Software category if empty
        stock: editEurPricing.stock ? parseInt(editEurPricing.stock) : undefined,
        // Explicitly preserve critical fields that might be overwritten
        allowDuplicateKeys: editProductFormData.allowDuplicateKeys,
        isActive: editProductFormData.isActive,
        // Explicitly preserve KM instruction fields (they might be overwritten by pricing objects)
        installationInstructionsKm: editProductFormData.installationInstructionsKm,
        activationInstructionsKm: editProductFormData.activationInstructionsKm,
        usageInstructionsKm: editProductFormData.usageInstructionsKm,
        systemRequirementsKm: editProductFormData.systemRequirementsKm,
        troubleshootingGuideKm: editProductFormData.troubleshootingGuideKm,
        supportContactsKm: editProductFormData.supportContactsKm
      };

      console.log('Debug submitData after construction:', submitData);
      console.log('Debug allowDuplicateKeys in submitData:', submitData.allowDuplicateKeys);
      console.log('Debug KM fields in submitData:', {
        installationInstructionsKm: submitData.installationInstructionsKm,
        activationInstructionsKm: submitData.activationInstructionsKm,
        usageInstructionsKm: submitData.usageInstructionsKm,
        systemRequirementsKm: submitData.systemRequirementsKm,
        troubleshootingGuideKm: submitData.troubleshootingGuideKm,
        supportContactsKm: submitData.supportContactsKm
      });

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
                onClick={() => setEditActiveTab('user-instructions')}
                className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                  editActiveTab === "user-instructions"
                    ? "border-[#FFB20F] text-[#FFB20F]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                User Instructions
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
                    {licenseKeysError && (
                      <span className="text-red-600 ml-2">
                        Error: {licenseKeysError.message}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Allow Duplicate Keys Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <label htmlFor="allowDuplicateKeys" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] cursor-pointer">
                      Allow Duplicate License Keys
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      When enabled, identical license keys can be added to the pool
                    </p>
                    {editProductFormData.allowDuplicateKeys && (
                      <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                        <span>⚠️</span>
                        Warning: Duplicate keys are allowed for this product
                      </p>
                    )}
                  </div>
                  <input
                    id="allowDuplicateKeys"
                    type="checkbox"
                    checked={editProductFormData.allowDuplicateKeys}
                    onChange={(e) => {
                      setEditProductFormData({ 
                        ...editProductFormData, 
                        allowDuplicateKeys: e.target.checked 
                      });
                      setEditUnsavedChanges(true);
                    }}
                    className="w-4 h-4 text-[#FFB20F] bg-gray-100 border-gray-300 rounded focus:ring-[#FFB20F] focus:ring-2"
                  />
                </div>

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

          {/* User Instructions Tab */}
          {editActiveTab === "user-instructions" && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Multi-Language User Instructions</h4>
                <p className="text-sm text-blue-600">
                  Create comprehensive user guides in both English (EUR shop) and Bosnian (KM shop). 
                  Each language will be displayed to customers in their respective shops.
                </p>
              </div>

              {/* Language Tabs */}
              <Tabs defaultValue="english" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="english" className="flex items-center gap-2">
                    <span className="text-blue-600 font-medium">🇬🇧</span>
                    English (EUR Shop)
                  </TabsTrigger>
                  <TabsTrigger value="bosnian" className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">🇧🇦</span>
                    Bosnian (KM Shop)
                  </TabsTrigger>
                </TabsList>

                {/* English Instructions */}
                <TabsContent value="english" className="space-y-6 mt-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700 font-medium">
                      English Instructions for EUR Shop Customers
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* English Installation Instructions */}
                    <div>
                      <Label htmlFor="installationInstructions" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Download className="w-4 h-4 text-[#FFB20F]" />
                        Installation Instructions
                      </Label>
                      <Textarea
                        id="installationInstructions"
                        value={editProductFormData.installationInstructions}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, installationInstructions: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Installation Steps</h3>
<ol>
<li>Download the installer from your order confirmation email</li>
<li>Run the installer as administrator</li>
<li>Follow the setup wizard</li>
<li>Enter your license key when prompted</li>
</ol>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Supports HTML formatting (h3, ol, ul, li, p, strong, em)</p>
                    </div>

                    {/* English Activation Instructions */}
                    <div>
                      <Label htmlFor="activationInstructions" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Key className="w-4 h-4 text-[#FFB20F]" />
                        Activation Instructions
                      </Label>
                      <Textarea
                        id="activationInstructions"
                        value={editProductFormData.activationInstructions}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, activationInstructions: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Activation Process</h3>
<ol>
<li>Open the software after installation</li>
<li>Navigate to Help → License Activation</li>
<li>Enter your license key</li>
<li>Click 'Activate Online' for instant activation</li>
</ol>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Step-by-step license activation guide</p>
                    </div>

                    {/* English Usage Instructions */}
                    <div>
                      <Label htmlFor="usageInstructions" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Play className="w-4 h-4 text-[#FFB20F]" />
                        Getting Started Guide
                      </Label>
                      <Textarea
                        id="usageInstructions"
                        value={editProductFormData.usageInstructions}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, usageInstructions: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Getting Started</h3>
<p>After activation, you can access all features from the main dashboard. For detailed tutorials, visit our knowledge base.</p>
<p><strong>Quick Start:</strong> Open the application and follow the welcome tutorial.</p>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Basic usage instructions and tips</p>
                    </div>

                    {/* English System Requirements */}
                    <div>
                      <Label htmlFor="systemRequirements" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[#FFB20F]" />
                        System Requirements
                      </Label>
                      <Textarea
                        id="systemRequirements"
                        value={editProductFormData.systemRequirements}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, systemRequirements: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Minimum Requirements</h3>
<ul>
<li>Windows 10 or later / macOS 10.14+</li>
<li>4GB RAM minimum, 8GB recommended</li>
<li>2GB free disk space</li>
<li>Internet connection for activation</li>
</ul>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Technical specifications needed</p>
                    </div>

                    {/* English Troubleshooting Guide */}
                    <div>
                      <Label htmlFor="troubleshootingGuide" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-[#FFB20F]" />
                        Troubleshooting Guide
                      </Label>
                      <Textarea
                        id="troubleshootingGuide"
                        value={editProductFormData.troubleshootingGuide}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, troubleshootingGuide: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Common Issues</h3>
<p><strong>License not activating?</strong> Check your internet connection and ensure the key is entered correctly.</p>
<p><strong>Software won't start?</strong> Try running as administrator or check system requirements.</p>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Common problems and solutions</p>
                    </div>

                    {/* English Support Contacts */}
                    <div>
                      <Label htmlFor="supportContacts" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[#FFB20F]" />
                        Support Information
                      </Label>
                      <Textarea
                        id="supportContacts"
                        value={editProductFormData.supportContacts}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, supportContacts: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Support Information</h3>
<p>Email: support@b2bplatform.com</p>
<p>Phone: +1-800-SUPPORT</p>
<p>Live Chat: Available 24/7 through your dashboard</p>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Contact information for customer support</p>
                    </div>
                  </div>
                </TabsContent>

                {/* Bosnian Instructions */}
                <TabsContent value="bosnian" className="space-y-6 mt-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-700 font-medium">
                      Bosanski Uputstva za KM Shop Korisnike
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bosnian Installation Instructions */}
                    <div>
                      <Label htmlFor="installationInstructionsKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Download className="w-4 h-4 text-[#FFB20F]" />
                        Uputstva za Instalaciju
                      </Label>
                      <Textarea
                        id="installationInstructionsKm"
                        value={editProductFormData.installationInstructionsKm}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, installationInstructionsKm: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Koraci za Instalaciju</h3>
<ol>
<li>Preuzmite instaler iz email potvrde narudžbe</li>
<li>Pokrenite instaler kao administrator</li>
<li>Pratite čarobnjak za podešavanje</li>
<li>Unesite licencni ključ kada se traži</li>
</ol>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Podržava HTML formatiranje (h3, ol, ul, li, p, strong, em)</p>
                    </div>

                    {/* Bosnian Activation Instructions */}
                    <div>
                      <Label htmlFor="activationInstructionsKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Key className="w-4 h-4 text-[#FFB20F]" />
                        Uputstva za Aktivaciju
                      </Label>
                      <Textarea
                        id="activationInstructionsKm"
                        value={editProductFormData.activationInstructionsKm}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, activationInstructionsKm: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Proces Aktivacije</h3>
<ol>
<li>Otvorite softver nakon instalacije</li>
<li>Idite na Pomoć → Aktivacija Licence</li>
<li>Unesite svoj licencni ključ</li>
<li>Kliknite 'Aktiviraj Online' za trenutnu aktivaciju</li>
</ol>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Korak po korak vodič za aktivaciju licence</p>
                    </div>

                    {/* Bosnian Usage Instructions */}
                    <div>
                      <Label htmlFor="usageInstructionsKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Play className="w-4 h-4 text-[#FFB20F]" />
                        Vodič za Početak
                      </Label>
                      <Textarea
                        id="usageInstructionsKm"
                        value={editProductFormData.usageInstructionsKm}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, usageInstructionsKm: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Prvi Koraci</h3>
<p>Nakon aktivacije, možete pristupiti svim funkcijama iz glavnog menija. Za detaljne vodiče, posjetite našu bazu znanja.</p>
<p><strong>Brzi Start:</strong> Otvorite aplikaciju i pratite uvodni vodič.</p>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Osnovna uputstva za korišćenje i savjeti</p>
                    </div>

                    {/* Bosnian System Requirements */}
                    <div>
                      <Label htmlFor="systemRequirementsKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[#FFB20F]" />
                        Sistemski Zahtjevi
                      </Label>
                      <Textarea
                        id="systemRequirementsKm"
                        value={editProductFormData.systemRequirementsKm}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, systemRequirementsKm: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Minimalni Zahtjevi</h3>
<ul>
<li>Windows 10 ili noviji / macOS 10.14+</li>
<li>4GB RAM minimum, 8GB preporučeno</li>
<li>2GB slobodnog prostora na disku</li>
<li>Internet konekcija za aktivaciju</li>
</ul>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Potrebne tehničke specifikacije</p>
                    </div>

                    {/* Bosnian Troubleshooting Guide */}
                    <div>
                      <Label htmlFor="troubleshootingGuideKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-[#FFB20F]" />
                        Vodič za Rješavanje Problema
                      </Label>
                      <Textarea
                        id="troubleshootingGuideKm"
                        value={editProductFormData.troubleshootingGuideKm}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, troubleshootingGuideKm: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Česti Problemi</h3>
<p><strong>Licenca se ne aktivira?</strong> Provjerite internet konekciju i provjerite da li je ključ ispravno unesen.</p>
<p><strong>Softver se neće pokrenuti?</strong> Pokušajte pokrenuti kao administrator ili provjerite sistemske zahtjeve.</p>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Česti problemi i rješenja</p>
                    </div>

                    {/* Bosnian Support Contacts */}
                    <div>
                      <Label htmlFor="supportContactsKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] flex items-center gap-2">
                        <Phone className="w-4 h-4 text-[#FFB20F]" />
                        Informacije o Podršci
                      </Label>
                      <Textarea
                        id="supportContactsKm"
                        value={editProductFormData.supportContactsKm}
                        onChange={(e) => {
                          setEditProductFormData({ ...editProductFormData, supportContactsKm: e.target.value });
                          setEditUnsavedChanges(true);
                        }}
                        className="mt-1"
                        rows={6}
                        placeholder="<h3>Informacije o Podršci</h3>
<p>Email: podrska@b2bplatforma.com</p>
<p>Telefon: +387-XX-XXX-XXX</p>
<p>Live Chat: Dostupan 24/7 kroz vaš panel</p>"
                      />
                      <p className="text-xs text-gray-500 mt-1">Kontakt informacije za korisničku podršku</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Preview Section */}
              <div className="border-t pt-6">
                <h5 className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px] mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#FFB20F]" />
                  Preview: Multi-Language User Instructions
                </h5>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* English Preview */}
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-blue-600">🇬🇧</span>
                        <span className="font-medium text-sm">EUR Shop (English)</span>
                      </div>
                      <div className="text-xs">
                        <strong>Available Sections:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {editProductFormData.installationInstructions && <li>Installation Instructions</li>}
                          {editProductFormData.activationInstructions && <li>Activation Instructions</li>}
                          {editProductFormData.usageInstructions && <li>Getting Started Guide</li>}
                          {editProductFormData.systemRequirements && <li>System Requirements</li>}
                          {editProductFormData.troubleshootingGuide && <li>Troubleshooting Guide</li>}
                          {editProductFormData.supportContacts && <li>Support Information</li>}
                        </ul>
                        {!editProductFormData.installationInstructions && 
                         !editProductFormData.activationInstructions && 
                         !editProductFormData.usageInstructions && 
                         !editProductFormData.systemRequirements && 
                         !editProductFormData.troubleshootingGuide && 
                         !editProductFormData.supportContacts && (
                          <p className="text-gray-500 italic mt-2">No English instructions configured yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Bosnian Preview */}
                    <div className="bg-white rounded-lg p-4 border">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-green-600">🇧🇦</span>
                        <span className="font-medium text-sm">KM Shop (Bosanski)</span>
                      </div>
                      <div className="text-xs">
                        <strong>Dostupne Sekcije:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {editProductFormData.installationInstructionsKm && <li>Uputstva za Instalaciju</li>}
                          {editProductFormData.activationInstructionsKm && <li>Uputstva za Aktivaciju</li>}
                          {editProductFormData.usageInstructionsKm && <li>Vodič za Početak</li>}
                          {editProductFormData.systemRequirementsKm && <li>Sistemski Zahtjevi</li>}
                          {editProductFormData.troubleshootingGuideKm && <li>Vodič za Rješavanje Problema</li>}
                          {editProductFormData.supportContactsKm && <li>Informacije o Podršci</li>}
                        </ul>
                        {!editProductFormData.installationInstructionsKm && 
                         !editProductFormData.activationInstructionsKm && 
                         !editProductFormData.usageInstructionsKm && 
                         !editProductFormData.systemRequirementsKm && 
                         !editProductFormData.troubleshootingGuideKm && 
                         !editProductFormData.supportContactsKm && (
                          <p className="text-gray-500 italic mt-2">Bosanska uputstva još nisu konfigurirana.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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

// Integrated User Edit Modal Component
function UserEditModal({ user, onClose }: { user: any; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState<any>({});
  const [newDeposit, setNewDeposit] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');

  // Fetch user data
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/admin/users', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!user.id,
  });

  // Fetch user's wallet data
  const { data: walletData } = useQuery({
    queryKey: ['/api/admin/users', user.id, 'wallet'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${user.id}/wallet`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch wallet');
      return response.json();
    },
    enabled: !!user.id,
  });

  // Fetch all products for custom pricing tab
  const { data: productsData } = useQuery({
    queryKey: ['/api/admin/products'],
    queryFn: async () => {
      const response = await fetch('/api/admin/products', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Fetch user's custom pricing
  const { data: userPricingData } = useQuery({
    queryKey: ['/api/admin/users', user.id, 'pricing'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${user.id}/pricing`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pricing');
      return response.json();
    },
    enabled: !!user.id,
  });

  // Fetch user's transactions
  const { data: transactionsData } = useQuery({
    queryKey: ['/api/admin/users', user.id, 'transactions'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${user.id}/transactions`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: !!user.id,
  });

  // Initialize form data when user data loads
  useEffect(() => {
    if (userData?.data) {
      setFormData(userData.data);
      setNewCreditLimit(userData.data.creditLimit?.toString() || '0');
    }
  }, [userData]);

  // Add deposit mutation
  const addDepositMutation = useMutation({
    mutationFn: async ({ amount }: { amount: number }) => {
      const response = await apiRequest(`/api/admin/users/${user.id}/deposit`, 'POST', { amount });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Deposit added successfully",
      });
      setNewDeposit('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', user.id, 'wallet'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', user.id, 'transactions'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add deposit",
        variant: "destructive",
      });
    },
  });

  // Update credit limit mutation
  const updateCreditMutation = useMutation({
    mutationFn: async ({ creditLimit }: { creditLimit: number }) => {
      const response = await apiRequest(`/api/admin/users/${user.id}/credit-limit`, 'PUT', { creditLimit });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Credit limit updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', user.id, 'wallet'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update credit limit",
        variant: "destructive",
      });
    },
  });

  const handleAddDeposit = () => {
    const amount = parseFloat(newDeposit);
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return;
    }
    addDepositMutation.mutate({ amount });
  };

  const handleUpdateCreditLimit = () => {
    const creditLimit = parseFloat(newCreditLimit);
    if (creditLimit < 0) {
      toast({
        title: "Error",
        description: "Credit limit cannot be negative",
        variant: "destructive",
      });
      return;
    }
    updateCreditMutation.mutate({ creditLimit });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#6E6F71] text-xl uppercase tracking-[0.5px] flex items-center justify-between">
            <span>EDIT USER: {user.firstName} {user.lastName}</span>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              @{user.username} • {user.email}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="text-sm">
              <DollarSign className="w-4 h-4 mr-2" />
              Profile & Credit
            </TabsTrigger>
            <TabsTrigger value="products" className="text-sm">
              <Package className="w-4 h-4 mr-2" />
              Company Products
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-sm">
              <History className="w-4 h-4 mr-2" />
              Transaction History
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-sm">
              <CreditCard className="w-4 h-4 mr-2" />
              Payment History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-8">
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-[#6E6F71] flex items-center">
                    <Edit className="w-5 h-5 mr-2" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>First Name *</Label>
                      <Input 
                        value={formData.firstName || ''} 
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Last Name *</Label>
                      <Input 
                        value={formData.lastName || ''} 
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input 
                      value={formData.email || ''} 
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input 
                      value={formData.phone || ''} 
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Company Name *</Label>
                    <Input 
                      value={formData.companyName || ''} 
                      onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Contact Person</Label>
                    <Input 
                      value={formData.contactPerson || ''} 
                      onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Country *</Label>
                      <Input 
                        value={formData.country || ''} 
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>City *</Label>
                      <Input 
                        value={formData.city || ''} 
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Address *</Label>
                    <Textarea 
                      value={formData.address || ''} 
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>VAT or Registration No. *</Label>
                    <Input 
                      value={formData.vatOrRegistrationNo || ''} 
                      onChange={(e) => setFormData({...formData, vatOrRegistrationNo: e.target.value})}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Credit & Wallet Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-[#6E6F71] flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Credit & Wallet Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {walletData?.data && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Deposit Balance</Label>
                          <div className="text-2xl font-bold text-green-600">
                            €{walletData.data.depositBalance}
                          </div>
                        </div>
                        <div>
                          <Label>Credit Limit</Label>
                          <div className="text-2xl font-bold text-blue-600">
                            €{walletData.data.creditLimit}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Credit Used</Label>
                          <div className="text-2xl font-bold text-red-600">
                            €{walletData.data.creditUsed}
                          </div>
                        </div>
                        <div>
                          <Label>Total Available</Label>
                          <div className="text-2xl font-bold text-[#FFB20F]">
                            €{walletData.data.totalAvailable}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 pt-4 border-t">
                        <div>
                          <Label>Add Deposit</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00"
                              value={newDeposit}
                              onChange={(e) => setNewDeposit(e.target.value)}
                            />
                            <Button 
                              onClick={handleAddDeposit}
                              disabled={addDepositMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <Label>Change Credit Limit</Label>
                          <div className="flex gap-2">
                            <Input 
                              type="number" 
                              step="0.01" 
                              value={newCreditLimit}
                              onChange={(e) => setNewCreditLimit(e.target.value)}
                            />
                            <Button 
                              onClick={handleUpdateCreditLimit}
                              disabled={updateCreditMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Update
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">Company Products & Custom Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Custom product pricing functionality will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsData?.data && transactionsData.data.length > 0 ? (
                  <div className="space-y-2">
                    {transactionsData.data.map((transaction: any) => (
                      <div key={transaction.id} className="flex justify-between items-center p-3 border rounded">
                        <div>
                          <div className="font-medium">{transaction.description}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className={`font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          €{transaction.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">No transactions found.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Payment history functionality will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
