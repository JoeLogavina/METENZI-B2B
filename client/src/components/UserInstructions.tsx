import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Download,
  Key,
  Play,
  Settings,
  HelpCircle,
  Phone,
  BookOpen,
  Monitor,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import type { ProductWithStock } from "@shared/schema";

interface UserInstructionsProps {
  product: ProductWithStock;
  tenantId: 'eur' | 'km';
  trigger?: React.ReactNode;
}

function UserInstructions({ product, tenantId, trigger }: UserInstructionsProps) {
  const [activeTab, setActiveTab] = useState("installation");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const instructionSections = [
    {
      id: "installation",
      title: "Installation",
      icon: Download,
      content: product.installationInstructions,
      description: "Step-by-step installation guide"
    },
    {
      id: "activation",
      title: "Activation",
      icon: Key,
      content: product.activationInstructions,
      description: "How to activate your license"
    },
    {
      id: "usage",
      title: "Getting Started",
      icon: Play,
      content: product.usageInstructions,
      description: "Basic usage instructions"
    },
    {
      id: "requirements",
      title: "System Requirements",
      icon: Monitor,
      content: product.systemRequirements,
      description: "Technical specifications needed"
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      icon: AlertCircle,
      content: product.troubleshootingGuide,
      description: "Common issues and solutions"
    },
    {
      id: "support",
      title: "Support",
      icon: Phone,
      content: product.supportContacts,
      description: "Get help when you need it"
    }
  ];

  const hasAnyInstructions = instructionSections.some(section => section.content);

  if (!hasAnyInstructions) {
    return null;
  }

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
    >
      <BookOpen className="w-4 h-4 mr-2" />
      User Guide
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <BookOpen className="w-6 h-6 text-[#FFB20F]" />
            User Instructions - {product.name}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {tenantId.toUpperCase()} Version
            </Badge>
            <Badge variant="outline" className="text-xs">
              SKU: {product.sku}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {product.platform}
            </Badge>
          </div>
        </DialogHeader>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-6">
              {instructionSections.map((section) => {
                const hasContent = Boolean(section.content);
                return (
                  <TabsTrigger 
                    key={section.id} 
                    value={section.id}
                    disabled={!hasContent}
                    className="flex flex-col items-center gap-1 p-3 h-auto data-[state=active]:bg-[#FFB20F] data-[state=active]:text-white"
                  >
                    <section.icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{section.title}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {instructionSections.map((section) => (
              <TabsContent key={section.id} value={section.id} className="mt-0">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-[#6E6F71]">
                      <section.icon className="w-5 h-5 text-[#FFB20F]" />
                      {section.title}
                    </CardTitle>
                    <CardDescription>
                      {section.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {section.content ? (
                      <ScrollArea className="max-h-96 w-full rounded-md border p-4">
                        <div 
                          className="prose prose-sm max-w-none prose-headings:text-[#6E6F71] prose-strong:text-[#6E6F71] prose-a:text-[#FFB20F]"
                          dangerouslySetInnerHTML={{ __html: section.content }} 
                        />
                      </ScrollArea>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Info className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm">
                          No {section.title.toLowerCase()} instructions available for this product.
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          Contact support if you need assistance with {section.title.toLowerCase()}.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Complete user guide for {product.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {product.supportContacts && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("support")}
                  className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Get Support
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(window.location.href, 'url')}
                className="border-[#FFB20F] text-[#FFB20F] hover:bg-[#FFB20F] hover:text-white"
              >
                {copiedText === 'url' ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Share Guide
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

export default UserInstructions;