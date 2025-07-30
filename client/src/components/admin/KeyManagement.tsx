import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Calendar, 
  Key, 
  User, 
  Package, 
  Clock, 
  Filter,
  Download,
  Copy,
  ExternalLink,
  FileText,
  ChevronDown,
  CalendarDays
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface LicenseKeyData {
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
  status: 'active' | 'used' | 'expired' | 'revoked';
  isActive: boolean;
}

interface FilterState {
  search: string;
  orderNumber: string;
  categoryId: string;
  buyerSearch: string;
  dateRange: 'custom' | '7days' | '14days' | '30days' | '6months' | '1year' | 'all';
  startDate: Date | null;
  endDate: Date | null;
  status: string;
}

const DATE_PRESETS = [
  { value: '7days', label: 'Last 7 days' },
  { value: '14days', label: 'Last 14 days' },
  { value: '30days', label: 'Last 30 days' },
  { value: '6months', label: 'Last 6 months' },
  { value: '1year', label: 'Last year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' }
];

export function KeyManagement() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    orderNumber: '',
    categoryId: '',
    buyerSearch: '',
    dateRange: 'all',
    startDate: null,
    endDate: null,
    status: 'all'
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Fetch license keys data with orders and user information
  const { data: licenseKeysData, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/license-keys/all', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.search) params.append('search', filters.search);
      if (filters.orderNumber) params.append('orderNumber', filters.orderNumber);
      if (filters.categoryId && filters.categoryId !== 'all') params.append('categoryId', filters.categoryId);
      if (filters.buyerSearch) params.append('buyerSearch', filters.buyerSearch);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      
      // Handle date filtering
      if (filters.dateRange !== 'all') {
        let startDate: Date;
        let endDate = new Date();
        
        switch (filters.dateRange) {
          case '7days':
            startDate = subDays(new Date(), 7);
            break;
          case '14days':
            startDate = subDays(new Date(), 14);
            break;
          case '30days':
            startDate = subDays(new Date(), 30);
            break;
          case '6months':
            startDate = subMonths(new Date(), 6);
            break;
          case '1year':
            startDate = subYears(new Date(), 1);
            break;
          case 'custom':
            if (filters.startDate) startDate = startOfDay(filters.startDate);
            if (filters.endDate) endDate = endOfDay(filters.endDate);
            break;
          default:
            startDate = new Date(0);
        }
        
        if (startDate!) params.append('startDate', startDate.toISOString());
        if (endDate) params.append('endDate', endDate.toISOString());
      }

      const response = await fetch(`/api/admin/license-keys/all?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch license keys');
      }
      
      return response.json();
    },
  });

  // Fetch categories for filtering
  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
  });

  const licenseKeys: LicenseKeyData[] = useMemo(() => {
    return licenseKeysData?.data || [];
  }, [licenseKeysData]);

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      search: '',
      orderNumber: '',
      categoryId: '',
      buyerSearch: '',
      dateRange: 'all',
      startDate: null,
      endDate: null,
      status: 'all'
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.orderNumber) count++;
    if (filters.categoryId && filters.categoryId !== 'all') count++;
    if (filters.buyerSearch) count++;
    if (filters.dateRange !== 'all') count++;
    if (filters.status && filters.status !== 'all') count++;
    return count;
  };

  const handleCopyKey = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    toast({
      title: "Copied",
      description: "License key copied to clipboard",
    });
  };

  const handleCopyAllSelected = () => {
    const selectedKeysData = licenseKeys.filter(key => selectedKeys.includes(key.id));
    const keysText = selectedKeysData.map(key => key.keyValue).join('\n');
    navigator.clipboard.writeText(keysText);
    toast({
      title: "Copied",
      description: `${selectedKeys.length} license keys copied to clipboard`,
    });
  };

  const handleExportToExcel = () => {
    const selectedKeysData = licenseKeys.filter(key => selectedKeys.includes(key.id));
    const csvContent = [
      ['Order Number', 'Product Name', 'License Key', 'Buyer Name', 'Buyer Email', 'Purchase Date', 'Status'].join(','),
      ...selectedKeysData.map(key => [
        key.orderNumber,
        key.productName,
        key.keyValue,
        key.buyerName,
        key.buyerEmail,
        format(new Date(key.purchaseDate), 'yyyy-MM-dd HH:mm:ss'),
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
      description: `${selectedKeys.length} license keys exported to CSV`,
    });
  };

  const handleOrderClick = (orderId: string, orderNumber: string) => {
    // Open order details in a new tab with B2B panel styling
    window.open(`/admin/orders/${orderId}?orderNumber=${orderNumber}`, '_blank');
  };

  const toggleKeySelection = (keyId: string) => {
    setSelectedKeys(prev => 
      prev.includes(keyId) 
        ? prev.filter(id => id !== keyId)
        : [...prev, keyId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedKeys.length === licenseKeys.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(licenseKeys.map(key => key.id));
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'used': return 'secondary';
      case 'expired': return 'destructive';
      case 'revoked': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Key className="h-5 w-5 text-[#FFB20F]" />
              Keys Management
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedKeys.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAllSelected}
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Selected ({selectedKeys.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportToExcel}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    Export Selected
                  </Button>
                </>
              )}
              <Badge variant="secondary" className="bg-[#FFB20F] text-white">
                {licenseKeys.length} Total Keys
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Manage and track all software license keys</span>
            {getActiveFilterCount() > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 px-2 text-xs"
              >
                Clear Filters ({getActiveFilterCount()})
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Search & Filters
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-1"
            >
              Advanced Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search Keys/Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search license keys, products..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Order Number</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by order number..."
                  value={filters.orderNumber}
                  onChange={(e) => handleFilterChange('orderNumber', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Range</Label>
              <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range */}
          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "PPP") : "Pick start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={filters.startDate || undefined}
                      onSelect={(date) => handleFilterChange('startDate', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "PPP") : "Pick end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={filters.endDate || undefined}
                      onSelect={(date) => handleFilterChange('endDate', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <CollapsibleContent className="space-y-4">
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select value={filters.categoryId} onValueChange={(value) => handleFilterChange('categoryId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Buyer Search</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search by buyer name, email..."
                      value={filters.buyerSearch}
                      onChange={(e) => handleFilterChange('buyerSearch', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Key Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">License Keys Results</CardTitle>
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
          {isLoading ? (
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
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-sm">
                      <input
                        type="checkbox"
                        checked={selectedKeys.length === licenseKeys.length && licenseKeys.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Purchase Date/Time</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Order Number</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Product Name</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">License Key</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Buyer</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {licenseKeys.map((key) => (
                    <tr key={key.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(key.id)}
                          onChange={() => toggleKeySelection(key.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-sm">
                              {format(new Date(key.purchaseDate), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(key.purchaseDate), 'HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="link"
                          className="p-0 h-auto text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleOrderClick(key.orderId, key.orderNumber)}
                        >
                          {key.orderNumber}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium text-sm">{key.productName}</div>
                            <div className="text-xs text-gray-500">{key.categoryName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                            {key.keyValue}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyKey(key.keyValue)}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
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
                        <Badge variant={getStatusBadgeVariant(key.status)} className="text-xs">
                          {key.status.charAt(0).toUpperCase() + key.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyKey(key.keyValue)}
                            className="h-6 w-6 p-0"
                            title="Copy key"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOrderClick(key.orderId, key.orderNumber)}
                            className="h-6 w-6 p-0"
                            title="View order"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
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
  );
}