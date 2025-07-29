import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Trash2, Edit, DollarSign, CreditCard, History, Package } from "lucide-react";
import { formatAdminPrice } from "@/lib/currency-utils";
import type { User, Product, UserProductPricing, WalletTransaction } from "@shared/schema";

export default function UserEditPage() {
  const [location, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Extract user ID from URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const userId = searchParams.get('id');
  
  // Local state for form data
  const [formData, setFormData] = useState<Partial<User>>({});
  const [newDeposit, setNewDeposit] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<{[key: string]: { price: string; visible: boolean }}>({});

  // Fetch user data
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/admin/users', userId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!userId,
  });

  // Fetch all products for custom pricing tab
  const { data: productsData } = useQuery({
    queryKey: ['/api/admin/products'],
    queryFn: async () => {
      const response = await fetch('/api/admin/products', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  // Fetch user's custom pricing
  const { data: userPricingData } = useQuery({
    queryKey: ['/api/admin/users', userId, 'pricing'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/pricing`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch pricing');
      return response.json();
    },
    enabled: !!userId,
  });

  // Fetch user's wallet transactions
  const { data: transactionsData } = useQuery({
    queryKey: ['/api/admin/users', userId, 'transactions'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/transactions`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: !!userId,
  });

  // Fetch user's payment history (orders)
  const { data: paymentsData } = useQuery({
    queryKey: ['/api/admin/users', userId, 'payments'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/payments`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      return response.json();
    },
    enabled: !!userId,
  });

  // Fetch user's wallet data
  const { data: walletData } = useQuery({
    queryKey: ['/api/admin/users', userId, 'wallet'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${userId}/wallet`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch wallet');
      return response.json();
    },
    enabled: !!userId,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user profile", variant: "destructive" });
    },
  });

  // Add deposit mutation
  const addDepositMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await fetch(`/api/admin/users/${userId}/wallet/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });
      if (!response.ok) throw new Error('Failed to add deposit');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Deposit added successfully" });
      setNewDeposit('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'wallet'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'transactions'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add deposit", variant: "destructive" });
    },
  });

  // Update credit limit mutation
  const updateCreditMutation = useMutation({
    mutationFn: async (creditLimit: string) => {
      const response = await fetch(`/api/admin/users/${userId}/wallet/credit-limit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ creditLimit: parseFloat(creditLimit) }),
      });
      if (!response.ok) throw new Error('Failed to update credit limit');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credit limit updated successfully" });
      setNewCreditLimit('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'wallet'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'transactions'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update credit limit", variant: "destructive" });
    },
  });

  // Update product pricing mutation
  const updateProductPricingMutation = useMutation({
    mutationFn: async ({ productId, customPrice, isVisible }: { productId: string; customPrice: string; isVisible: boolean }) => {
      const response = await fetch(`/api/admin/users/${userId}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, customPrice, isVisible }),
      });
      if (!response.ok) throw new Error('Failed to update pricing');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Product pricing updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users', userId, 'pricing'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update product pricing", variant: "destructive" });
    },
  });

  // Initialize form data when user data loads
  useEffect(() => {
    if (userData?.data) {
      setFormData(userData.data);
    }
  }, [userData]);

  // Initialize product pricing data
  useEffect(() => {
    if (userPricingData?.data && productsData?.data) {
      const pricing: {[key: string]: { price: string; visible: boolean }} = {};
      
      // Set existing custom prices
      userPricingData.data.forEach((item: UserProductPricing & { product: Product }) => {
        pricing[item.productId] = {
          price: item.customPrice,
          visible: item.isVisible
        };
      });
      
      // Add products without custom pricing with default prices
      productsData.data.forEach((product: Product) => {
        if (!pricing[product.id]) {
          pricing[product.id] = {
            price: product.b2bPrice || product.price,
            visible: true
          };
        }
      });
      
      setSelectedProducts(pricing);
    }
  }, [userPricingData, productsData]);

  if (!userId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">No user ID provided</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p>Loading user data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userData?.data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">User not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleProfileSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleAddDeposit = () => {
    if (newDeposit && !isNaN(parseFloat(newDeposit)) && parseFloat(newDeposit) > 0) {
      addDepositMutation.mutate(newDeposit);
    }
  };

  const handleUpdateCreditLimit = () => {
    if (newCreditLimit && parseFloat(newCreditLimit) >= 0) {
      updateCreditMutation.mutate(newCreditLimit);
    }
  };

  const handleProductPricingUpdate = (productId: string) => {
    const productPricing = selectedProducts[productId];
    if (productPricing && parseFloat(productPricing.price) >= 0) {
      updateProductPricingMutation.mutate({
        productId,
        customPrice: productPricing.price,
        isVisible: productPricing.visible
      });
    }
  };

  const user = userData.data;
  const wallet = walletData?.data;
  const transactions = transactionsData?.data || [];
  const payments = paymentsData?.data || [];
  const products = productsData?.data || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setLocation('/admin')}
            className="text-[#6E6F71] border-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#6E6F71] uppercase tracking-[0.5px]">
              Edit User: {user.firstName} {user.lastName}
            </h1>
            <p className="text-[#6E6F71]">@{user.username} • {user.email}</p>
          </div>
        </div>
        <Badge variant={user.isActive ? "default" : "destructive"}>
          {user.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4" />
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

        {/* Profile & Credit Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Edit className="w-5 h-5" />
                  <span>Profile Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={formData.country || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="vatOrRegistrationNo">VAT or Registration No. *</Label>
                  <Input
                    id="vatOrRegistrationNo"
                    value={formData.vatOrRegistrationNo || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, vatOrRegistrationNo: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="companyDescription">A word about your company</Label>
                  <Textarea
                    id="companyDescription"
                    value={formData.companyDescription || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyDescription: e.target.value }))}
                  />
                </div>

                <Button 
                  onClick={handleProfileSave}
                  disabled={updateProfileMutation.isPending}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                </Button>
              </CardContent>
            </Card>

            {/* Credit & Wallet Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Credit & Wallet Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {wallet && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Deposit Balance</Label>
                        <p className="text-2xl font-bold text-green-600">
                          {formatAdminPrice(wallet.depositBalance, user.tenantId)}
                        </p>
                      </div>
                      <div>
                        <Label>Credit Limit</Label>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatAdminPrice(wallet.creditLimit, user.tenantId)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Credit Used</Label>
                        <p className="text-lg font-semibold text-red-600">
                          {formatAdminPrice(wallet.creditUsed, user.tenantId)}
                        </p>
                      </div>
                      <div>
                        <Label>Total Available</Label>
                        <p className="text-lg font-semibold text-[#FFB20F]">
                          {formatAdminPrice(wallet.totalAvailable, user.tenantId)}
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                      <div>
                        <Label htmlFor="newDeposit">Add Deposit</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="newDeposit"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={newDeposit}
                            onChange={(e) => setNewDeposit(e.target.value)}
                          />
                          <Button 
                            onClick={handleAddDeposit}
                            disabled={addDepositMutation.isPending || !newDeposit}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Add
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="newCreditLimit">Change Credit Limit</Label>
                        <div className="flex space-x-2">
                          <Input
                            id="newCreditLimit"
                            type="number"
                            step="0.01"
                            placeholder={wallet.creditLimit}
                            value={newCreditLimit}
                            onChange={(e) => setNewCreditLimit(e.target.value)}
                          />
                          <Button 
                            onClick={handleUpdateCreditLimit}
                            disabled={updateCreditMutation.isPending || !newCreditLimit}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Update
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Company Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="w-5 h-5" />
                <span>Company Products - Custom Pricing</span>
              </CardTitle>
              <p className="text-sm text-[#6E6F71]">
                Manage which products this user can see and set custom prices for them.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {products.map((product: Product) => (
                  <div key={product.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{product.name}</h4>
                        <p className="text-sm text-gray-600">{product.description}</p>
                        <p className="text-xs text-gray-500">
                          Default Price: {formatAdminPrice(product.b2bPrice || product.price, user.tenantId)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label className="text-sm">Visible:</Label>
                        <input
                          type="checkbox"
                          checked={selectedProducts[product.id]?.visible ?? true}
                          onChange={(e) => setSelectedProducts(prev => ({
                            ...prev,
                            [product.id]: {
                              ...prev[product.id],
                              visible: e.target.checked,
                              price: prev[product.id]?.price || product.b2bPrice || product.price
                            }
                          }))}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Label className="text-sm">Custom Price:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={selectedProducts[product.id]?.price || product.b2bPrice || product.price}
                        onChange={(e) => setSelectedProducts(prev => ({
                          ...prev,
                          [product.id]: {
                            ...prev[product.id],
                            price: e.target.value,
                            visible: prev[product.id]?.visible ?? true
                          }
                        }))}
                        className="w-32"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleProductPricingUpdate(product.id)}
                        disabled={updateProductPricingMutation.isPending}
                        className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <History className="w-5 h-5" />
                <span>Transaction History</span>
              </CardTitle>
              <p className="text-sm text-[#6E6F71]">
                All wallet transactions including deposits, credit changes, purchases, and refunds.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No transactions found</p>
                ) : (
                  transactions.map((transaction: WalletTransaction) => (
                    <div key={transaction.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            transaction.type === 'deposit' ? 'default' :
                            transaction.type === 'payment' ? 'destructive' :
                            transaction.type === 'credit_limit' ? 'secondary' :
                            'outline'
                          }>
                            {transaction.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">
                            {transaction.amount > 0 ? '+' : ''}{formatAdminPrice(transaction.amount, user.tenantId)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{transaction.description}</p>
                        <p className="text-xs text-gray-500">
                          {transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Balance After:</p>
                        <p className="font-semibold">
                          {formatAdminPrice(transaction.balanceAfter, user.tenantId)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment History Tab */}
        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Payment History</span>
              </CardTitle>
              <p className="text-sm text-[#6E6F71]">
                Order payments and purchase history.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payments.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No payments found</p>
                ) : (
                  payments.map((payment: any) => (
                    <div key={payment.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant={payment.paymentStatus === 'paid' ? 'default' : 'destructive'}>
                            {payment.paymentStatus.toUpperCase()}
                          </Badge>
                          <span className="font-semibold">{payment.orderNumber}</span>
                        </div>
                        <span className="font-bold text-[#FFB20F]">
                          {formatAdminPrice(payment.finalAmount, user.tenantId)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Payment Method: {payment.paymentMethod}</p>
                        <p>Items: {payment.items?.length || 0}</p>
                        <p>Date: {new Date(payment.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}