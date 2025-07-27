import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2, Eye, Clock } from 'lucide-react';

export function CacheDebugPanel() {
  const queryClient = useQueryClient();
  const [isVisible, setIsVisible] = useState(false);
  
  // Only show in development
  if (import.meta.env.PROD) return null;

  const cacheEntries = queryClient.getQueryCache().getAll();

  const invalidateAll = () => {
    queryClient.invalidateQueries();
  };

  const clearCache = () => {
    queryClient.clear();
  };

  const invalidateSpecific = (queryKey: any) => {
    queryClient.invalidateQueries({ queryKey });
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          size="sm"
          variant="outline"
          className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
        >
          <Eye className="h-4 w-4 mr-1" />
          Cache Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="bg-white shadow-lg border-2 border-yellow-300">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Cache Debug Panel
            </CardTitle>
            <Button
              onClick={() => setIsVisible(false)}
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                onClick={invalidateAll}
                size="sm"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Invalidate All
              </Button>
              <Button
                onClick={clearCache}
                size="sm"
                variant="destructive"
                className="flex-1"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            </div>
            
            <div className="text-sm font-medium">
              Cache Entries ({cacheEntries.length})
            </div>
            
            <div className="space-y-2">
              {cacheEntries.map((entry, index) => {
                const key = JSON.stringify(entry.queryKey);
                const isStale = entry.isStale();
                const isFetching = entry.isFetching();
                const hasData = entry.state.data !== undefined;
                
                return (
                  <div
                    key={index}
                    className="p-2 border rounded-md bg-gray-50 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-mono text-xs truncate max-w-48">
                        {key}
                      </div>
                      <div className="flex gap-1">
                        {hasData && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            Data
                          </Badge>
                        )}
                        {isStale && (
                          <Badge variant="destructive" className="text-xs px-1 py-0">
                            Stale
                          </Badge>
                        )}
                        {isFetching && (
                          <Badge variant="default" className="text-xs px-1 py-0">
                            Fetching
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {entry.state.dataUpdatedAt 
                          ? new Date(entry.state.dataUpdatedAt).toLocaleTimeString()
                          : 'Never'
                        }
                      </div>
                      <Button
                        onClick={() => invalidateSpecific(entry.queryKey)}
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                      >
                        Invalidate
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}