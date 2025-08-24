import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Package, 
  Calendar, 
  CreditCard, 
  ChevronDown, 
  ChevronRight,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Key,
  Download,
  Files,
  ShoppingCart
} from "lucide-react";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface LicenseKey {
  id: string;
  keyValue: string;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

interface LicenseKeyTableRow {
  licenseKey: string;
  productTitle: string;
  price: string;
  orderNumber: string;
  warranty: string;
  platform: string;
  region: string;
  orderDate: string;
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
    platform: string;
    region: string;
  };
  licenseKey: LicenseKey | null;
}

interface Order {
  id: string;
  userId: string;
  tenantId: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  taxAmount: string;
  finalAmount: string;
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
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export default function OrdersManagement() {
  const { toast } = useToast();
  const { formatPrice } = useTenant();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Fetch all orders for admin view
  const {
    data: orders,
    error,
    isLoading: ordersLoading,
  } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Helper functions
  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "License key copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const copyOrderKeys = async (order: Order) => {
    const orderKeys = order.items
      .filter(item => item.licenseKey)
      .map(item => item.licenseKey!.keyValue);
    
    const keysText = orderKeys.join('\n');
    
    try {
      await navigator.clipboard.writeText(keysText);
      toast({
        title: "Keys Copied",
        description: `${orderKeys.length} license keys from order ${order.orderNumber} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy keys to clipboard",
        variant: "destructive",
      });
    }
  };

  const exportOrderToExcel = (order: Order) => {
    const excelData: LicenseKeyTableRow[] = [];
    
    order.items.forEach(item => {
      if (item.licenseKey) {
        excelData.push({
          licenseKey: item.licenseKey.keyValue,
          productTitle: item.product.name,
          price: formatPrice(parseFloat(item.unitPrice)),
          orderNumber: order.orderNumber,
          warranty: getWarrantyPeriod(item.licenseKey.createdAt),
          platform: item.product.platform,
          region: item.product.region,
          orderDate: formatDateTime(order.createdAt)
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData, {
      header: ['licenseKey', 'productTitle', 'price', 'orderNumber', 'warranty', 'platform', 'region', 'orderDate']
    });

    XLSX.utils.sheet_add_aoa(worksheet, [
      ['License Key', 'Product Title', 'Price', 'Order Number', 'Warranty', 'Platform', 'Region', 'Order Date']
    ], { origin: 'A1' });

    worksheet['!cols'] = [
      { width: 25 }, { width: 30 }, { width: 10 }, { width: 20 },
      { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Order ${order.orderNumber}`);

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `order-${order.orderNumber}-keys.xlsx`);

    toast({
      title: "Export Complete",
      description: `${excelData.length} license keys from order ${order.orderNumber} exported to Excel`,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getWarrantyPeriod = (createdAt: string) => {
    const createdDate = new Date(createdAt);
    const warrantyEnd = new Date(createdDate);
    warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);
    return `${formatDate(createdAt)} - ${formatDate(warrantyEnd.toISOString())}`;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <XCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">Failed to Load Orders</h3>
          <p className="text-sm text-gray-600 text-center">
            There was an error loading orders. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Package className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Orders Found</h3>
          <p className="text-sm text-gray-600 text-center">
            No orders have been placed yet. Orders will appear here once customers start shopping.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#6E6F71] uppercase tracking-[0.5px]">ORDERS MANAGEMENT</h3>
          <p className="text-[#6E6F71]">Manage customer orders and license keys</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {orders.length} Total Orders
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} className="border-[#d1d5db] shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="h-5 w-5 text-[#6E6F71]" />
                    <span className="font-semibold text-[#6E6F71]">Order #{order.orderNumber}</span>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                  <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                    {order.paymentStatus}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{formatDate(order.createdAt)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleOrderExpansion(order.id)}
                    className="text-[#6E6F71] hover:text-[#FFB20F]"
                  >
                    {expandedOrders.has(order.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <p className="text-[#6E6F71]">
                    <span className="font-medium">Customer:</span> {order.billingInfo.firstName} {order.billingInfo.lastName}
                  </p>
                  <p className="text-[#6E6F71]">
                    <span className="font-medium">Company:</span> {order.billingInfo.companyName}
                  </p>
                  <p className="text-[#6E6F71]">
                    <span className="font-medium">Email:</span> {order.billingInfo.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#FFB20F]">{formatPrice(parseFloat(order.finalAmount))}</p>
                  <p className="text-sm text-gray-500">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardHeader>

            <Collapsible open={expandedOrders.has(order.id)}>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="border-t pt-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-[#6E6F71]">Order Items & License Keys</h4>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyOrderKeys(order)}
                          className="text-[#6E6F71] hover:text-[#FFB20F] border-[#6E6F71] hover:border-[#FFB20F]"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy All Keys
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportOrderToExcel(order)}
                          className="text-[#6E6F71] hover:text-[#FFB20F] border-[#6E6F71] hover:border-[#FFB20F]"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export Excel
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h5 className="font-medium text-[#6E6F71] mb-1">{item.product.name}</h5>
                              <p className="text-sm text-gray-600 mb-2">{item.product.description}</p>
                              <div className="flex gap-4 text-sm text-gray-500">
                                <span>Platform: {item.product.platform}</span>
                                <span>Region: {item.product.region}</span>
                                <span>Qty: {item.quantity}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-[#FFB20F]">{formatPrice(parseFloat(item.totalPrice))}</p>
                              <p className="text-sm text-gray-500">{formatPrice(parseFloat(item.unitPrice))} each</p>
                            </div>
                          </div>

                          {item.licenseKey && (
                            <div className="border-t pt-3 mt-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <Key className="h-4 w-4 text-[#6E6F71]" />
                                  <span className="text-sm font-medium text-[#6E6F71]">License Key:</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(item.licenseKey!.keyValue)}
                                  className="text-[#6E6F71] hover:text-[#FFB20F]"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="font-mono text-sm bg-white p-2 rounded mt-1 border">
                                {item.licenseKey.keyValue}
                              </p>
                              <div className="text-xs text-gray-500 mt-1">
                                Issued: {formatDateTime(item.licenseKey.createdAt)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <h5 className="font-medium text-[#6E6F71] mb-2">Billing Information</h5>
                          <div className="space-y-1 text-gray-600">
                            <p>{order.billingInfo.firstName} {order.billingInfo.lastName}</p>
                            <p>{order.billingInfo.companyName}</p>
                            <p>{order.billingInfo.email}</p>
                            <p>{order.billingInfo.phone}</p>
                            <p>{order.billingInfo.address}</p>
                            <p>{order.billingInfo.city}, {order.billingInfo.country}</p>
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium text-[#6E6F71] mb-2">Payment Details</h5>
                          <div className="space-y-1 text-gray-600">
                            <p>Method: {order.paymentMethod}</p>
                            <p>Subtotal: {formatPrice(parseFloat(order.totalAmount))}</p>
                            <p>Tax: {formatPrice(parseFloat(order.taxAmount))}</p>
                            <p className="font-semibold text-[#FFB20F]">
                              Total: {formatPrice(parseFloat(order.finalAmount))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
}