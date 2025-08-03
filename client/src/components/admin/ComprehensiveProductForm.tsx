import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { X, Upload, Package, Save, ArrowLeft } from "lucide-react";
import { HierarchicalCategorySelector } from "./CategoryManagement";
import type { Category } from "@shared/schema";

interface ComprehensiveProductFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

// Using Category type from shared schema

interface LicenseCount {
  license_count: number;
  product_id: string;
}

export function ComprehensiveProductForm({ onCancel, onSuccess }: ComprehensiveProductFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("details");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    htmlDescription: '',
    warranty: '',
    categoryId: '',
    platform: '',
    region: '',
    imageUrl: '',
    isActive: true
  });

  // EUR Pricing (mandatory)
  const [eurPricing, setEurPricing] = useState({
    purchasePrice: '',
    b2bPrice: '',
    retailPrice: ''
  });

  // KM Pricing (optional)
  const [kmPricing, setKmPricing] = useState({
    purchasePriceKm: '',
    b2bPriceKm: '',
    retailPriceKm: ''
  });

  // License keys for initial stock
  const [licenseKeys, setLicenseKeys] = useState('');

  // Fetch categories for hierarchical selection
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Get license counts for stock calculation reference
  const { data: licenseCounts = [] } = useQuery<LicenseCount[]>({
    queryKey: ["/api/admin/license-counts"],
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(productData),
      });
      if (!response.ok) {
        throw new Error('Failed to create product');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Product creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive",
      });
    },
  });

  // Add license keys mutation
  const addLicenseKeysMutation = useMutation({
    mutationFn: async ({ productId, keys }: { productId: string; keys: string }) => {
      return fetch(`/api/admin/license-keys/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keys, ignoreDuplicates: false }),
      });
    },
  });

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setFormData(prev => ({ ...prev, imageUrl: result.imageUrl }));
      
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  // Generate SKU from product name
  const generateSKU = (name: string) => {
    return "SKU-" + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  };

  // Form validation
  const isFormValid = () => {
    const hasRequiredDetails = formData.name && formData.categoryId && formData.platform && formData.region;
    const hasRequiredPricing = eurPricing.purchasePrice && eurPricing.b2bPrice && eurPricing.retailPrice;
    return hasRequiredDetails && hasRequiredPricing;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare product data
      const productData = {
        sku: generateSKU(formData.name),
        name: formData.name,
        description: formData.description,
        htmlDescription: formData.htmlDescription,
        warranty: formData.warranty,
        categoryId: formData.categoryId,
        platform: formData.platform,
        region: formData.region,
        imageUrl: formData.imageUrl,
        isActive: formData.isActive,
        // EUR pricing (mandatory) - the main price field is B2B price
        price: eurPricing.b2bPrice,
        purchasePrice: eurPricing.purchasePrice,
        b2bPrice: eurPricing.b2bPrice,
        retailPrice: eurPricing.retailPrice,
        // KM pricing (optional)
        priceKm: kmPricing.b2bPriceKm || null,
        purchasePriceKm: kmPricing.purchasePriceKm || null,
        retailPriceKm: kmPricing.retailPriceKm || null,
        // Stock will be auto-calculated from license keys
        stockCount: 0, // Will be updated after adding license keys
      };

      // Create the product
      const createdProduct = await createProductMutation.mutateAsync(productData);
      
      // Add license keys if provided
      if (licenseKeys.trim()) {
        try {
          const keysResponse = await addLicenseKeysMutation.mutateAsync({
            productId: createdProduct.data.id,
            keys: licenseKeys,
          });

          if (!keysResponse.ok) {
            const keysError = await keysResponse.json();
            toast({
              title: "Warning",
              description: `Product created but license keys failed: ${keysError.message}`,
              variant: "destructive",
            });
          }
        } catch (keyError) {
          console.error('License keys error:', keyError);
          toast({
            title: "Warning", 
            description: "Product created but failed to add license keys",
            variant: "destructive",
          });
        }
      }

    } catch (error) {
      console.error('Product creation failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <div>
            <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
              CREATE NEW PRODUCT
            </h3>
            <p className="text-[#6E6F71]">Complete product creation form</p>
          </div>
        </div>
        
        <Button
          onClick={handleSubmit}
          disabled={createProductMutation.isPending || !isFormValid()}
          className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
        >
          {createProductMutation.isPending ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          CREATE PRODUCT
        </Button>
      </div>

      {/* Form Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Product Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Product Details</TabsTrigger>
              <TabsTrigger value="eur-pricing">EUR Pricing</TabsTrigger>
              <TabsTrigger value="km-pricing">KM Pricing</TabsTrigger>
              <TabsTrigger value="license-keys">License Keys</TabsTrigger>
            </TabsList>

            {/* Product Details Tab */}
            <TabsContent value="details" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PRODUCT NAME *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1"
                    placeholder="Enter product name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    CATEGORY (L1 &gt; L2 &gt; L3) *
                  </Label>
                  <div className="mt-1">
                    <HierarchicalCategorySelector
                      categories={categories}
                      selectedCategoryId={formData.categoryId}
                      onSelect={(categoryId) => {
                        setFormData({ ...formData, categoryId: categoryId || '' });
                      }}
                      maxLevel={3}
                      placeholder="Select category hierarchy"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    BASIC DESCRIPTION
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1"
                    rows={4}
                    placeholder="Brief product description for listings"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="htmlDescription" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    DETAILED HTML DESCRIPTION
                  </Label>
                  <Textarea
                    id="htmlDescription"
                    value={formData.htmlDescription}
                    onChange={(e) => setFormData({ ...formData, htmlDescription: e.target.value })}
                    className="mt-1 font-mono text-sm"
                    rows={8}
                    placeholder="Rich HTML content with images, formatting, etc."
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    <p>• Supports full HTML including images, tables, lists</p>
                    <p>• Use &lt;img src="..." alt="..." /&gt; for images</p>
                    <p>• Use &lt;b&gt;, &lt;i&gt;, &lt;u&gt; for formatting</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="platform" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PLATFORM *
                  </Label>
                  <Select 
                    value={formData.platform} 
                    onValueChange={(value) => setFormData({ ...formData, platform: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Windows">Windows</SelectItem>
                      <SelectItem value="Mac">Mac</SelectItem>
                      <SelectItem value="Linux">Linux</SelectItem>
                      <SelectItem value="Cross-platform">Cross-platform</SelectItem>
                      <SelectItem value="Web">Web</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="region" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    REGION *
                  </Label>
                  <Select 
                    value={formData.region} 
                    onValueChange={(value) => setFormData({ ...formData, region: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Worldwide">Worldwide</SelectItem>
                      <SelectItem value="Europe">Europe</SelectItem>
                      <SelectItem value="North America">North America</SelectItem>
                      <SelectItem value="Asia">Asia</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="imageUpload" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PRODUCT IMAGE
                  </Label>
                  <div className="mt-1 flex flex-col space-y-3">
                    {formData.imageUrl && (
                      <div className="relative">
                        <img 
                          src={formData.imageUrl} 
                          alt="Product preview" 
                          className="h-32 w-32 object-cover rounded-lg border border-gray-300"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setFormData({ ...formData, imageUrl: '' })}
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    )}
                    <div className="relative">
                      <input
                        id="imageUpload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#FFB20F] file:text-white hover:file:bg-[#e6a00e] file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FFB20F]"></div>
                            <span className="text-sm text-gray-600">Uploading...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="warranty" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    WARRANTY INFORMATION
                  </Label>
                  <Textarea
                    id="warranty"
                    value={formData.warranty}
                    onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                    className="mt-1"
                    rows={3}
                    placeholder="Warranty terms, duration, coverage details..."
                  />
                </div>
              </div>
            </TabsContent>

            {/* EUR Pricing Tab */}
            <TabsContent value="eur-pricing" className="space-y-6 mt-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-yellow-800 mb-2">EUR Pricing (Required)</h4>
                <p className="text-sm text-yellow-700">
                  All three pricing fields are mandatory. The B2B price will be used as the main display price.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="purchasePrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PURCHASE PRICE (EUR) *
                  </Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={eurPricing.purchasePrice}
                    onChange={(e) => setEurPricing({ ...eurPricing, purchasePrice: e.target.value })}
                    className="mt-1"
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Your cost price</p>
                </div>

                <div>
                  <Label htmlFor="b2bPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    B2B PRICE (EUR) *
                  </Label>
                  <Input
                    id="b2bPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={eurPricing.b2bPrice}
                    onChange={(e) => setEurPricing({ ...eurPricing, b2bPrice: e.target.value })}
                    className="mt-1"
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Main selling price (displayed on shop)</p>
                </div>

                <div>
                  <Label htmlFor="retailPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    RETAIL PRICE (EUR) *
                  </Label>
                  <Input
                    id="retailPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={eurPricing.retailPrice}
                    onChange={(e) => setEurPricing({ ...eurPricing, retailPrice: e.target.value })}
                    className="mt-1"
                    placeholder="0.00"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended retail price</p>
                </div>
              </div>
            </TabsContent>

            {/* KM Pricing Tab */}
            <TabsContent value="km-pricing" className="space-y-6 mt-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-800 mb-2">KM Pricing (Optional)</h4>
                <p className="text-sm text-blue-700">
                  Bosnian Mark pricing for future KM tenant. Leave empty if not applicable.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="purchasePriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PURCHASE PRICE (KM)
                  </Label>
                  <Input
                    id="purchasePriceKm"
                    type="number"
                    step="0.01"
                    min="0"
                    value={kmPricing.purchasePriceKm}
                    onChange={(e) => setKmPricing({ ...kmPricing, purchasePriceKm: e.target.value })}
                    className="mt-1"
                    placeholder="0.00"
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
                    min="0"
                    value={kmPricing.b2bPriceKm}
                    onChange={(e) => setKmPricing({ ...kmPricing, b2bPriceKm: e.target.value })}
                    className="mt-1"
                    placeholder="0.00"
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
                    min="0"
                    value={kmPricing.retailPriceKm}
                    onChange={(e) => setKmPricing({ ...kmPricing, retailPriceKm: e.target.value })}
                    className="mt-1"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </TabsContent>

            {/* License Keys Tab */}
            <TabsContent value="license-keys" className="space-y-6 mt-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-green-800 mb-2">License Keys & Stock</h4>
                <p className="text-sm text-green-700">
                  Stock count is automatically calculated from the number of available license keys. Add initial license keys below.
                </p>
              </div>

              <div>
                <Label htmlFor="licenseKeys" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                  LICENSE KEYS (Optional)
                </Label>
                <Textarea
                  id="licenseKeys"
                  value={licenseKeys}
                  onChange={(e) => setLicenseKeys(e.target.value)}
                  className="mt-1 font-mono text-sm"
                  rows={10}
                  placeholder="Enter license keys, one per line:
LICENSE-KEY-1
LICENSE-KEY-2
LICENSE-KEY-3"
                />
                <div className="mt-2 text-sm text-gray-600">
                  <p>• Enter one license key per line</p>
                  <p>• Keys will be validated for duplicates</p>
                  <p>• Stock count = number of available license keys</p>
                  <p>• You can add more keys later in the product edit section</p>
                  {licenseKeys && (
                    <p className="text-green-600 font-medium mt-2">
                      • {licenseKeys.split('\n').filter(k => k.trim()).length} keys ready to add
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Form Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Required Fields</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={formData.name ? "default" : "secondary"}>
                    {formData.name ? "✓" : "○"} Product Name
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={formData.categoryId ? "default" : "secondary"}>
                    {formData.categoryId ? "✓" : "○"} Category
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={formData.platform ? "default" : "secondary"}>
                    {formData.platform ? "✓" : "○"} Platform
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={formData.region ? "default" : "secondary"}>
                    {formData.region ? "✓" : "○"} Region
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Required Pricing</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={eurPricing.purchasePrice ? "default" : "secondary"}>
                    {eurPricing.purchasePrice ? "✓" : "○"} Purchase Price
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={eurPricing.b2bPrice ? "default" : "secondary"}>
                    {eurPricing.b2bPrice ? "✓" : "○"} B2B Price
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={eurPricing.retailPrice ? "default" : "secondary"}>
                    {eurPricing.retailPrice ? "✓" : "○"} Retail Price
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}