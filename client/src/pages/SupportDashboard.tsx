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
  MessageSquare, 
  Plus, 
  Search, 
  Filter, 
  Ticket, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  MessagesSquare,
  BookOpen,
  HelpCircle,
  Send,
  Loader2
} from 'lucide-react';

// Form schemas
const createTicketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.enum(['technical', 'billing', 'general', 'feature_request', 'bug_report'])
});

const createChatSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters')
});

const messageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty')
});

type CreateTicketForm = z.infer<typeof createTicketSchema>;
type CreateChatForm = z.infer<typeof createChatSchema>;
type MessageForm = z.infer<typeof messageSchema>;

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Badge className={getStatusColor(status)}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
};

// Priority badge component
const PriorityBadge = ({ priority }: { priority: string }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Badge className={getPriorityColor(priority)}>
      {priority.toUpperCase()}
    </Badge>
  );
};

// Create ticket dialog
const CreateTicketDialog = ({ onSuccess }: { onSuccess: () => void }) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      subject: '',
      message: '',
      priority: 'medium',
      category: 'general'
    }
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: CreateTicketForm) => {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create ticket: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Ticket Created',
        description: 'Your support ticket has been created successfully.',
      });
      form.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create ticket',
        variant: 'destructive',
      });
    }
  });

  const onSubmit = (data: CreateTicketForm) => {
    createTicketMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-corporate-gray hover:bg-corporate-gray/90">
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue and we'll help you resolve it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of your issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="feature_request">Feature Request</SelectItem>
                        <SelectItem value="bug_report">Bug Report</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Please provide detailed information about your issue..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTicketMutation.isPending}
                className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
              >
                {createTicketMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Ticket
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Support tickets list
const SupportTicketsList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['/api/support/tickets', { search: searchTerm, status: statusFilter }],
    retry: false
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading tickets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to Load Tickets</h3>
        <p className="text-gray-600 dark:text-gray-400">
          {error instanceof Error ? error.message : 'Please check your connection and try again.'}
        </p>
      </div>
    );
  }

  const ticketData = (tickets as any)?.data || [];

  const filteredTickets = ticketData.filter((ticket: any) => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
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
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets list */}
      {filteredTickets.length === 0 ? (
        <div className="text-center p-8">
          <Ticket className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Tickets Found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'You haven\'t created any support tickets yet.'
            }
          </p>
          <CreateTicketDialog onSuccess={() => {}} />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket: any) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                      <span>#{ticket.ticketNumber}</span>
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
                <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-2">
                  {ticket.message}
                </p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {ticket.category.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Live chat component
const LiveChatComponent = () => {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/support/chat/sessions'],
    retry: false
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/support/chat/sessions', selectedSession, 'messages'],
    enabled: !!selectedSession,
    retry: false
  });

  const createSessionMutation = useMutation({
    mutationFn: async (data: CreateChatForm) => {
      const response = await fetch('/api/support/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create chat session: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Chat Started',
        description: 'Your chat session has been created.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/support/chat/sessions'] });
    }
  });

  const sessionData = (sessions as any)?.data || [];
  const messageData = (messages as any)?.data || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
      {/* Chat sessions list */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Chat Sessions</CardTitle>
            <Button
              size="sm"
              onClick={() => createSessionMutation.mutate({ title: 'New Chat Session' })}
              disabled={createSessionMutation.isPending}
              className="bg-spanish-yellow hover:bg-spanish-yellow/90 text-black"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            {sessionsLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : sessionData.length === 0 ? (
              <div className="text-center p-4">
                <MessagesSquare className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">No chat sessions</p>
              </div>
            ) : (
              sessionData.map((session: any) => (
                <div
                  key={session.id}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    selectedSession === session.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => setSelectedSession(session.id)}
                >
                  <div className="font-medium text-sm">{session.title}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {new Date(session.startedAt).toLocaleString()}
                  </div>
                  <StatusBadge status={session.status} />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat messages */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedSession ? 'Chat Messages' : 'Select a Chat Session'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedSession ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="text-center">
                <MessagesSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Select a chat session to view messages
                </p>
              </div>
            </div>
          ) : messagesLoading ? (
            <div className="flex justify-center items-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 h-[400px] overflow-y-auto">
              {messageData.map((message: any) => (
                <div
                  key={message.id}
                  className={`flex ${message.userId === 'current-user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg ${
                      message.userId === 'current-user'
                        ? 'bg-spanish-yellow text-black'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    <p className="text-sm">{message.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Knowledge base browser
const KnowledgeBaseBrowser = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const { data: articles, isLoading } = useQuery({
    queryKey: ['/api/support/kb/articles', { search: searchTerm, category: categoryFilter }],
    retry: false
  });

  const articleData = (articles as any)?.data || [];

  const filteredArticles = articleData.filter((article: any) => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search knowledge base..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="getting_started">Getting Started</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
            <SelectItem value="troubleshooting">Troubleshooting</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="text-center p-8">
          <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Articles Found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || categoryFilter !== 'all' 
              ? 'Try adjusting your search criteria.'
              : 'No knowledge base articles are available yet.'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredArticles.map((article: any) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{article.title}</CardTitle>
                    <CardDescription>{article.excerpt}</CardDescription>
                  </div>
                  <Badge variant="outline">
                    {article.category.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>👀 {article.viewCount || 0} views</span>
                    <span>👍 {article.helpfulCount || 0} helpful</span>
                  </div>
                  <Button variant="outline" size="sm">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Read Article
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// FAQ component
const FAQComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: faqs, isLoading } = useQuery({
    queryKey: ['/api/support/faqs', { search: searchTerm }],
    retry: false
  });

  const faqData = (faqs as any)?.data || [];

  const filteredFaqs = faqData.filter((faq: any) =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search frequently asked questions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="text-center p-8">
          <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No FAQs Found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm 
              ? 'Try different search terms or browse our knowledge base.'
              : 'No frequently asked questions are available yet.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFaqs.map((faq: any) => (
            <Card key={faq.id}>
              <CardHeader>
                <CardTitle className="text-lg">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {faq.answer}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>👀 {faq.viewCount || 0} views</span>
                    <span>👍 {faq.helpfulCount || 0} helpful</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      👍 Helpful
                    </Button>
                    <Button variant="outline" size="sm">
                      👎 Not Helpful
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// Main support dashboard component
export default function SupportDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTicketCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support Center</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Get help with your account, products, and services
          </p>
        </div>
        <CreateTicketDialog onSuccess={handleTicketCreated} />
      </div>

      <Tabs defaultValue="tickets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            Support Tickets
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessagesSquare className="h-4 w-4" />
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
              <CardTitle>Your Support Tickets</CardTitle>
              <CardDescription>
                View and manage your support requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupportTicketsList key={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Live Chat Support</CardTitle>
              <CardDescription>
                Chat with our support team in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LiveChatComponent />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>
                Browse helpful articles and guides
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KnowledgeBaseBrowser />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Quick answers to common questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FAQComponent />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}