import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Key, 
  Copy, 
  Download, 
  Filter, 
  Search 
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from 'xlsx';

interface LicenseKeyResult {
  id: string;
  keyValue: string;
  productId: string;
  productName: string;
  productPrice: string;
  productPlatform: string;
  productRegion: string;
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
  dateRange: string;
}

export function EmbeddedKeyManagement() {
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    orderNumber: '',
    categoryId: 'all',
    dateRange: 'all'
  });

  // Fetch license keys
  const { data: licenseKeysData, isLoading } = useQuery({
    queryKey: ['/api/admin/license-keys/all', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.orderNumber) params.append('orderNumber', filters.orderNumber);
      if (filters.categoryId !== 'all') params.append('categoryId', filters.categoryId);
      
      const response = await fetch(`/api/admin/license-keys/all?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch license keys');
      return response.json();
    },
  });

  // Fetch categories for filter
  const { data: categories = [] } = useQuery<Array<{id: string, name: string}>>({
    queryKey: ['/api/categories'],
  });

  const licenseKeys: LicenseKeyResult[] = licenseKeysData?.data || [];

  const handleDateRangeChange = (range: string) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
  };

  const copyKeyToClipboard = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    toast({
      title: "Copied!",
      description: "License key copied to clipboard",
    });
  };

  const copyAllKeys = () => {
    const allKeys = licenseKeys.map(key => key.keyValue).join('\n');
    navigator.clipboard.writeText(allKeys);
    toast({
      title: "Copied!",
      description: `${licenseKeys.length} license keys copied to clipboard`,
    });
  };

  const exportToExcel = () => {
    const exportData = licenseKeys.map(key => ({
      'License Key': key.keyValue,
      'Product Title': key.productName,
      'Price': `€${key.productPrice || '29.90'}`,
      'Order Number': key.orderNumber,
      'Warranty': format(new Date(key.purchaseDate), 'MMM dd, yyyy'),
      'Platform': key.productPlatform || 'Mac',
      'Region': key.productRegion || 'Worldwide',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'License Keys');
    XLSX.writeFile(workbook, `license-keys-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    
    toast({
      title: "Exported!",
      description: `${licenseKeys.length} license keys exported to Excel`,
    });
  };

  const navigateToOrder = (orderNumber: string) => {
    // This would navigate to the orders section with the order number pre-filled
    // For now, we'll just show a toast
    toast({
      title: "Order Navigation",
      description: `Would navigate to order ${orderNumber}`,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-gray-500">Loading license keys...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header matching the image design */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key className="h-6 w-6 text-[#6E6F71]" />
          <h3 className="text-xl font-semibold text-[#6E6F71]">
            Digital License Keys
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm px-4 py-2 flex items-center gap-2 border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
          >
            <Filter className="h-4 w-4" />
            Advanced Filters
          </Button>
          <Button
            size="sm"
            onClick={copyAllKeys}
            className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white text-sm px-4 py-2 flex items-center gap-2 font-medium"
          >
            <Copy className="h-4 w-4" />
            Copy All Keys ({licenseKeys.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="text-sm px-4 py-2 flex items-center gap-2 border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Filters - Always show for compact design */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search keys or products..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>

            {/* Order Number */}
            <Input
              placeholder="Order number..."
              value={filters.orderNumber}
              onChange={(e) => setFilters(prev => ({ ...prev, orderNumber: e.target.value }))}
            />

            {/* Category */}
            <Select
              value={filters.categoryId}
              onValueChange={(value) => setFilters(prev => ({ ...prev, categoryId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Presets */}
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
        </CardContent>
      </Card>

      {/* Keys Table - Exact design from image */}
      <Card>
        <CardContent className="p-0">
          {licenseKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No license keys found</p>
              <p className="text-sm text-gray-400">Try adjusting your search filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#6E6F71] text-white">
                    <th className="text-left py-3 px-4 font-medium text-sm">License Key</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Product Title</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Price</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Order Number</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Warranty</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Platform</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Region</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {licenseKeys.map((key) => (
                    <tr key={key.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-2 px-4">
                        <div className="font-mono text-sm font-medium text-gray-900">
                          {key.keyValue}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-sm font-medium text-gray-900">{key.productName}</div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-sm font-medium text-[#FFB20F]">
                          €{key.productPrice || '29.90'}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() => navigateToOrder(key.orderNumber)}
                          className="text-sm text-gray-600 hover:text-[#FFB20F] font-medium"
                        >
                          {key.orderNumber}
                        </button>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-sm text-gray-600">
                          {format(new Date(key.purchaseDate), 'MMM dd, yyyy')}
                        </div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-sm text-gray-600">{key.productPlatform || 'Mac'}</div>
                      </td>
                      <td className="py-2 px-4">
                        <div className="text-sm text-gray-600">{key.productRegion || 'Worldwide'}</div>
                      </td>
                      <td className="py-2 px-4">
                        <Button
                          size="sm"
                          onClick={() => copyKeyToClipboard(key.keyValue)}
                          className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white text-xs px-3 py-1 h-7 flex items-center gap-1 font-medium"
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
  );
}