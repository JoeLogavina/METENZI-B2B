import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, CreditCard, Package, History, Plus, Minus, Save, Eye, EyeOff, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { formatAdminPrice } from "@/lib/currency-utils";

interface UserEditProps {
  userId: string;
  onBack: () => void;
}

export default function UserEdit({ userId, onBack }: UserEditProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    contactPerson: '',
    companyDescription: '',
    phone: '',
    country: '',
    city: '',
    address: '',
    vatOrRegistrationNo: '',
    isActive: true
  });

  // Wallet management state
  const [depositAmount, setDepositAmount] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [depositDescription, setDepositDescription] = useState('');

  // Product pricing state
  const [customPricing, setCustomPricing] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productPrices, setProductPrices] = useState<{[key: string]: string}>({});
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch user data
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: [`/api/admin/users/${userId}`],
    enabled: !!userId,
  });

  // Fetch wallet data
  const { data: walletData, isLoading: walletLoading, refetch: refetchWallet } = useQuery({
    queryKey: [`/api/admin/users/${userId}/wallet`],
    enabled: !!userId,
  });

  // Fetch user's custom pricing
  const { data: userPricing = [], refetch: refetchPricing } = useQuery({
    queryKey: [`/api/admin/users/${userId}/pricing`],
    enabled: !!userId,
  });

  // Fetch all products for pricing management
  const { data: productsResponse, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['/api/admin/products'],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract products from API response
  const products = Array.isArray(productsResponse?.data) ? productsResponse.data : (Array.isArray(productsResponse) ? productsResponse : []);

  // Fetch transaction history
  const { data: transactions = [] } = useQuery({
    queryKey: [`/api/admin/users/${userId}/transactions`],
    enabled: !!userId && activeTab === 'transactions',
  });

  // Fetch payment history
  const { data: payments = [] } = useQuery({
    queryKey: [`/api/admin/users/${userId}/payments`],
    enabled: !!userId && activeTab === 'payments',
  });

  // Update profile data when user data loads
  useEffect(() => {
    if (userData && typeof userData === 'object') {
      const user = userData as any;
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        companyName: user.companyName || '',
        contactPerson: user.contactPerson || '',
        companyDescription: user.companyDescription || '',
        phone: user.phone || '',
        country: user.country || '',
        city: user.city || '',
        address: user.address || '',
        vatOrRegistrationNo: user.vatOrRegistrationNo || '',
        isActive: user.isActive ?? true
      });
    }
  }, [userData]);

  // Update wallet form when wallet data loads
  useEffect(() => {
    if (walletData && typeof walletData === 'object') {
      const wallet = walletData as any;
      if (wallet.data) {
        setCreditLimit(wallet.data.creditLimit || '0.00');
      }
    }
  }, [walletData]);

  // Update pricing data when it loads
  useEffect(() => {
    if (Array.isArray(products) && Array.isArray(userPricing)) {
      const productsArray = products as any[];
      const pricingArray = userPricing as any[];
      const pricingMap = new Map(pricingArray.map((p: any) => [p.productId, p]));
      
      const newCustomPricing = productsArray.map((product: any) => ({
        ...product,
        customPrice: pricingMap.get(product.id)?.customPrice || product.b2bPrice || product.price,
        isVisible: pricingMap.get(product.id)?.isVisible ?? true,
        hasCustomPricing: pricingMap.has(product.id)
      }));
      
      // Only update if the data has actually changed
      setCustomPricing(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(newCustomPricing)) {
          return newCustomPricing;
        }
        return prev;
      });
    }
  }, [products, userPricing]);

  // Set allProducts when products data is loaded
  useEffect(() => {
    if (Array.isArray(products) && products.length > 0) {
      const productsArray = products as any[];
      setAllProducts(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(productsArray)) {
          return productsArray;
        }
        return prev;
      });
    }
  }, [products]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/admin/users/${userId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  });

  // Deposit mutation
  const addDepositMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/admin/users/${userId}/deposit`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Deposit added successfully",
      });
      setDepositAmount('');
      setDepositDescription('');
      refetchWallet();
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/transactions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add deposit",
        variant: "destructive",
      });
    }
  });

  // Credit limit mutation
  const updateCreditLimitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/admin/users/${userId}/credit-limit`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Credit limit updated successfully",
      });
      refetchWallet();
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${userId}/transactions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update credit limit",
        variant: "destructive",
      });
    }
  });

  // Pricing update mutation
  const updatePricingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/admin/users/${userId}/pricing`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product pricing updated successfully",
      });
      refetchPricing();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pricing",
        variant: "destructive",
      });
    }
  });

  // Delete single product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest('DELETE', `/api/admin/users/${userId}/pricing/${productId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product removed successfully",
      });
      refetchPricing();
      setSelectedProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(deleteProductMutation.variables as string);
        return newSet;
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove product",
        variant: "destructive",
      });
    }
  });

  // Delete multiple products mutation
  const deleteMultipleProductsMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      return apiRequest('DELETE', `/api/admin/users/${userId}/pricing`, { productIds });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Selected products removed successfully",
      });
      refetchPricing();
      setSelectedProducts(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove products",
        variant: "destructive",
      });
    }
  });

  // Handle profile save
  const handleProfileSave = () => {
    updateProfileMutation.mutate(profileData);
  };



  // Handle deposit addition
  const handleAddDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid deposit amount",
        variant: "destructive",
      });
      return;
    }

    addDepositMutation.mutate({
      amount: parseFloat(depositAmount),
      description: depositDescription || `Deposit added by admin`
    });
  };

  // Handle credit limit update
  const handleUpdateCreditLimit = () => {
    if (!creditLimit || parseFloat(creditLimit) < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid credit limit",
        variant: "destructive",
      });
      return;
    }

    updateCreditLimitMutation.mutate({
      creditLimit: parseFloat(creditLimit)
    });
  };

  // Handle pricing update
  const handlePricingUpdate = (productId: string, customPrice: string, isVisible: boolean) => {
    updatePricingMutation.mutate({
      productId,
      customPrice: parseFloat(customPrice),
      isVisible
    });
  };

  // Handle adding selected products to user
  const handleAddSelectedProducts = () => {
    if (selectedProducts.size === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select at least one product to add.",
        variant: "destructive"
      });
      return;
    }

    // Add products with default pricing and visibility
    const productIdsArray = Array.from(selectedProducts);
    const promises = productIdsArray.map(productId => {
      const product = allProducts?.find((p: any) => p.id === productId);
      const defaultPrice = parseFloat(product?.b2bPrice || product?.price || "0").toString();
      
      return updatePricingMutation.mutateAsync({
        productId,
        customPrice: parseFloat(defaultPrice),
        isVisible: true
      });
    });

    Promise.all(promises).then(() => {
      setSelectedProducts(new Set());
      setShowAddProductModal(false);
      refetchPricing();
      toast({
        title: "Products Added",
        description: `${productIdsArray.length} products added successfully`,
        variant: "default"
      });
    }).catch((error) => {
      toast({
        title: "Error",
        description: "Failed to add some products. Please try again.",
        variant: "destructive"
      });
    });
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F]"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="text-center py-8">
        <p className="text-[#6E6F71]">User not found</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="text-[#6E6F71] border-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
          <div>
            <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">
              EDIT USER: {(userData as any)?.firstName} {(userData as any)?.lastName}
            </h3>
            <p className="text-sm text-[#6E6F71]">@{(userData as any)?.username} • {(userData as any)?.email}</p>
          </div>
        </div>
        <Badge variant={(userData as any)?.isActive ? "default" : "destructive"}>
          {(userData as any)?.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span>Profile & Credit</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center space-x-2">
            <Package className="w-4 h-4" />
            <span>Company Products</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center space-x-2">
            <History className="w-4 h-4" />
            <span>Transaction History</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4" />
            <span>Payment History</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Information & Credit Management */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={profileData.companyName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, companyName: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={profileData.contactPerson}
                    onChange={(e) => setProfileData(prev => ({ ...prev, contactPerson: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="companyDescription">A word about your company</Label>
                  <Textarea
                    id="companyDescription"
                    value={profileData.companyDescription}
                    onChange={(e) => setProfileData(prev => ({ ...prev, companyDescription: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={profileData.country}
                      onChange={(e) => setProfileData(prev => ({ ...prev, country: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={profileData.city}
                      onChange={(e) => setProfileData(prev => ({ ...prev, city: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="vatOrRegistrationNo">VAT or Registration No. *</Label>
                    <Input
                      id="vatOrRegistrationNo"
                      value={profileData.vatOrRegistrationNo}
                      onChange={(e) => setProfileData(prev => ({ ...prev, vatOrRegistrationNo: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    value={profileData.address}
                    onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                    rows={2}
                    required
                  />
                </div>

                <Button
                  onClick={handleProfileSave}
                  disabled={updateProfileMutation.isPending}
                  className="w-full bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>

            {/* Wallet Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71]">Wallet & Credit Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {walletLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FFB20F]"></div>
                  </div>
                ) : walletData?.data ? (
                  <div className="space-y-4">
                    {/* Current Balance Overview */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <h4 className="font-medium text-[#6E6F71]">Current Balance</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Deposit Balance:</span>
                          <p className="font-medium text-[#FFB20F]">€{(walletData as any)?.data?.depositBalance || '0.00'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Credit Used:</span>
                          <p className="font-medium text-red-600">€{(walletData as any)?.data?.creditUsed || '0.00'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Credit Limit:</span>
                          <p className="font-medium">€{(walletData as any)?.data?.creditLimit || '0.00'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Available:</span>
                          <p className="font-bold text-green-600">€{(walletData as any)?.data?.totalAvailable || '0.00'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Add Deposit */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-[#6E6F71]">Add Deposit</h4>
                      <div>
                        <Label htmlFor="depositAmount">Amount (EUR)</Label>
                        <Input
                          id="depositAmount"
                          type="number"
                          step="0.01"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="depositDescription">Description</Label>
                        <Input
                          id="depositDescription"
                          value={depositDescription}
                          onChange={(e) => setDepositDescription(e.target.value)}
                          placeholder="Deposit reason (optional)"
                        />
                      </div>
                      <Button
                        onClick={handleAddDeposit}
                        disabled={addDepositMutation.isPending}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {addDepositMutation.isPending ? "Adding..." : "Add Deposit"}
                      </Button>
                    </div>

                    {/* Update Credit Limit */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-[#6E6F71]">Update Credit Limit</h4>
                      <div>
                        <Label htmlFor="creditLimit">Credit Limit (EUR)</Label>
                        <Input
                          id="creditLimit"
                          type="number"
                          step="0.01"
                          value={creditLimit}
                          onChange={(e) => setCreditLimit(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleUpdateCreditLimit}
                        disabled={updateCreditLimitMutation.isPending}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateCreditLimitMutation.isPending ? "Updating..." : "Update Credit Limit"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No wallet data found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Company Products */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-[#6E6F71]">Product Pricing & Visibility</CardTitle>
              <div className="flex gap-2">
                {selectedProducts.size > 0 && (
                  <Button
                    onClick={() => {
                      deleteMultipleProductsMutation.mutate(Array.from(selectedProducts));
                    }}
                    variant="destructive"
                    size="sm"
                    disabled={deleteMultipleProductsMutation.isPending}
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    {deleteMultipleProductsMutation.isPending ? 'Deleting...' : `Delete Selected (${selectedProducts.size})`}
                  </Button>
                )}
                <Button
                  onClick={() => setShowAddProductModal(true)}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {Array.isArray(userPricing) && userPricing.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-[#6E6F71] text-white">
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium w-12">
                          <Checkbox
                            checked={selectedProducts.size === userPricing.length && userPricing.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProducts(new Set(userPricing.map((p: any) => p.productId)));
                              } else {
                                setSelectedProducts(new Set());
                              }
                            }}
                            className="border-white data-[state=checked]:bg-[#FFB20F] data-[state=checked]:border-[#FFB20F]"
                          />
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">#</th>
                        <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">Product Name</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">Purchase</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">B2B Price</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">Retail Price</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">Visible</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(userPricing as any[]).map((pricingData: any, index: number) => {
                        const product = (products as any[]).find((p: any) => p.id === pricingData.productId);
                        if (!product) return null;
                        
                        const isVisible = pricingData.isVisible ?? true;
                        const customPrice = pricingData.customPrice || product.b2bPrice || product.price;
                        
                        return (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <Checkbox
                                checked={selectedProducts.has(product.id)}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedProducts);
                                  if (checked) {
                                    newSelected.add(product.id);
                                  } else {
                                    newSelected.delete(product.id);
                                  }
                                  setSelectedProducts(newSelected);
                                }}
                                className="data-[state=checked]:bg-[#FFB20F] data-[state=checked]:border-[#FFB20F]"
                              />
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-sm text-center font-medium">
                              {index + 1}
                            </td>
                            <td className="border border-gray-300 px-3 py-2">
                              <div className="max-w-xs">
                                <div className="text-sm font-medium text-[#6E6F71] truncate">{product.name}</div>
                                <div className="text-xs text-gray-500 truncate">
                                  {product.description}
                                </div>
                              </div>
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <span className="text-sm font-medium">
                                €{parseFloat(product.purchasePrice || "0").toFixed(2)}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <Input
                                type="number"
                                step="0.01"
                                value={productPrices[product.id] || customPrice}
                                onChange={(e) => {
                                  setProductPrices(prev => ({
                                    ...prev,
                                    [product.id]: e.target.value
                                  }));
                                }}
                                data-product={product.id}
                                className="w-20 text-sm text-center border-[#FFB20F] focus:border-[#FFB20F] focus:ring-[#FFB20F]"
                              />
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <span className="text-sm font-medium">
                                €{parseFloat(product.retailerPrice || product.price || "0").toFixed(2)}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <button
                                onClick={() => {
                                  const newVisibility = !isVisible;
                                  updatePricingMutation.mutate({
                                    productId: product.id,
                                    customPrice: parseFloat(customPrice),
                                    isVisible: newVisibility
                                  });
                                }}
                                className={`p-2 rounded-full transition-colors ${
                                  isVisible 
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                    : 'bg-red-100 text-red-600 hover:bg-red-200'
                                }`}
                              >
                                {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const newPrice = productPrices[product.id] || customPrice;
                                    updatePricingMutation.mutate({
                                      productId: product.id,
                                      customPrice: parseFloat(newPrice),
                                      isVisible: isVisible
                                    });
                                  }}
                                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white px-2 py-1 text-xs h-6"
                                  disabled={updatePricingMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    deleteProductMutation.mutate(product.id);
                                  }}
                                  variant="destructive"
                                  className="px-2 py-1 text-xs h-6"
                                  disabled={deleteProductMutation.isPending}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-[#6E6F71]">No products added yet</h3>
                  <p className="mt-2 text-sm text-gray-500">This user has no visible products in their B2B shop.</p>
                  <p className="mt-1 text-xs text-gray-400">Click "Add Product" to make products visible to this user.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History */}
        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#6E6F71]">Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {(transactions as any[]).length > 0 ? (
                <div className="space-y-2">
                  {(transactions as any[]).map((transaction: any) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Badge variant={
                            transaction.type === 'deposit' ? 'default' :
                            transaction.type === 'payment' ? 'destructive' :
                            'secondary'
                          }>
                            {transaction.type}
                          </Badge>
                          <span className="text-sm text-[#6E6F71]">{transaction.description}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${
                          transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'deposit' ? '+' : '-'}€{Math.abs(parseFloat(transaction.amount) || 0)}
                        </p>
                        <p className="text-xs text-gray-500">Balance: €{transaction.balanceAfter}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No transactions found</h3>
                  <p className="mt-1 text-sm text-gray-500">Transaction history will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#6E6F71]">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {(payments as any[]).length > 0 ? (
                <div className="space-y-2">
                  {(payments as any[]).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Badge variant="destructive">Payment</Badge>
                          <span className="text-sm text-[#6E6F71]">
                            Order {payment.orderNumber || payment.orderId}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(payment.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-600">-€{payment.amount}</p>
                        <p className="text-xs text-gray-500">
                          {payment.paymentMethod === 'wallet' ? 'Wallet Payment' : payment.paymentMethod}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No payments found</h3>
                  <p className="mt-1 text-sm text-gray-500">Payment history will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Product Modal */}
      <Dialog open={showAddProductModal} onOpenChange={setShowAddProductModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#6E6F71]">Add Products to User</DialogTitle>
            <DialogDescription>
              Select products to make them visible to this user in their B2B shop.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Products List */}
            <div className="border rounded-lg">
              <div className="bg-[#6E6F71] text-white p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Available Products</span>
                  <span className="text-sm">
                    {selectedProducts.size} selected
                  </span>
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {Array.isArray(products) && products.length > 0 ? (
                  <>
                    {products
                      .filter((product: any) => {
                        // Only filter by search term - show ALL products
                        const matchesSearch = !searchTerm || 
                          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
                        
                        return matchesSearch;
                      })
                      .map((product: any) => {
                        const isSelected = selectedProducts.has(product.id);
                        const isAlreadyAdded = Array.isArray(userPricing) && (userPricing as any[]).some((p: any) => p.productId === product.id);
                        
                        return (
                          <div
                            key={product.id}
                            className={`p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50' : ''
                            } ${isAlreadyAdded ? 'bg-green-50 border-green-200' : ''}`}
                            onClick={() => {
                              const newSelected = new Set(selectedProducts);
                              if (isSelected) {
                                newSelected.delete(product.id);
                              } else {
                                newSelected.add(product.id);
                              }
                              setSelectedProducts(newSelected);
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => {}} // Handled by parent div click
                                className="pointer-events-none"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium text-[#6E6F71] truncate">
                                        {product.name}
                                      </h4>
                                      {isAlreadyAdded && (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                          Added
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-500 truncate max-w-md">
                                      {product.description}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-[#FFB20F]">
                                      €{parseFloat(product.b2bPrice || product.price || "0").toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500">B2B Price</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    
                    {products.filter((product: any) => {
                      const matchesSearch = !searchTerm || 
                        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        product.description.toLowerCase().includes(searchTerm.toLowerCase());
                      return matchesSearch;
                    }).length === 0 && (
                      <div className="p-6 text-center">
                        <Package className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                          {searchTerm ? 'No matching products found' : 'No products available'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                        {searchTerm 
                          ? 'Try adjusting your search terms.' 
                          : 'All products are already visible to this user.'
                        }
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No available products
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Loading products or no products found.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddProductModal(false);
                  setSelectedProducts(new Set());
                  setSearchTerm('');
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">
                  {selectedProducts.size} products selected
                </span>
                <Button
                  onClick={handleAddSelectedProducts}
                  disabled={selectedProducts.size === 0 || updatePricingMutation.isPending}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                >
                  {updatePricingMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Products ({selectedProducts.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}