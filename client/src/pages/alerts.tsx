import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Search,
  Filter,
  Bell,
  AlertCircle,
  Info,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import Sidebar from "@/components/sidebar";

interface AlertRule {
  alert: string;
  expr: string;
  for: string;
  labels: {
    severity: 'critical' | 'warning' | 'info';
    category: string;
  };
  annotations: {
    summary: string;
    description: string;
  };
}

interface Alert {
  id: string;
  timestamp: string;
  level: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  resolved: boolean;
  source: string;
}

// Mock alert rules - in production, these would come from Prometheus
const mockAlertRules: AlertRule[] = [
  {
    alert: "ApplicationDown",
    expr: "up{job=\"b2b-platform\"} == 0",
    for: "1m",
    labels: {
      severity: "critical",
      category: "system"
    },
    annotations: {
      summary: "B2B Platform application is down",
      description: "The B2B Platform application has been down for more than 1 minute."
    }
  },
  {
    alert: "HighErrorRate",
    expr: "rate(http_requests_total{status=~\"5..\"}[5m]) > 0.1",
    for: "2m",
    labels: {
      severity: "warning",
      category: "performance"
    },
    annotations: {
      summary: "High error rate detected",
      description: "HTTP error rate is above 0.1 errors per second for more than 2 minutes."
    }
  },
  {
    alert: "LicenseKeyGenerationStopped",
    expr: "rate(license_keys_generated_total[5m]) == 0",
    for: "5m",
    labels: {
      severity: "critical",
      category: "business"
    },
    annotations: {
      summary: "License key generation has stopped",
      description: "No license keys have been generated in the last 5 minutes."
    }
  },
  {
    alert: "HighAuthFailureRate",
    expr: "rate(auth_failures_total[5m]) > 0.1",
    for: "3m",
    labels: {
      severity: "warning",
      category: "security"
    },
    annotations: {
      summary: "High authentication failure rate",
      description: "Authentication failure rate is above 0.1 failures per second."
    }
  },
  {
    alert: "DatabaseSlowQueries",
    expr: "histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 1",
    for: "5m",
    labels: {
      severity: "warning",
      category: "database"
    },
    annotations: {
      summary: "Database queries are slow",
      description: "95th percentile of database query duration is above 1 second."
    }
  }
];

// Mock recent alerts - in production, these would come from audit logs
const mockRecentAlerts: Alert[] = [
  {
    id: "1",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    level: "warning",
    category: "performance",
    message: "High response time detected on /api/products endpoint",
    resolved: false,
    source: "prometheus"
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    level: "info",
    category: "system",
    message: "Application successfully restarted",
    resolved: true,
    source: "system"
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    level: "critical",
    category: "security",
    message: "Multiple failed login attempts detected from IP 192.168.1.100",
    resolved: true,
    source: "security-scanner"
  }
];

