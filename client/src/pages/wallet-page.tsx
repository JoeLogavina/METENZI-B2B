import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Wallet, CreditCard, History, DollarSign, TrendingUp, AlertTriangle, Package, Grid, Users, FileText, BarChart3, Settings, HelpCircle, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

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
  const { user, isLoading: authLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: walletData, isLoading, error } = useQuery<{ data: WalletData }>({
    queryKey: ["/api/wallet"],
    enabled: !!user?.id,
  });

  const sidebarItems = [
    { icon: Package, label: "B2B SHOP", active: false, href: "/", allowed: true },
    { icon: Grid, label: "CATALOG", active: false, href: "/catalog", allowed: true },
    { icon: Users, label: "CLIENTS", active: false, href: "/clients", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: FileText, label: "ORDERS", active: false, href: "/orders", allowed: true },
    { icon: CreditCard, label: "MY WALLET", active: true, href: "/wallet", allowed: true },
    { icon: BarChart3, label: "REPORTS", active: false, href: "/reports", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: CreditCard, label: "INVOICES", active: false, href: "/invoices", allowed: user?.role === 'admin' || user?.role === 'super_admin' },
    { icon: Settings, label: "SETTINGS", active: false, href: "/settings", allowed: true },
    { icon: HelpCircle, label: "SUPPORT", active: false, href: "/support", allowed: true },
  ].filter(item => item.allowed);

  if (!isAuthenticated) {
    return null;
  }

  const wallet = walletData?.data;

  const formatCurrency = (amount: string) => {
    return `€${parseFloat(amount).toFixed(2)}`;
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

  return (
    <div className="min-h-screen bg-[#f5f6f5] flex font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Sidebar */}
      <div className="w-64 text-white flex-shrink-0 bg-[#404040]">
        <div className="p-4 border-b border-[#5a5b5d]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#FFB20F] rounded flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-[0.5px]">B2B PORTAL</h2>
              <p className="text-xs text-gray-300 uppercase tracking-[0.5px]">ENTERPRISE</p>
            </div>
          </div>
        </div>
        
        <nav className="mt-4">
          {sidebarItems.map((item, index) => (
            <div
              key={index}
              className={`flex items-center px-4 py-3 text-lg transition-colors duration-200 cursor-pointer ${
                item.active 
                  ? 'bg-[#FFB20F] text-white border-r-2 border-[#e6a00e]' 
                  : 'text-white hover:bg-[#7a7b7d]'
              }`}
              onClick={() => {
                console.log('Sidebar item clicked:', item.label, 'href:', item.href);
                setLocation(item.href);
              }}
            >
              <item.icon className="w-6 h-6 mr-3" />
              <span className="uppercase tracking-[0.5px] font-medium text-sm">{item.label}</span>
            </div>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-[#5a5b5d]">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.firstName?.charAt(0) || user?.username?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.firstName || user?.username}
              </p>
              <p className="text-xs text-gray-300 truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={logout}
            disabled={isLoggingOut}
            className="w-full bg-[#E15554] hover:bg-[#c74443] text-white border-0 px-4 py-2 rounded-[5px] font-medium transition-colors duration-200"
          >
            {isLoggingOut ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-2" />
                LOGOUT
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Wallet className="w-8 h-8 text-[#FFB20F]" />
              <div>
                <h1 className="text-2xl font-bold text-[#6E6F71] uppercase tracking-[0.5px]">MY WALLET</h1>
                <p className="text-sm text-gray-600">Manage your wallet balance and transactions</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.firstName || user?.username}!</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFB20F]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Wallet</h2>
              <p className="text-gray-600">Unable to load wallet information. Please try again later.</p>
            </div>
          ) : !wallet ? (
            <div className="text-center py-8">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No Wallet Found</h2>
              <p className="text-gray-600">Your wallet is being set up. Please contact support if this persists.</p>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="mb-6">
                <nav className="flex space-x-8 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                      activeTab === "overview"
                        ? "border-[#FFB20F] text-[#FFB20F]"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm uppercase tracking-[0.5px] ${
                      activeTab === "transactions"
                        ? "border-[#FFB20F] text-[#FFB20F]"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Transaction History
                  </button>
                </nav>
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
                          {new Date(transaction.createdAt).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell>
                          <Badge className={getTransactionTypeColor(transaction.type)}>
                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1).replace('_', ' ')}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}