import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Target,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsSummary {
  totalNotifications: number;
  deliveryRate: number;
  bounceRate: number;
  avgProcessingTime: number;
  dailyTrends: DailyTrend[];
  templatePerformance: TemplatePerformance[];
  recentEvents: NotificationEvent[];
}

interface DailyTrend {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  deliveryRate: number;
}

interface TemplatePerformance {
  templateName: string;
  tenantId: string;
  language: string;
  totalSent: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  lastSentAt: Date | null;
}

interface NotificationEvent {
  id: string;
  eventType: string;
  timestamp: Date;
  source: string;
  eventData: any;
}

interface RealTimeMetrics {
  activeQueue: number;
  processingRate: number;
  errorRate: number;
  avgResponseTime: number;
  lastHourTrends: HourlyTrend[];
}

interface HourlyTrend {
  hour: string;
  sent: number;
  delivered: number;
  failed: number;
}

const COLORS = ['#FFB20F', '#6E6F71', '#22c55e', '#ef4444', '#3b82f6', '#8b5cf6'];

export function NotificationAnalyticsDashboard() {
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30d');
  const { toast } = useToast();

  // Fetch analytics summary
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery<{ success: boolean; data: AnalyticsSummary }>({
    queryKey: ['/api/admin/notification-analytics/summary', selectedTenant, timeRange],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch real-time metrics
  const { data: realTimeMetrics, isLoading: realTimeLoading, refetch: refetchRealTime } = useQuery<{ success: boolean; data: RealTimeMetrics }>({
    queryKey: ['/api/admin/notification-analytics/real-time', selectedTenant],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch failure analysis
  const { data: failureAnalysis, isLoading: failureLoading } = useQuery<{ success: boolean; data: { failureReasons: Array<{ reason: string; count: number }>, totalFailures: number } }>({
    queryKey: ['/api/admin/notification-analytics/failures', selectedTenant, '7'],
    refetchInterval: 60000, // Refresh every minute
  });

  const handleManualRefresh = async () => {
    try {
      await Promise.all([
        refetchAnalytics(),
        refetchRealTime()
      ]);
      toast({
        title: "Dashboard Updated",
        description: "Analytics data has been refreshed successfully.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh dashboard data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-500';
      case 'sent': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'bounced': return 'bg-orange-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (analyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Notification Analytics Dashboard</h2>
          <Button disabled>
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading...
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#6E6F71]">Advanced Notification Analytics</h2>
        <div className="flex items-center gap-4">
          <select 
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Tenants</option>
            <option value="EUR">EUR Shop</option>
            <option value="KM">KM Shop</option>
          </select>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <Button onClick={handleManualRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#6E6F71]">
              {analytics?.data?.totalNotifications?.toLocaleString() || '0'}
            </div>
            <Badge variant="outline" className="text-xs">
              {timeRange.replace('d', ' days')}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analytics?.data?.deliveryRate?.toFixed(1) || '0'}%
            </div>
            <Progress 
              value={analytics?.data?.deliveryRate || 0} 
              className="w-full h-2 mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {analytics?.data?.bounceRate?.toFixed(1) || '0'}%
            </div>
            <Progress 
              value={analytics?.data?.bounceRate || 0} 
              className="w-full h-2 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {analytics?.data?.avgProcessingTime || '0'}ms
            </div>
            <p className="text-xs text-muted-foreground">per notification</p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Metrics */}
      {realTimeMetrics?.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time System Status
            </CardTitle>
            <CardDescription>Live monitoring of notification system performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#FFB20F]">
                  {realTimeMetrics.data.activeQueue}
                </div>
                <p className="text-sm text-muted-foreground">Queue Length</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {realTimeMetrics.data.processingRate}/hr
                </div>
                <p className="text-sm text-muted-foreground">Processing Rate</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {realTimeMetrics.data.errorRate.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {realTimeMetrics.data.avgResponseTime}ms
                </div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts and Detailed Analytics */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Target className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="failures">
            <AlertCircle className="h-4 w-4 mr-2" />
            Failures
          </TabsTrigger>
          <TabsTrigger value="events">
            <Activity className="h-4 w-4 mr-2" />
            Live Events
          </TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Notification Trends</CardTitle>
              <CardDescription>Volume and delivery performance over time</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={analytics?.data?.dailyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => `Date: ${formatDate(value)}`}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="sent" 
                    stackId="1"
                    stroke="#FFB20F" 
                    fill="#FFB20F" 
                    name="Sent"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="delivered" 
                    stackId="1"
                    stroke="#22c55e" 
                    fill="#22c55e" 
                    name="Delivered"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="bounced" 
                    stackId="1"
                    stroke="#f97316" 
                    fill="#f97316" 
                    name="Bounced"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="failed" 
                    stackId="1"
                    stroke="#ef4444" 
                    fill="#ef4444" 
                    name="Failed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Template Performance</CardTitle>
                <CardDescription>Open and click rates by template type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.data?.templatePerformance?.map((template: TemplatePerformance, index: number) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{template.templateName}</span>
                        <Badge variant="outline">{template.totalSent} sent</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Open: </span>
                          <span className="font-medium text-green-600">
                            {template.openRate.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Click: </span>
                          <span className="font-medium text-blue-600">
                            {template.clickRate.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bounce: </span>
                          <span className="font-medium text-orange-600">
                            {template.bounceRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )) || <p className="text-muted-foreground">No template data available</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Status Distribution</CardTitle>
                <CardDescription>Current status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.data && (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Delivered', value: analytics.data.deliveryRate, fill: '#22c55e' },
                          { name: 'Bounced', value: analytics.data.bounceRate, fill: '#f97316' },
                          { name: 'Other', value: 100 - analytics.data.deliveryRate - analytics.data.bounceRate, fill: '#6b7280' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[{ name: 'Delivered', value: analytics.data.deliveryRate, fill: '#22c55e' }].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Failures Tab */}
        <TabsContent value="failures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Failure Analysis</CardTitle>
              <CardDescription>Common failure reasons and troubleshooting data</CardDescription>
            </CardHeader>
            <CardContent>
              {failureLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : failureAnalysis?.data?.failureReasons && failureAnalysis.data.failureReasons.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Total failures in last 7 days: {failureAnalysis?.data?.totalFailures || 0}
                  </div>
                  {failureAnalysis.data.failureReasons.map((failure: { reason: string; count: number }, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{failure.reason || 'Unknown Error'}</div>
                        <div className="text-sm text-muted-foreground">
                          {failure.count} occurrences
                        </div>
                      </div>
                      <Badge variant="destructive">{failure.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  No failures detected in the last 7 days
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notification Events</CardTitle>
              <CardDescription>Live feed of notification system activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {analytics?.data?.recentEvents?.map((event: NotificationEvent, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(event.eventType)}`}></div>
                      <div>
                        <div className="font-medium">{event.eventType}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.eventData?.type} • {event.eventData?.recipient}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4" />
                    No recent events to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}