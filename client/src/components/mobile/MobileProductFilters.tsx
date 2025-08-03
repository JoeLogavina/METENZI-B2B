import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MobileProductFiltersProps {
  filters: any;
  setFilters: (filters: any) => void;
  onClose: () => void;
}

export function MobileProductFilters({ filters, setFilters, onClose }: MobileProductFiltersProps) {
  // Fetch categories for filter dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories", { credentials: "include" });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    },
  });

  const clearAllFilters = () => {
    setFilters({
      search: "",
      categoryId: "",
      region: "",
      platform: "",
      priceMin: "",
      priceMax: "",
      stockLevel: "",
      dateAdded: "",
      sku: "",
      priceRange: [0, 1000] as [number, number],
      availability: [] as string[],
      sortBy: "",
      sortOrder: "asc" as "asc" | "desc"
    });
  };

  const hasActiveFilters = filters.categoryId || filters.region || filters.platform || 
                          filters.priceMin || filters.priceMax || filters.stockLevel;

  return (
    <div className="space-y-6 pt-6">
      {/* Header with Clear All */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filters</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Active Filters</Label>
          <div className="flex flex-wrap gap-2">
            {filters.categoryId && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Category: {categories.find((c: any) => c.id === filters.categoryId)?.name || filters.categoryId}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({ ...filters, categoryId: "" })}
                />
              </Badge>
            )}
            {filters.region && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Region: {filters.region}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({ ...filters, region: "" })}
                />
              </Badge>
            )}
            {filters.platform && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Platform: {filters.platform}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({ ...filters, platform: "" })}
                />
              </Badge>
            )}
            {(filters.priceMin || filters.priceMax) && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Price: {filters.priceMin || '0'} - {filters.priceMax || '∞'}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({ ...filters, priceMin: "", priceMax: "" })}
                />
              </Badge>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Category Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Category</Label>
        <Select
          value={filters.categoryId}
          onValueChange={(value) => setFilters({ ...filters, categoryId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {categories.map((category: any) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Region Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Region</Label>
        <Select
          value={filters.region}
          onValueChange={(value) => setFilters({ ...filters, region: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All regions</SelectItem>
            <SelectItem value="Europe">Europe</SelectItem>
            <SelectItem value="North America">North America</SelectItem>
            <SelectItem value="Asia">Asia</SelectItem>
            <SelectItem value="Global">Global</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Platform Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Platform</Label>
        <Select
          value={filters.platform}
          onValueChange={(value) => setFilters({ ...filters, platform: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All platforms</SelectItem>
            <SelectItem value="Windows">Windows</SelectItem>
            <SelectItem value="Mac">Mac</SelectItem>
            <SelectItem value="Linux">Linux</SelectItem>
            <SelectItem value="Web">Web</SelectItem>
            <SelectItem value="Mobile">Mobile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Price Range</Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Min Price</Label>
            <Input
              type="number"
              placeholder="0"
              value={filters.priceMin}
              onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Max Price</Label>
            <Input
              type="number"
              placeholder="1000"
              value={filters.priceMax}
              onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Stock Level */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Stock Availability</Label>
        <Select
          value={filters.stockLevel}
          onValueChange={(value) => setFilters({ ...filters, stockLevel: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any stock level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any stock level</SelectItem>
            <SelectItem value="in-stock">In Stock</SelectItem>
            <SelectItem value="low-stock">Low Stock (&lt; 10)</SelectItem>
            <SelectItem value="high-stock">High Stock (&gt; 50)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Apply Button */}
      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button 
          className="flex-1 bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
          onClick={onClose}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
}