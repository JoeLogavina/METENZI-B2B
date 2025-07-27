import { useState, useEffect } from 'react';
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Upload, X, Plus, Trash2, Copy, Save, FileImage } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/currency-utils';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function EditProduct() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get product ID from URL params
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const productId = urlParams.get('id');

  // State for forms
  const [eurFormData, setEurFormData] = useState({
    name: '',
    description: '',
    price: '',
    purchasePrice: '',
    b2bPrice: '',
    retailPrice: '',
    category: '',
    region: 'Global',
    platform: 'Both',
    sku: '',
    stockCount: 0,
    imageUrl: ''
  });

  const [kmFormData, setKmFormData] = useState({
    priceKm: '',
    purchasePriceKm: '',
    resellerPriceKm: '',
    retailerPriceKm: ''
  });

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showLicenseKeyDialog, setShowLicenseKeyDialog] = useState(false);
  const [newLicenseKey, setNewLicenseKey] = useState('');

  // Fetch product data
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: [`/api/admin/products/${productId}`],
    enabled: !!productId
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories']
  });

  // Fetch license keys
  const { data: licenseKeys = [], refetch: refetchLicenseKeys } = useQuery({
    queryKey: [`/api/admin/products/${productId}/license-keys`],
    enabled: !!productId
  });

  // Populate form data when product loads
  useEffect(() => {
    if (product && typeof product === 'object') {
      setEurFormData({
        name: (product as any).name || '',
        description: (product as any).description || '',
        price: (product as any).price || '',
        purchasePrice: (product as any).purchasePrice || '',
        b2bPrice: (product as any).b2bPrice || '',
        retailPrice: (product as any).retailPrice || '',
        category: (product as any).categoryId || '',
        region: (product as any).region || 'Global',
        platform: (product as any).platform || 'Both',
        sku: (product as any).sku || '',
        stockCount: (product as any).stockCount || 0,
        imageUrl: (product as any).imageUrl || ''
      });

      setKmFormData({
        priceKm: (product as any).priceKm || '',
        purchasePriceKm: (product as any).purchasePriceKm || '',
        resellerPriceKm: (product as any).resellerPriceKm || '',
        retailerPriceKm: (product as any).retailerPriceKm || ''
      });
    }
  }, [product]);

  // Auto-save mutation
  const saveProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', `/api/admin/products/${productId}`, data);
      return response.json();
    },
    onSuccess: () => {
      setUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${productId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    }
  });

  // Add license key mutation
  const addLicenseKeyMutation = useMutation({
    mutationFn: async (keyValue: string) => {
      const response = await apiRequest('POST', '/api/admin/license-keys', {
        productId,
        keyValue
      });
      return response.json();
    },
    onSuccess: () => {
      setNewLicenseKey('');
      setShowLicenseKeyDialog(false);
      toast({
        title: "Success",
        description: "License key added successfully",
      });
      refetchLicenseKeys();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add license key",
        variant: "destructive",
      });
    }
  });

  // Delete license key mutation
  const deleteLicenseKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await apiRequest('DELETE', `/api/admin/license-keys/${keyId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License key deleted successfully",
      });
      refetchLicenseKeys();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete license key",
        variant: "destructive",
      });
    }
  });

  // Handle save
  const handleSave = () => {
    const combinedData = {
      ...eurFormData,
      ...kmFormData,
      stockCount: Number(eurFormData.stockCount)
    };
    saveProductMutation.mutate(combinedData);
  };

  // Handle field changes and mark as unsaved
  const updateEurForm = (updates: any) => {
    setEurFormData(prev => ({ ...prev, ...updates }));
    setUnsavedChanges(true);
  };

  const updateKmForm = (updates: any) => {
    setKmFormData(prev => ({ ...prev, ...updates }));
    setUnsavedChanges(true);
  };

  if (!productId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product ID Required</h1>
          <p className="text-gray-600 mb-8">Please provide a product ID to edit.</p>
          <Button onClick={() => navigate('/admin-panel')} className="bg-[#FFB20F] hover:bg-[#FFB20F]/90 text-white">
            Back to Admin Panel
          </Button>
        </div>
      </div>
    );
  }

  if (productLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFB20F] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin-panel')}
              className="text-[#6E6F71] hover:text-[#FFB20F] hover:bg-[#FFB20F]/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-[0.5px]">
                Edit Product
              </h1>
              <p className="text-sm text-[#6E6F71]">SKU: {eurFormData.sku}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {unsavedChanges && (
              <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                Unsaved changes
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saveProductMutation.isPending}
              className="bg-[#FFB20F] hover:bg-[#FFB20F]/90 text-white px-6"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveProductMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        <Tabs defaultValue="eur" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white border border-gray-200 rounded-lg p-1">
            <TabsTrigger 
              value="eur" 
              className="data-[state=active]:bg-[#FFB20F] data-[state=active]:text-white font-medium"
            >
              EUR Product Details
            </TabsTrigger>
            <TabsTrigger 
              value="km" 
              className="data-[state=active]:bg-[#FFB20F] data-[state=active]:text-white font-medium"
            >
              KM Pricing
            </TabsTrigger>
            <TabsTrigger 
              value="keys" 
              className="data-[state=active]:bg-[#FFB20F] data-[state=active]:text-white font-medium"
            >
              License Keys ({Array.isArray(licenseKeys) ? licenseKeys.length : 0})
            </TabsTrigger>
          </TabsList>

          {/* EUR Tab */}
          <TabsContent value="eur">
            <Card className="border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg text-gray-900 uppercase tracking-[0.5px]">
                  Product Information (EUR)
                </CardTitle>
                <CardDescription>
                  Primary product details and EUR pricing
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Product Name
                    </Label>
                    <Input
                      id="name"
                      value={eurFormData.name}
                      onChange={(e) => updateEurForm({ name: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="sku" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      SKU
                    </Label>
                    <Input
                      id="sku"
                      value={eurFormData.sku}
                      onChange={(e) => updateEurForm({ sku: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={eurFormData.description}
                    onChange={(e) => updateEurForm({ description: e.target.value })}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      B2B Price (EUR)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={eurFormData.price}
                      onChange={(e) => updateEurForm({ price: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Purchase Price (EUR)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={eurFormData.purchasePrice}
                      onChange={(e) => updateEurForm({ purchasePrice: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Reseller Price (EUR)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={eurFormData.b2bPrice}
                      onChange={(e) => updateEurForm({ b2bPrice: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Retail Price (EUR)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={eurFormData.retailPrice}
                      onChange={(e) => updateEurForm({ retailPrice: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Categories and Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Category
                    </Label>
                    <Select value={eurFormData.category} onValueChange={(value) => updateEurForm({ category: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(categories) && categories.map((category: any) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Region
                    </Label>
                    <Select value={eurFormData.region} onValueChange={(value) => updateEurForm({ region: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Global">Global</SelectItem>
                        <SelectItem value="EU">EU</SelectItem>
                        <SelectItem value="US">US</SelectItem>
                        <SelectItem value="Asia">Asia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Platform
                    </Label>
                    <Select value={eurFormData.platform} onValueChange={(value) => updateEurForm({ platform: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Windows">Windows</SelectItem>
                        <SelectItem value="Mac">Mac</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    Stock Count
                  </Label>
                  <Input
                    type="number"
                    value={eurFormData.stockCount}
                    onChange={(e) => updateEurForm({ stockCount: parseInt(e.target.value) || 0 })}
                    className="mt-1 max-w-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* KM Tab */}
          <TabsContent value="km">
            <Card className="border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg text-gray-900 uppercase tracking-[0.5px]">
                  KM Pricing (Bosnian Mark)
                </CardTitle>
                <CardDescription>
                  Pricing in KM currency for Bosnia market
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      B2B Price (KM)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={kmFormData.priceKm}
                      onChange={(e) => updateKmForm({ priceKm: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Purchase Price (KM)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={kmFormData.purchasePriceKm}
                      onChange={(e) => updateKmForm({ purchasePriceKm: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Reseller Price (KM)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={kmFormData.resellerPriceKm}
                      onChange={(e) => updateKmForm({ resellerPriceKm: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      Retailer Price (KM)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={kmFormData.retailerPriceKm}
                      onChange={(e) => updateKmForm({ retailerPriceKm: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* License Keys Tab */}
          <TabsContent value="keys">
            <Card className="border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg text-gray-900 uppercase tracking-[0.5px] flex items-center justify-between">
                  License Keys Management
                  <Dialog open={showLicenseKeyDialog} onOpenChange={setShowLicenseKeyDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-[#FFB20F] hover:bg-[#FFB20F]/90 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add License Key</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="licenseKey">License Key</Label>
                          <Input
                            id="licenseKey"
                            value={newLicenseKey}
                            onChange={(e) => setNewLicenseKey(e.target.value)}
                            placeholder="Enter license key..."
                            className="mt-1"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowLicenseKeyDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => addLicenseKeyMutation.mutate(newLicenseKey)}
                            disabled={!newLicenseKey.trim() || addLicenseKeyMutation.isPending}
                            className="bg-[#FFB20F] hover:bg-[#FFB20F]/90 text-white"
                          >
                            Add Key
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
                <CardDescription>
                  Manage digital license keys for this product
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {!Array.isArray(licenseKeys) || licenseKeys.length === 0 ? (
                  <div className="text-center py-8">
                    <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No license keys added yet</p>
                    <p className="text-sm text-gray-400 mt-1">Click "Add Key" to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Array.isArray(licenseKeys) && licenseKeys.map((key: any) => (
                      <div key={key.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex-1">
                          <div className="font-mono text-sm">{key.keyValue}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Status: {key.isUsed ? 'Used' : 'Available'}
                            {key.isUsed && key.usedBy && ` • Used by: ${key.usedBy}`}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(key.keyValue);
                              toast({
                                title: "Copied",
                                description: "License key copied to clipboard",
                              });
                            }}
                            className="text-[#6E6F71] border-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteLicenseKeyMutation.mutate(key.id)}
                            disabled={deleteLicenseKeyMutation.isPending}
                            className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}