export default function AlertsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // In production, these would be real API calls
  const { data: alertRules = mockAlertRules, isLoading: rulesLoading, refetch: refetchRules } = useQuery({
    queryKey: ['/api/alerts/rules'],
    queryFn: () => Promise.resolve(mockAlertRules),
    refetchInterval: 60000, // 1 minute
  });

  const { data: recentAlerts = mockRecentAlerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['/api/alerts/recent'],
    queryFn: () => Promise.resolve(mockRecentAlerts),
    refetchInterval: 30000, // 30 seconds
  });

  const filteredAlerts = recentAlerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === "all" || alert.level === selectedSeverity;
    const matchesCategory = selectedCategory === "all" || alert.category === selectedCategory;
    
    return matchesSearch && matchesSeverity && matchesCategory;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500 text-white"><AlertCircle className="w-3 h-3 mr-1" />Warning</Badge>;
      case 'info':
        return <Badge variant="outline"><Info className="w-3 h-3 mr-1" />Info</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date().getTime();
    const alertTime = new Date(timestamp).getTime();
    const diffInMinutes = Math.floor((now - alertTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const categories = Array.from(new Set(recentAlerts.map(alert => alert.category)));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeItem="alerts" userRole="admin" />
      
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Alert Management</h1>
            <p className="text-gray-600">Monitor and manage system alerts and notifications</p>
            
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">
                  {recentAlerts.filter(a => !a.resolved).length} active alerts
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchRules();
                  refetchAlerts();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <Tabs defaultValue="active" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active">Active Alerts</TabsTrigger>
              <TabsTrigger value="rules">Alert Rules</TabsTrigger>
              <TabsTrigger value="history">Alert History</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Critical</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {recentAlerts.filter(a => a.level === 'critical' && !a.resolved).length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Warning</CardTitle>
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {recentAlerts.filter(a => a.level === 'warning' && !a.resolved).length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Info</CardTitle>
                    <Info className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {recentAlerts.filter(a => a.level === 'info' && !a.resolved).length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {recentAlerts.filter(a => a.resolved).length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Filter Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-500" />
                      <Input
                        placeholder="Search alerts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64"
                      />
                    </div>
                    
                    <select
                      value={selectedSeverity}
                      onChange={(e) => setSelectedSeverity(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="all">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="warning">Warning</option>
                      <option value="info">Info</option>
                    </select>

                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Alerts</CardTitle>
                  <CardDescription>
                    Latest system alerts and notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {alertsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAlerts.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No alerts match your filters</p>
                      ) : (
                        filteredAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`p-4 border rounded-lg ${
                              !alert.resolved ? 'border-l-4 border-l-red-500 bg-red-50' : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {getSeverityBadge(alert.level)}
                                  <Badge variant="outline">{alert.category}</Badge>
                                  {alert.resolved && (
                                    <Badge variant="outline" className="bg-green-100 text-green-800">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Resolved
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium text-gray-900 mb-1">{alert.message}</p>
                                <div className="text-sm text-gray-600">
                                  <span>Source: {alert.source}</span>
                                  <span className="mx-2">•</span>
                                  <span>{getTimeAgo(alert.timestamp)}</span>
                                  <span className="mx-2">•</span>
                                  <span>{formatTimestamp(alert.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rules" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Alert Rules Configuration</CardTitle>
                  <CardDescription>
                    Active alerting rules and their thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {rulesLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {alertRules.map((rule, index) => (
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-lg">{rule.alert}</h3>
                              <p className="text-gray-600">{rule.annotations.summary}</p>
                            </div>
                            <div className="flex gap-2">
                              {getSeverityBadge(rule.labels.severity)}
                              <Badge variant="outline">{rule.labels.category}</Badge>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded text-sm font-mono mb-3">
                            <div><strong>Expression:</strong> {rule.expr}</div>
                            <div><strong>Duration:</strong> {rule.for}</div>
                          </div>
                          
                          <p className="text-sm text-gray-700">{rule.annotations.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Alert History</CardTitle>
                  <CardDescription>
                    Complete history of all system alerts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="p-4 border rounded-lg bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getSeverityBadge(alert.level)}
                              <Badge variant="outline">{alert.category}</Badge>
                              {alert.resolved ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Resolved
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-red-100 text-red-800">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-gray-900 mb-1">{alert.message}</p>
                            <div className="text-sm text-gray-600">
                              <span>Source: {alert.source}</span>
                              <span className="mx-2">•</span>
                              <span>{formatTimestamp(alert.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* External Tools Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>External Alert Management</CardTitle>
              <CardDescription>
                Access external alerting and monitoring tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => window.open('http://localhost:9093', '_blank')}
                  className="justify-start h-auto p-4"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <span className="font-semibold">Alertmanager</span>
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-gray-600">Manage alert routing and notifications</p>
                  </div>
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => window.open('http://localhost:9090/rules', '_blank')}
                  className="justify-start h-auto p-4"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <Filter className="w-5 h-5 text-orange-500" />
                      <span className="font-semibold">Prometheus Rules</span>
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-gray-600">View and manage alerting rules</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}