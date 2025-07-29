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
import { ArrowLeft, User, CreditCard, Package, History, Plus, Minus, Save, Eye, EyeOff } from "lucide-react";
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
  const { data: products = [] } = useQuery({
    queryKey: ['/api/admin/products'],
    enabled: !!userId && activeTab === 'products',
  });

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
    if (userData) {
      setProfileData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        companyName: userData.companyName || '',
        contactPerson: userData.contactPerson || '',
        companyDescription: userData.companyDescription || '',
        phone: userData.phone || '',
        country: userData.country || '',
        city: userData.city || '',
        address: userData.address || '',
        vatOrRegistrationNo: userData.vatOrRegistrationNo || '',
        isActive: userData.isActive ?? true
      });
    }
  }, [userData]);

  // Update wallet form when wallet data loads
  useEffect(() => {
    if (walletData?.data) {
      setCreditLimit(walletData.data.creditLimit || '0.00');
    }
  }, [walletData]);

  // Update pricing data when it loads
  useEffect(() => {
    if (products.length && userPricing.length) {
      const pricingMap = new Map(userPricing.map((p: any) => [p.productId, p]));
      setCustomPricing(products.map((product: any) => ({
        ...product,
        customPrice: pricingMap.get(product.id)?.customPrice || product.b2bPrice || product.price,
        isVisible: pricingMap.get(product.id)?.isVisible ?? true,
        hasCustomPricing: pricingMap.has(product.id)
      })));
    }
  }, [products, userPricing]);

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
              EDIT USER: {userData.firstName} {userData.lastName}
            </h3>
            <p className="text-sm text-[#6E6F71]">@{userData.username} • {userData.email}</p>
          </div>
        </div>
        <Badge variant={userData.isActive ? "default" : "destructive"}>
          {userData.isActive ? "Active" : "Inactive"}
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
                          <p className="font-medium text-[#FFB20F]">€{walletData.data.depositBalance}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Credit Used:</span>
                          <p className="font-medium text-red-600">€{walletData.data.creditUsed}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Credit Limit:</span>
                          <p className="font-medium">€{walletData.data.creditLimit}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Total Available:</span>
                          <p className="font-bold text-green-600">€{walletData.data.totalAvailable}</p>
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
            <CardHeader>
              <CardTitle className="text-[#6E6F71]">Product Pricing & Visibility</CardTitle>
            </CardHeader>
            <CardContent>
              {customPricing.length > 0 ? (
                <div className="space-y-2">
                  {customPricing.map((product: any) => (
                    <div key={product.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#6E6F71] truncate">{product.name}</p>
                        <p className="text-sm text-gray-500">Default: €{product.b2bPrice || product.price}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={product.customPrice}
                          onChange={(e) => {
                            const newPricing = customPricing.map(p => 
                              p.id === product.id ? { ...p, customPrice: e.target.value } : p
                            );
                            setCustomPricing(newPricing);
                          }}
                          className="w-24"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newPricing = customPricing.map(p => 
                              p.id === product.id ? { ...p, isVisible: !p.isVisible } : p
                            );
                            setCustomPricing(newPricing);
                          }}
                          className={product.isVisible ? "text-green-600" : "text-red-600"}
                        >
                          {product.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handlePricingUpdate(product.id, product.customPrice, product.isVisible)}
                          disabled={updatePricingMutation.isPending}
                          className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No products found</h3>
                  <p className="mt-1 text-sm text-gray-500">Products will appear here when available.</p>
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
              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((transaction: any) => (
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
              {payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.map((payment: any) => (
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
    </div>
  );
}