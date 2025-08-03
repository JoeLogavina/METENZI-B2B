import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDeviceDetection } from '@/hooks/mobile/useDeviceDetection';

export function MobileDebugPanel() {
  const deviceInfo = useDeviceDetection();
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [forceMobile, setForceMobile] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 bg-white shadow-lg border-2 border-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-blue-600">Mobile Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="space-y-2">
          <h4 className="font-semibold">Device Detection</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>Width: <Badge variant="outline">{windowSize.width}px</Badge></div>
            <div>Height: <Badge variant="outline">{windowSize.height}px</Badge></div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Mobile:</span>
              <Badge variant={deviceInfo.isMobile ? "default" : "secondary"}>
                {deviceInfo.isMobile ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Tablet:</span>
              <Badge variant={deviceInfo.isTablet ? "default" : "secondary"}>
                {deviceInfo.isTablet ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Desktop:</span>
              <Badge variant={deviceInfo.isDesktop ? "default" : "secondary"}>
                {deviceInfo.isDesktop ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Touch:</span>
              <Badge variant={deviceInfo.isTouchDevice ? "default" : "secondary"}>
                {deviceInfo.isTouchDevice ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Mobile Logic</h4>
          <div className="text-xs">
            <div>Should be mobile: <strong>{windowSize.width <= 768 ? "YES" : "NO"}</strong></div>
            <div>Detection says: <strong>{deviceInfo.isMobile ? "YES" : "NO"}</strong></div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Force Override</h4>
          <Button 
            size="sm" 
            onClick={() => setForceMobile(!forceMobile)}
            variant={forceMobile ? "destructive" : "outline"}
            className="w-full"
          >
            {forceMobile ? "Disable Force Mobile" : "Force Mobile Mode"}
          </Button>
          {forceMobile && (
            <Badge variant="destructive" className="w-full justify-center">
              MOBILE MODE FORCED
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">User Agent</h4>
          <div className="text-xs bg-gray-100 p-2 rounded break-words">
            {navigator.userAgent}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}