import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { formatAdminPrice, convertEurToKm } from "@/lib/currency-utils";

interface EditProductProps {
  productId: string;
}

export default function EditProduct({ productId }: EditProductProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    priceKm: '',
    purchasePrice: '',
    b2bPrice: '',
    retailPrice: '',
    category: '',
    categoryId: '',
    region: '',
    platform: '',
    stockCount: '',
    isActive: true,
    sku: '',
    imageUrl: '',
    features: '',
    requirements: '',
    supportedLanguages: '',
    licenseType: '',
    maxUsers: '',
    validityPeriod: '',
  });

  // Fetch product data
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["/api/admin/products", productId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/products/${productId}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      return response.json();
    },
    enabled: !!productId,
  });

  // Fetch categories for dropdown
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Update form data when product is loaded
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        priceKm: product.priceKm || '',
        purchasePrice: product.purchasePrice || '',
        b2bPrice: product.b2bPrice || '',
        retailPrice: product.retailPrice || '',
        category: product.category || '',
        categoryId: product.categoryId || '',
        region: product.region || '',
        platform: product.platform || '',
        stockCount: product.stockCount || '',
        isActive: product.isActive ?? true,
        sku: product.sku || '',
        imageUrl: product.imageUrl || '',
        features: product.features || '',
        requirements: product.requirements || '',
        supportedLanguages: product.supportedLanguages || '',
        licenseType: product.licenseType || '',
        maxUsers: product.maxUsers || '',
        validityPeriod: product.validityPeriod || '',
      });
    }
  }, [product]);

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/admin/products/${productId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setLocation("/admin?section=products");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/products/${productId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setLocation("/admin?section=products");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare data for submission
    const submitData = {
      ...formData,
      price: formData.price || null,
      priceKm: formData.priceKm || null,
      purchasePrice: formData.purchasePrice || null,
      b2bPrice: formData.b2bPrice || null,
      retailPrice: formData.retailPrice || null,
      stockCount: formData.stockCount || null,
      maxUsers: formData.maxUsers || null,
      validityPeriod: formData.validityPeriod || null,
    };

    updateProductMutation.mutate(submitData);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      deleteProductMutation.mutate();
    }
  };

  if (productLoading) {
    return (
      <div className="min-h-screen bg-[#f5f6f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F]"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f5f6f5] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-[#6E6F71] mb-2">Product Not Found</h2>
          <Button onClick={() => setLocation("/admin?section=products")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>
        </div>
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
              onClick={() => setLocation("/admin?section=products")}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Products</span>
            </Button>
            <h1 className="text-xl font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
              EDIT PRODUCT
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={deleteProductMutation.isPending}
              className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              type="submit"
              form="edit-product-form"
              disabled={updateProductMutation.isPending}
              className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateProductMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <form id="edit-product-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-[#6E6F71] mb-4 uppercase tracking-[0.5px]">
                BASIC INFORMATION
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PRODUCT NAME
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="mt-1"
                    placeholder="Product SKU"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    DESCRIPTION
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-[#6E6F71] mb-4 uppercase tracking-[0.5px]">
                PRICING
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    DISPLAY PRICE (€)
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="priceKm" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PRICE (KM) - Bosnian Mark
                  </Label>
                  <Input
                    id="priceKm"
                    type="number"
                    step="0.01"
                    value={formData.priceKm}
                    onChange={(e) => setFormData({ ...formData, priceKm: e.target.value })}
                    className="mt-1"
                    placeholder="Optional - for future tenant"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For future Bosnian market tenant (1 EUR ≈ 1.96 KM)
                  </p>
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-[#6E6F71] mb-4 uppercase tracking-[0.5px]">
                PRODUCT DETAILS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    CATEGORY
                  </Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => {
                      const selectedCategory = (categories || []).find((cat: any) => cat.id === value);
                      setFormData({ 
                        ...formData, 
                        categoryId: value,
                        category: selectedCategory?.name || ''
                      });
                    }}
                  >
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
                  <Select
                    value={formData.region}
                    onValueChange={(value) => setFormData({ ...formData, region: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Global">Global</SelectItem>
                      <SelectItem value="EU">EU</SelectItem>
                      <SelectItem value="US">US</SelectItem>
                      <SelectItem value="APAC">APAC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="platform" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    PLATFORM
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
                      <SelectItem value="Both">Both</SelectItem>
                      <SelectItem value="Web">Web</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="stockCount" className="text-sm font-medium text-gray-700 uppercase tracking-[0.5px]">
                    STOCK COUNT
                  </Label>
                  <Input
                    id="stockCount"
                    type="number"
                    value={formData.stockCount}
                    onChange={(e) => setFormData({ ...formData, stockCount: e.target.value })}
                    className="mt-1"
                    placeholder="Available licenses"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}