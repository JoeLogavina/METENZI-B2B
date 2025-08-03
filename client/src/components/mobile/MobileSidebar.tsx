import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Package, Grid, Users, FileText, CreditCard, BarChart3, 
  Settings, HelpCircle, Menu, X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarItem {
  icon: any;
  label: string;
  active: boolean;
  href: string;
  allowed: boolean;
}

interface MobileSidebarProps {
  sidebarItems: SidebarItem[];
  user: any;
}

export function MobileSidebar({ sidebarItems, user }: MobileSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <>
      {/* Collapsed Sidebar - Always visible on mobile */}
      <div className="fixed left-0 top-0 h-full w-16 bg-[#404040] z-40 flex flex-col">
        {/* Logo/Menu Button */}
        <div className="p-3 border-b border-[#5a5b5d]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-10 h-10 p-0 text-white hover:bg-[#7a7b7d] rounded-lg"
          >
            {isExpanded ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 mt-2">
          {sidebarItems.map((item, index) => (
            <div
              key={index}
              className={`flex items-center justify-center h-12 mb-1 mx-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                item.active 
                  ? 'bg-[#FFB20F] text-white' 
                  : 'text-white hover:bg-[#7a7b7d]'
              }`}
              onClick={() => setLocation(item.href)}
            >
              <item.icon className="w-5 h-5" />
            </div>
          ))}
        </nav>
      </div>

      {/* Expanded Sidebar Overlay */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[45]"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Expanded Sidebar */}
          <div className="fixed left-0 top-0 h-full w-64 bg-[#404040] z-[50] flex flex-col transform transition-transform duration-300">
            {/* Header */}
            <div className="p-4 border-b border-[#5a5b5d]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#FFB20F] rounded flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sm uppercase tracking-[0.5px] text-white">B2B PORTAL</h2>
                    <p className="text-xs text-gray-300 uppercase tracking-[0.5px]">ENTERPRISE</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="w-8 h-8 p-0 text-white hover:bg-[#7a7b7d] rounded-lg"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 mt-4">
              {sidebarItems.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center px-4 py-3 text-lg transition-colors duration-200 cursor-pointer ${
                    item.active 
                      ? 'bg-[#FFB20F] text-white border-r-2 border-[#e6a00e]' 
                      : 'text-white hover:bg-[#7a7b7d]'
                  }`}
                  onClick={() => {
                    setLocation(item.href);
                    setIsExpanded(false); // Close sidebar after navigation
                  }}
                >
                  <item.icon className="w-6 h-6 mr-3" />
                  <span className="uppercase tracking-[0.5px] font-medium text-sm">{item.label}</span>
                </div>
              ))}
            </nav>
          </div>
        </>
      )}
    </>
  );
}