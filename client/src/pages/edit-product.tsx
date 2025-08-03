import { useState, useEffect } from 'react';
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Plus, Trash2, Copy, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';
import { ProductImageUpload } from '@/components/ProductImageUpload';

export default function EditProduct() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = useAuth();

  // Get product ID from URL params using useLocation hook properly
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  const [activeTab, setActiveTab] = useState('details');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [licenseKeys, setLicenseKeys] = useState('');

  // State for forms
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    platform: '',
    region: '',
    imageUrl: '',
    isActive: true
  });

  const [eurPricing, setEurPricing] = useState({
    price: '',
    purchasePrice: '',
    b2bPrice: '',
    retailPrice: '',
    stock: ''
  });

  const [kmPricing, setKmPricing] = useState({
    priceKm: '',
    purchasePriceKm: '',
    b2bPriceKm: '',
    retailPriceKm: ''
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "Admin access required. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/admin-panel";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Fetch product data with aggressive refetch to ensure fresh data
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: [`/api/admin/products/${productId}`],
    enabled: !!productId && isAuthenticated,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    enabled: isAuthenticated
  });

  // Fetch license keys
  const { data: licenseKeysResponse, refetch: refetchLicenseKeys } = useQuery({
    queryKey: [`/api/admin/license-keys/${productId}`],
    enabled: !!productId && isAuthenticated
  });

  // Extract license keys from API response structure
  const existingLicenseKeys = (licenseKeysResponse as any)?.data || [];

  // CRITICAL FIX: Force state updates whenever product data changes
  useEffect(() => {
    console.log('🚨 USEEFFECT ALWAYS RUNS - product exists:', !!product, 'type:', typeof product);
    
    if (product && typeof product === 'object') {
      const prod = product as any;
      // CRITICAL FIX: Product data is wrapped in .data property
      const productData = prod.data || prod;
      console.log('🔍 FRESH PRODUCT DATA RECEIVED:', prod);
      console.log('🎯 CRITICAL B2B PRICE FROM API:', productData.b2bPrice);
      
      // Update basic form data
      setFormData({
        name: productData.name || '',
        description: productData.description || '',
        category: productData.categoryId || '',
        platform: productData.platform || '',
        region: productData.region || '',
        imageUrl: productData.imageUrl || '',
        isActive: productData.isActive ?? true
      });

      // CRITICAL FIX: Display Price should show B2B Price (controlled from Price Management)
      const newEurPricing = {
        price: productData.b2bPrice || '', // Display Price = B2B Price from Price Management
        purchasePrice: productData.purchasePrice || '',
        b2bPrice: productData.b2bPrice || '',
        retailPrice: productData.retailPrice || '',
        stock: productData.stockCount?.toString() || ''
      };
      
      console.log('🔄 FORCING EUR PRICING UPDATE:', newEurPricing);
      console.log('🎯 NEW B2B PRICE BEING SET:', newEurPricing.b2bPrice);
      
      // Force complete state replacement
      setEurPricing(newEurPricing);

      setKmPricing({
        priceKm: productData.priceKm || '',
        purchasePriceKm: productData.purchasePriceKm || '',
        b2bPriceKm: productData.b2bPriceKm || '',
        retailPriceKm: productData.retailPriceKm || ''
      });
      
      console.log('✅ ALL STATE UPDATES COMPLETED');
    } else {
      console.log('⚠️ NO PRODUCT DATA OR INVALID PRODUCT DATA');
    }
  }, [product]);

  // FORCE LOG WHENEVER PRODUCT CHANGES
  useEffect(() => {
    console.log('🔍 PRODUCT DATA CHANGED:', product);
  }, [product]);

  // Force re-render when eurPricing.b2bPrice changes  
  useEffect(() => {
    console.log('🔍 EUR Pricing state updated:', eurPricing);
    console.log('🎯 Current B2B Price in state:', eurPricing.b2bPrice);
  }, [eurPricing]);

  // Mark unsaved changes
  const handleFormChange = (section: string, field: string, value: any) => {
    setUnsavedChanges(true);
    if (section === 'details') {
      setFormData(prev => ({ ...prev, [field]: value }));
    } else if (section === 'eur') {
      setEurPricing(prev => ({ ...prev, [field]: value }));
    } else if (section === 'km') {
      setKmPricing(prev => ({ ...prev, [field]: value }));
    }
  };

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const submitData = {
        ...formData,
        ...eurPricing,
        ...kmPricing,
        categoryId: formData.category,
        stock: eurPricing.stock ? parseInt(eurPricing.stock) : undefined
      };

      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save product');
      }

      return await response.json();
    },
    onSuccess: () => {
      setUnsavedChanges(false);
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/products/${productId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Save license keys mutation
  const saveLicenseKeysMutation = useMutation({
    mutationFn: async () => {
      if (!licenseKeys.trim()) {
        throw new Error("Please enter license keys to save");
      }

      const response = await fetch(`/api/admin/license-keys/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          keys: licenseKeys,
          ignoreDuplicates: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save license keys');
      }

      return await response.json();
    },
    onSuccess: (result) => {
      setLicenseKeys('');
      toast({
        title: "Success",
        description: `Added ${result.data.added.length} license keys. Stock updated to ${result.data.stats.available} available keys.`,
      });
      refetchLicenseKeys();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete license key mutation
  const deleteLicenseKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/admin/license-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete license key');
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License key deleted successfully",
      });
      refetchLicenseKeys();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (!productId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Product ID Required</h1>
          <p className="text-gray-600 mb-6">Please provide a product ID to edit.</p>
          <Button onClick={() => navigate('/admin-panel')} className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white">
            Back to Admin Panel
          </Button>
        </div>
      </div>
    );
  }

  if (productLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/admin-panel')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Admin Panel</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#6E6F71] uppercase tracking-[0.5px]">
                EDIT PRODUCT
              </h1>
              <p className="text-[#6E6F71]">{(product as any)?.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {unsavedChanges && (
              <span className="text-sm text-orange-600 font-medium">
                Unsaved changes
              </span>
            )}
            <Button
              onClick={() => saveProductMutation.mutate()}
              disabled={saveProductMutation.isPending}
              className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveProductMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex space-x-8">
          {[
            { id: 'details', label: 'Product Details' },
            { id: 'eur-pricing', label: 'EUR Pricing' },
            { id: 'km-pricing', label: 'KM Pricing' },
            { id: 'license-keys', label: 'License Keys' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] transition-colors ${
                activeTab === tab.id
                  ? "border-[#FFB20F] text-[#FFB20F]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Product Details Tab */}
          {activeTab === 'details' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px] mb-6">
                Product Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PRODUCT NAME
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFormChange('details', 'name', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="category" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    CATEGORY
                  </Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleFormChange('details', 'category', value)}
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
                    onChange={(e) => handleFormChange('details', 'description', e.target.value)}
                    className="mt-1"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="platform" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PLATFORM
                  </Label>
                  <Select 
                    value={formData.platform} 
                    onValueChange={(value) => handleFormChange('details', 'platform', value)}
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
                    onValueChange={(value) => handleFormChange('details', 'region', value)}
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

                <div className="md:col-span-2">
                  <ProductImageUpload
                    productId={productId || ''}
                    currentImageUrl={formData.imageUrl}
                    onImageUploaded={(imageUrl) => handleFormChange('details', 'imageUrl', imageUrl)}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => handleFormChange('details', 'isActive', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                      Active (visible to B2B users)
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EUR Pricing Tab */}
          {activeTab === 'eur-pricing' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px] mb-6">
                EUR Pricing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="price" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    DISPLAY PRICE (€) - Auto-synced from Price Management: €{eurPricing.b2bPrice}
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={eurPricing.b2bPrice}
                    disabled
                    className="mt-1 bg-gray-100 cursor-not-allowed"
                    placeholder="Controlled by Price Management"
                  />
                </div>

                <div>
                  <Label htmlFor="stock" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    STOCK
                  </Label>
                  <Input
                    id="stock"
                    type="number"
                    value={eurPricing.stock}
                    onChange={(e) => handleFormChange('eur', 'stock', e.target.value)}
                    className="mt-1"
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
                    value={eurPricing.purchasePrice}
                    onChange={(e) => handleFormChange('eur', 'purchasePrice', e.target.value)}
                    className="mt-1"
                    placeholder="Optional"
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Label className="text-sm font-medium text-blue-800 uppercase tracking-[0.5px] block mb-2">
                    📊 B2B PRICE CONTROL - Managed via Price Management Panel
                  </Label>
                  <div className="text-sm text-blue-700 mb-2">
                    Current B2B Price: €{eurPricing.b2bPrice}
                  </div>
                  <div className="text-xs text-blue-600">
                    To change the B2B price (which controls the Display Price), use the Price Management panel in the admin section.
                  </div>
                </div>

                <div>
                  <Label htmlFor="retailPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    RETAIL PRICE (€)
                  </Label>
                  <Input
                    id="retailPrice"
                    type="number"
                    step="0.01"
                    value={eurPricing.retailPrice}
                    onChange={(e) => handleFormChange('eur', 'retailPrice', e.target.value)}
                    className="mt-1"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}

          {/* KM Pricing Tab */}
          {activeTab === 'km-pricing' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px] mb-6">
                KM Pricing (Bosnian Mark)
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                For future Bosnian market tenant. Current exchange rate: 1 EUR ≈ 1.96 KM
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="priceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    DISPLAY PRICE (KM)
                  </Label>
                  <Input
                    id="priceKm"
                    type="number"
                    step="0.01"
                    value={kmPricing.priceKm}
                    onChange={(e) => handleFormChange('km', 'priceKm', e.target.value)}
                    className="mt-1"
                    placeholder="Bosnian Mark price"
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
                    value={kmPricing.purchasePriceKm}
                    onChange={(e) => handleFormChange('km', 'purchasePriceKm', e.target.value)}
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
                    value={kmPricing.b2bPriceKm}
                    onChange={(e) => handleFormChange('km', 'b2bPriceKm', e.target.value)}
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
                    value={kmPricing.retailPriceKm}
                    onChange={(e) => handleFormChange('km', 'retailPriceKm', e.target.value)}
                    className="mt-1"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          )}

          {/* License Keys Tab */}
          {activeTab === 'license-keys' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px] mb-6">
                License Key Management
              </h2>
              
              {/* Add new keys section */}
              <div className="mb-8">
                <h3 className="text-md font-medium text-gray-700 uppercase tracking-[0.5px] mb-4">
                  Add New License Keys
                </h3>
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
                      rows={10}
                      placeholder={`Enter license keys, one per line:
ABCD1-EFGH2-IJKL3-MNOP4-QRST5
XYZ12-ABC34-DEF56-GHI78-JKL90
...`}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Format: 3-6 blocks with 5-6 characters each. Spaces between blocks are allowed.
                    </p>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      {licenseKeys.split('\n').filter(k => k.trim()).length} keys ready to add
                    </div>
                    <Button
                      onClick={() => saveLicenseKeysMutation.mutate()}
                      disabled={!licenseKeys.trim() || saveLicenseKeysMutation.isPending}
                      className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {saveLicenseKeysMutation.isPending ? 'Adding...' : 'Add Keys'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Existing keys section */}
              <div>
                <h3 className="text-md font-medium text-gray-700 uppercase tracking-[0.5px] mb-4">
                  Existing License Keys ({existingLicenseKeys.length})
                </h3>
                {existingLicenseKeys.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No license keys added yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {existingLicenseKeys.map((key: any) => (
                      <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <code className="text-sm font-mono bg-white px-2 py-1 rounded border">
                            {key.keyValue || key.key_value}
                          </code>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            (key.isUsed || key.is_used)
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {(key.isUsed || key.is_used) ? 'Used' : 'Available'}
                          </span>
                          {(key.isUsed || key.is_used) && (key.usedAt || key.used_at) && (
                            <span className="text-xs text-gray-500">
                              Used {new Date(key.usedAt || key.used_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigator.clipboard.writeText(key.keyValue || key.key_value)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          {!(key.isUsed || key.is_used) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteLicenseKeyMutation.mutate(key.id)}
                              disabled={deleteLicenseKeyMutation.isPending}
                              className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}