import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Grid3X3, List, Loader2, BookOpen } from "lucide-react";
import { type ProductWithStock } from "@shared/schema";
import { UserInstructions } from '@/components/UserInstructions';
import { useTenant } from '@/contexts/TenantContext';

interface ProductTableProps {
  products: ProductWithStock[];
  isLoading: boolean;
  onAddToCart: (product: ProductWithStock, quantity: number) => void;
  isAddingToCart: boolean;
}

export default function ProductTable({ 
  products, 
  isLoading, 
  onAddToCart,
  isAddingToCart 
}: ProductTableProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const { tenant } = useTenant();

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const getQuantity = (productId: string) => quantities[productId] || 1;

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'windows':
        return '🪟';
      case 'mac':
        return '🍎';
      case 'both':
        return '🪟🍎';
      default:
        return '💻';
    }
  };

  const getRegionBadgeColor = (region: string) => {
    switch (region.toLowerCase()) {
      case 'global':
        return 'bg-blue-100 text-blue-800';
      case 'eu':
        return 'bg-green-100 text-green-800';
      case 'us':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStockBadgeColor = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800';
    if (stock < 10) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Loading products...</h3>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-white flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="mt-2 text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Products Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            Found {products.length} products
          </h3>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-500 ml-4">
              {viewMode === 'list' ? 'List View' : 'Grid View'}
            </span>
          </div>
        </div>
      </div>

      {/* Products Content */}
      <div className="flex-1 overflow-auto bg-white">
        {products.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <List className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-2">No products found</p>
              <p className="text-sm text-gray-400">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="table-header border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">IMAGE</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">PRODUCT</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">PRICE</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">REGION</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">PLATFORM</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">STOCK</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">QUANTITY</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="py-4 px-6 text-sm text-gray-900 font-mono">
                    {product.sku}
                  </td>
                  <td className="py-4 px-6">
                    <div className="w-16 h-12 bg-gray-100 rounded border flex items-center justify-center">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">No Image</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm font-medium text-gray-900">
                      {product.name}
                    </div>
                    {product.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {product.description}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900">
                      <span className="font-semibold">€{parseFloat(product.price).toLocaleString()}</span>
                      <div className="text-xs text-gray-500">per license</div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <Badge className={`${getRegionBadgeColor(product.region)}`}>
                      {product.region}
                    </Badge>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-1">
                      <span className="text-lg">{getPlatformIcon(product.platform)}</span>
                      <span className="text-xs text-gray-500">{product.platform}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <Badge className={getStockBadgeColor(product.stockCount)}>
                      {product.stockCount}
                    </Badge>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(product.id, -1)}
                        disabled={getQuantity(product.id) <= 1}
                        className="w-6 h-6 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={getQuantity(product.id)}
                        onChange={(e) => setQuantities(prev => ({
                          ...prev,
                          [product.id]: Math.max(1, parseInt(e.target.value) || 1)
                        }))}
                        className="w-16 text-center"
                        min="1"
                        max={product.stockCount}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(product.id, 1)}
                        disabled={getQuantity(product.id) >= product.stockCount}
                        className="w-6 h-6 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex space-x-2">
                      {/* User Instructions Button */}
                      <UserInstructions 
                        product={product} 
                        tenantId={tenant.currency === 'KM' ? 'km' : 'eur'}
                        trigger={
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
                          >
                            <BookOpen className="h-4 w-4 mr-1" />
                            Guide
                          </Button>
                        }
                      />
                      
                      {/* Add to Cart Button */}
                      <Button
                        onClick={() => onAddToCart(product, getQuantity(product.id))}
                        disabled={product.stockCount === 0 || isAddingToCart}
                        size="sm"
                        className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                      >
                        {isAddingToCart ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Plus className="h-4 w-4 mr-1" />
                        )}
                        ADD
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
