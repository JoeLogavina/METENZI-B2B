import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, Users, Mail, Phone, MapPin, Calendar, ArrowLeft, DollarSign } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
  vatOrRegistrationNo?: string;
  branchType: 'main' | 'branch';
  branchName?: string;
  branchCode?: string;
  parentCompanyId?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserDetailViewProps {
  userId: string;
  onBack: () => void;
  onViewBranches: () => void;
}

export function UserDetailView({ userId, onBack, onViewBranches }: UserDetailViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');
  const [newDeposit, setNewDeposit] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');

  // Listen for wallet tab navigation
  useEffect(() => {
    const handleWalletTabSwitch = () => {
      setActiveTab('wallet');
    };
    window.addEventListener('set-user-wallet-tab', handleWalletTabSwitch);
    return () => window.removeEventListener('set-user-wallet-tab', handleWalletTabSwitch);
  }, []);
  
  const { data: user, isLoading } = useQuery<{ data: User }>({
    queryKey: ['admin', 'users', userId],
    queryFn: () => apiRequest(`/api/admin/users/${userId}`)
  });

  // Fetch wallet data for this user
  const { data: walletData, isLoading: walletLoading } = useQuery<any>({
    queryKey: ["/api/admin/wallets", userId, "transactions"],
    queryFn: () => apiRequest(`/api/admin/users/${userId}/wallet`),
    enabled: activeTab === 'wallet'
  });

  // Add deposit mutation
  const addDepositMutation = useMutation({
    mutationFn: async (amount: string) => {
      return apiRequest('/api/admin/wallets/transaction', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId,
          type: 'deposit',
          amount: parseFloat(amount),
          description: `Admin deposit: €${amount}`
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Deposit Added",
        description: `€${newDeposit} has been added to the user's wallet.`,
      });
      setNewDeposit('');
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallets"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add deposit",
        variant: "destructive",
      });
    }
  });

  // Update credit limit mutation
  const updateCreditMutation = useMutation({
    mutationFn: async (creditLimit: string) => {
      return apiRequest(`/api/admin/users/${userId}/credit-limit`, {
        method: 'PUT',
        body: JSON.stringify({
          creditLimit: parseFloat(creditLimit)
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Credit Limit Updated",
        description: `Credit limit updated to €${newCreditLimit}`,
      });
      setNewCreditLimit('');
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallets"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update credit limit",
        variant: "destructive",
      });
    }
  });

  const handleAddDeposit = () => {
    if (newDeposit && parseFloat(newDeposit) > 0) {
      addDepositMutation.mutate(newDeposit);
    }
  };

  const handleUpdateCreditLimit = () => {
    if (newCreditLimit && parseFloat(newCreditLimit) >= 0) {
      updateCreditMutation.mutate(newCreditLimit);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading user details...</div>;
  }

  if (!user?.data) {
    return <div className="p-6">User not found</div>;
  }

  const userData = user.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">User Details</h2>
            <p className="text-gray-600">{userData.username}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {userData.branchType === 'main' && (
            <Button
              onClick={onViewBranches}
              className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
            >
              <Users className="h-4 w-4 mr-2" />
              View Branches
            </Button>
          )}
          <Badge variant={userData.isActive ? "default" : "secondary"}>
            {userData.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-6 mt-6">

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <Label className="text-sm font-medium text-gray-600">Username</Label>
            <p className="font-semibold">{userData.username}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Email</Label>
            <p className="font-semibold">{userData.email || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Role</Label>
            <Badge variant="outline">{userData.role}</Badge>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">First Name</Label>
            <p className="font-semibold">{userData.firstName || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Last Name</Label>
            <p className="font-semibold">{userData.lastName || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Account Type</Label>
            <Badge variant={userData.branchType === 'main' ? "default" : "secondary"}>
              {userData.branchType === 'main' ? 'Main Company' : 'Branch'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <Label className="text-sm font-medium text-gray-600">Company Name</Label>
            <p className="font-semibold">{userData.companyName || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Contact Person</Label>
            <p className="font-semibold">{userData.contactPerson || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">VAT/Registration No</Label>
            <p className="font-semibold">{userData.vatOrRegistrationNo || 'N/A'}</p>
          </div>
          {userData.branchType === 'branch' && (
            <>
              <div>
                <Label className="text-sm font-medium text-gray-600">Branch Name</Label>
                <p className="font-semibold">{userData.branchName || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Branch Code</Label>
                <p className="font-semibold">{userData.branchCode || 'N/A'}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <Label className="text-sm font-medium text-gray-600">Phone</Label>
            <p className="font-semibold">{userData.phone || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Country</Label>
            <p className="font-semibold">{userData.country || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">City</Label>
            <p className="font-semibold">{userData.city || 'N/A'}</p>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Label className="text-sm font-medium text-gray-600">Address</Label>
            <p className="font-semibold">{userData.address || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium text-gray-600">Created At</Label>
            <p className="font-semibold">{new Date(userData.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Last Updated</Label>
            <p className="font-semibold">{new Date(userData.updatedAt).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6 mt-6">
          {walletLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F] mx-auto"></div>
                <p className="text-center mt-2 text-[#6E6F71]">Loading wallet data...</p>
              </CardContent>
            </Card>
          ) : walletData?.data ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[#6E6F71] flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Wallet & Credit Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Deposit Balance</Label>
                    <div className="text-2xl font-bold text-green-600">
                      €{walletData.data.depositBalance}
                    </div>
                  </div>
                  <div>
                    <Label>Credit Limit</Label>
                    <div className="text-2xl font-bold text-blue-600">
                      €{walletData.data.creditLimit}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Credit Used</Label>
                    <div className="text-2xl font-bold text-red-600">
                      €{walletData.data.creditUsed}
                    </div>
                  </div>
                  <div>
                    <Label>Total Available</Label>
                    <div className="text-2xl font-bold text-[#FFB20F]">
                      €{walletData.data.balance?.totalAvailable || '0.00'}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <Label>Add Deposit</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        value={newDeposit}
                        onChange={(e) => setNewDeposit(e.target.value)}
                      />
                      <Button 
                        onClick={handleAddDeposit}
                        disabled={addDepositMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Change Credit Limit</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder={walletData.data.creditLimit}
                        value={newCreditLimit}
                        onChange={(e) => setNewCreditLimit(e.target.value)}
                      />
                      <Button 
                        onClick={handleUpdateCreditLimit}
                        disabled={updateCreditMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-[#6E6F71]">No wallet data available for this user.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}