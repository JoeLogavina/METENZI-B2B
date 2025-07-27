import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, Trash2, Plus, Image as ImageIcon } from "lucide-react";
import { formatAdminPrice, convertEurToKm } from "@/lib/currency-utils";

export default function EditProduct() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/admin/products/:id");
  const productId = params?.id;

  // Form states for different currencies
  const [eurFormData, setEurFormData] = useState({
    name: '',
    description: '',
    sku: '',
    category: '',
    region: '',
    platform: '',
    isActive: true,
    purchasePrice: '',
    resellerPrice: '',
    retailerPrice: '',
    imageUrl: ''
  });

  const [kmFormData, setKmFormData] = useState({
    purchasePriceKm: '',
    resellerPriceKm: '',
    retailerPriceKm: ''
  });

  const [activeTab, setActiveTab] = useState("product-details");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || ((user as any)?.role !== 'admin' && (user as any)?.role !== 'super_admin'))) {
      toast({
        title: "Unauthorized", 
        description: "Admin access required. Redirecting...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/");
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, (user as any)?.role, toast, setLocation]);

  // Fetch product data
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["/api/admin/products", productId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/products/${productId}`);
      return await res.json();
    },
    enabled: !!productId && isAuthenticated && ((user as any)?.role === 'admin' || (user as any)?.role === 'super_admin'),
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  // Fetch license keys for this product
  const { data: licenseKeys, isLoading: licenseKeysLoading } = useQuery({
    queryKey: ["/api/admin/license-keys", productId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/license-keys?productId=${productId}`);
      return await res.json();
    },
    enabled: !!productId && isAuthenticated,
  });

  // Initialize form data when product loads
  useEffect(() => {
    if (product) {
      setEurFormData({
        name: product.name || '',
        description: product.description || '',
        sku: product.sku || '',
        category: product.categoryId || '',
        region: product.region || '',
        platform: product.platform || '',
        isActive: product.isActive !== false,
        purchasePrice: product.purchasePrice || '',
        resellerPrice: product.resellerPrice || '',
        retailerPrice: product.retailerPrice || '',
        imageUrl: product.imageUrl || ''
      });

      setKmFormData({
        purchasePriceKm: product.purchasePriceKm || '',
        resellerPriceKm: product.resellerPriceKm || '',
        retailerPriceKm: product.retailerPriceKm || ''
      });

      if (product.imageUrl) {
        setImagePreview(product.imageUrl);
      }
    }
  }, [product]);

  // Handle image file selection
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PUT',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to update product');
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products", productId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add license key mutation
  const addLicenseKeyMutation = useMutation({
    mutationFn: async (licenseKey: string) => {
      const res = await apiRequest("POST", "/api/admin/license-keys", {
        productId,
        licenseKey,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License key added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/license-keys", productId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete license key mutation
  const deleteLicenseKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/license-keys/${keyId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "License key deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/license-keys", productId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const formData = new FormData();
    
    // Add product data
    Object.entries(eurFormData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    // Add KM pricing data
    Object.entries(kmFormData).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, String(value));
      }
    });

    // Add image file if selected
    if (imageFile) {
      formData.append('image', imageFile);
    }

    updateProductMutation.mutate(formData);
  };

  const [newLicenseKey, setNewLicenseKey] = useState("");

  if (!match) {
    return <div>Product not found</div>;
  }

  if (productLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f5]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/admin")}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Admin</span>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
                EDIT PRODUCT
              </h1>
              {product && (
                <p className="text-sm text-gray-600">{product.name}</p>
              )}
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={updateProductMutation.isPending}
            className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
          >
            {updateProductMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="product-details">Product Details</TabsTrigger>
            <TabsTrigger value="eur-pricing">EUR Pricing</TabsTrigger>
            <TabsTrigger value="km-pricing">KM Pricing</TabsTrigger>
            <TabsTrigger value="license-keys">License Keys</TabsTrigger>
          </TabsList>

          {/* Product Details Tab */}
          <TabsContent value="product-details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      PRODUCT NAME
                    </Label>
                    <Input
                      id="name"
                      value={eurFormData.name}
                      onChange={(e) => setEurFormData({ ...eurFormData, name: e.target.value })}
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
                      onChange={(e) => setEurFormData({ ...eurFormData, sku: e.target.value })}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    DESCRIPTION
                  </Label>
                  <Textarea
                    id="description"
                    value={eurFormData.description}
                    onChange={(e) => setEurFormData({ ...eurFormData, description: e.target.value })}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="category" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      CATEGORY
                    </Label>
                    <Select value={eurFormData.category} onValueChange={(value) => setEurFormData({ ...eurFormData, category: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories || []).map((category: any) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="region" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      REGION
                    </Label>
                    <Select value={eurFormData.region} onValueChange={(value) => setEurFormData({ ...eurFormData, region: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select region" />
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
                    <Label htmlFor="platform" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      PLATFORM
                    </Label>
                    <Select value={eurFormData.platform} onValueChange={(value) => setEurFormData({ ...eurFormData, platform: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Windows">Windows</SelectItem>
                        <SelectItem value="Mac">Mac</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                        <SelectItem value="Linux">Linux</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Image Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">Product Image</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="image" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                        UPLOAD IMAGE
                      </Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="imageUrl" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                        OR IMAGE URL
                      </Label>
                      <Input
                        id="imageUrl"
                        value={eurFormData.imageUrl}
                        onChange={(e) => {
                          setEurFormData({ ...eurFormData, imageUrl: e.target.value });
                          setImagePreview(e.target.value);
                        }}
                        className="mt-1"
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EUR Pricing Tab */}
          <TabsContent value="eur-pricing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">EUR Pricing Structure</CardTitle>
                <p className="text-sm text-gray-600">Set pricing tiers for European market</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="purchasePrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      PURCHASE PRICE (€)
                    </Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      step="0.01"
                      value={eurFormData.purchasePrice}
                      onChange={(e) => setEurFormData({ ...eurFormData, purchasePrice: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Cost to acquire this product</p>
                  </div>

                  <div>
                    <Label htmlFor="resellerPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      RESELLER PRICE (€)
                    </Label>
                    <Input
                      id="resellerPrice"
                      type="number"
                      step="0.01"
                      value={eurFormData.resellerPrice}
                      onChange={(e) => setEurFormData({ ...eurFormData, resellerPrice: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Price for B2B resellers</p>
                  </div>

                  <div>
                    <Label htmlFor="retailerPrice" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      RETAILER PRICE (€)
                    </Label>
                    <Input
                      id="retailerPrice"
                      type="number"
                      step="0.01"
                      value={eurFormData.retailerPrice}
                      onChange={(e) => setEurFormData({ ...eurFormData, retailerPrice: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">End customer price</p>
                  </div>
                </div>

                {eurFormData.purchasePrice && eurFormData.resellerPrice && eurFormData.retailerPrice && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">MARGIN ANALYSIS</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Reseller Margin:</span>
                        <span className="ml-2 font-medium text-[#FFB20F]">
                          €{(parseFloat(eurFormData.resellerPrice) - parseFloat(eurFormData.purchasePrice)).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Retail Margin:</span>
                        <span className="ml-2 font-medium text-[#FFB20F]">
                          €{(parseFloat(eurFormData.retailerPrice) - parseFloat(eurFormData.resellerPrice)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KM Pricing Tab */}
          <TabsContent value="km-pricing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">KM Pricing Structure</CardTitle>
                <p className="text-sm text-gray-600">Set pricing tiers for Bosnian market (1 EUR ≈ 1.96 KM)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="purchasePriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      PURCHASE PRICE (KM)
                    </Label>
                    <Input
                      id="purchasePriceKm"
                      type="number"
                      step="0.01"
                      value={kmFormData.purchasePriceKm}
                      onChange={(e) => setKmFormData({ ...kmFormData, purchasePriceKm: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Suggested: {eurFormData.purchasePrice ? convertEurToKm(parseFloat(eurFormData.purchasePrice)).toFixed(2) + ' KM' : 'Enter EUR price first'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="resellerPriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      RESELLER PRICE (KM)
                    </Label>
                    <Input
                      id="resellerPriceKm"
                      type="number"
                      step="0.01"
                      value={kmFormData.resellerPriceKm}
                      onChange={(e) => setKmFormData({ ...kmFormData, resellerPriceKm: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Suggested: {eurFormData.resellerPrice ? convertEurToKm(parseFloat(eurFormData.resellerPrice)).toFixed(2) + ' KM' : 'Enter EUR price first'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="retailerPriceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                      RETAILER PRICE (KM)
                    </Label>
                    <Input
                      id="retailerPriceKm"
                      type="number"
                      step="0.01"
                      value={kmFormData.retailerPriceKm}
                      onChange={(e) => setKmFormData({ ...kmFormData, retailerPriceKm: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Suggested: {eurFormData.retailerPrice ? convertEurToKm(parseFloat(eurFormData.retailerPrice)).toFixed(2) + ' KM' : 'Enter EUR price first'}
                    </p>
                  </div>
                </div>

                {/* Auto-convert buttons */}
                <div className="flex space-x-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (eurFormData.purchasePrice && eurFormData.resellerPrice && eurFormData.retailerPrice) {
                        setKmFormData({
                          purchasePriceKm: convertEurToKm(parseFloat(eurFormData.purchasePrice)).toFixed(2),
                          resellerPriceKm: convertEurToKm(parseFloat(eurFormData.resellerPrice)).toFixed(2),
                          retailerPriceKm: convertEurToKm(parseFloat(eurFormData.retailerPrice)).toFixed(2),
                        });
                      }
                    }}
                    className="text-[#FFB20F] border-[#FFB20F] hover:bg-[#FFB20F] hover:text-white"
                  >
                    Auto-Convert from EUR
                  </Button>
                </div>

                {kmFormData.purchasePriceKm && kmFormData.resellerPriceKm && kmFormData.retailerPriceKm && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">KM MARGIN ANALYSIS</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Reseller Margin:</span>
                        <span className="ml-2 font-medium text-[#FFB20F]">
                          {(parseFloat(kmFormData.resellerPriceKm) - parseFloat(kmFormData.purchasePriceKm)).toFixed(2)} KM
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Retail Margin:</span>
                        <span className="ml-2 font-medium text-[#FFB20F]">
                          {(parseFloat(kmFormData.retailerPriceKm) - parseFloat(kmFormData.resellerPriceKm)).toFixed(2)} KM
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* License Keys Tab */}
          <TabsContent value="license-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71] flex items-center justify-between">
                  License Keys Management
                  <Badge variant="outline">
                    {licenseKeys?.length || 0} keys available
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new license key */}
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter license key"
                    value={newLicenseKey}
                    onChange={(e) => setNewLicenseKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (newLicenseKey.trim()) {
                        addLicenseKeyMutation.mutate(newLicenseKey.trim());
                        setNewLicenseKey("");
                      }
                    }}
                    disabled={addLicenseKeyMutation.isPending || !newLicenseKey.trim()}
                    className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Key
                  </Button>
                </div>

                {/* License keys list */}
                <div className="space-y-2">
                  {licenseKeysLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FFB20F] mx-auto"></div>
                    </div>
                  ) : licenseKeys && Array.isArray(licenseKeys) && licenseKeys.length > 0 ? (
                    licenseKeys.map((key: any) => (
                      <div key={key.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <div className="font-mono text-sm">{key.licenseKey}</div>
                          <div className="text-xs text-gray-500">
                            {key.isUsed ? (
                              <span className="text-red-600">Used on {new Date(key.usedAt).toLocaleDateString()}</span>
                            ) : (
                              <span className="text-green-600">Available</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteLicenseKeyMutation.mutate(key.id)}
                          disabled={deleteLicenseKeyMutation.isPending}
                          className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No license keys added yet. Add your first license key above.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}