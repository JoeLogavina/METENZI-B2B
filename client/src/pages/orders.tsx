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
  ChevronDown, 
  ChevronRight,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Key,
  Download,
  Files,
  Home,
  ShoppingCart,
  Users,
  Settings,
  HelpCircle,
  FileText,
  Wallet
} from "lucide-react";
import { useEffect } from "react";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useLocation } from "wouter";

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
    platform: string;
  };
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
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export default function OrdersPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [location, setLocation] = useLocation();

  const {
    data: orders,
    error,
    isLoading: ordersLoading,
  } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">Failed to Load Orders</h3>
            <p className="text-sm text-gray-600 text-center">
              There was an error loading your orders. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  const copyAllKeys = async () => {
    if (!orders) return;
    
    const allKeys = orders.flatMap(order => 
      order.items
        .filter(item => item.licenseKey)
        .map(item => item.licenseKey!.licenseKey)
    );
    
    const keysText = allKeys.join('\n');
    
    try {
      await navigator.clipboard.writeText(keysText);
      toast({
        title: "Copied",
        description: `${allKeys.length} license keys copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy keys to clipboard",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    if (!orders) return;

    // Prepare data for Excel export
    const excelData: LicenseKeyTableRow[] = [];
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.licenseKey) {
          excelData.push({
            licenseKey: item.licenseKey.licenseKey,
            productTitle: item.product.name,
            price: `€${parseFloat(item.unitPrice).toFixed(2)}`,
            orderNumber: order.orderNumber,
            warranty: getWarrantyPeriod(item.licenseKey.createdAt),
            platform: item.product.platform,
            region: item.product.region,
            orderDate: formatDate(order.createdAt)
          });
        }
      });
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData, {
      header: ['licenseKey', 'productTitle', 'price', 'orderNumber', 'warranty', 'platform', 'region', 'orderDate']
    });

    // Set column headers
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['License Key', 'Product Title', 'Price', 'Order Number', 'Warranty', 'Platform', 'Region', 'Order Date']
    ], { origin: 'A1' });

    // Set column widths
    worksheet['!cols'] = [
      { width: 25 }, // License Key
      { width: 30 }, // Product Title
      { width: 10 }, // Price
      { width: 20 }, // Order Number
      { width: 15 }, // Warranty
      { width: 15 }, // Platform
      { width: 15 }, // Region
      { width: 15 }  // Order Date
    ];

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'License Keys');

    // Export file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `license-keys-${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Export Complete",
      description: "License keys exported to Excel file",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getWarrantyPeriod = (createdAt: string) => {
    const purchaseDate = new Date(createdAt);
    const warrantyEnd = new Date(purchaseDate);
    warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1); // 1 year warranty
    return formatDate(warrantyEnd.toISOString());
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (!orders || orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Package className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Orders Found</h3>
            <p className="text-sm text-gray-600 text-center">
              You haven't placed any orders yet. Start shopping to see your orders here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Count total license keys
  const totalKeys = orders.reduce((total, order) => 
    total + order.items.filter(item => item.licenseKey).length, 0
  );

  const sidebarItems = [
    { icon: Home, label: 'B2B SHOP', href: '/', active: location === '/' },
    { icon: Package, label: 'CATALOG', href: '/products', active: location === '/products' },
    { icon: FileText, label: 'ORDERS', href: '/orders', active: location === '/orders' },
    { icon: Wallet, label: 'MY WALLET', href: '/wallet', active: location === '/wallet' },
    { icon: Settings, label: 'SETTINGS', href: '/settings', active: location === '/settings' },
    { icon: HelpCircle, label: 'SUPPORT', href: '/support', active: location === '/support' },
  ];

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
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Orders</h1>
              <p className="text-gray-600">
                View your order history and access your digital license keys
              </p>
            </div>
            
            {totalKeys > 0 && (
              <div className="flex gap-2">
                <Button onClick={copyAllKeys} className="gap-2 bg-[#FFB20F] hover:bg-[#e09d0d] text-black">
                  <Files className="h-4 w-4" />
                  Copy All Keys ({totalKeys})
                </Button>
                <Button onClick={exportToExcel} className="gap-2 bg-[#6699CC] hover:bg-[#5588BB] text-white">
                  <Download className="h-4 w-4" />
                  Export to Excel
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.id} className="w-full">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-semibold">
                        Order {order.orderNumber}
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(order.createdAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4" />
                          {order.paymentMethod === 'wallet' ? 'Wallet' : 'Credit Card'}
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {order.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {order.status === 'cancelled' && <XCircle className="h-3 w-3 mr-1" />}
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                        <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                          {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div className="text-2xl font-bold text-[#FFB20F]">
                        €{parseFloat(order.totalAmount).toFixed(2)}
                      </div>
                      <Collapsible open={expandedOrders.has(order.id)} onOpenChange={() => toggleOrderExpansion(order.id)}>
                        <CollapsibleTrigger asChild>
                          <Button className="gap-2 bg-[#6699CC] hover:bg-[#5588BB] text-white px-3 py-1.5 text-sm">
                            <span>View Order Details</span>
                            {expandedOrders.has(order.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4">
                  {/* Billing Information */}
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <h4 className="font-semibold mb-2">Billing Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Company:</strong> {order.billingInfo.companyName}
                      </div>
                      <div>
                        <strong>Name:</strong> {order.billingInfo.firstName} {order.billingInfo.lastName}
                      </div>
                      <div>
                        <strong>Email:</strong> {order.billingInfo.email}
                      </div>
                      <div>
                        <strong>Phone:</strong> {order.billingInfo.phone}
                      </div>
                      <div className="col-span-2">
                        <strong>Address:</strong> {order.billingInfo.address}, {order.billingInfo.city}, {order.billingInfo.postalCode}, {order.billingInfo.country}
                      </div>
                    </div>
                  </div>

                  {/* License Keys Table */}
                  <div className="mb-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Digital License Keys
                    </h4>
                    
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm table-auto border-collapse">
                        <thead className="bg-[#6E6F71] text-white">
                          <tr>
                            <th className="text-left p-2 font-semibold">License Key</th>
                            <th className="text-left p-2 font-semibold">Product Title</th>
                            <th className="text-left p-2 font-semibold">Price</th>
                            <th className="text-left p-2 font-semibold">Order Number</th>
                            <th className="text-left p-2 font-semibold">Warranty</th>
                            <th className="text-left p-2 font-semibold">Platform</th>
                            <th className="text-left p-2 font-semibold">Region</th>
                            <th className="text-left p-2 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items
                            .filter(item => item.licenseKey)
                            .map((item, index) => (
                              <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'}>
                                <td className="p-2 font-mono text-xs border-r font-bold">
                                  {item.licenseKey!.licenseKey}
                                </td>
                                <td className="p-2 border-r">
                                  {item.product.name}
                                </td>
                                <td className="p-2 font-semibold text-[#FFB20F] border-r">
                                  €{parseFloat(item.unitPrice).toFixed(2)}
                                </td>
                                <td className="p-2 border-r">
                                  {order.orderNumber}
                                </td>
                                <td className="p-2 border-r">
                                  {getWarrantyPeriod(item.licenseKey!.createdAt)}
                                </td>
                                <td className="p-2 border-r">
                                  <Badge variant="secondary">{item.product.platform}</Badge>
                                </td>
                                <td className="p-2 border-r">
                                  <Badge variant="outline">{item.product.region}</Badge>
                                </td>
                                <td className="p-2">
                                  <Button
                                    size="sm"
                                    onClick={() => copyToClipboard(item.licenseKey!.licenseKey)}
                                    className="gap-1 bg-[#FFB20F] hover:bg-[#e09d0d] text-black"
                                  >
                                    <Copy className="h-3 w-3" />
                                    Copy
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Order Summary</h4>
                    <div className="space-y-2 text-sm">
                      {Object.entries(
                        order.items.reduce((acc, item) => {
                          const key = item.product.name;
                          if (!acc[key]) {
                            acc[key] = { quantity: 0, totalPrice: 0 };
                          }
                          acc[key].quantity += item.quantity;
                          acc[key].totalPrice += parseFloat(item.totalPrice);
                          return acc;
                        }, {} as Record<string, { quantity: number; totalPrice: number }>)
                      ).map(([productName, details]) => (
                        <div key={productName} className="flex justify-between">
                          <span>{productName} (x{details.quantity})</span>
                          <span className="font-semibold">€{details.totalPrice.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span className="text-[#FFB20F]">€{parseFloat(order.totalAmount).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}