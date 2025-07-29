import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator, 
  Save,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Percent,
  Edit,
  Check,
  X
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  sku: string;
  purchasePrice: string;
  b2bPrice: string;
  retailPrice: string;
  categoryName: string;
}

interface PriceUpdate {
  productId: string;
  purchasePrice: number;
  b2bPrice: number;
  retailPrice: number;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatPercentage = (value: number) => {
  const color = value >= 50 ? 'text-green-600' : value >= 20 ? 'text-yellow-600' : 'text-red-600';
  return (
    <span className={`font-semibold ${color}`}>
      {value.toFixed(1)}%
    </span>
  );
};

export default function PriceManagementPage() {
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<Record<string, {
    purchasePrice: string;
    b2bPrice: string;
    retailPrice: string;
    retailPriceWithVat: number;
    b2bMargin: number;
    b2cMargin: number;
    b2bProfit: number;
    b2cProfit: number;
    fees: number;
    priceRange: string;
  }>>({});
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { toast } = useToast();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: productsRaw, isLoading } = useQuery({
    queryKey: ["/api/admin/products"],
  });

  const products = useMemo(() => {
    return productsRaw?.data || [];
  }, [productsRaw]);

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const updatePriceMutation = useMutation({
    mutationFn: async (data: PriceUpdate) => {
      console.log('🎯 MUTATION CALLED WITH DATA:', data);
      console.log('🔍 Data Types:', {
        purchasePrice: typeof data.purchasePrice,
        b2bPrice: typeof data.b2bPrice,
        retailPrice: typeof data.retailPrice
      });
      
      // Use direct fetch with complete debugging to avoid middleware issues
      const requestBody = {
        purchasePrice: data.purchasePrice,
        b2bPrice: data.b2bPrice,
        retailPrice: data.retailPrice
      };
      
      console.log('🌐 About to send request:', {
        url: `/api/admin/products/${data.productId}/pricing`,
        method: 'PATCH',
        body: requestBody,
        bodyString: JSON.stringify(requestBody)
      });
      
      const response = await fetch(`/api/admin/products/${data.productId}/pricing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ SUCCESS - Backend response:', result);
      return result;
    },
    onSuccess: (updatedProduct) => {
      toast({ 
        title: "Central Pricing Authority Updated", 
        description: `Pricing synchronized across Edit Product, EUR Shop, and all platform systems` 
      });
      // Update local state with the new values to prevent reset
      setPriceData(prev => {
        const updated = { ...prev };
        if (updated[updatedProduct.data.id]) {
          updated[updatedProduct.data.id] = {
            ...updated[updatedProduct.data.id],
            purchasePrice: updatedProduct.data.purchasePrice,
            b2bPrice: updatedProduct.data.b2bPrice,
            retailPrice: updatedProduct.data.retailPrice
          };
        }
        return updated;
      });
      
      // COMPREHENSIVE PRICE SYNCHRONIZATION - invalidate all pricing-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/retail/product-offers"] });
      // CRITICAL FIX: Remove cached data completely and force fresh fetch for Edit Product page
      queryClient.removeQueries({ queryKey: [`/api/admin/products/${updatedProduct.data.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${updatedProduct.data.id}`] });
      
      // Force immediate refetch to trigger Edit Product page useEffect
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: [`/api/admin/products/${updatedProduct.data.id}`] });
      }, 100);
      queryClient.invalidateQueries({ queryKey: [`/api/products/${updatedProduct.data.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/retail/product-offers/${updatedProduct.data.id}`] });
      // Invalidate shop and admin panel caches
      queryClient.invalidateQueries({ queryKey: ["/api/retail/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/license-keys"] });
      setEditingProduct(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update pricing", variant: "destructive" });
    },
  });

  const calculateMargins = (purchasePrice: string, b2bPrice: string, retailPrice: string, fees: string = '0') => {
    const cost = parseFloat(purchasePrice) || 0;
    const b2bPriceNum = parseFloat(b2bPrice) || 0;
    const b2cPrice = parseFloat(retailPrice) || 0;
    const additionalFees = parseFloat(fees) || 0;
    const vatRate = 0.21; // 21% VAT rate
    
    // Add fees to the cost for margin calculations
    const totalCost = cost + additionalFees;
    const retailPriceWithVat = b2cPrice * (1 + vatRate);

    const b2bProfit = b2bPriceNum - totalCost;
    const b2cProfit = b2cPrice - totalCost;
    const b2bMargin = totalCost > 0 ? ((b2bProfit / totalCost) * 100) : 0;
    const b2cMargin = totalCost > 0 ? ((b2cProfit / totalCost) * 100) : 0;

    return {
      retailPriceWithVat: Math.round(retailPriceWithVat * 100) / 100,
      b2bMargin: Math.round(b2bMargin * 100) / 100,
      b2cMargin: Math.round(b2cMargin * 100) / 100,
      b2bProfit: Math.round(b2bProfit * 100) / 100,
      b2cProfit: Math.round(b2cProfit * 100) / 100,
      fees: Math.round(additionalFees * 100) / 100,
      priceRange: ''
    };
  };

  const calculatePriceFromMargin = (purchasePrice: string, margin: string, fees: string = '0') => {
    const cost = parseFloat(purchasePrice) || 0;
    const marginPercent = parseFloat(margin) || 0;
    const additionalFees = parseFloat(fees) || 0;
    const totalCost = cost + additionalFees;
    
    // Price = Cost * (1 + margin/100)
    const calculatedPrice = totalCost * (1 + marginPercent / 100);
    return Math.round(calculatedPrice * 100) / 100;
  };

  useEffect(() => {
    if (products && Array.isArray(products) && products.length > 0) {
      const initialData: Record<string, any> = {};
      products.forEach(product => {
        // Only initialize if we don't already have data for this product
        if (!priceData[product.id]) {
          const margins = calculateMargins(
            product.purchasePrice,
            product.b2bPrice,
            product.retailPrice
          );
          initialData[product.id] = {
            purchasePrice: product.purchasePrice,
            b2bPrice: product.b2bPrice,
            retailPrice: product.retailPrice,
            ...margins
          };
        }
      });
      
      // Only update state if we have new data to add
      if (Object.keys(initialData).length > 0) {
        setPriceData(prev => ({ ...prev, ...initialData }));
      }
    }
  }, [products]);

  const handlePriceChange = (productId: string, field: string, value: string) => {
    setPriceData(prev => {
      const current = prev[productId] || {};
      let updated = { ...current, [field]: value };
      
      // If changing margin, calculate new price
      if (field === 'b2bMargin') {
        const newB2BPrice = calculatePriceFromMargin(
          updated.purchasePrice || '0',
          value,
          updated.fees?.toString() || '0'
        );
        updated.b2bPrice = newB2BPrice.toString();
      } else if (field === 'b2cMargin') {
        const newB2CPrice = calculatePriceFromMargin(
          updated.purchasePrice || '0',
          value,
          updated.fees?.toString() || '0'
        );
        updated.retailPrice = newB2CPrice.toString();
      }
      
      // Recalculate all margins and profits
      const margins = calculateMargins(
        updated.purchasePrice || '0',
        updated.b2bPrice || '0',
        updated.retailPrice || '0',
        updated.fees?.toString() || '0'
      );

      return {
        ...prev,
        [productId]: {
          ...updated,
          ...margins
        }
      };
    });
  };

  const handleSave = (product: Product) => {
    const data = priceData[product.id];
    if (data) {
      // CRITICAL: Always send ALL pricing fields to ensure complete synchronization
      // Use current data if available, fallback to original product data
      const pricingUpdate = {
        productId: product.id,
        purchasePrice: parseFloat(data.purchasePrice || product.purchasePrice || '0'),
        b2bPrice: parseFloat(data.b2bPrice || product.b2bPrice || '0'),
        retailPrice: parseFloat(data.retailPrice || product.retailPrice || '0')
      };
      
      console.log('🏛️ CENTRAL PRICING AUTHORITY - Complete Product Update:', pricingUpdate);
      console.log('🔍 Original Product Data:', {
        purchasePrice: product.purchasePrice,
        b2bPrice: product.b2bPrice,
        retailPrice: product.retailPrice
      });
      console.log('🔍 Local Changes Data:', data);
      
      updatePriceMutation.mutate(pricingUpdate);
    }
  };

  const handleCancel = (product: Product) => {
    const margins = calculateMargins(
      product.purchasePrice,
      product.b2bPrice,
      product.retailPrice
    );
    setPriceData(prev => ({
      ...prev,
      [product.id]: {
        purchasePrice: product.purchasePrice,
        b2bPrice: product.b2bPrice,
        retailPrice: product.retailPrice,
        ...margins
      }
    }));
    setEditingProduct(null);
  };

  const handleCheckboxChange = (productId: string, index: number, event: React.MouseEvent) => {
    const isShiftPressed = event.shiftKey;
    
    setSelectedProducts(prev => {
      const newSelected = new Set(prev);
      
      if (isShiftPressed && lastSelectedIndex !== null) {
        // Range selection with shift
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const productList = products as Product[];
        
        for (let i = start; i <= end; i++) {
          if (productList[i]) {
            newSelected.add(productList[i].id);
          }
        }
      } else {
        // Single selection
        if (newSelected.has(productId)) {
          newSelected.delete(productId);
        } else {
          newSelected.add(productId);
        }
      }
      
      return newSelected;
    });
    
    setLastSelectedIndex(index);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === (products as Product[])?.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set((products as Product[])?.map(p => p.id) || []));
    }
  };

  const handleBulkEdit = () => {
    setBulkEditMode(true);
    // Initialize price data for all selected products
    selectedProducts.forEach(productId => {
      const product = (products as Product[])?.find(p => p.id === productId);
      if (product && !priceData[productId]) {
        const margins = calculateMargins(
          product.purchasePrice,
          product.b2bPrice,
          product.retailPrice
        );
        setPriceData(prev => ({
          ...prev,
          [productId]: {
            purchasePrice: product.purchasePrice,
            b2bPrice: product.b2bPrice,
            retailPrice: product.retailPrice,
            ...margins
          }
        }));
      }
    });
  };

  const handleBulkSave = async () => {
    const updates = Array.from(selectedProducts).map(productId => {
      const data = priceData[productId];
      return {
        productId,
        purchasePrice: parseFloat(data.purchasePrice),
        b2bPrice: parseFloat(data.b2bPrice),
        retailPrice: parseFloat(data.retailPrice)
      };
    });

    try {
      await Promise.all(updates.map(update => updatePriceMutation.mutateAsync(update)));
      setBulkEditMode(false);
      setSelectedProducts(new Set());
      toast({
        title: "Bulk Update Complete",
        description: `Updated pricing for ${updates.length} products`
      });
    } catch (error) {
      toast({
        title: "Bulk Update Failed",
        description: "Some products failed to update",
        variant: "destructive"
      });
    }
  };

  const handleBulkCancel = () => {
    setBulkEditMode(false);
    // Clear price data for selected products
    setPriceData(prev => {
      const newData = { ...prev };
      selectedProducts.forEach(id => delete newData[id]);
      return newData;
    });
    setSelectedProducts(new Set());
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCategoryFilter('all');
    setShowAdvancedFilters(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central Price Management Hub</h1>
          <p className="text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm font-medium mr-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              PRICING AUTHORITY
            </span>
            All price changes made here become the official prices across the entire platform
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/products"] })}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Pricing Authority Information Panel */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-600 rounded-full p-2 mt-1">
              <Calculator className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Central Pricing Authority</h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                This interface serves as the authoritative source for all product pricing across the platform. 
                Changes made here automatically synchronize to: <span className="font-medium">Edit Product Page, EUR Shop, Retail Store, Order Processing, Cart Systems, and API Responses</span>. 
                All other pricing displays throughout the platform reference these values.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              <CardTitle>Product Pricing & Profit Calculator</CardTitle>
            </div>
            <div className="flex gap-2">
              {selectedProducts.size > 0 && (
                <>
                  {!bulkEditMode ? (
                    <Button onClick={handleBulkEdit} size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit All ({selectedProducts.size})
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleBulkSave} size="sm" disabled={updatePriceMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        Save All Changes
                      </Button>
                      <Button onClick={handleBulkCancel} variant="outline" size="sm">
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search products..."
                className="max-w-md"
                value={searchTerm}
                onChange={handleSearchInputChange}
              />
              {searchTerm && (
                <Button variant="outline" size="sm" onClick={handleClearSearch}>
                  Clear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                Advanced Filters
              </Button>
            </div>
          </div>
          {showAdvancedFilters && (
            <div className="flex items-center gap-4 mt-3 p-3 bg-gray-50 rounded-lg">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(categories as any[])?.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleClearSearch}>
                Clear All
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              {/* Header */}
              <div className="grid gap-1 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b" style={{gridTemplateColumns: '40px minmax(60px, 80px) minmax(300px, 1fr) minmax(80px, 100px) minmax(80px, 100px) minmax(60px, 80px) minmax(70px, 90px) minmax(80px, 100px) minmax(60px, 80px) minmax(70px, 90px) minmax(70px, 90px) 40px'}}>
                <div className="text-center">
                  <Checkbox
                    checked={selectedProducts.size === (products as Product[])?.length && (products as Product[])?.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </div>
                <div className="text-center">
                  <div className="bg-orange-500 text-white px-1 py-2 rounded text-xs font-medium">
                    Fees
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-slate-600 text-white px-3 py-2 rounded text-sm font-medium">
                    Product Name
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-red-500 text-white px-3 py-2 rounded text-sm font-medium">
                    Cost Price
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-blue-500 text-white px-2 py-2 rounded text-sm font-medium">
                    B2B Price
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-blue-400 text-white px-1 py-2 rounded text-xs font-medium">
                    B2B Margin
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-blue-600 text-white px-1 py-2 rounded text-xs font-medium">
                    B2B Profit
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-emerald-500 text-white px-2 py-2 rounded text-sm font-medium">
                    B2C Price
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-emerald-400 text-white px-1 py-2 rounded text-xs font-medium">
                    B2C Margin
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-teal-600 text-white px-1 py-2 rounded text-xs font-medium">
                    B2C Profit
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-purple-600 text-white px-1 py-2 rounded text-xs font-medium">
                    B2C+VAT
                  </div>
                </div>
                <div className="text-center">
                  <Edit className="w-4 h-4 text-slate-500 mx-auto" />
                </div>
              </div>

              {/* Product Rows */}
              <div className="divide-y-2 divide-slate-200">
                {(products as Product[])?.map((product, index) => {
                  const data = priceData[product.id] || {
                    purchasePrice: product.purchasePrice,
                    b2bPrice: product.b2bPrice,
                    retailPrice: product.retailPrice,
                    retailPriceWithVat: parseFloat(product.retailPrice) * 1.21,
                    b2bMargin: ((parseFloat(product.b2bPrice) - parseFloat(product.purchasePrice)) / parseFloat(product.purchasePrice)) * 100,
                    b2cMargin: ((parseFloat(product.retailPrice) - parseFloat(product.purchasePrice)) / parseFloat(product.purchasePrice)) * 100,
                    b2bProfit: parseFloat(product.b2bPrice) - parseFloat(product.purchasePrice),
                    b2cProfit: parseFloat(product.retailPrice) - parseFloat(product.purchasePrice),
                    fees: 0,
                    priceRange: ''
                  };
                  const isEditing = editingProduct === product.id || (bulkEditMode && selectedProducts.has(product.id));
                  
                  // Truncate product name to 50 characters with ellipsis
                  const truncatedName = product.name.length > 50 
                    ? product.name.slice(0, 50) + '...' 
                    : product.name;

                  return (
                    <div key={product.id} className="grid gap-1 p-4 hover:bg-slate-50 transition-colors bg-white" style={{gridTemplateColumns: '40px minmax(60px, 80px) minmax(300px, 1fr) minmax(80px, 100px) minmax(80px, 100px) minmax(60px, 80px) minmax(70px, 90px) minmax(80px, 100px) minmax(60px, 80px) minmax(70px, 90px) minmax(70px, 90px) 40px'}}>
                      {/* Checkbox */}
                      <div className="text-center flex items-center justify-center">
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => {}}
                          onClick={(event) => handleCheckboxChange(product.id, index, event)}
                        />
                      </div>

                      {/* Fees */}
                      <div className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.fees || ''}
                            onChange={(e) => handlePriceChange(product.id, 'fees', e.target.value)}
                            className="w-full text-center font-mono text-sm h-8"
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="font-mono text-orange-700 font-semibold text-sm">
                            {formatCurrency(data.fees || 0)}
                          </div>
                        )}
                      </div>

                      {/* Product Name */}
                      <div className="flex items-center">
                        <div className="font-medium text-slate-900 text-sm w-full whitespace-nowrap overflow-hidden" title={product.name}>
                          {truncatedName}
                        </div>
                      </div>

                      {/* Cost Price */}
                      <div className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.purchasePrice || ''}
                            onChange={(e) => handlePriceChange(product.id, 'purchasePrice', e.target.value)}
                            className="w-full text-center font-mono text-sm h-8"
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="bg-red-500 text-white rounded px-2 py-1 text-sm font-medium">
                            {formatCurrency(parseFloat(data.purchasePrice || '0'))}
                          </div>
                        )}
                      </div>

                      {/* B2B Price */}
                      <div className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.b2bPrice || ''}
                            onChange={(e) => handlePriceChange(product.id, 'b2bPrice', e.target.value)}
                            className="w-full text-center font-mono text-sm h-8"
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="bg-blue-500 text-white rounded px-2 py-1 text-sm font-medium">
                            {formatCurrency(parseFloat(data.b2bPrice || '0'))}
                          </div>
                        )}
                      </div>

                      {/* B2B Margin */}
                      <div className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.1"
                            value={data.b2bMargin || ''}
                            onChange={(e) => handlePriceChange(product.id, 'b2bMargin', e.target.value)}
                            className="w-full text-center font-mono text-sm h-8"
                            placeholder="0"
                          />
                        ) : (
                          <div className="font-mono text-blue-700 font-semibold text-sm">
                            {Math.round(data.b2bMargin || 0)}%
                          </div>
                        )}
                      </div>

                      {/* B2B Profit */}
                      <div className="text-center">
                        <div className="font-mono text-blue-700 font-semibold text-sm">
                          {formatCurrency(data.b2bProfit || 0)}
                        </div>
                      </div>

                      {/* B2C Price */}
                      <div className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.retailPrice || ''}
                            onChange={(e) => handlePriceChange(product.id, 'retailPrice', e.target.value)}
                            className="w-full text-center font-mono text-sm h-8"
                            placeholder="0.00"
                          />
                        ) : (
                          <div className="bg-emerald-500 text-white rounded px-2 py-1 text-sm font-medium">
                            {formatCurrency(parseFloat(data.retailPrice || '0'))}
                          </div>
                        )}
                      </div>

                      {/* B2C Margin */}
                      <div className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.1"
                            value={data.b2cMargin || ''}
                            onChange={(e) => handlePriceChange(product.id, 'b2cMargin', e.target.value)}
                            className="w-full text-center font-mono text-sm h-8"
                            placeholder="0"
                          />
                        ) : (
                          <div className="font-mono text-emerald-700 font-semibold text-sm">
                            {Math.round(data.b2cMargin || 0)}%
                          </div>
                        )}
                      </div>

                      {/* B2C Profit */}
                      <div className="text-center">
                        <div className="font-mono text-emerald-700 font-semibold text-sm">
                          {formatCurrency(data.b2cProfit || 0)}
                        </div>
                      </div>

                      {/* B2C + VAT */}
                      <div className="text-center">
                        <div className="bg-purple-600 text-white rounded px-2 py-1 text-sm font-medium">
                          {formatCurrency(data.retailPriceWithVat || 0)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="text-center">
                        {editingProduct === product.id ? (
                          <div className="flex gap-1">
                            <Button
                              onClick={() => handleSave(product)}
                              size="sm"
                              variant="outline"
                              className="w-8 h-8 p-0"
                              disabled={updatePriceMutation.isPending}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button
                              onClick={() => handleCancel(product)}
                              size="sm"
                              variant="outline"
                              className="w-8 h-8 p-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setEditingProduct(product.id)}
                            size="sm"
                            variant="outline"
                            className="w-8 h-8 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}