import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Edit2, 
  Save, 
  X, 
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  DollarSign,
  BarChart3,
  Target
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  purchasePrice: string;
  b2bPrice: string;
  retailPrice: string;
  categoryName?: string;
  stock: number;
}

interface PriceUpdate {
  productId: string;
  costPrice: number;
  resellerPrice: number;
  retailPrice: number;
}

export default function PriceManagementPage() {
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<Record<string, {
    costPrice: string;
    resellerPrice: string;
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
    queryKey: ["/api/products"],
  });

  // Client-side filtering for search and categories
  const products = React.useMemo(() => {
    if (!productsRaw) return [];
    
    let filtered = productsRaw as Product[];
    
    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchLower) ||
        product.description.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.categoryName === categoryFilter);
    }
    
    return filtered;
  }, [productsRaw, debouncedSearchTerm, categoryFilter]);

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const updatePriceMutation = useMutation({
    mutationFn: async (data: PriceUpdate) => {
      const response = await fetch(`/api/admin/products/${data.productId}/pricing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          costPrice: data.costPrice,
          resellerPrice: data.resellerPrice,
          retailPrice: data.retailPrice
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (updatedProduct) => {
      toast({ 
        title: "Pricing Authority Updated", 
        description: "Product pricing synchronized across all platform systems" 
      });
      // Invalidate all pricing-related queries to ensure synchronization
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/retail/product-offers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/products/${updatedProduct.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/retail/product-offers/${updatedProduct.id}`] });
      // Invalidate search results and category listings
      queryClient.invalidateQueries({ queryKey: ["/api/retail/products"] });
      setEditingProduct(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update pricing", variant: "destructive" });
    },
  });

  const calculateMargins = (costPrice: string, resellerPrice: string, retailPrice: string, fees: string = '0') => {
    const cost = parseFloat(costPrice) || 0;
    const b2bPrice = parseFloat(resellerPrice) || 0;
    const b2cPrice = parseFloat(retailPrice) || 0;
    const additionalFees = parseFloat(fees) || 0;
    const vatRate = 0.21; // 21% VAT rate
    
    // Add fees to the cost for margin calculations
    const totalCost = cost + additionalFees;
    const retailPriceWithVat = b2cPrice * (1 + vatRate);

    const b2bProfit = b2bPrice - totalCost;
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

  const calculatePriceFromMargin = (costPrice: string, margin: string, fees: string = '0') => {
    const cost = parseFloat(costPrice) || 0;
    const marginPercent = parseFloat(margin) || 0;
    const additionalFees = parseFloat(fees) || 0;
    const totalCost = cost + additionalFees;
    
    // Price = Cost * (1 + margin/100)
    const calculatedPrice = totalCost * (1 + marginPercent / 100);
    return Math.round(calculatedPrice * 100) / 100;
  };

  const handlePriceChange = (productId: string, field: string, value: string) => {
    setPriceData(prev => {
      const current = prev[productId] || {};
      const updated = { ...current, [field]: value };
      
      // Recalculate margins when any price changes
      if (field === 'costPrice' || field === 'resellerPrice' || field === 'retailPrice') {
        const margins = calculateMargins(
          updated.costPrice || '0',
          updated.resellerPrice || '0', 
          updated.retailPrice || '0'
        );
        Object.assign(updated, margins);
      }
      
      return { ...prev, [productId]: updated };
    });
  };

  const handleMarginChange = (productId: string, marginType: 'b2bMargin' | 'b2cMargin', value: string) => {
    setPriceData(prev => {
      const current = prev[productId] || {};
      const costPrice = current.costPrice || '0';
      
      if (marginType === 'b2bMargin') {
        const newPrice = calculatePriceFromMargin(costPrice, value);
        const updated = { ...current, resellerPrice: newPrice.toString() };
        const margins = calculateMargins(
          updated.costPrice || '0',
          updated.resellerPrice || '0',
          updated.retailPrice || '0'
        );
        Object.assign(updated, margins);
        return { ...prev, [productId]: updated };
      } else {
        const newPrice = calculatePriceFromMargin(costPrice, value);
        const updated = { ...current, retailPrice: newPrice.toString() };
        const margins = calculateMargins(
          updated.costPrice || '0',
          updated.resellerPrice || '0',
          updated.retailPrice || '0'
        );
        Object.assign(updated, margins);
        return { ...prev, [productId]: updated };
      }
    });
  };

  const handleEdit = (productId: string) => {
    setEditingProduct(productId);
    const product = (products as Product[])?.find(p => p.id === productId);
    if (product && !priceData[productId]) {
      const margins = calculateMargins(
        product.purchasePrice || '0',
        product.b2bPrice || '0',
        product.retailPrice || '0'
      );
      setPriceData(prev => ({
        ...prev,
        [productId]: {
          costPrice: product.purchasePrice || '0',
          resellerPrice: product.resellerPrice || '0',
          retailPrice: product.retailerPrice || '0',
          ...margins
        }
      }));
    }
  };

  const handleSave = async (productId: string) => {
    const data = priceData[productId];
    if (data) {
      await updatePriceMutation.mutateAsync({
        productId,
        costPrice: parseFloat(data.costPrice),
        resellerPrice: parseFloat(data.resellerPrice),
        retailPrice: parseFloat(data.retailPrice)
      });
    }
  };

  const handleCancel = (productId: string) => {
    setEditingProduct(null);
    setPriceData(prev => {
      const newData = { ...prev };
      delete newData[productId];
      return newData;
    });
  };

  const handleCheckboxChange = (productId: string, index: number, event: React.MouseEvent) => {
    const isChecked = selectedProducts.has(productId);
    
    if (event.shiftKey && lastSelectedIndex !== null) {
      // Handle shift+click for range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelection = new Set(selectedProducts);
      
      for (let i = start; i <= end; i++) {
        const currentProduct = (products as Product[])?.[i];
        if (currentProduct) {
          if (isChecked) {
            newSelection.delete(currentProduct.id);
          } else {
            newSelection.add(currentProduct.id);
          }
        }
      }
      setSelectedProducts(newSelection);
    } else {
      // Handle normal click
      if (isChecked) {
        setSelectedProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
      } else {
        setSelectedProducts(prev => new Set(Array.from(prev).concat(productId)));
      }
    }
    setLastSelectedIndex(index);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set((products as Product[])?.map(p => p.id) || []));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleBulkEdit = () => {
    setBulkEditMode(true);
    // Initialize price data for all selected products
    Array.from(selectedProducts).forEach(productId => {
      const product = (products as Product[])?.find(p => p.id === productId);
      if (product && !priceData[productId]) {
        const margins = calculateMargins(
          product.purchasePrice || '0',
          product.b2bPrice || '0',
          product.retailPrice || '0'
        );
        setPriceData(prev => ({
          ...prev,
          [productId]: {
            costPrice: product.purchasePrice || '0',
            resellerPrice: product.b2bPrice || '0',
            retailPrice: product.retailPrice || '0',
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
        costPrice: parseFloat(data.costPrice),
        resellerPrice: parseFloat(data.resellerPrice),
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
      Array.from(selectedProducts).forEach(id => delete newData[id]);
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
            Comprehensive pricing control for all products across B2B and B2C channels
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products by name or description..."
                value={searchTerm}
                onChange={handleSearchInputChange}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(categories as any[])?.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{(products as Product[])?.length || 0}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg B2B Margin</p>
                <p className="text-2xl font-bold">NaN%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg B2C Margin</p>
                <p className="text-2xl font-bold">NaN%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Selected</p>
                <p className="text-2xl font-bold">{selectedProducts.size}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedProducts.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                {!bulkEditMode ? (
                  <>
                    <Button variant="outline" size="sm" onClick={handleBulkEdit}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Bulk Edit
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={handleBulkSave}>
                      <Save className="w-4 h-4 mr-2" />
                      Save All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBulkCancel}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Pricing Matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Pricing Matrix</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedProducts.size === (products as Product[])?.length && (products as Product[])?.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 w-12">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedProducts.size === (products as Product[])?.length && (products as Product[])?.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </div>
                  </th>
                  <th className="text-left p-4 font-semibold">Product</th>
                  <th className="text-left p-4 font-semibold">Category</th>
                  <th className="text-left p-4 font-semibold">Purchase Price</th>
                  <th className="text-left p-4 font-semibold">B2B Price</th>
                  <th className="text-left p-4 font-semibold">B2B Margin</th>
                  <th className="text-left p-4 font-semibold">Retail Price</th>
                  <th className="text-left p-4 font-semibold">B2C Margin</th>
                  <th className="text-left p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(products as Product[])?.map((product, index) => {
                  const isEditing = editingProduct === product.id || bulkEditMode && selectedProducts.has(product.id);
                  const data = priceData[product.id] || {};
                  
                  return (
                    <tr key={product.id} className="border-b hover:bg-muted/25">
                      <td className="p-4">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProducts(prev => new Set(Array.from(prev).concat(product.id)));
                              } else {
                                setSelectedProducts(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(product.id);
                                  return newSet;
                                });
                              }
                            }}
                            onClick={(e) => handleCheckboxChange(product.id, index, e)}
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-48">
                            {product.description}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{product.categoryName || 'N/A'}</span>
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.costPrice || '0'}
                            onChange={(e) => handlePriceChange(product.id, 'costPrice', e.target.value)}
                            className="w-24"
                          />
                        ) : (
                          <span className="font-mono">€{product.purchasePrice || '0'}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.resellerPrice || '0'}
                            onChange={(e) => handlePriceChange(product.id, 'resellerPrice', e.target.value)}
                            className="w-24"
                          />
                        ) : (
                          <span className="font-mono">€{product.resellerPrice || '0'}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={data.b2bMargin || '0'}
                              onChange={(e) => handleMarginChange(product.id, 'b2bMargin', e.target.value)}
                              className="w-20"
                            />
                            <span className="text-sm">%</span>
                          </div>
                        ) : (
                          <Badge variant={data.b2bMargin > 20 ? "default" : data.b2bMargin > 10 ? "secondary" : "destructive"}>
                            {data.b2bMargin ? `${data.b2bMargin}%` : 'N/A'}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.retailPrice || '0'}
                            onChange={(e) => handlePriceChange(product.id, 'retailPrice', e.target.value)}
                            className="w-24"
                          />
                        ) : (
                          <span className="font-mono">€{product.retailerPrice || '0'}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={data.b2cMargin || '0'}
                              onChange={(e) => handleMarginChange(product.id, 'b2cMargin', e.target.value)}
                              className="w-20"
                            />
                            <span className="text-sm">%</span>
                          </div>
                        ) : (
                          <Badge variant={data.b2cMargin > 30 ? "default" : data.b2cMargin > 15 ? "secondary" : "destructive"}>
                            {data.b2cMargin ? `${data.b2cMargin}%` : 'N/A'}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {!bulkEditMode && (
                          <div className="flex gap-1">
                            {isEditing ? (
                              <>
                                <Button size="sm" onClick={() => handleSave(product.id)}>
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCancel(product.id)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleEdit(product.id)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                
                {(products as Product[])?.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No products found matching your criteria</p>
                      <p className="text-sm">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}