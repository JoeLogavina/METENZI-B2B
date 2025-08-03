import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  X, 
  Plus, 
  Minus, 
  Package, 
  Star, 
  Share2, 
  Heart,
  Monitor,
  Globe,
  Shield,
  Award
} from "lucide-react";
import { type ProductWithStock } from "@shared/schema";
import { useTenant } from '@/contexts/TenantContext';

interface MobileProductModalProps {
  product: ProductWithStock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (quantity: number) => void;
  isAddingToCart: boolean;
}

export function MobileProductModal({ 
  product, 
  open, 
  onOpenChange, 
  onAddToCart, 
  isAddingToCart 
}: MobileProductModalProps) {
  const { formatPrice } = useTenant();
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, Math.min(product.stockCount, quantity + change));
    setQuantity(newQuantity);
  };

  const isOutOfStock = product.stockCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-full h-full sm:max-w-md sm:h-auto sm:max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold truncate flex-1 mr-4">
              Product Details
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="p-1 h-auto"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Product Image */}
            <div className="w-full h-64 bg-gray-100 relative">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.log(`❌ Modal image failed to load: ${product.imageUrl}`);
                    e.currentTarget.style.display = 'none';
                  }}
                  onLoad={() => {
                    console.log(`✅ Modal image loaded: ${product.imageUrl} for ${product.name}`);
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-16 w-16 text-gray-400" />
                </div>
              )}
              
              {/* Stock Badge */}
              <div className="absolute top-4 right-4">
                {isOutOfStock ? (
                  <Badge variant="destructive">
                    Out of Stock
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {product.stockCount} in stock
                  </Badge>
                )}
              </div>
            </div>

            {/* Product Info */}
            <div className="p-4 space-y-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                  {product.name}
                </h1>
                
                <div className="text-2xl font-bold text-[#FFB20F] mb-3">
                  {formatPrice(product.price)}
                </div>

                {/* Product Tags */}
                <div className="flex flex-wrap gap-2">
                  {product.platform && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      {product.platform}
                    </Badge>
                  )}
                  {product.region && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {product.region}
                    </Badge>
                  )}
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Licensed
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Product Description */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {product.description || "Professional software license with full support and updates."}
                </p>
              </div>

              {/* Product Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Product Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">SKU:</span>
                    <span className="font-medium">{product.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform:</span>
                    <span className="font-medium">{product.platform || 'Universal'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Region:</span>
                    <span className="font-medium">{product.region || 'Global'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Availability:</span>
                    <span className={`font-medium ${isOutOfStock ? 'text-red-600' : 'text-green-600'}`}>
                      {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Features/Benefits */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">What's Included</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Award className="h-4 w-4 text-green-500" />
                    <span>Official License Key</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Award className="h-4 w-4 text-green-500" />
                    <span>Digital Download</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Award className="h-4 w-4 text-green-500" />
                    <span>Instant Delivery</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Award className="h-4 w-4 text-green-500" />
                    <span>Customer Support</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Add to Cart */}
          {!isOutOfStock && (
            <div className="border-t bg-white p-4 space-y-4">
              {/* Quantity Selector */}
              <div className="flex items-center justify-center space-x-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="h-9 w-9 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-lg font-semibold w-12 text-center">
                    {quantity}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= product.stockCount}
                    className="h-9 w-9 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Add to Cart Button */}
              <Button
                onClick={() => onAddToCart(quantity)}
                disabled={isAddingToCart}
                className="w-full bg-[#FFB20F] hover:bg-[#e6a00e] text-white h-12"
                size="lg"
              >
                {isAddingToCart ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Adding to Cart...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Plus className="h-5 w-5" />
                    <span>Add to Cart - {formatPrice((parseFloat(product.price) * quantity).toFixed(2))}</span>
                  </div>
                )}
              </Button>
            </div>
          )}
          
          {isOutOfStock && (
            <div className="border-t bg-gray-50 p-4">
              <div className="text-center text-gray-600">
                <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="font-medium">Currently Out of Stock</p>
                <p className="text-sm">This product will be available soon</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}