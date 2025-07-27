import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, CreditCard, History, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";

interface WalletBalance {
  depositBalance: string;
  creditLimit: string;
  creditUsed: string;
  availableCredit: string;
  totalAvailable: string;
  isOverlimit: boolean;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  balanceAfter: string;
}

interface WalletData {
  id: string;
  userId: string;
  depositBalance: string;
  creditLimit: string;
  creditUsed: string;
  isActive: boolean;
  balance: WalletBalance;
  recentTransactions: WalletTransaction[];
}

export default function WalletPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");

  const { data: walletData, isLoading, error } = useQuery<{ data: WalletData }>({
    queryKey: ["/api/wallet"],
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f6f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFB20F]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f6f5] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Wallet</h2>
          <p className="text-gray-600">Unable to load wallet information. Please try again later.</p>
        </div>
      </div>
    );
  }

  const wallet = walletData?.data;
  if (!wallet) {
    return (
      <div className="min-h-screen bg-[#f5f6f5] flex items-center justify-center">
        <div className="text-center">
          <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Wallet Found</h2>
          <p className="text-gray-600">Your wallet is being set up. Please contact support if this persists.</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: string) => `€${parseFloat(amount).toFixed(2)}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Deposit';
      case 'payment': return 'Payment';
      case 'credit_limit': return 'Credit Limit';
      case 'credit_payment': return 'Credit Payment';
      case 'refund': return 'Refund';
      case 'adjustment': return 'Adjustment';
      default: return type;
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'deposit': return 'bg-green-100 text-green-800';
      case 'payment': return 'bg-red-100 text-red-800';
      case 'credit_limit': return 'bg-blue-100 text-blue-800';
      case 'credit_payment': return 'bg-purple-100 text-purple-800';
      case 'refund': return 'bg-green-100 text-green-800';
      case 'adjustment': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f5] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Wallet className="w-8 h-8 text-[#FFB20F]" />
            <h1 className="text-3xl font-bold text-[#6E6F71]">My Wallet</h1>
          </div>
          <p className="text-gray-600">Manage your deposits, credit, and payment history</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6">
          <Button
            variant={activeTab === "overview" ? "default" : "outline"}
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 ${
              activeTab === "overview" 
                ? "bg-[#FFB20F] hover:bg-[#e6a00e] text-white" 
                : "border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
            }`}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === "transactions" ? "default" : "outline"}
            onClick={() => setActiveTab("transactions")}
            className={`px-4 py-2 ${
              activeTab === "transactions" 
                ? "bg-[#FFB20F] hover:bg-[#e6a00e] text-white" 
                : "border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            Transactions
          </Button>
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Deposit Balance */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Deposit Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(wallet.balance.depositBalance)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Available from deposits</p>
              </CardContent>
            </Card>

            {/* Credit Limit */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Credit Limit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(wallet.balance.creditLimit)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Maximum credit allowed</p>
              </CardContent>
            </Card>

            {/* Available Credit */}
            <Card className="border-l-4 border-l-[#FFB20F]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Available Credit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#FFB20F]">
                  {formatCurrency(wallet.balance.availableCredit)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Credit remaining</p>
              </CardContent>
            </Card>

            {/* Total Available */}
            <Card className="border-l-4 border-l-[#6E6F71]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Available</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#6E6F71]">
                  {formatCurrency(wallet.balance.totalAvailable)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Total purchasing power</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Credit Status Warning */}
        {wallet.balance.isOverlimit && (
          <Card className="border-l-4 border-l-red-500 bg-red-50 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                <div>
                  <h3 className="font-semibold text-red-800">Credit Limit Exceeded</h3>
                  <p className="text-red-700">
                    You have used {formatCurrency(wallet.balance.creditUsed)} of your {formatCurrency(wallet.balance.creditLimit)} credit limit.
                    Please contact your account manager to arrange payment.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "transactions" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="w-5 h-5 mr-2" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                Your latest wallet activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wallet.recentTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Transactions</h3>
                  <p className="text-gray-600">No transactions found in your wallet history.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallet.recentTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(transaction.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getTransactionTypeColor(transaction.type)}>
                            {getTransactionTypeLabel(transaction.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transaction.description || "-"}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${
                          transaction.type === 'deposit' || transaction.type === 'refund' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {transaction.type === 'deposit' || transaction.type === 'refund' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(transaction.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}