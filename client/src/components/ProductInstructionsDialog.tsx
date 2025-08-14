import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  Download, 
  Settings, 
  HelpCircle, 
  AlertCircle, 
  Phone,
  Monitor,
  PlayCircle 
} from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import type { ProductWithStock } from "@shared/schema";

interface ProductInstructionsDialogProps {
  product: ProductWithStock;
  children: React.ReactNode;
}

export function ProductInstructionsDialog({ 
  product, 
  children 
}: ProductInstructionsDialogProps) {
  const { tenant } = useTenant();
  
  // Select language-specific instructions based on tenant
  const instructions = {
    installation: tenant.currency === 'KM' 
      ? (product.installationInstructionsKm || product.installationInstructions)
      : product.installationInstructions,
    activation: tenant.currency === 'KM' 
      ? (product.activationInstructionsKm || product.activationInstructions)
      : product.activationInstructions,
    usage: tenant.currency === 'KM' 
      ? (product.usageInstructionsKm || product.usageInstructions)
      : product.usageInstructions,
    systemRequirements: tenant.currency === 'KM' 
      ? (product.systemRequirementsKm || product.systemRequirements)
      : product.systemRequirements,
    troubleshooting: tenant.currency === 'KM' 
      ? (product.troubleshootingGuideKm || product.troubleshootingGuide)
      : product.troubleshootingGuide,
    support: tenant.currency === 'KM' 
      ? (product.supportContactsKm || product.supportContacts)
      : product.supportContacts,
  };

  // Language-specific labels
  const labels = tenant.currency === 'KM' ? {
    title: "Uputstva za korištenje",
    installation: "Instalacija",
    activation: "Aktivacija", 
    usage: "Korištenje",
    systemReqs: "Sistemski zahtevi",
    troubleshooting: "Rešavanje problema",
    support: "Podrška",
    noInstructions: "Uputstva nisu dostupna za ovaj proizvod.",
    productInfo: "Informacije o proizvodu"
  } : {
    title: "User Instructions",
    installation: "Installation",
    activation: "Activation",
    usage: "Usage Guide", 
    systemReqs: "System Requirements",
    troubleshooting: "Troubleshooting",
    support: "Support",
    noInstructions: "Instructions are not available for this product.",
    productInfo: "Product Information"
  };

  const hasInstructions = Object.values(instructions).some(inst => inst && inst.trim().length > 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {labels.title} - {product.name}
          </DialogTitle>
          <DialogDescription>
            {labels.productInfo} • SKU: {product.sku}
          </DialogDescription>
        </DialogHeader>

        {!hasInstructions ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">{labels.noInstructions}</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="installation" className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="installation" className="text-xs">
                <Download className="h-3 w-3 mr-1" />
                {labels.installation}
              </TabsTrigger>
              <TabsTrigger value="activation" className="text-xs">
                <Settings className="h-3 w-3 mr-1" />
                {labels.activation}
              </TabsTrigger>
              <TabsTrigger value="usage" className="text-xs">
                <PlayCircle className="h-3 w-3 mr-1" />
                {labels.usage}
              </TabsTrigger>
              <TabsTrigger value="system" className="text-xs">
                <Monitor className="h-3 w-3 mr-1" />
                {labels.systemReqs}
              </TabsTrigger>
              <TabsTrigger value="troubleshooting" className="text-xs">
                <HelpCircle className="h-3 w-3 mr-1" />
                {labels.troubleshooting}
              </TabsTrigger>
              <TabsTrigger value="support" className="text-xs">
                <Phone className="h-3 w-3 mr-1" />
                {labels.support}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4">
              <ScrollArea className="h-[60vh]">
                <TabsContent value="installation" className="m-0">
                  <InstructionCard 
                    title={labels.installation}
                    content={instructions.installation}
                    icon={<Download className="h-5 w-5" />}
                  />
                </TabsContent>

                <TabsContent value="activation" className="m-0">
                  <InstructionCard 
                    title={labels.activation}
                    content={instructions.activation}
                    icon={<Settings className="h-5 w-5" />}
                  />
                </TabsContent>

                <TabsContent value="usage" className="m-0">
                  <InstructionCard 
                    title={labels.usage}
                    content={instructions.usage}
                    icon={<PlayCircle className="h-5 w-5" />}
                  />
                </TabsContent>

                <TabsContent value="system" className="m-0">
                  <InstructionCard 
                    title={labels.systemReqs}
                    content={instructions.systemRequirements}
                    icon={<Monitor className="h-5 w-5" />}
                  />
                </TabsContent>

                <TabsContent value="troubleshooting" className="m-0">
                  <InstructionCard 
                    title={labels.troubleshooting}
                    content={instructions.troubleshooting}
                    icon={<HelpCircle className="h-5 w-5" />}
                  />
                </TabsContent>

                <TabsContent value="support" className="m-0">
                  <InstructionCard 
                    title={labels.support}
                    content={instructions.support}
                    icon={<Phone className="h-5 w-5" />}
                  />
                </TabsContent>
              </ScrollArea>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface InstructionCardProps {
  title: string;
  content?: string | null;
  icon: React.ReactNode;
}

function InstructionCard({ title, content, icon }: InstructionCardProps) {
  if (!content || content.trim().length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No instructions available for this section.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </CardContent>
    </Card>
  );
}