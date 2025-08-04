import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Server, 
  Database, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Eye,
  ExternalLink
} from "lucide-react";
import Sidebar from "@/components/sidebar";

interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  database: {
    tables: Array<{
      schemaname: string;
      tablename: string;
      inserts: number;
      updates: number;
      deletes: number;
    }>;
  };
}

interface MonitoringStatus {
  monitoring: {
    prometheus: string;
    grafana: string;
    alertmanager: string;
    sentry: string;
    audit_logging: string;
  };
  endpoints: {
    metrics: string;
    health: string;
    webhooks: {
      general: string;
      critical: string;
      warning: string;
    };
  };
}

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

export default function MonitoringPage() {
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  const { data: healthData, isLoading: healthLoading } = useQuery<HealthStatus>({
    queryKey: ['/health'],
    refetchInterval: refreshInterval,
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery<SystemMetrics>({
    queryKey: ['/metrics'],
    refetchInterval: refreshInterval,
  });

  const { data: monitoringStatus, isLoading: statusLoading } = useQuery<MonitoringStatus>({
    queryKey: ['/monitoring/status'],
    refetchInterval: 60000, // 1 minute
  });

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'healthy':
      case 'configured':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'disabled':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{status}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeItem="monitoring" userRole="admin" />
      
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">System Monitoring</h1>
            <p className="text-gray-600">Enterprise-grade monitoring dashboard for B2B platform</p>
            
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600">
                  Auto-refresh: {refreshInterval / 1000}s
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefreshInterval(refreshInterval === 30000 ? 10000 : 30000)}
              >
                {refreshInterval === 30000 ? 'Fast Refresh' : 'Normal Refresh'}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="system">System Metrics</TabsTrigger>
              <TabsTrigger value="database">Database</TabsTrigger>
              <TabsTrigger value="external">External Tools</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* System Health Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">System Status</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {healthLoading ? (
                      <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <div>
                        <div className="text-2xl font-bold">
                          {getStatusBadge(healthData?.status || 'Unknown')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Uptime: {healthData ? formatUptime(healthData.uptime) : 'N/A'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <div>
                        <div className="text-2xl font-bold">
                          {metricsData ? formatBytes(metricsData.memory.heapUsed) : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          of {metricsData ? formatBytes(metricsData.memory.heapTotal) : 'N/A'} heap
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Database Activity</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="h-6 bg-gray-200 rounded animate-pulse" />
                    ) : (
                      <div>
                        <div className="text-2xl font-bold">
                          {metricsData?.database.tables.length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Active tables
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Monitoring Services Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Monitoring Services</CardTitle>
                  <CardDescription>
                    Status of enterprise monitoring infrastructure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statusLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Prometheus</span>
                          {getStatusBadge(monitoringStatus?.monitoring.prometheus || 'Unknown')}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Grafana</span>
                          {getStatusBadge(monitoringStatus?.monitoring.grafana || 'Unknown')}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Alertmanager</span>
                          {getStatusBadge(monitoringStatus?.monitoring.alertmanager || 'Unknown')}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Sentry</span>
                          {getStatusBadge(monitoringStatus?.monitoring.sentry || 'Unknown')}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Audit Logging</span>
                          {getStatusBadge(monitoringStatus?.monitoring.audit_logging || 'Unknown')}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Metrics</CardTitle>
                  <CardDescription>Real-time system performance data</CardDescription>
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : metricsData ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold mb-3">Memory Usage</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 border rounded">
                            <div className="text-sm text-gray-600">RSS</div>
                            <div className="font-bold">{formatBytes(metricsData.memory.rss)}</div>
                          </div>
                          <div className="p-3 border rounded">
                            <div className="text-sm text-gray-600">Heap Total</div>
                            <div className="font-bold">{formatBytes(metricsData.memory.heapTotal)}</div>
                          </div>
                          <div className="p-3 border rounded">
                            <div className="text-sm text-gray-600">Heap Used</div>
                            <div className="font-bold">{formatBytes(metricsData.memory.heapUsed)}</div>
                          </div>
                          <div className="p-3 border rounded">
                            <div className="text-sm text-gray-600">External</div>
                            <div className="font-bold">{formatBytes(metricsData.memory.external)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No metrics data available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="database" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Database Statistics</CardTitle>
                  <CardDescription>Table-level activity and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : metricsData?.database.tables ? (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Table</th>
                              <th className="text-right p-2">Inserts</th>
                              <th className="text-right p-2">Updates</th>
                              <th className="text-right p-2">Deletes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metricsData.database.tables.map((table, index) => (
                              <tr key={index} className="border-b">
                                <td className="p-2 font-medium">{table.tablename}</td>
                                <td className="p-2 text-right">{table.inserts}</td>
                                <td className="p-2 text-right">{table.updates}</td>
                                <td className="p-2 text-right">{table.deletes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">No database metrics available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="external" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>External Monitoring Tools</CardTitle>
                  <CardDescription>
                    Direct access to external monitoring dashboards and tools
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-5 h-5 text-blue-500" />
                        <h3 className="font-semibold">Grafana Dashboard</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Real-time B2B platform metrics and visualizations
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => window.open('http://localhost:3000', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Grafana
                      </Button>
                      <p className="text-xs text-gray-500 mt-2">
                        Default: admin / admin123
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-orange-500" />
                        <h3 className="font-semibold">Prometheus</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Metrics collection and alerting rules
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => window.open('http://localhost:9090', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Prometheus
                      </Button>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <h3 className="font-semibold">Alertmanager</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Alert management and routing
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => window.open('http://localhost:9093', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Alertmanager
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Quick Start</h4>
                    <p className="text-sm text-gray-700 mb-3">
                      To launch the complete monitoring stack with all dashboards:
                    </p>
                    <code className="bg-white px-3 py-2 rounded text-sm border">
                      ./scripts/start-monitoring.sh
                    </code>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}