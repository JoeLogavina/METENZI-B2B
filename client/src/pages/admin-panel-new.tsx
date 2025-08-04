import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  ShoppingCart, 
  Key, 
  Package, 
  BarChart3,
  Settings,
  Shield,
  FileText,
  ArrowLeft,
  Building,
  Activity
} from "lucide-react";
import { BranchManagement } from "@/components/admin/BranchManagement";
import { UserDetailView } from "@/components/admin/UserDetailView";

// State-based navigation types
type AdminView = 
  | 'dashboard'
  | 'users'
  | 'user-detail'
  | 'user-branches'
  | 'products'
  | 'categories'
  | 'license-keys'
  | 'orders'
  | 'reports'
  | 'settings'
  | 'security';

interface AdminState {
  currentView: AdminView;
  selectedUserId?: string;
  selectedProductId?: string;
  breadcrumb: Array<{ label: string; view: AdminView; id?: string }>;
}

interface DashboardStats {
  totalUsers: number;
  totalSales: string;
  activeKeys: number;
  totalProducts: number;
}

interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  isActive: boolean;
  companyName?: string;
  branchType: 'main' | 'branch';
  branchName?: string;
  createdAt: string;
}

export default function AdminPanelNew() {
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

  // Data queries
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/dashboard"],
    enabled: isAuthenticated && ((user as any)?.role === 'admin' || (user as any)?.role === 'super_admin'),
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && (user as any)?.role === 'super_admin' && adminState.currentView === 'users',
    select: (data: any) => Array.isArray(data) ? data : (data?.data || []),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-spanish-yellow"></div>
      </div>
    );
  }

  if (!isAuthenticated || ((user as any)?.role !== 'admin' && (user as any)?.role !== 'super_admin')) {
    return null;
  }

  // Sidebar navigation items
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'User Management', icon: Users, requiresSuperAdmin: true },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: FileText },
    { id: 'license-keys', label: 'License Keys', icon: Key },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Render content based on current view
  const renderContent = () => {
    switch (adminState.currentView) {
      case 'dashboard':
        return <DashboardView stats={stats} statsLoading={statsLoading} />;
      
      case 'users':
        return <UsersListView 
          users={users} 
          usersLoading={usersLoading} 
          onUserClick={(userId, username) => navigateTo('user-detail', userId, username)}
        />;
      
      case 'user-detail':
        return <UserDetailView 
          userId={adminState.selectedUserId!}
          onBack={navigateBack}
          onViewBranches={() => navigateTo('user-branches', adminState.selectedUserId, 'Branches')}
        />;
      
      case 'user-branches':
        return <BranchManagement 
          userId={adminState.selectedUserId!}
          onUserClick={(userId, username) => navigateTo('user-detail', userId, username)}
          onBack={navigateBack}
        />;
      
      default:
        return <div className="p-6">View under construction</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#6E6F71] text-white flex flex-col">
        <div className="p-6 border-b border-gray-600">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-gray-300">Management Console</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {sidebarItems.map(item => {
              if (item.requiresSuperAdmin && (user as any)?.role !== 'super_admin') {
                return null;
              }
              
              const Icon = item.icon;
              const isActive = adminState.currentView === item.id;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => navigateTo(item.id as AdminView, undefined, item.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive 
                        ? 'bg-spanish-yellow text-black font-medium' 
                        : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-600">
          <Button
            onClick={logout}
            variant="outline"
            className="w-full text-gray-300 border-gray-600 hover:bg-gray-600"
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header with Breadcrumb */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            {adminState.breadcrumb.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && <span className="text-gray-400">/</span>}
                <button
                  onClick={() => {
                    const newBreadcrumb = adminState.breadcrumb.slice(0, index + 1);
                    const targetItem = newBreadcrumb[newBreadcrumb.length - 1];
                    setAdminState({
                      currentView: targetItem.view,
                      selectedUserId: targetItem.view === 'user-detail' || targetItem.view === 'user-branches' ? targetItem.id : undefined,
                      selectedProductId: targetItem.view === 'product-detail' ? targetItem.id : undefined,
                      breadcrumb: newBreadcrumb
                    });
                  }}
                  className={`text-sm font-medium ${
                    index === adminState.breadcrumb.length - 1 
                      ? 'text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// Dashboard View Component
function DashboardView({ stats, statsLoading }: { stats?: DashboardStats; statsLoading: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600">Welcome to the admin management console</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalSales || '€0'}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeKeys || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Users List View Component
function UsersListView({ 
  users, 
  usersLoading, 
  onUserClick 
}: { 
  users: User[]; 
  usersLoading: boolean; 
  onUserClick: (userId: string, username: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600">Manage system users and their permissions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-600">No users are currently registered in the system.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onUserClick(user.id, user.username)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.username}</div>
                      <div className="text-sm text-gray-500">
                        {user.email || 'No email'} • {user.companyName || 'No company'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.branchType === 'main' ? "default" : "secondary"}>
                      {user.branchType === 'main' ? 'Main Company' : 'Branch'}
                    </Badge>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">{user.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}