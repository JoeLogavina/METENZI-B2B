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

  // Use KM-specific instructions if tenant is 'km' and they exist, otherwise fallback to English
  const getLocalizedContent = (englishField: string | null, kmField: string | null) => {
    if (tenantId === 'km' && kmField) {
      return kmField;
    }
    return englishField;
  };

  const instructionSections = [
    {
      id: "installation",
      title: tenantId === 'km' ? "Instalacija" : "Installation",
      icon: Download,
      content: getLocalizedContent(product.installationInstructions, product.installationInstructionsKm),
      description: tenantId === 'km' ? "Korak-po-korak vodič za instalaciju" : "Step-by-step installation guide"
    },
    {
      id: "activation",
      title: tenantId === 'km' ? "Aktivacija" : "Activation",
      icon: Key,
      content: getLocalizedContent(product.activationInstructions, product.activationInstructionsKm),
      description: tenantId === 'km' ? "Kako aktivirati vašu licencu" : "How to activate your license"
    },
    {
      id: "usage",
      title: tenantId === 'km' ? "Početak rada" : "Getting Started",
      icon: Play,
      content: getLocalizedContent(product.usageInstructions, product.usageInstructionsKm),
      description: tenantId === 'km' ? "Osnovna uputstva za korišćenje" : "Basic usage instructions"
    },
    {
      id: "requirements",
      title: tenantId === 'km' ? "Sistemski zahtevi" : "System Requirements",
      icon: Monitor,
      content: getLocalizedContent(product.systemRequirements, product.systemRequirementsKm),
      description: tenantId === 'km' ? "Potrebne tehničke specifikacije" : "Technical specifications needed"
    },
    {
      id: "troubleshooting",
      title: tenantId === 'km' ? "Rešavanje problema" : "Troubleshooting",
      icon: AlertCircle,
      content: getLocalizedContent(product.troubleshootingGuide, product.troubleshootingGuideKm),
      description: tenantId === 'km' ? "Česti problemi i rešenja" : "Common issues and solutions"
    },
    {
      id: "support",
      title: tenantId === 'km' ? "Podrška" : "Support",
      icon: Phone,
      content: getLocalizedContent(product.supportContacts, product.supportContactsKm),
      description: tenantId === 'km' ? "Pomoć kada vam je potrebna" : "Get help when you need it"
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
      {tenantId === 'km' ? 'Korisnički vodič' : 'User Guide'}
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
            {tenantId === 'km' ? 'Korisnička uputstva' : 'User Instructions'} - {product.name}
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
                          {tenantId === 'km' 
                            ? `Nema dostupnih uputstava za ${section.title.toLowerCase()} za ovaj proizvod.`
                            : `No ${section.title.toLowerCase()} instructions available for this product.`
                          }
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          {tenantId === 'km' 
                            ? `Kontaktirajte podršku ako vam je potrebna pomoć sa ${section.title.toLowerCase()}.`
                            : `Contact support if you need assistance with ${section.title.toLowerCase()}.`
                          }
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
              <span>
                {tenantId === 'km' 
                  ? `Kompletan korisnički vodič za ${product.name}` 
                  : `Complete user guide for ${product.name}`
                }
              </span>
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
                  {tenantId === 'km' ? 'Kontaktiraj podršku' : 'Get Support'}
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
                    {tenantId === 'km' ? 'Kopirano!' : 'Copied!'}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    {tenantId === 'km' ? 'Podeli vodič' : 'Share Guide'}
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