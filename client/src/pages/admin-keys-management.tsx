import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, subDays, subMonths, subYears, isAfter, isBefore, parseISO } from 'date-fns';
import { CalendarIcon, Search, Download, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface LicenseKeyDetails {
  id: string;
  keyValue: string;
  productTitle: string;
  price: string;
  orderNumber: string;
  purchaseDate: string;
  purchaseTime: string;
  warranty: string;
  platform: string;
  region: string;
  buyerName: string;
  buyerEmail: string;
  orderId: string;
}

interface KeySearchFilters {
  search: string;
  datePreset: string;
  startDate: Date | null;
  endDate: Date | null;
  orderNumber: string;
  category: string;
  buyer: string;
}

const DATE_PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' }
];

const AdminKeysManagement: React.FC = () => {
  const { toast } = useToast();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [filters, setFilters] = useState<KeySearchFilters>({
    search: '',
    datePreset: 'all',
    startDate: null,
    endDate: null,
    orderNumber: '',
    category: '',
    buyer: ''
  });

  // Fetch license keys data
  const { data: keysData, isLoading } = useQuery({
    queryKey: ['/api/admin/license-keys', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.orderNumber) params.append('orderNumber', filters.orderNumber);
      if (filters.category) params.append('category', filters.category);
      if (filters.buyer) params.append('buyer', filters.buyer);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      
      const response = await fetch(`/api/admin/license-keys?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch license keys');
      return response.json();
    }
  });

  // Apply date filtering based on preset
  const filteredKeys = useMemo(() => {
    if (!keysData?.data) return [];
    
    let filtered = keysData.data;
    
    // Apply date preset filtering
    if (filters.datePreset !== 'all' && filters.datePreset !== 'custom') {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.datePreset) {
        case '7d':
          startDate = subDays(now, 7);
          break;
        case '14d':
          startDate = subDays(now, 14);
          break;
        case '30d':
          startDate = subDays(now, 30);
          break;
        case '6m':
          startDate = subMonths(now, 6);
          break;
        case '1y':
          startDate = subYears(now, 1);
          break;
        default:
          startDate = new Date(0);
      }
      
      filtered = filtered.filter((key: LicenseKeyDetails) => {
        const purchaseDate = parseISO(key.purchaseDate);
        return isAfter(purchaseDate, startDate) || purchaseDate.getTime() === startDate.getTime();
      });
    }
    
    // Apply custom date range
    if (filters.datePreset === 'custom' && (filters.startDate || filters.endDate)) {
      filtered = filtered.filter((key: LicenseKeyDetails) => {
        const purchaseDate = parseISO(key.purchaseDate);
        let valid = true;
        
        if (filters.startDate) {
          valid = valid && (isAfter(purchaseDate, filters.startDate) || purchaseDate.getTime() === filters.startDate.getTime());
        }
        
        if (filters.endDate) {
          valid = valid && (isBefore(purchaseDate, filters.endDate) || purchaseDate.getTime() === filters.endDate.getTime());
        }
        
        return valid;
      });
    }
    
    return filtered;
  }, [keysData?.data, filters]);

  const handleDatePresetChange = (preset: string) => {
    setFilters(prev => ({
      ...prev,
      datePreset: preset,
      startDate: preset === 'custom' ? prev.startDate : null,
      endDate: preset === 'custom' ? prev.endDate : null
    }));
  };

  const handleSelectAll = () => {
    if (selectedKeys.length === filteredKeys.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(filteredKeys.map((key: LicenseKeyDetails) => key.id));
    }
  };

  const handleCopyKey = async (keyValue: string) => {
    try {
      await navigator.clipboard.writeText(keyValue);
      toast({
        title: "Success",
        description: "License key copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy license key",
        variant: "destructive"
      });
    }
  };

  const handleCopyAllKeys = async () => {
    if (selectedKeys.length === 0) {
      toast({
        title: "Warning",
        description: "No keys selected",
        variant: "destructive"
      });
      return;
    }

    const selectedKeyValues = filteredKeys
      .filter((key: LicenseKeyDetails) => selectedKeys.includes(key.id))
      .map((key: LicenseKeyDetails) => key.keyValue)
      .join('\n');

    try {
      await navigator.clipboard.writeText(selectedKeyValues);
      toast({
        title: "Success",
        description: `${selectedKeys.length} license keys copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy license keys",
        variant: "destructive"
      });
    }
  };

  const handleExportToExcel = () => {
    const selectedKeysData = filteredKeys.filter((key: LicenseKeyDetails) => 
      selectedKeys.length === 0 || selectedKeys.includes(key.id)
    );

    if (selectedKeysData.length === 0) {
      toast({
        title: "Warning",
        description: "No keys to export",
        variant: "destructive"
      });
      return;
    }

    // Create CSV content
    const headers = ['License Key', 'Product Title', 'Price', 'Order Number', 'Purchase Date', 'Warranty', 'Platform', 'Region', 'Buyer Name', 'Buyer Email'];
    const csvContent = [
      headers.join(','),
      ...selectedKeysData.map((key: LicenseKeyDetails) => [
        key.keyValue,
        `"${key.productTitle}"`,
        key.price,
        key.orderNumber,
        key.purchaseDate,
        key.warranty,
        key.platform,
        key.region,
        `"${key.buyerName}"`,
        key.buyerEmail
      ].join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `license-keys-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Exported ${selectedKeysData.length} license keys to CSV`,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#FFB20F] rounded-lg">
            <ExternalLink className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Digital License Keys</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCopyAllKeys}
            disabled={selectedKeys.length === 0}
            className="bg-[#FFB20F] hover:bg-[#FFB20F]/90 text-white"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy All Keys ({selectedKeys.length})
          </Button>
          <Button
            onClick={handleExportToExcel}
            variant="outline"
            className="text-[#6E6F71] border-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#6E6F71]">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search keys, products..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Preset */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date Range</label>
              <Select value={filters.datePreset} onValueChange={handleDatePresetChange}>
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

            {/* Order Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Order Number</label>
              <Input
                placeholder="ORD-12345..."
                value={filters.orderNumber}
                onChange={(e) => setFilters(prev => ({ ...prev, orderNumber: e.target.value }))}
              />
            </div>

            {/* Buyer */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Buyer</label>
              <Input
                placeholder="Name or email..."
                value={filters.buyer}
                onChange={(e) => setFilters(prev => ({ ...prev, buyer: e.target.value }))}
              />
            </div>
          </div>

          {/* Custom Date Range */}
          {filters.datePreset === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "PPP") : "Pick start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.startDate || undefined}
                      onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "PPP") : "Pick end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.endDate || undefined}
                      onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader className="bg-[#6E6F71] text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              License Keys ({filteredKeys.length} results)
            </CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedKeys.length === filteredKeys.length && filteredKeys.length > 0}
                onChange={handleSelectAll}
                className="rounded"
              />
              <span className="text-sm">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    License Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Warranty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredKeys.map((key: LicenseKeyDetails) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedKeys.includes(key.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKeys(prev => [...prev, key.id]);
                          } else {
                            setSelectedKeys(prev => prev.filter(id => id !== key.id));
                          }
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {key.keyValue}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{key.productTitle}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-[#FFB20F]">€{key.price}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Link href={`/admin/orders/details?id=${key.orderId}`}>
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-[#FFB20F] hover:text-white transition-colors"
                        >
                          {key.orderNumber}
                        </Badge>
                      </Link>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{key.warranty}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge variant="secondary">{key.platform}</Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge variant="outline">{key.region}</Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Button
                        size="sm"
                        onClick={() => handleCopyKey(key.keyValue)}
                        className="bg-[#FFB20F] hover:bg-[#FFB20F]/90 text-white"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredKeys.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg">No license keys found</div>
              <div className="text-gray-400 text-sm mt-2">Try adjusting your search filters</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminKeysManagement;