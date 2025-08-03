import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Package, Eye, Star, Heart } from "lucide-react";
import { type ProductWithStock } from "@shared/schema";
import { useTenant } from '@/contexts/TenantContext';

interface MobileProductCardProps {
  product: ProductWithStock;
  onAddToCart: (quantity: number) => void;
  onViewDetails: () => void;
  isAddingToCart: boolean;
}

export function MobileProductCard({ 
  product, 
  onAddToCart, 
  onViewDetails, 
  isAddingToCart 
}: MobileProductCardProps) {
  const { formatPrice } = useTenant();
  const [quantity, setQuantity] = useState(1);

  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, Math.min(product.stockCount, quantity + change));
    setQuantity(newQuantity);
  };

  const isOutOfStock = product.stockCount === 0;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-0">
        <div className="flex">
          {/* Product Image */}
          <div className="w-24 h-24 flex-shrink-0 bg-gray-100 relative">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.log(`❌ Mobile card image failed to load: ${product.imageUrl}`);
                  e.currentTarget.style.display = 'none';
                }}
                onLoad={() => {
                  console.log(`✅ Mobile card image loaded: ${product.imageUrl} for ${product.name}`);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
            )}
            
            {/* Stock Badge */}
            <div className="absolute top-1 right-1">
              {isOutOfStock ? (
                <Badge variant="destructive" className="text-xs">
                  Out of Stock
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {product.stockCount}
                </Badge>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex-1 p-3 flex flex-col justify-between">
            <div>
              <h3 className="font-medium text-sm text-gray-900 line-clamp-2 leading-tight">
                {product.name}
              </h3>
              
              <div className="flex items-center justify-between mt-1">
                <div className="text-lg font-bold text-[#FFB20F]">
                  {formatPrice(product.price)}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewDetails}
                  className="p-1 h-auto"
                >
                  <Eye className="h-4 w-4 text-gray-500" />
                </Button>
              </div>

              {/* Product details */}
              <div className="flex items-center space-x-2 mt-1">
                {product.platform && (
                  <Badge variant="outline" className="text-xs">
                    {product.platform}
                  </Badge>
                )}
                {product.region && (
                  <Badge variant="outline" className="text-xs">
                    {product.region}
                  </Badge>
                )}
              </div>
            </div>

            {/* Add to Cart Section */}
            <div className="flex items-center justify-between mt-3">
              {!isOutOfStock && (
                <>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    
                    <span className="text-sm font-medium w-8 text-center">
                      {quantity}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= product.stockCount}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    onClick={() => onAddToCart(quantity)}
                    disabled={isAddingToCart}
                    size="sm"
                    className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white px-3"
                  >
                    {isAddingToCart ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </>
              )}
              
              {isOutOfStock && (
                <div className="text-sm text-gray-500 font-medium">
                  Currently unavailable
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}