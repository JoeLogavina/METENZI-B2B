import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Plus, Search, Eye, DollarSign, CreditCard, History, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WalletBalance {
  depositBalance: string;
  creditLimit: string;
  creditUsed: string;
  availableCredit: string;
  totalAvailable: string;
  isOverlimit: boolean;
}

interface WalletUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  tenantId: string;
  balance: WalletBalance;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  balanceAfter: string;
}

export default function WalletManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<WalletUser | null>(null);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [transactionType, setTransactionType] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Listen for automatic user selection from other components
  useEffect(() => {
    const handleSelectUser = (event: any) => {
      const { userId, userData } = event.detail || {};
      if (userId && userData) {
        // Convert userData to WalletUser format if needed
        const walletUserData: WalletUser = {
          id: userData.id,
          username: userData.username,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          role: userData.role,
          tenantId: userData.tenantId || 'eur',
          balance: {
            depositBalance: '0.00',
            creditLimit: '0.00', 
            creditUsed: '0.00',
            availableCredit: '0.00',
            totalAvailable: '0.00',
            isOverlimit: false
          }
        };
        setSelectedUser(walletUserData);
      }
    };
    window.addEventListener('select-wallet-user', handleSelectUser);
    return () => window.removeEventListener('select-wallet-user', handleSelectUser);
  }, []);

  // Fetch all users with wallet data
  const { data: walletUsers = [], isLoading: walletsLoading } = useQuery<WalletUser[]>({
    queryKey: ["/api/admin/wallets"],
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Fetch transactions for selected user
  const { data: userTransactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/wallets", selectedUser?.id, "transactions"],
    enabled: !!selectedUser,
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Add transaction mutation
  const addTransactionMutation = useMutation({
    mutationFn: async (transactionData: {
      userId: string;
      type: string;
      amount: string;
      description: string;
    }) => {
      const response = await apiRequest("/api/admin/wallets/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData)
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transaction added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/wallets", selectedUser?.id, "transactions"] });
      setShowTransactionDialog(false);
      setTransactionType("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add transaction",
        variant: "destructive",
      });
    },
  });

  // Format currency based on user's tenant
  const formatCurrency = (amount: string, userTenantId?: string) => {
    const numAmount = parseFloat(amount).toFixed(2);
    
    // Use tenant-specific currency formatting
    if (userTenantId === 'km') {
      return `${numAmount} KM`;
    } else {
      return `€${numAmount}`;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100 text-green-800';
      case 'payment':
        return 'bg-red-100 text-red-800';
      case 'credit_limit':
        return 'bg-blue-100 text-blue-800';
      case 'credit_payment':
        return 'bg-purple-100 text-purple-800';
      case 'refund':
        return 'bg-yellow-100 text-yellow-800';
      case 'adjustment':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSubmitTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const amount = formData.get('amount') as string;
    const description = formData.get('description') as string;

    if (!transactionType || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields with valid values",
        variant: "destructive",
      });
      return;
    }

    addTransactionMutation.mutate({
      userId: selectedUser.id,
      type: transactionType,
      amount: amount,
      description: description || `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} transaction`,
    });
  };

  const filteredUsers = walletUsers.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">WALLET MANAGEMENT</h3>
          <p className="text-[#6E6F71]">Manage B2B user wallets, deposits, and credit limits</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 min-w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Wallets Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-[#FFB20F]" />
              B2B Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {walletsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFB20F] mx-auto"></div>
                <p className="mt-2 text-[#6E6F71]">Loading wallets...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Users Found</h3>
                <p className="text-gray-600">No B2B users match your search criteria.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className={`p-4 cursor-pointer transition-colors duration-200 ${
                      selectedUser?.id === user.id ? 'bg-[#FFB20F]/10 border-l-4 border-l-[#FFB20F]' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#6E6F71] rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {user.firstName?.charAt(0) || user.username?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-[#6E6F71]">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-600">@{user.username}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#FFB20F]">
                          {formatCurrency(user.balance?.totalAvailable || "0", user.tenantId)}
                        </p>
                        <p className="text-xs text-gray-500">Available</p>
                      </div>
                    </div>
                    {user.balance?.isOverlimit && (
                      <div className="mt-2">
                        <Badge className="bg-red-100 text-red-800 text-xs">
                          Over Credit Limit
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Details & Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-[#FFB20F]" />
                {selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : 'Select User'}
              </span>
              {selectedUser && (
                <Button
                  onClick={() => setShowTransactionDialog(true)}
                  className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedUser ? (
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No User Selected</h3>
                <p className="text-gray-600">Select a user from the list to view their wallet details.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Balance Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Deposit Balance</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(selectedUser.balance?.depositBalance || "0", selectedUser.tenantId)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Available Credit</p>
                        <p className="text-lg font-semibold text-blue-600">
                          {formatCurrency(selectedUser.balance?.availableCredit || "0", selectedUser.tenantId)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-[#FFB20F]/10 p-4 rounded-lg">
                    <div className="flex items-center">
                      <Wallet className="w-5 h-5 text-[#FFB20F] mr-2" />
                      <div>
                        <p className="text-sm font-medium text-[#6E6F71]">Total Available</p>
                        <p className="text-lg font-semibold text-[#FFB20F]">
                          {formatCurrency(selectedUser.balance?.totalAvailable || "0", selectedUser.tenantId)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <CreditCard className="w-5 h-5 text-gray-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Credit Limit</p>
                        <p className="text-lg font-semibold text-gray-600">
                          {formatCurrency(selectedUser.balance?.creditLimit || "0", selectedUser.tenantId)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div>
                  <h4 className="font-medium text-[#6E6F71] mb-3 flex items-center">
                    <History className="w-4 h-4 mr-2" />
                    Recent Transactions
                  </h4>
                  {transactionsLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FFB20F] mx-auto"></div>
                    </div>
                  ) : userTransactions.length === 0 ? (
                    <p className="text-gray-600 text-sm">No transactions found</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {userTransactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <Badge className={getTransactionTypeColor(transaction.type)}>
                              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1).replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-gray-600 truncate max-w-[150px]">
                              {transaction.description}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${
                              transaction.type === 'deposit' || transaction.type === 'refund' 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {transaction.type === 'deposit' || transaction.type === 'refund' ? '+' : '-'}
                              {formatCurrency(transaction.amount, selectedUser.tenantId)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(transaction.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTransaction} className="space-y-4">
            <div>
              <Label htmlFor="user">User</Label>
              <Input
                id="user"
                value={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : ''}
                disabled
              />
            </div>
            
            <div>
              <Label htmlFor="type">Transaction Type</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transaction type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="credit_limit">Set Credit Limit</SelectItem>
                  <SelectItem value="credit_payment">Credit Payment</SelectItem>
                  <SelectItem value="adjustment">Balance Adjustment</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="amount">Amount (€)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Transaction description (optional)"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTransactionDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addTransactionMutation.isPending}
                className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
              >
                {addTransactionMutation.isPending ? 'Adding...' : 'Add Transaction'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}