import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  LifeBuoy, 
  BookOpen, 
  HelpCircle, 
  Users, 
  BarChart3,
  Plus,
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  FileText,
  UserCheck,
  MessageSquare
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Form schemas
const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  tags: z.string().optional(),
  isPublished: z.boolean().default(true)
});

const createFaqSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters"),
  answer: z.string().min(10, "Answer must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  order: z.number().min(0).default(0)
});

type CreateArticleForm = z.infer<typeof createArticleSchema>;
type CreateFaqForm = z.infer<typeof createFaqSchema>;

export function AdminSupportManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Statistics query
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/support/tickets/stats'],
    retry: false
  });

  // Tickets query
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['/api/admin/support/tickets'],
    retry: false
  });

  // Filtered tickets for display
  const filteredTickets = React.useMemo(() => {
    if (!(tickets as any)?.data) return [];
    
    return (tickets as any).data.filter((ticket: any) => {
      const matchesSearch = !searchTerm || 
        ticket.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [(tickets as any)?.data, searchTerm, statusFilter, priorityFilter]);

  // Knowledge base articles query
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['/api/admin/support/kb/articles'],
    retry: false
  });

  // FAQ query
  const { data: faqs, isLoading: faqsLoading } = useQuery({
    queryKey: ['/api/admin/support/faqs'],
    retry: false
  });

  const statsData = (stats as any)?.data || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    avgResponseTime: "0 hours",
    satisfactionRating: 0
  };

  const ticketData = filteredTickets || [];
  const articleData = (articles as any)?.data || [];
  const faqData = (faqs as any)?.data || [];

  // Overview Section Component
  const OverviewSection = () => (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#6E6F71]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6E6F71]">Total Tickets</p>
                <p className="text-2xl font-bold text-[#6E6F71]">
                  {statsLoading ? "..." : statsData.total}
                </p>
              </div>
              <LifeBuoy className="h-8 w-8 text-[#FFB20F]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#6E6F71]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6E6F71]">Open Tickets</p>
                <p className="text-2xl font-bold text-[#6E6F71]">
                  {statsLoading ? "..." : statsData.open}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#6E6F71]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6E6F71]">In Progress</p>
                <p className="text-2xl font-bold text-[#6E6F71]">
                  {statsLoading ? "..." : statsData.inProgress}
                </p>
              </div>
              <Clock className="h-8 w-8 text-[#FFB20F]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#6E6F71]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#6E6F71]">Resolved</p>
                <p className="text-2xl font-bold text-[#6E6F71]">
                  {statsLoading ? "..." : statsData.resolved}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-[#6E6F71]">
        <CardHeader className="bg-[#6E6F71] text-white">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Support Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {ticketData.slice(0, 5).map((ticket: any) => (
              <div key={ticket.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#FFB20F] rounded-full"></div>
                  <div>
                    <p className="font-medium text-[#6E6F71]">{ticket.subject}</p>
                    <p className="text-sm text-gray-600">by {ticket.userFirstName} {ticket.userLastName}</p>
                  </div>
                </div>
                <Badge variant={ticket.status === 'open' ? 'destructive' : ticket.status === 'in_progress' ? 'default' : 'secondary'}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Ticket Management Section
  const TicketManagementSection = () => {
    const StatusBadge = ({ status }: { status: string }) => {
      const colors = {
        open: 'bg-blue-100 text-blue-800',
        in_progress: 'bg-yellow-100 text-yellow-800',
        resolved: 'bg-green-100 text-green-800',
        closed: 'bg-gray-100 text-gray-800'
      };
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || colors.open}`}>
          {status.replace('_', ' ')}
        </span>
      );
    };

    const PriorityBadge = ({ priority }: { priority: string }) => {
      const colors = {
        low: 'bg-green-100 text-green-800',
        medium: 'bg-yellow-100 text-yellow-800',
        high: 'bg-orange-100 text-orange-800',
        urgent: 'bg-red-100 text-red-800'
      };
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[priority as keyof typeof colors] || colors.medium}`}>
          {priority}
        </span>
      );
    };

    return (
      <div className="space-y-4">
        {/* Filters */}
        <Card className="border-[#6E6F71]">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-[#6E6F71] focus:border-[#FFB20F]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] border-[#6E6F71]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px] border-[#6E6F71]">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card className="border-[#6E6F71]">
          <CardHeader className="bg-[#6E6F71] text-white">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Support Tickets Management
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6E6F71] uppercase tracking-wider">Ticket</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6E6F71] uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6E6F71] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6E6F71] uppercase tracking-wider">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6E6F71] uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#6E6F71] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ticketsLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6E6F71] mx-auto"></div>
                        <p className="mt-2 text-[#6E6F71]">Loading tickets...</p>
                      </td>
                    </tr>
                  ) : ticketData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No tickets found</h3>
                        <p className="mt-1 text-sm text-gray-500">No support tickets match your current filters.</p>
                      </td>
                    </tr>
                  ) : (
                    ticketData.map((ticket: any) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div>
                            <div className="text-sm font-medium text-[#6E6F71]">{ticket.subject}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{ticket.message}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-[#6E6F71]">{ticket.userFirstName} {ticket.userLastName}</div>
                          <div className="text-sm text-gray-500">{ticket.userEmail}</div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={ticket.status} />
                        </td>
                        <td className="px-4 py-4">
                          <PriorityBadge priority={ticket.priority} />
                        </td>
                        <td className="px-4 py-4 text-sm text-[#6E6F71]">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            size="sm"
                            className="bg-[#FFB20F] hover:bg-[#e6a00e] text-white"
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Knowledge Base Management Section
  const KnowledgeBaseSection = () => {
    const [showCreateForm, setShowCreateForm] = useState(false);

    const form = useForm<CreateArticleForm>({
      resolver: zodResolver(createArticleSchema),
      defaultValues: {
        title: '',
        content: '',
        category: '',
        tags: '',
        isPublished: true
      }
    });

    const createArticleMutation = useMutation({
      mutationFn: async (data: CreateArticleForm) => {
        const response = await fetch('/api/admin/support/kb/articles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create article: ${response.statusText}`);
        }
        
        return response.json();
      },
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Knowledge base article created successfully",
        });
        form.reset();
        setShowCreateForm(false);
        queryClient.invalidateQueries({ queryKey: ['/api/admin/support/kb/articles'] });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to create article",
          variant: "destructive",
        });
      }
    });

    const onSubmit = (data: CreateArticleForm) => {
      createArticleMutation.mutate(data);
    };

    return (
      <div className="space-y-4">
        <Card className="border-[#6E6F71]">
          <CardHeader className="bg-[#6E6F71] text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Knowledge Base Management
              </CardTitle>
              <Button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Article
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {showCreateForm && (
              <Card className="mb-4 border-[#FFB20F]">
                <CardHeader>
                  <CardTitle className="text-[#6E6F71]">Create New Article</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#6E6F71]">Title</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="border-[#6E6F71] focus:border-[#FFB20F]"
                                placeholder="Enter article title"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#6E6F71]">Category</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="border-[#6E6F71]">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">General</SelectItem>
                                  <SelectItem value="technical">Technical</SelectItem>
                                  <SelectItem value="billing">Billing</SelectItem>
                                  <SelectItem value="account">Account</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#6E6F71]">Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="border-[#6E6F71] focus:border-[#FFB20F] min-h-[120px]"
                                placeholder="Enter article content"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          disabled={createArticleMutation.isPending}
                          className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black"
                        >
                          {createArticleMutation.isPending ? "Creating..." : "Create Article"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setShowCreateForm(false)}
                          className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Articles List */}
            <div className="space-y-3">
              {articlesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6E6F71] mx-auto"></div>
                  <p className="mt-2 text-[#6E6F71]">Loading articles...</p>
                </div>
              ) : articleData.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No articles found</h3>
                  <p className="mt-1 text-sm text-gray-500">Create your first knowledge base article.</p>
                </div>
              ) : (
                articleData.map((article: any) => (
                  <Card key={article.id} className="border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-[#6E6F71] mb-2">{article.title}</h3>
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">{article.content}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{article.category}</Badge>
                            <span className="text-xs text-gray-500">
                              Created {new Date(article.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant={article.isPublished ? "default" : "secondary"}>
                            {article.isPublished ? "Published" : "Draft"}
                          </Badge>
                          <Button size="sm" variant="outline" className="border-[#6E6F71] text-[#6E6F71]">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // FAQ Management Section - Similar structure to Knowledge Base
  const FAQSection = () => {
    const [showCreateForm, setShowCreateForm] = useState(false);

    const form = useForm<CreateFaqForm>({
      resolver: zodResolver(createFaqSchema),
      defaultValues: {
        question: '',
        answer: '',
        category: '',
        order: 0
      }
    });

    const createFaqMutation = useMutation({
      mutationFn: async (data: CreateFaqForm) => {
        const response = await fetch('/api/admin/support/faqs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create FAQ: ${response.statusText}`);
        }
        
        return response.json();
      },
      onSuccess: () => {
        toast({
          title: "Success",
          description: "FAQ created successfully",
        });
        form.reset();
        setShowCreateForm(false);
        queryClient.invalidateQueries({ queryKey: ['/api/admin/support/faqs'] });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to create FAQ",
          variant: "destructive",
        });
      }
    });

    const onSubmit = (data: CreateFaqForm) => {
      createFaqMutation.mutate(data);
    };

    return (
      <div className="space-y-4">
        <Card className="border-[#6E6F71]">
          <CardHeader className="bg-[#6E6F71] text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                FAQ Management
              </CardTitle>
              <Button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                New FAQ
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {showCreateForm && (
              <Card className="mb-4 border-[#FFB20F]">
                <CardHeader>
                  <CardTitle className="text-[#6E6F71]">Create New FAQ</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="question"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#6E6F71]">Question</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="border-[#6E6F71] focus:border-[#FFB20F]"
                                placeholder="Enter FAQ question"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#6E6F71]">Category</FormLabel>
                            <FormControl>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="border-[#6E6F71]">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">General</SelectItem>
                                  <SelectItem value="technical">Technical</SelectItem>
                                  <SelectItem value="billing">Billing</SelectItem>
                                  <SelectItem value="account">Account</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="answer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#6E6F71]">Answer</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="border-[#6E6F71] focus:border-[#FFB20F] min-h-[120px]"
                                placeholder="Enter FAQ answer"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          disabled={createFaqMutation.isPending}
                          className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black"
                        >
                          {createFaqMutation.isPending ? "Creating..." : "Create FAQ"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setShowCreateForm(false)}
                          className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* FAQ List */}
            <div className="space-y-3">
              {faqsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6E6F71] mx-auto"></div>
                  <p className="mt-2 text-[#6E6F71]">Loading FAQs...</p>
                </div>
              ) : faqData.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-[#6E6F71]">No FAQs found</h3>
                  <p className="mt-1 text-sm text-gray-500">Create your first FAQ.</p>
                </div>
              ) : (
                faqData.map((faq: any) => (
                  <Card key={faq.id} className="border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-[#6E6F71] mb-2">{faq.question}</h3>
                          <p className="text-gray-600 text-sm mb-2">{faq.answer}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{faq.category}</Badge>
                            <span className="text-xs text-gray-500">
                              Created {new Date(faq.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button size="sm" variant="outline" className="border-[#6E6F71] text-[#6E6F71]">
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#6E6F71]">Support Management</h2>
          <p className="text-gray-600">Manage customer support tickets, knowledge base, and FAQ</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-100">
          <TabsTrigger value="overview" className="data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tickets" className="data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black">
            <MessageCircle className="w-4 h-4 mr-2" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="knowledge-base" className="data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black">
            <BookOpen className="w-4 h-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="faq" className="data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black">
            <HelpCircle className="w-4 h-4 mr-2" />
            FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewSection />
        </TabsContent>

        <TabsContent value="tickets" className="mt-6">
          <TicketManagementSection />
        </TabsContent>

        <TabsContent value="knowledge-base" className="mt-6">
          <KnowledgeBaseSection />
        </TabsContent>

        <TabsContent value="faq" className="mt-6">
          <FAQSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}