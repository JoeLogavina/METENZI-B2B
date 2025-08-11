import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3,
  Users,
  MessageSquare,
  Plus,
  Search,
  Filter,
  Ticket,
  BookOpen,
  HelpCircle,
  Settings,
  Eye,
  Edit,
  Trash2,
  UserCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  TrendingUp,
  Activity
} from 'lucide-react';

// Form schemas
const createArticleSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  content: z.string().min(50, 'Content must be at least 50 characters'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters'),
  category: z.enum(['getting_started', 'technical', 'billing', 'troubleshooting', 'general']),
  isPublished: z.boolean()
});

const createFaqSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters'),
  answer: z.string().min(10, 'Answer must be at least 10 characters'),
  category: z.enum(['getting_started', 'technical', 'billing', 'general']),
  isPublished: z.boolean()
});

const assignTicketSchema = z.object({
  assignedToId: z.string().min(1, 'Please select an admin'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  priority: z.enum(['low', 'medium', 'high', 'urgent'])
});

type CreateArticleForm = z.infer<typeof createArticleSchema>;
type CreateFaqForm = z.infer<typeof createFaqSchema>;
type AssignTicketForm = z.infer<typeof assignTicketSchema>;

// Statistics cards component
const StatisticsCards = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/admin/support/tickets/stats'],
    retry: false
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-300 rounded w-2/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-300 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = (stats as any)?.data || {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    avgResponseTime: 0
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
          <Ticket className="h-4 w-4 text-gray-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statsData.total}</div>
          <p className="text-xs text-gray-600">All time</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{statsData.open}</div>
          <p className="text-xs text-gray-600">Needs attention</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          <Activity className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{statsData.inProgress}</div>
          <p className="text-xs text-gray-600">Being handled</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{statsData.resolved}</div>
          <p className="text-xs text-gray-600">Completed</p>
        </CardContent>
      </Card>
    </div>
  );
};

// Ticket management component
const TicketManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['/api/admin/support/tickets', { search: searchTerm, status: statusFilter, priority: priorityFilter }],
    retry: false
  });

  const ticketData = (tickets as any)?.data || [];

  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const PriorityBadge = ({ priority }: { priority: string }) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={colors[priority as keyof typeof colors]}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const filteredTickets = ticketData.filter((ticket: any) => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
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
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets table */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket: any) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span>#{ticket.ticketNumber}</span>
                      <span>•</span>
                      <span>{ticket.username || 'Unknown User'}</span>
                      <span>•</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4 line-clamp-2">
                  {ticket.message}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline" className="text-xs">
                      {ticket.category?.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {ticket.assignedToId && (
                      <Badge variant="outline" className="text-xs">
                        <UserCheck className="mr-1 h-3 w-3" />
                        Assigned
                      </Badge>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-4 w-4" />
                      Assign
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredTickets.length === 0 && (
            <div className="text-center p-8">
              <Ticket className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Tickets Found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your search criteria.'
                  : 'No support tickets available.'
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Knowledge base management
const KnowledgeBaseManagement = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<CreateArticleForm>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: {
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      category: 'general',
      isPublished: false
    }
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ['/api/admin/support/kb/articles'],
    retry: false
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
        title: 'Article Created',
        description: 'Knowledge base article has been created successfully.',
      });
      form.reset();
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/support/kb/articles'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create article',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: CreateArticleForm) => {
    createArticleMutation.mutate(data);
  };

  const articleData = (articles as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Knowledge Base Articles</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black">
              <Plus className="mr-2 h-4 w-4" />
              New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Create Knowledge Base Article</DialogTitle>
              <DialogDescription>
                Create a new article to help users find answers to common questions.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Article title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="article-slug" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the article..."
                          className="min-h-[60px]"
                          {...field}
                        />
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
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Full article content..."
                          className="min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="getting_started">Getting Started</SelectItem>
                            <SelectItem value="technical">Technical</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="isPublished"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Published</FormLabel>
                          <div className="text-[0.8rem] text-muted-foreground">
                            Make this article visible to users
                          </div>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createArticleMutation.isPending}
                    className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
                  >
                    {createArticleMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Article
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {articleData.map((article: any) => (
            <Card key={article.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{article.title}</CardTitle>
                    <CardDescription>{article.excerpt}</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={article.isPublished ? "default" : "secondary"}>
                      {article.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                    <Badge variant="outline">
                      {article.category?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>👀 {article.viewCount || 0} views</span>
                    <span>👍 {article.helpfulCount || 0} helpful</span>
                    <span>📅 {new Date(article.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {articleData.length === 0 && (
            <div className="text-center p-8">
              <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Articles Found</h3>
              <p className="text-gray-600">Create your first knowledge base article.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// FAQ management
const FAQManagement = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<CreateFaqForm>({
    resolver: zodResolver(createFaqSchema),
    defaultValues: {
      question: '',
      answer: '',
      category: 'general',
      isPublished: false
    }
  });

  const { data: faqs, isLoading } = useQuery({
    queryKey: ['/api/admin/support/faqs'],
    retry: false
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
        title: 'FAQ Created',
        description: 'FAQ has been created successfully.',
      });
      form.reset();
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/support/faqs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create FAQ',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: CreateFaqForm) => {
    createFaqMutation.mutate(data);
  };

  const faqData = (faqs as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black">
              <Plus className="mr-2 h-4 w-4" />
              New FAQ
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create FAQ</DialogTitle>
              <DialogDescription>
                Add a new frequently asked question and answer.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="question"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question</FormLabel>
                      <FormControl>
                        <Input placeholder="What is your question?" {...field} />
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
                      <FormLabel>Answer</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide a clear and helpful answer..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="getting_started">Getting Started</SelectItem>
                            <SelectItem value="technical">Technical</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="isPublished"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Published</FormLabel>
                          <div className="text-[0.8rem] text-muted-foreground">
                            Make this FAQ visible to users
                          </div>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createFaqMutation.isPending}
                    className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
                  >
                    {createFaqMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create FAQ
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {faqData.map((faq: any) => (
            <Card key={faq.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant={faq.isPublished ? "default" : "secondary"}>
                      {faq.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                    <Badge variant="outline">
                      {faq.category?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">{faq.answer}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>👀 {faq.viewCount || 0} views</span>
                    <span>👍 {faq.helpfulCount || 0} helpful</span>
                    <span>📅 {new Date(faq.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {faqData.length === 0 && (
            <div className="text-center p-8">
              <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No FAQs Found</h3>
              <p className="text-gray-600">Create your first FAQ entry.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main admin support dashboard
export default function AdminSupportDashboard() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage support tickets, knowledge base, and FAQ
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <BarChart3 className="mr-2 h-4 w-4" />
            Reports
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <StatisticsCards />

      {/* Main content tabs */}
      <Tabs defaultValue="tickets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Live Chat
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="faq" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Support Tickets Management</CardTitle>
              <CardDescription>
                View, assign, and manage all support tickets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TicketManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Live Chat Management</CardTitle>
              <CardDescription>
                Monitor and manage live chat sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-8">
                <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Chat Management</h3>
                <p className="text-gray-600">
                  Live chat management interface will be implemented here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Management</CardTitle>
              <CardDescription>
                Create and manage help articles and documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KnowledgeBaseManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>FAQ Management</CardTitle>
              <CardDescription>
                Manage frequently asked questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FAQManagement />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}