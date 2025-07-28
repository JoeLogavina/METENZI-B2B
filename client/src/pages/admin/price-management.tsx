import { useState, useEffect, useCallback } from "react";
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
  description: string;
  price: string;
  purchasePrice: string;
  resellerPrice: string;
  retailerPrice: string;
  categoryId: string;
  categoryName?: string;
}

interface PriceUpdate {
  productId: string;
  price: number;
  purchasePrice: number;
  resellerPrice: number;
  retailerPrice: number;
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
    price: string;
    purchasePrice: string;
    resellerPrice: string;
    retailerPrice: string;
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

  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/admin/products", { 
      search: debouncedSearchTerm || undefined, 
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter 
    }],
  });

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
          price: data.price,
          purchasePrice: data.purchasePrice,
          resellerPrice: data.resellerPrice,
          retailerPrice: data.retailerPrice
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
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${updatedProduct.id}`] });
      setEditingProduct(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update pricing", variant: "destructive" });
    },
  });

  const calculateMargins = (purchasePrice: string, resellerPrice: string, retailerPrice: string, fees: string = '0') => {
    const cost = parseFloat(purchasePrice) || 0;
    const b2bPrice = parseFloat(resellerPrice) || 0;
    const b2cPrice = parseFloat(retailerPrice) || 0;
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
    if (products) {
      const initialData: Record<string, any> = {};
      (products as Product[]).forEach(product => {
        const margins = calculateMargins(
          product.purchasePrice || '0',
          product.resellerPrice || '0',
          product.retailerPrice || '0'
        );
        initialData[product.id] = {
          price: product.price || '0',
          purchasePrice: product.purchasePrice || '0',
          resellerPrice: product.resellerPrice || '0',
          retailerPrice: product.retailerPrice || '0',
          ...margins
        };
      });
      setPriceData(initialData);
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
        updated.resellerPrice = newB2BPrice.toString();
      } else if (field === 'b2cMargin') {
        const newB2CPrice = calculatePriceFromMargin(
          updated.purchasePrice || '0',
          value,
          updated.fees?.toString() || '0'
        );
        updated.retailerPrice = newB2CPrice.toString();
      }
      
      // Recalculate all margins and profits
      const margins = calculateMargins(
        updated.purchasePrice || '0',
        updated.resellerPrice || '0',
        updated.retailerPrice || '0',
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
      updatePriceMutation.mutate({
        productId: product.id,
        price: parseFloat(data.price),
        purchasePrice: parseFloat(data.purchasePrice),
        resellerPrice: parseFloat(data.resellerPrice),
        retailerPrice: parseFloat(data.retailerPrice)
      });
    }
  };

  const handleCancel = (product: Product) => {
    const margins = calculateMargins(
      product.purchasePrice || '0',
      product.resellerPrice || '0',
      product.retailerPrice || '0'
    );
    setPriceData(prev => ({
      ...prev,
      [product.id]: {
        price: product.price || '0',
        purchasePrice: product.purchasePrice || '0',
        resellerPrice: product.resellerPrice || '0',
        retailerPrice: product.retailerPrice || '0',
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
    Array.from(selectedProducts).forEach(productId => {
      const product = (products as Product[])?.find(p => p.id === productId);
      if (product && !priceData[productId]) {
        const margins = calculateMargins(
          product.purchasePrice || '0',
          product.resellerPrice || '0',
          product.retailerPrice || '0'
        );
        setPriceData(prev => ({
          ...prev,
          [productId]: {
            price: product.price || '0',
            purchasePrice: product.purchasePrice || '0',
            resellerPrice: product.resellerPrice || '0',
            retailerPrice: product.retailerPrice || '0',
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
        price: parseFloat(data.price),
        purchasePrice: parseFloat(data.purchasePrice),
        resellerPrice: parseFloat(data.resellerPrice),
        retailerPrice: parseFloat(data.retailerPrice)
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] })}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {selectedProducts.size > 0 && (
            <>
              {!bulkEditMode ? (
                <Button onClick={handleBulkEdit} className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Bulk Edit ({selectedProducts.size})
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleBulkSave} className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Save All
                  </Button>
                  <Button variant="outline" onClick={handleBulkCancel} className="flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search products by name or description..."
                value={searchTerm}
                onChange={handleSearchInputChange}
                className="max-w-md"
              />
            </div>
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
            {(searchTerm || categoryFilter !== 'all') && (
              <Button variant="outline" onClick={handleClearSearch}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Pricing Matrix</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedProducts.size === (products as Product[])?.length && (products as Product[])?.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label>Select All</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
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
                            value={data.purchasePrice || '0'}
                            onChange={(e) => handlePriceChange(product.id, 'purchasePrice', e.target.value)}
                            className="w-24"
                          />
                        ) : (
                          <span className="font-mono">{formatCurrency(parseFloat(data.purchasePrice || '0'))}</span>
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
                          <span className="font-mono">{formatCurrency(parseFloat(data.resellerPrice || '0'))}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.1"
                            value={data.b2bMargin?.toFixed(1) || '0.0'}
                            onChange={(e) => handlePriceChange(product.id, 'b2bMargin', e.target.value)}
                            className="w-20"
                            placeholder="%"
                          />
                        ) : (
                          formatPercentage(data.b2bMargin || 0)
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={data.retailerPrice || '0'}
                            onChange={(e) => handlePriceChange(product.id, 'retailerPrice', e.target.value)}
                            className="w-24"
                          />
                        ) : (
                          <span className="font-mono">{formatCurrency(parseFloat(data.retailerPrice || '0'))}</span>
                        )}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.1"
                            value={data.b2cMargin?.toFixed(1) || '0.0'}
                            onChange={(e) => handlePriceChange(product.id, 'b2cMargin', e.target.value)}
                            className="w-20"
                            placeholder="%"
                          />
                        ) : (
                          formatPercentage(data.b2cMargin || 0)
                        )}
                      </td>
                      <td className="p-4">
                        {!bulkEditMode && (
                          <div className="flex items-center gap-2">
                            {editingProduct === product.id ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleSave(product)}
                                  disabled={updatePriceMutation.isPending}
                                  className="flex items-center gap-1"
                                >
                                  <Check className="h-3 w-3" />
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancel(product)}
                                  className="flex items-center gap-1"
                                >
                                  <X className="h-3 w-3" />
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingProduct(product.id)}
                                className="flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Total Products</p>
                <p className="text-2xl font-bold">{(products as Product[])?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Avg B2B Margin</p>
                <p className="text-2xl font-bold">
                  {((products as Product[])?.reduce((acc, product) => {
                    const data = priceData[product.id];
                    return acc + (data?.b2bMargin || 0);
                  }, 0) / ((products as Product[])?.length || 1))?.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Avg B2C Margin</p>
                <p className="text-2xl font-bold">
                  {((products as Product[])?.reduce((acc, product) => {
                    const data = priceData[product.id];
                    return acc + (data?.b2cMargin || 0);
                  }, 0) / ((products as Product[])?.length || 1))?.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Selected</p>
                <p className="text-2xl font-bold">{selectedProducts.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}