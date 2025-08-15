import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Settings, 
  TestTube, 
  Brain, 
  BarChart3, 
  Mail, 
  Users, 
  Target,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  Eye,
  Shuffle
} from 'lucide-react';

interface SmartNotificationsDashboard {
  overview: {
    activeRules: number;
    activeABTests: number;
    availableTemplates: number;
    personalizationRules: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
    metadata: any;
  }>;
  templates: Array<{
    id: string;
    name: string;
    type: string;
    tenant?: string;
    language: string;
    variants: number;
  }>;
  abTests: Array<{
    id: string;
    name: string;
    status: string;
    variants: number;
    participants: number;
    conversionRate: number;
  }>;
}

export function SmartNotificationsPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [previewContent, setPreviewContent] = useState<any>(null);

  // Fetch dashboard data
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['/api/admin/smart-notifications/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['/api/admin/smart-notifications/templates'],
  });

  // Fetch routing analytics
  const { data: routingAnalytics } = useQuery({
    queryKey: ['/api/admin/smart-notifications/routing/analytics'],
  });

  const handlePreviewTemplate = async (templateId: string, variant?: string) => {
    try {
      const response = await fetch(`/api/admin/smart-notifications/templates/${templateId}/preview${variant ? `?variant=${variant}` : ''}`);
      const result = await response.json();
      if (result.success) {
        setPreviewContent(result.data);
      }
    } catch (error) {
      console.error('Failed to preview template:', error);
    }
  };

  const handleSendTestEmail = async () => {
    if (!selectedTemplate || !testEmail) return;
    
    try {
      const response = await fetch(`/api/admin/smart-notifications/templates/${selectedTemplate}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: testEmail })
      });
      const result = await response.json();
      if (result.success) {
        alert('Test email sent successfully!');
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <Bot className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p>Loading Smart Notifications...</p>
        </div>
      </div>
    );
  }

  const dashboardData: SmartNotificationsDashboard = dashboard?.data || {
    overview: { activeRules: 0, activeABTests: 0, availableTemplates: 0, personalizationRules: 0 },
    recentActivity: [],
    templates: [],
    abTests: []
  };

  // Debug log to check data
  console.log('Dashboard data received:', dashboard?.data);
  console.log('Templates data:', dashboardData.templates);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Smart Notifications</h1>
          <p className="text-gray-600 mt-1">Advanced routing, A/B testing, and personalization</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          Step 5: Active
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Rules</p>
                <p className="text-2xl font-bold text-primary">{dashboardData.overview.activeRules}</p>
              </div>
              <Settings className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">A/B Tests</p>
                <p className="text-2xl font-bold text-primary">{dashboardData.overview.activeABTests}</p>
              </div>
              <TestTube className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Templates</p>
                <p className="text-2xl font-bold text-primary">{dashboardData.overview.availableTemplates}</p>
              </div>
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Personalizations</p>
                <p className="text-2xl font-bold text-primary">{dashboardData.overview.personalizationRules}</p>
              </div>
              <Brain className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="routing">Routing Rules</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest smart notification actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData.recentActivity.length > 0 ? (
                    dashboardData.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  System Status
                </CardTitle>
                <CardDescription>Smart notification system health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Routing Engine</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Template Engine</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">A/B Test Framework</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Personalization</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Template List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Email Templates
                </CardTitle>
                <CardDescription>Available notification templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(dashboardData.templates && dashboardData.templates.length > 0) ? (
                    dashboardData.templates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {template.type}
                            </Badge>
                            {template.tenant && (
                              <Badge variant="outline" className="text-xs">
                                {template.tenant}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {template.language}
                            </Badge>
                            {template.variants > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {template.variants} variants
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePreviewTemplate(template.id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">No templates available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Template Testing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Test Templates
                </CardTitle>
                <CardDescription>Send test emails and preview templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="template-select">Select Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dashboardData.templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="test-email">Test Email Address</Label>
                  <Input
                    id="test-email"
                    type="email"
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleSendTestEmail}
                    disabled={!selectedTemplate || !testEmail}
                    className="flex-1"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Test
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selectedTemplate && handlePreviewTemplate(selectedTemplate)}
                    disabled={!selectedTemplate}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                </div>

                {previewContent && (
                  <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium mb-2">Preview</h4>
                    <p className="text-sm"><strong>Subject:</strong> {previewContent.subject}</p>
                    <div className="mt-2 text-xs text-gray-600 max-h-32 overflow-y-auto">
                      <div dangerouslySetInnerHTML={{ 
                        __html: previewContent.htmlContent?.substring(0, 500) + '...' 
                      }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="routing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Routing Rules
              </CardTitle>
              <CardDescription>
                Intelligent notification routing based on user profiles, behavior, and context
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Routing rules are currently configured in code. Future versions will include a visual rule editor.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">VIP User Routing</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      High-priority routing for admin and super admin users
                    </p>
                    <Badge variant="default">Active</Badge>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Tenant-Specific Rules</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Language and currency customization per tenant
                    </p>
                    <Badge variant="default">Active</Badge>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">High-Value Orders</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Special handling for orders over €1000
                    </p>
                    <Badge variant="default">Active</Badge>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Business Hours</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Optimized delivery timing for business hours
                    </p>
                    <Badge variant="default">Active</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ab-testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="w-5 h-5" />
                A/B Testing
              </CardTitle>
              <CardDescription>
                Experiment with different notification approaches to optimize engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.abTests.map((test) => (
                  <div key={test.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{test.name}</h4>
                      <Badge variant={test.status === 'active' ? 'default' : 'secondary'}>
                        {test.status}
                      </Badge>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-gray-600">Variants</p>
                        <p className="text-lg font-semibold">{test.variants}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Participants</p>
                        <p className="text-lg font-semibold">{test.participants}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Conversion Rate</p>
                        <p className="text-lg font-semibold">{test.conversionRate}%</p>
                      </div>
                    </div>

                    <Progress value={50} className="mt-3" />
                    <p className="text-xs text-gray-500 mt-1">50% traffic split</p>
                  </div>
                ))}

                {dashboardData.abTests.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No A/B tests configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Routing Analytics
              </CardTitle>
              <CardDescription>
                Performance metrics and insights for smart notification routing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-4">Performance Metrics</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Notifications</span>
                      <span className="font-medium">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Routed Notifications</span>
                      <span className="font-medium">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">A/B Test Participants</span>
                      <span className="font-medium">0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Personalized</span>
                      <span className="font-medium">0</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Effectiveness</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Open Rate Improvement</span>
                      <span className="font-medium text-green-600">+0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Click Rate Improvement</span>
                      <span className="font-medium text-green-600">+0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Conversion Rate</span>
                      <span className="font-medium text-green-600">+0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Processing Time</span>
                      <span className="font-medium">0ms</span>
                    </div>
                  </div>
                </div>
              </div>

              <Alert className="mt-6">
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  Analytics data will populate as notifications are processed through the smart routing system.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}