import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useWallet, emitWalletEvent } from "@/contexts/WalletContext";
import { useTenant } from "@/contexts/TenantContext";
import { useOptimisticOrders } from "@/hooks/use-orders-optimistic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ShoppingCart, 
  CreditCard, 
  ArrowLeft, 
  CheckCircle, 
  Package, 
  MapPin, 
  User, 
  Mail, 
  Phone,
  Building,
  Banknote,
  FileText,
  Wallet
} from "lucide-react";
import { Link, useLocation } from "wouter";

interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: string;
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    priceKm?: number;
    region: string;
    platform: string;
    stockCount: number;
  };
}

const checkoutSchema = z.object({
  // Billing Information
  companyName: z.string().min(1, "Company name is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  
  // Billing Address
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  
  // Payment Information
  paymentMethod: z.enum(["credit_card", "bank_transfer", "purchase_order", "wallet"]),
  
  // Optional fields for different payment methods
  cardNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  cvv: z.string().optional(),
  cardHolderName: z.string().optional(),
  poNumber: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { formatPrice, tenant } = useTenant();
  const { updateOrderOptimistically } = useOptimisticOrders();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<'checkout' | 'processing' | 'success'>('checkout');
  const [orderNumber, setOrderNumber] = useState<string>('');

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      companyName: user?.companyName || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      city: user?.city || "",
      postalCode: "",
      country: user?.country || "",
      paymentMethod: "credit_card",
      cardNumber: "",
      expiryDate: "",
      cvv: "",
      cardHolderName: "",
      poNumber: "",
    },
  });

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

  // Update form values when user data loads
  useEffect(() => {
    if (user && !isLoading) {
      form.reset({
        companyName: user.companyName || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
        city: user.city || "",
        postalCode: "",
        country: user.country || "",
        paymentMethod: "credit_card",
        cardNumber: "",
        expiryDate: "",
        cvv: "",
        cardHolderName: "",
        poNumber: "",
      });
    }
  }, [user, isLoading, form]);

  // Fetch cart items
  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart"],
    enabled: isAuthenticated,
  });

  // Use unified wallet system
  const { balance, formatCurrency, hasInsufficientBalance, isLoading: walletLoading } = useWallet();
  
  // Debug wallet state
  useEffect(() => {
    console.log('🛒 Checkout wallet state:', {
      walletLoading,
      hasBalance: !!balance,
      balance: balance,
      isAuthenticated,
      userId: user?.id
    });
  }, [walletLoading, balance, isAuthenticated, user?.id]);

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: CheckoutFormData) => {
      
      const orderPayload = {
        billingInfo: {
          companyName: orderData.companyName,
          firstName: orderData.firstName,
          lastName: orderData.lastName,
          email: orderData.email,
          phone: orderData.phone,
          address: orderData.address,
          city: orderData.city,
          postalCode: orderData.postalCode,
          country: orderData.country,
        },
        paymentMethod: orderData.paymentMethod,
        paymentDetails: {
          cardNumber: orderData.cardNumber,
          expiryDate: orderData.expiryDate,
          cvv: orderData.cvv,
          cardHolderName: orderData.cardHolderName,
          poNumber: orderData.poNumber,
        },
      };
      
      
      const result = await apiRequest("POST", "/api/orders", orderPayload);
      console.log('🚀 Order creation response:', result);
      return result;
    },
    onSuccess: (order) => {
      setOrderNumber(order.orderNumber);
      setStep('success');
      
      // Optimistic UI update: immediately show order completion
      if (order.items) {
        updateOrderOptimistically({
          orderId: order.id,
          licenseKeys: order.items.map((item: any) => ({
            id: item.licenseKeyId || `temp-${Date.now()}-${Math.random()}`,
            licenseKey: item.licenseKey?.licenseKey || `KEY-${Date.now()}`,
            productName: item.product?.name || 'Unknown Product'
          }))
        });
      }
      
      // Invalidate all related caches for real-time updates
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      
      // Force refetch orders immediately
      queryClient.refetchQueries({ queryKey: ["/api/orders"] });
      
      // Emit order completion event to trigger wallet refresh
      emitWalletEvent('order:completed', { 
        orderId: order.id, 
        orderNumber: order.orderNumber,
        amount: order.finalAmount,
        paymentMethod: order.paymentMethod
      });
      
      toast({
        title: "Order Placed Successfully",
        description: `Your order #${order.orderNumber} has been placed`,
      });
    },
    onError: (error) => {
      console.error("Order creation error:", error);
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
      const errorMessage = error?.message || "Failed to place order. Please try again.";
      toast({
        title: "Order Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setStep('checkout');
    },
  });

  const onSubmit = (data: CheckoutFormData) => {
    if (cartItems.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Your cart is empty. Add some items to proceed.",
        variant: "destructive",
      });
      return;
    }

    // Check wallet balance if wallet payment is selected
    if (data.paymentMethod === 'wallet') {
      if (hasInsufficientBalance(finalAmount)) {
        const availableBalance = balance ? parseFloat(balance.totalAvailable) : 0;
        toast({
          title: "Insufficient Balance",
          description: `Your wallet balance (${formatCurrency(availableBalance)}) is insufficient for this order (${formatCurrency(finalAmount)}). Please add funds or use another payment method.`,
          variant: "destructive",
        });
        return;
      }
    }
    
    setStep('processing');
    // Simulate processing time
    setTimeout(() => {
      placeOrderMutation.mutate(data);
    }, 2000);
  };

  // TENANT-AWARE PRICING CALCULATION
  const getTenantPrice = (product: CartItem['product']): number => {
    if (tenant.currency === 'KM' && product.priceKm) {
      return typeof product.priceKm === 'string' ? parseFloat(product.priceKm) : product.priceKm;
    }
    return typeof product.price === 'string' ? parseFloat(product.price) : product.price;
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + (getTenantPrice(item.product) * item.quantity), 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const taxAmount = totalAmount * 0.21;
  const finalAmount = totalAmount + taxAmount;

  // Redirect to cart if empty
  useEffect(() => {
    if (!cartLoading && cartItems.length === 0 && step === 'checkout') {
      setLocation('/cart');
    }
  }, [cartItems.length, cartLoading, step, setLocation]);

  if (isLoading || cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f5]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4D9DE0] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Processing step
  if (step === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f5]">
        <Card className="w-96 bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4D9DE0] mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-[#4D585A] mb-2">Processing Your Order</h2>
            <p className="text-gray-600">Please wait while we process your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success step
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f6f5]">
        <Card className="w-96 bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-[#4D585A] mb-2">Order Successful!</h2>
            <p className="text-gray-600 mb-4">
              Your order #{orderNumber} has been placed successfully.
            </p>
            <div className="space-y-3">
              <Link href="/b2b-shop">
                <Button className="w-full bg-[#4D9DE0] hover:bg-[#3ba3e8] text-white rounded-[5px] font-medium transition-colors duration-200">
                  Continue Shopping
                </Button>
              </Link>
              <Link href="/orders">
                <Button
                  variant="outline"
                  className="w-full border-[#ddd] text-gray-700 hover:bg-[#f8f8f8] rounded-[5px] font-medium transition-colors duration-200"
                >
                  View Orders
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main checkout form
  return (
    <div className="min-h-screen bg-[#f5f6f5] font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]">
      {/* Header */}
      <header className="bg-[#4D585A] text-white px-6 py-4 shadow-[0_2px_5px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/cart">
              <Button variant="ghost" size="sm" className="text-white hover:bg-[#5a6668] rounded-[5px] transition-colors duration-200">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Cart
              </Button>
            </Link>
            <div className="border-l border-[#3a4446] pl-4">
              <CreditCard className="w-6 h-6 mr-3 inline" />
              <h1 className="text-2xl font-semibold uppercase tracking-[0.5px] inline">Checkout</h1>
            </div>
          </div>
          <div className="text-sm">
            <span className="font-mono font-medium">{totalItems}</span> items • {formatPrice(finalAmount)}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            <Form {...form}>
              <div className="space-y-6">
                {/* Billing Information */}
                <Card className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] border-[#ddd]">
                  <CardHeader className="bg-[#0077B6] text-white rounded-t-[8px] py-3">
                    <CardTitle className="flex items-center text-lg font-semibold uppercase tracking-[0.5px]">
                      <Building className="w-5 h-5 mr-2" />
                      Billing Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-gray-700">Company Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                  placeholder="Enter company name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">First Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                placeholder="Enter first name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Last Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                placeholder="Enter last name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Email</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                placeholder="Enter email address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Phone</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                placeholder="Enter phone number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Billing Address */}
                <Card className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] border-[#ddd]">
                  <CardHeader className="bg-[#0077B6] text-white rounded-t-[8px] py-3">
                    <CardTitle className="flex items-center text-lg font-semibold uppercase tracking-[0.5px]">
                      <MapPin className="w-5 h-5 mr-2" />
                      Billing Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700">Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                              placeholder="Enter street address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">City</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                placeholder="Enter city"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Postal Code</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                placeholder="Enter postal code"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Country</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]">
                                  <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="DE">Germany</SelectItem>
                                <SelectItem value="FR">France</SelectItem>
                                <SelectItem value="UK">United Kingdom</SelectItem>
                                <SelectItem value="US">United States</SelectItem>
                                <SelectItem value="CA">Canada</SelectItem>
                                <SelectItem value="NL">Netherlands</SelectItem>
                                <SelectItem value="BE">Belgium</SelectItem>
                                <SelectItem value="ES">Spain</SelectItem>
                                <SelectItem value="IT">Italy</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Method */}
                <Card className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] border-[#ddd]">
                  <CardHeader className="bg-[#0077B6] text-white rounded-t-[8px] py-3">
                    <CardTitle className="flex items-center text-lg font-semibold uppercase tracking-[0.5px]">
                      <CreditCard className="w-5 h-5 mr-2" />
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700 mb-3 block">Select Payment Method</FormLabel>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Wallet Payment */}
                            <div 
                              className={`border-2 rounded-[8px] p-4 cursor-pointer transition-all duration-200 ${
                                field.value === 'wallet' 
                                  ? 'border-[#FFB20F] bg-[#FFB20F]/5' 
                                  : 'border-[#ddd] hover:border-[#FFB20F]/50'
                              }`}
                              onClick={() => field.onChange('wallet')}
                            >
                              <div className="text-center">
                                <Wallet className={`w-8 h-8 mx-auto mb-2 ${
                                  field.value === 'wallet' ? 'text-[#FFB20F]' : 'text-gray-600'
                                }`} />
                                <h3 className="font-semibold text-sm text-gray-800">Wallet</h3>
                                <p className="text-xs text-gray-600 mt-1">
                                  {balance ? 
                                    `${formatCurrency(balance.totalAvailable)} available` :
                                    'Loading...'
                                  }
                                </p>
                              </div>
                            </div>

                            {/* Credit Card */}
                            <div 
                              className={`border-2 rounded-[8px] p-4 cursor-pointer transition-all duration-200 ${
                                field.value === 'credit_card' 
                                  ? 'border-[#4D9DE0] bg-[#4D9DE0]/5' 
                                  : 'border-[#ddd] hover:border-[#4D9DE0]/50'
                              }`}
                              onClick={() => field.onChange('credit_card')}
                            >
                              <div className="text-center">
                                <CreditCard className={`w-8 h-8 mx-auto mb-2 ${
                                  field.value === 'credit_card' ? 'text-[#4D9DE0]' : 'text-gray-600'
                                }`} />
                                <h3 className="font-semibold text-sm text-gray-800">Credit Card</h3>
                                <p className="text-xs text-gray-600 mt-1">Visa, Mastercard, Amex</p>
                              </div>
                            </div>

                            {/* Bank Transfer */}
                            <div 
                              className={`border-2 rounded-[8px] p-4 cursor-pointer transition-all duration-200 ${
                                field.value === 'bank_transfer' 
                                  ? 'border-[#4D9DE0] bg-[#4D9DE0]/5' 
                                  : 'border-[#ddd] hover:border-[#4D9DE0]/50'
                              }`}
                              onClick={() => field.onChange('bank_transfer')}
                            >
                              <div className="text-center">
                                <Banknote className={`w-8 h-8 mx-auto mb-2 ${
                                  field.value === 'bank_transfer' ? 'text-[#4D9DE0]' : 'text-gray-600'
                                }`} />
                                <h3 className="font-semibold text-sm text-gray-800">Bank Transfer</h3>
                                <p className="text-xs text-gray-600 mt-1">SEPA, Wire Transfer</p>
                              </div>
                            </div>

                            {/* Purchase Order */}
                            <div 
                              className={`border-2 rounded-[8px] p-4 cursor-pointer transition-all duration-200 ${
                                field.value === 'purchase_order' 
                                  ? 'border-[#4D9DE0] bg-[#4D9DE0]/5' 
                                  : 'border-[#ddd] hover:border-[#4D9DE0]/50'
                              }`}
                              onClick={() => field.onChange('purchase_order')}
                            >
                              <div className="text-center">
                                <FileText className={`w-8 h-8 mx-auto mb-2 ${
                                  field.value === 'purchase_order' ? 'text-[#4D9DE0]' : 'text-gray-600'
                                }`} />
                                <h3 className="font-semibold text-sm text-gray-800">Purchase Order</h3>
                                <p className="text-xs text-gray-600 mt-1">Net 30 Payment Terms</p>
                              </div>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Credit Card Fields */}
                    {form.watch("paymentMethod") === "credit_card" && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="cardHolderName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-gray-700">Cardholder Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                  placeholder="Enter cardholder name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="cardNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-gray-700">Card Number</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0] font-mono"
                                  placeholder="1234 5678 9012 3456"
                                  maxLength={19}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="expiryDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-semibold text-gray-700">Expiry Date</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0] font-mono"
                                    placeholder="MM/YY"
                                    maxLength={5}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="cvv"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-semibold text-gray-700">CVV</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0] font-mono"
                                    placeholder="123"
                                    maxLength={4}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    {/* Purchase Order Field */}
                    {form.watch("paymentMethod") === "purchase_order" && (
                      <FormField
                        control={form.control}
                        name="poNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Purchase Order Number</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="border-[#ddd] rounded-[5px] focus:border-[#4D9DE0]"
                                placeholder="Enter PO number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Wallet Payment Info */}
                    {form.watch("paymentMethod") === "wallet" && (
                      <div className="bg-[#fff8e1] p-4 rounded-[5px] border border-[#FFB20F]">
                        <div className="flex items-center mb-2">
                          <Wallet className="w-5 h-5 text-[#FFB20F] mr-2" />
                          <strong className="text-sm text-gray-800">Wallet Payment Details:</strong>
                        </div>
                        {walletLoading ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FFB20F]"></div>
                            <p className="text-sm text-gray-600">Loading wallet information...</p>
                          </div>
                        ) : balance ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Deposit Balance:</span>
                              <span className="font-semibold text-green-600">{formatCurrency(balance.depositBalance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Available Credit:</span>
                              <span className="font-semibold text-blue-600">{formatCurrency(balance.availableCredit)}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t pt-2">
                              <span className="text-gray-600">Total Available:</span>
                              <span className="font-semibold text-[#FFB20F]">{formatCurrency(balance.totalAvailable)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Order Total:</span>
                              <span className="font-semibold text-gray-800">{formatCurrency(finalAmount)}</span>
                            </div>
                            {hasInsufficientBalance(finalAmount) && (
                              <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                                <p className="text-xs text-red-700">
                                  Insufficient wallet balance. Please add funds or use another payment method.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                            <p className="text-sm text-yellow-700">
                              Wallet data unavailable. Please refresh the page or try again.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bank Transfer Info */}
                    {form.watch("paymentMethod") === "bank_transfer" && (
                      <div className="bg-[#f8f8f8] p-4 rounded-[5px] border border-[#ddd]">
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Bank Transfer Details:</strong>
                        </p>
                        <p className="text-sm text-gray-600">
                          After placing your order, you will receive an invoice with our bank details for payment.
                          Your order will be processed once payment is received.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </Form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="bg-white rounded-[8px] shadow-[0_2px_5px_rgba(0,0,0,0.1)] border-[#ddd] sticky top-6">
              <CardHeader className="bg-[#0077B6] text-white rounded-t-[8px] py-3">
                <CardTitle className="text-lg font-semibold uppercase tracking-[0.5px]">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {/* Order Items */}
                <div className="space-y-3 mb-6">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-[5px] flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#4D585A] truncate">{item.product.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatPrice(getTenantPrice(item.product))} × <span className="font-mono">{item.quantity}</span>
                        </p>
                      </div>
                      <div className="text-sm font-mono font-semibold text-[#4D585A]">
                        {formatPrice(getTenantPrice(item.product) * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-3 border-t border-[#e5e5e5] pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal ({totalItems} items)</span>
                    <span className="font-mono font-semibold">{formatPrice(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tax (21%)</span>
                    <span className="font-mono font-semibold">{formatPrice(taxAmount)}</span>
                  </div>
                  <div className="border-t border-[#e5e5e5] pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#4D585A] uppercase tracking-[0.5px]">Total</span>
                      <span className="font-mono font-semibold text-xl text-[#4D585A]">
                        {formatPrice(finalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Place Order Button */}
                <div className="mt-6">
                  <Button
                    onClick={() => form.handleSubmit(onSubmit)()}
                    disabled={placeOrderMutation.isPending}
                    className="w-full bg-[#4D9DE0] hover:bg-[#3ba3e8] text-white rounded-[5px] font-semibold uppercase tracking-[0.5px] py-4 text-lg transition-colors duration-200"
                  >
                    {placeOrderMutation.isPending ? "Processing..." : `Place Order • ${formatPrice(finalAmount)}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}