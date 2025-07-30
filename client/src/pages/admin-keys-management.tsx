import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { format, subDays, subMonths, subYears } from "date-fns";
import { 
  Search, 
  Key, 
  Calendar, 
  User, 
  Package, 
  FileText, 
  Download, 
  Copy, 
  ExternalLink,
  Filter,
  X,
  ChevronDown,
  BarChart3,
  Users,
  DollarSign,
  Shield,
  Wallet,
  Edit,
  Settings,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LicenseKeyResult {
  id: string;
  keyValue: string;
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  orderId: string;
  orderNumber: string;
  purchaseDate: string;
  purchaseTime: string;
  buyerName: string;
  buyerEmail: string;
  buyerCompany: string;
  status: 'active' | 'used' | 'revoked' | 'expired';
  isActive: boolean;
}

interface FilterState {
  search: string;
  orderNumber: string;
  categoryId: string;
  buyerSearch: string;
  status: string;
  dateRange: string;
  startDate: string;
  endDate: string;
}

export default function AdminKeysManagement() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState('keys');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    orderNumber: '',
    categoryId: '',
    buyerSearch: '',
    status: '',
    dateRange: '',
    startDate: '',
    endDate: ''
  });

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'super_admin'))) {
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
  }, [isAuthenticated, isLoading, user?.role]);

  // Sidebar items
  const sidebarItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard', allowed: true },
    { id: 'users', icon: Users, label: 'User Management', allowed: user?.role === 'super_admin' },
    { id: 'categories', icon: FileText, label: 'Category Management', allowed: true },
    { id: 'products', icon: Package, label: 'Product Management', allowed: true },
    { id: 'price-management', icon: DollarSign, label: 'Price Management', allowed: true },
    { id: 'keys', icon: Key, label: 'Keys Management', allowed: true },
    { id: 'wallets', icon: Wallet, label: 'Wallet Management', allowed: true },
    { id: 'permissions', icon: Shield, label: 'Permissions', allowed: user?.role === 'super_admin' },
    { id: 'reports', icon: FileText, label: 'Reports', allowed: true },
  ].filter(item => item.allowed);

  // Handle date range presets
  const handleDateRangeChange = (range: string) => {
    const now = new Date();
    let startDate = '';
    let endDate = format(now, 'yyyy-MM-dd');

    switch (range) {
      case 'last7':
        startDate = format(subDays(now, 7), 'yyyy-MM-dd');
        break;
      case 'last14':
        startDate = format(subDays(now, 14), 'yyyy-MM-dd');
        break;
      case 'last30':
        startDate = format(subDays(now, 30), 'yyyy-MM-dd');
        break;
      case 'last6months':
        startDate = format(subMonths(now, 6), 'yyyy-MM-dd');
        break;
      case 'lastyear':
        startDate = format(subYears(now, 1), 'yyyy-MM-dd');
        break;
      case 'all':
        startDate = '';
        endDate = '';
        break;
      default:
        return;
    }

    setFilters(prev => ({
      ...prev,
      dateRange: range,
      startDate,
      endDate
    }));
  };

  // Fetch license keys with filters
  const { data: licenseKeys = [], isLoading: keysLoading, refetch } = useQuery<LicenseKeyResult[]>({
    queryKey: ["/api/admin/license-keys/all", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/admin/license-keys/all?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch license keys');
      }

      const result = await response.json();
      return result.data || [];
    },
    enabled: isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin'),
  });

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    enabled: isAuthenticated
  });

  // Handle key selection
  const toggleKeySelection = (keyId: string) => {
    setSelectedKeys(prev => 
      prev.includes(keyId) 
        ? prev.filter(id => id !== keyId)
        : [...prev, keyId]
    );
  };

  const toggleSelectAll = () => {
    setSelectedKeys(
      selectedKeys.length === licenseKeys.length 
        ? [] 
        : licenseKeys.map(key => key.id)
    );
  };

  // Copy key to clipboard
  const copyKeyToClipboard = async (keyValue: string) => {
    try {
      await navigator.clipboard.writeText(keyValue);
      toast({
        title: "Copied",
        description: "License key copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy license key",
        variant: "destructive",
      });
    }
  };

  // Copy all selected keys
  const copySelectedKeys = async () => {
    const selectedKeyValues = licenseKeys
      .filter(key => selectedKeys.includes(key.id))
      .map(key => `${key.productName}: ${key.keyValue}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(selectedKeyValues);
      toast({
        title: "Copied",
        description: `${selectedKeys.length} license keys copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy license keys",
        variant: "destructive",
      });
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const keysToExport = selectedKeys.length > 0 
        ? licenseKeys.filter(key => selectedKeys.includes(key.id))
        : licenseKeys;

      const csvContent = [
        ['Date', 'Time', 'Order Number', 'Product Name', 'License Key', 'Buyer Name', 'Buyer Email', 'Status'].join(','),
        ...keysToExport.map(key => [
          format(new Date(key.purchaseDate), 'yyyy-MM-dd'),
          format(new Date(key.purchaseDate), 'HH:mm:ss'),
          key.orderNumber,
          key.productName,
          key.keyValue,
          key.buyerName,
          key.buyerEmail,
          key.status
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `license-keys-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Exported",
        description: `${keysToExport.length} license keys exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export license keys",
        variant: "destructive",
      });
    }
  };

  // Navigate to order details
  const navigateToOrder = (orderId: string) => {
    // Navigate to order details - this would need to be implemented in the orders page
    setLocation(`/admin-panel?section=orders&orderId=${orderId}`);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      used: { color: 'bg-blue-100 text-blue-800', label: 'Used' },
      revoked: { color: 'bg-red-100 text-red-800', label: 'Revoked' },
      expired: { color: 'bg-gray-100 text-gray-800', label: 'Expired' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return (
      <Badge className={cn("text-xs font-medium", config.color)}>
        {config.label}
      </Badge>
    );
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f5] flex font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Sidebar */}
      <div className="w-64 text-white flex-shrink-0 bg-[#404040]">
        <div className="p-4 border-b border-[#5a5b5d]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#FFB20F] rounded flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-[0.5px]">ADMIN PANEL</h2>
              <p className="text-xs text-gray-300 uppercase tracking-[0.5px]">LICENSE MANAGEMENT</p>
            </div>
          </div>
        </div>
        
        <nav className="mt-4">
          {sidebarItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center px-4 py-3 text-lg transition-colors duration-200 cursor-pointer",
                item.id === activeSection 
                  ? 'bg-[#FFB20F] text-white border-r-2 border-[#e6a00e]' 
                  : 'text-white hover:bg-[#7a7b7d]'
              )}
              onClick={() => {
                if (item.id === 'keys') return;
                setLocation(`/admin-panel?section=${item.id}`);
              }}
            >
              <item.icon className="w-6 h-6 mr-3" />
              <span className="uppercase tracking-[0.5px] font-medium text-sm">{item.label}</span>
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
            KEYS MANAGEMENT
          </h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
            {selectedKeys.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copySelectedKeys}
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Selected ({selectedKeys.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Selected
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export All
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-6 bg-[#f5f6f5]">
          {/* Advanced Filters */}
          {showFilters && (
            <Card className="mb-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Advanced Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search Keys/Products
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search license keys or products..."
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Order Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Number
                    </label>
                    <Input
                      placeholder="e.g., ORD-100001"
                      value={filters.orderNumber}
                      onChange={(e) => setFilters(prev => ({ ...prev, orderNumber: e.target.value }))}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <Select
                      value={filters.categoryId}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, categoryId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All categories</SelectItem>
                        {categories.map((category: any) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Buyer Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buyer Search
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Name, email, or company..."
                        value={filters.buyerSearch}
                        onChange={(e) => setFilters(prev => ({ ...prev, buyerSearch: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                        <SelectItem value="revoked">Revoked</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range Presets */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Range
                    </label>
                    <Select
                      value={filters.dateRange}
                      onValueChange={handleDateRangeChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All time</SelectItem>
                        <SelectItem value="last7">Last 7 days</SelectItem>
                        <SelectItem value="last14">Last 14 days</SelectItem>
                        <SelectItem value="last30">Last 30 days</SelectItem>
                        <SelectItem value="last6months">Last 6 months</SelectItem>
                        <SelectItem value="lastyear">Last year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Start Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        startDate: e.target.value,
                        dateRange: '' // Clear preset when custom date is set
                      }))}
                    />
                  </div>

                  {/* Custom End Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ 
                        ...prev, 
                        endDate: e.target.value,
                        dateRange: '' // Clear preset when custom date is set
                      }))}
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilters({
                        search: '',
                        orderNumber: '',
                        categoryId: '',
                        buyerSearch: '',
                        status: '',
                        dateRange: '',
                        startDate: '',
                        endDate: ''
                      });
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  License Keys Results {!keysLoading && `(${licenseKeys.length})`}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1"
                  >
                    {selectedKeys.length === licenseKeys.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {keysLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-[#FFB20F] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-gray-500">Loading license keys...</p>
                  </div>
                </div>
              ) : licenseKeys.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Key className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-2">No license keys found</p>
                  <p className="text-sm text-gray-400">Try adjusting your search filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">
                          <input
                            type="checkbox"
                            checked={selectedKeys.length === licenseKeys.length}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">Date</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">Order</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">Product</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">License Key</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">Buyer</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700 bg-gray-50">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licenseKeys.map((key) => (
                        <tr key={key.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedKeys.includes(key.id)}
                              onChange={() => toggleKeySelection(key.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {format(new Date(key.purchaseDate), 'yyyy-MM-dd')}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {format(new Date(key.purchaseDate), 'HH:mm:ss')}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => navigateToOrder(key.orderId)}
                              className="text-[#FFB20F] hover:text-[#e6a00e] font-medium text-sm flex items-center gap-1"
                            >
                              {key.orderNumber}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-sm">{key.productName}</div>
                              {key.categoryName && (
                                <div className="text-xs text-gray-500">{key.categoryName}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded max-w-[200px] truncate">
                              {key.keyValue}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium text-sm">{key.buyerName}</div>
                              <div className="text-xs text-gray-500">{key.buyerEmail}</div>
                              {key.buyerCompany && (
                                <div className="text-xs text-gray-400">{key.buyerCompany}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(key.status)}
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyKeyToClipboard(key.keyValue)}
                              className="flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
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
        </div>
      </div>
    </div>
  );
}