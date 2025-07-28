import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Package, Monitor, Globe, Calendar, Star, Info, Check, X } from "lucide-react";
import { type ProductWithStock } from "@shared/schema";
import { parsePrice } from "@/lib/price-utils";

interface ProductDetailModalProps {
  product: ProductWithStock | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: ProductWithStock, quantity: number) => void;
  isInCart?: boolean;
  isLoading?: boolean;
}

export function ProductDetailModal({ 
  product, 
  isOpen, 
  onClose, 
  onAddToCart, 
  isInCart = false,
  isLoading = false 
}: ProductDetailModalProps) {
  if (!product) return null;

  const purchasePrice = parsePrice(product.purchasePrice || '0');
  const retailPrice = parsePrice(product.retailPrice || '0');
  const price = parsePrice(product.price || '0');
  const priceKm = parsePrice(product.priceKm || '0');

  const stockStatus = product.stockCount === 0 
    ? { text: 'Out of Stock', variant: 'destructive' as const, icon: X }
    : product.stockCount < 10 
    ? { text: 'Low Stock', variant: 'secondary' as const, icon: Info }
    : { text: 'In Stock', variant: 'default' as const, icon: Check };

  const handleAddToCart = () => {
    if (!isInCart && product.stockCount > 0) {
      onAddToCart(product, 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-2xl font-bold text-[#6E6F71]">
              {product.name}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Product Image */}
              <div className="space-y-4">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/api/placeholder/400/400';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-gray-400" />
                    </div>
                  )}
                </div>
                
                {/* Product Info Pills */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Monitor className="h-3 w-3" />
                    {product.platform}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {product.region}
                  </Badge>
                  <Badge variant={stockStatus.variant} className="flex items-center gap-1">
                    <stockStatus.icon className="h-3 w-3" />
                    {stockStatus.text}
                  </Badge>
                  {product.sku && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      SKU: {product.sku}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Product Details */}
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-[#6E6F71] mb-3">Description</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {product.description || 'No description available.'}
                  </p>
                  {product.htmlDescription && (
                    <div className="mt-4 prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: product.htmlDescription }} />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Pricing Information */}
                <div>
                  <h3 className="text-lg font-semibold text-[#6E6F71] mb-4">Pricing Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#FFB20F]/5 p-4 rounded-lg border border-[#FFB20F]/20">
                      <div className="text-sm text-gray-600 mb-1">B2B Price (EUR)</div>
                      <div className="text-2xl font-bold text-[#FFB20F]">€{price.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">Your purchase price</div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Retail Price (EUR)</div>
                      <div className="text-2xl font-bold text-gray-700">€{retailPrice.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 mt-1">Suggested retail price</div>
                    </div>
                    
                    {priceKm > 0 && (
                      <>
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="text-sm text-gray-600 mb-1">B2B Price (KM)</div>
                          <div className="text-2xl font-bold text-blue-600">{priceKm.toFixed(2)} KM</div>
                          <div className="text-xs text-gray-500 mt-1">Your purchase price</div>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">Purchase Cost (EUR)</div>
                          <div className="text-2xl font-bold text-gray-700">€{purchasePrice.toFixed(2)}</div>
                          <div className="text-xs text-gray-500 mt-1">Your cost basis</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Profit Margin Indicator */}
                  {price > 0 && retailPrice > 0 && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-700">Potential Profit Margin</span>
                        <span className="text-lg font-bold text-green-600">
                          €{(retailPrice - price).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        {((retailPrice - price) / retailPrice * 100).toFixed(1)}% margin
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Stock Information */}
                <div>
                  <h3 className="text-lg font-semibold text-[#6E6F71] mb-3">Availability</h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Stock Level</div>
                      <div className="text-sm text-gray-600">
                        {product.stockCount > 0 ? `${product.stockCount} units available` : 'Currently out of stock'}
                      </div>
                    </div>
                    <Badge variant={stockStatus.variant} className="flex items-center gap-1">
                      <stockStatus.icon className="h-3 w-3" />
                      {stockStatus.text}
                    </Badge>
                  </div>
                </div>

                {/* Warranty Information */}
                {product.warranty && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-lg font-semibold text-[#6E6F71] mb-3">Warranty</h3>
                      <p className="text-gray-700">{product.warranty}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Footer with Action Buttons */}
          <div className="p-6 pt-0 border-t border-gray-200">
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="px-6"
              >
                Close
              </Button>
              <Button
                onClick={handleAddToCart}
                disabled={isInCart || product.stockCount === 0 || isLoading}
                className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white px-8 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Adding...
                  </>
                ) : isInCart ? (
                  <>
                    <Check className="h-4 w-4" />
                    In Cart
                  </>
                ) : product.stockCount === 0 ? (
                  <>
                    <X className="h-4 w-4" />
                    Out of Stock
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Add to Cart
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}