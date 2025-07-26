import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown, Filter } from "lucide-react";
import { useState } from "react";

interface FiltersPanelProps {
  filters: {
    region: string;
    platform: string;
    search: string;
    priceMin: string;
    priceMax: string;
  };
  onFiltersChange: (filters: any) => void;
}

export default function FiltersPanel({ filters, onFiltersChange }: FiltersPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      region: "",
      platform: "",
      search: "",
      priceMin: "",
      priceMax: "",
    });
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Search and Basic Controls */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search products..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex space-x-2">
            <Select value={filters.region} onValueChange={(value) => updateFilter('region', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Regions</SelectItem>
                <SelectItem value="Global">Global</SelectItem>
                <SelectItem value="EU">EU</SelectItem>
                <SelectItem value="US">US</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.platform} onValueChange={(value) => updateFilter('platform', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Platforms</SelectItem>
                <SelectItem value="Windows">Windows</SelectItem>
                <SelectItem value="Mac">Mac</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-right">
            <Select>
              <SelectTrigger className="w-auto">
                <SelectValue placeholder="By Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">By Name</SelectItem>
                <SelectItem value="price">By Price</SelectItem>
                <SelectItem value="stock">By Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Advanced Filters</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-0 h-auto"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
          </div>
          
          {showAdvanced && (
            <div className="space-y-4">
              {/* Price Range */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Price Range (BAM)</Label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => updateFilter('priceMin', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => updateFilter('priceMax', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Stock Level */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Stock Level</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="All stock levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stock levels</SelectItem>
                    <SelectItem value="in-stock">In Stock (&gt;0)</SelectItem>
                    <SelectItem value="low-stock">Low Stock (&lt;10)</SelectItem>
                    <SelectItem value="out-of-stock">Out of Stock (0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Added */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Date Added</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="3months">Last 3 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search SKU */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Search SKU</Label>
                <Input
                  type="text"
                  placeholder="Enter SKU..."
                />
              </div>
            </div>
          )}

          <div className="flex space-x-2 mt-6">
            <Button className="flex-1" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="px-4"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
