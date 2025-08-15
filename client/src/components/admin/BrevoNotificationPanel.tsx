import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Mail, 
  Send, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  Settings,
  Database,
  TrendingUp
} from 'lucide-react';
import { NotificationAnalyticsDashboard } from './NotificationAnalyticsDashboard';

interface NotificationStatus {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
}

interface BrevoAccount {
  email: string;
  name: string;
  company: string;
  plan: Array<{
    type: string;
    credits: number;
    creditsType: string;
  }>;
}

interface TestEmailData {
  recipient: string;
  templateName: string;
  tenant: 'EUR' | 'KM';
  testData: Record<string, any>;
}

export function BrevoNotificationPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [testEmailDialog, setTestEmailDialog] = useState(false);
  const [connectionTestDialog, setConnectionTestDialog] = useState(false);
  const [testEmailData, setTestEmailData] = useState<TestEmailData>({
    recipient: '',
    templateName: 'order-confirmation',
    tenant: 'EUR',
    testData: {}
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch connection status
  const { data: connectionStatus, isLoading: connectionLoading } = useQuery({
    queryKey: ['/api/admin/brevo-notifications/test-connection'],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  // Fetch queue status
  const { data: queueStatus, isLoading: queueLoading } = useQuery({
    queryKey: ['/api/admin/brevo-notifications/queue/status'],
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false,
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/brevo-notifications/test-connection', 'GET'),
    onSuccess: (data) => {
      toast({
        title: data.success ? "Connection Successful" : "Connection Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brevo-notifications/test-connection'] });
    },
    onError: (error) => {
      toast({
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (data: TestEmailData) => {
      const response = await fetch('/api/admin/brevo-notifications/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Test Email Sent" : "Email Failed",
        description: data.success 
          ? `Email sent successfully. Message ID: ${data.messageId?.substring(0, 20)}...`
          : data.error,
        variant: data.success ? "default" : "destructive",
      });
      setTestEmailDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brevo-notifications/queue/status'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Test Email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTestEmail = () => {
    if (!testEmailData.recipient) {
      toast({
        title: "Validation Error",
        description: "Please enter a recipient email address",
        variant: "destructive",
      });
      return;
    }
    sendTestEmailMutation.mutate(testEmailData);
  };

  const renderConnectionStatus = () => {
    if (connectionLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Brevo Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Testing connection...</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    const isConnected = (connectionStatus as any)?.success;
    const accountData: BrevoAccount = (connectionStatus as any)?.data;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Brevo Connection
            {isConnected ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Disconnected
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isConnected ? 'API connection is active' : 'Unable to connect to Brevo API'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected && accountData ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Account:</span>
                <span className="text-sm font-medium">{accountData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Company:</span>
                <span className="text-sm font-medium">{accountData.company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Credits:</span>
                <span className="text-sm font-medium">
                  {accountData.plan?.find(p => p.type === 'subscription')?.credits?.toLocaleString() || 'N/A'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              {(connectionStatus as any)?.error || 'Connection test failed'}
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={() => testConnectionMutation.mutate()}
              disabled={testConnectionMutation.isPending}
              size="sm"
            >
              {testConnectionMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Activity className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Dialog open={connectionTestDialog} onOpenChange={setConnectionTestDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Details
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connection Details</DialogTitle>
                  <DialogDescription>
                    Brevo API connection information and diagnostics
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(connectionStatus, null, 2)}
                  </pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQueueStatus = () => {
    if (queueLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Notification Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading queue status...</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    const status: NotificationStatus = (queueStatus as any)?.queueStatus || {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Notification Queue
          </CardTitle>
          <CardDescription>
            Current queue statistics and processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{status.pending}</div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                Pending
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{status.processing}</div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Processing
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{status.sent}</div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Sent
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{status.failed}</div>
              <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Failed
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTestEmailForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send Test Email
        </CardTitle>
        <CardDescription>
          Send a test email to verify the notification system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="w-4 h-4 mr-2" />
              Send Test Email
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
              <DialogDescription>
                Configure and send a test email through the Brevo system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recipient">Recipient Email</Label>
                <Input
                  id="recipient"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmailData.recipient}
                  onChange={(e) => setTestEmailData(prev => ({ ...prev, recipient: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="template">Template</Label>
                <Select 
                  value={testEmailData.templateName} 
                  onValueChange={(value) => setTestEmailData(prev => ({ ...prev, templateName: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order-confirmation">Order Confirmation</SelectItem>
                    <SelectItem value="license-key-delivery">License Key Delivery</SelectItem>
                    <SelectItem value="welcome-email">Welcome Email</SelectItem>
                    <SelectItem value="password-reset">Password Reset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tenant">Tenant</Label>
                <Select 
                  value={testEmailData.tenant} 
                  onValueChange={(value: 'EUR' | 'KM') => setTestEmailData(prev => ({ ...prev, tenant: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR Shop (English)</SelectItem>
                    <SelectItem value="KM">KM Shop (Bosnian)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="testData">Test Data (JSON)</Label>
                <Textarea
                  id="testData"
                  placeholder='{"customerName": "Test Customer", "orderNumber": "ORD-12345"}'
                  value={JSON.stringify(testEmailData.testData, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setTestEmailData(prev => ({ ...prev, testData: parsed }));
                    } catch {
                      // Keep previous value if invalid JSON
                    }
                  }}
                />
              </div>
              <Button 
                onClick={handleTestEmail}
                disabled={sendTestEmailMutation.isPending}
                className="w-full"
              >
                {sendTestEmailMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Test Email
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Brevo Email Notifications</h2>
          <p className="text-gray-600">Manage and monitor your email notification system</p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Activity className="w-3 h-3 mr-1" />
          System Active
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {renderConnectionStatus()}
            {renderQueueStatus()}
          </div>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          {renderTestEmailForm()}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <NotificationAnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}