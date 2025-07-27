import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Package, 
  Calendar, 
  CreditCard, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronRight,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Key
} from "lucide-react";
import { useEffect } from "react";

interface LicenseKey {
  id: string;
  productId: string;
  licenseKey: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    version: string;
    platform: string;
  };
}

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  licenseKeyId: string | null;
  product: {
    id: string;
    name: string;
    description: string;
    price: string;
    version: string;
    platform: string;
    region: string;
  };
  licenseKey: LicenseKey | null;
}

interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  billingInfo: {
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

const statusConfig = {
  pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
  processing: { color: "bg-blue-100 text-blue-800", icon: Clock },
  completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { color: "bg-red-100 text-red-800", icon: XCircle },
};

const paymentMethodLabels = {
  credit_card: "Credit Card",
  bank_transfer: "Bank Transfer", 
  purchase_order: "Purchase Order",
  wallet: "Wallet"
};

export default function OrdersPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading, error } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
    },
  });

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeys(new Set(copiedKeys).add(keyId));
      toast({
        title: "Copied to clipboard",
        description: "License key copied successfully",
      });
      setTimeout(() => {
        setCopiedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(keyId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy license key to clipboard",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const maskLicenseKey = (key: string) => {
    if (!key) return '';
    const parts = key.split('-');
    return parts.map((part, index) => {
      if (index === 0 || index === parts.length - 1) {
        return part;
      }
      return '*'.repeat(part.length);
    }).join('-');
  };

  if (isLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6E6F71] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to Load Orders</h3>
            <p className="text-red-600">There was an error loading your orders. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Orders</h1>
        <p className="text-gray-600">View your order history and download license keys</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Orders Yet</h3>
            <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
            <Button 
              onClick={() => window.location.href = '/'}
              className="bg-[#FFB20F] hover:bg-[#e69d0a] text-black"
            >
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const StatusIcon = statusConfig[order.status]?.icon || Clock;
            const isExpanded = expandedOrders.has(order.id);
            
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          Order #{order.orderNumber}
                        </CardTitle>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(order.createdAt)}
                          </div>
                          <div className="flex items-center">
                            <CreditCard className="w-4 h-4 mr-1" />
                            {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          €{parseFloat(order.totalAmount).toFixed(2)}
                        </div>
                        <Badge className={`${statusConfig[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleOrderExpansion(order.id)}
                        className="ml-4"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronRight className="w-4 h-4 mr-1" />
                            Show Details
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <Collapsible open={isExpanded}>
                  <CollapsibleContent>
                    <CardContent className="p-6">
                      {/* Billing Information */}
                      <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Billing Information</h3>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p><strong>Company:</strong> {order.billingInfo.companyName}</p>
                            <p><strong>Contact:</strong> {order.billingInfo.firstName} {order.billingInfo.lastName}</p>
                            <p><strong>Email:</strong> {order.billingInfo.email}</p>
                            <p><strong>Phone:</strong> {order.billingInfo.phone}</p>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">Billing Address</h3>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p>{order.billingInfo.address}</p>
                            <p>{order.billingInfo.city}, {order.billingInfo.postalCode}</p>
                            <p>{order.billingInfo.country}</p>
                          </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-4">Order Items</h3>
                        <div className="space-y-4">
                          {order.items.map((item) => (
                            <div key={item.id} className="border rounded-lg p-4 bg-white">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900">{item.product.name}</h4>
                                  <p className="text-sm text-gray-600 mt-1">{item.product.description}</p>
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                    <span>Version: {item.product.version}</span>
                                    <span>Platform: {item.product.platform}</span>
                                    <span>Region: {item.product.region}</span>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-sm text-gray-600">
                                    €{parseFloat(item.unitPrice).toFixed(2)} × {item.quantity}
                                  </div>
                                  <div className="font-semibold text-gray-900">
                                    €{parseFloat(item.totalPrice).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              {/* License Key Section */}
                              {item.licenseKey && (
                                <div className="border-t pt-3 mt-3 bg-yellow-50 rounded p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                      <Key className="w-4 h-4 text-[#FFB20F] mr-2" />
                                      <span className="font-medium text-gray-900">Digital License Key</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleKeyVisibility(item.licenseKey!.id)}
                                        className="text-xs"
                                      >
                                        {visibleKeys.has(item.licenseKey.id) ? (
                                          <>
                                            <EyeOff className="w-3 h-3 mr-1" />
                                            Hide
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="w-3 h-3 mr-1" />
                                            Show
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyToClipboard(item.licenseKey!.licenseKey, item.licenseKey!.id)}
                                        className="text-xs"
                                        disabled={copiedKeys.has(item.licenseKey!.id)}
                                      >
                                        {copiedKeys.has(item.licenseKey!.id) ? (
                                          <>
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Copied
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3 mr-1" />
                                            Copy
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="bg-white border rounded p-3 font-mono text-sm">
                                    {visibleKeys.has(item.licenseKey.id) 
                                      ? item.licenseKey.licenseKey 
                                      : maskLicenseKey(item.licenseKey.licenseKey)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-2">
                                    Generated: {formatDate(item.licenseKey.createdAt)}
                                    {item.licenseKey.usedAt && (
                                      <span className="ml-4">
                                        Activated: {formatDate(item.licenseKey.usedAt)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}