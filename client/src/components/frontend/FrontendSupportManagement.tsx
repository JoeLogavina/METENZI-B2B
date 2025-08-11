import React, { useState } from 'react';
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
import { isUnauthorizedError } from '@/lib/authUtils';
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
  Loader2,
  Users,
  TrendingUp,
  MessageCircle
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

export function FrontendSupportManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Statistics query  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/support/tickets/stats'],
    retry: false
  });

  // Tickets query
  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['/api/support/tickets'],
    retry: false
  });

  // Filtered tickets for display
  const filteredTickets = React.useMemo(() => {
    if (!tickets?.data) return [];
    
    return tickets.data.filter((ticket: any) => {
      const matchesSearch = !searchTerm || 
        ticket.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets?.data, searchTerm, statusFilter, priorityFilter]);

  // Knowledge base articles query
  const { data: kbArticles, isLoading: kbLoading } = useQuery({
    queryKey: ['/api/support/kb/articles'],
    retry: false
  });

  // FAQs query
  const { data: faqs, isLoading: faqsLoading } = useQuery({
    queryKey: ['/api/support/faqs'],
    retry: false
  });

  // Create ticket form
  const createTicketForm = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      subject: '',
      message: '',
      priority: 'medium',
      category: 'general'
    }
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: CreateTicketForm) => {
      await apiRequest('POST', '/api/support/tickets', data);
    },
    onSuccess: () => {
      toast({
        title: 'Ticket Created',
        description: 'Your support ticket has been created successfully.',
      });
      createTicketForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets/stats'] });
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to create ticket',
        variant: 'destructive'
      });
    }
  });

  const onCreateTicket = (data: CreateTicketForm) => {
    createTicketMutation.mutate(data);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[#6E6F71] uppercase tracking-[0.5px]">
            Support Center
          </h2>
          <p className="text-gray-600 mt-1">
            Get help with your B2B platform experience
          </p>
        </div>
      </div>

      {/* Support Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger 
            value="overview" 
            className="flex items-center gap-2 data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black"
          >
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="tickets" 
            className="flex items-center gap-2 data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black"
          >
            <Ticket className="w-4 h-4" />
            My Tickets
          </TabsTrigger>
          <TabsTrigger 
            value="knowledge-base" 
            className="flex items-center gap-2 data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black"
          >
            <BookOpen className="w-4 h-4" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger 
            value="faq" 
            className="flex items-center gap-2 data-[state=active]:bg-[#FFB20F] data-[state=active]:text-black"
          >
            <HelpCircle className="w-4 h-4" />
            FAQ
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Statistics Cards */}
            <Card className="border-[#6E6F71]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#6E6F71] flex items-center">
                  <Ticket className="w-4 h-4 mr-2" />
                  Total Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#FFB20F]">
                  {statsLoading ? '...' : ((stats as any)?.data?.totalTickets || '0')}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#6E6F71]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#6E6F71] flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Open Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {statsLoading ? '...' : ((stats as any)?.data?.openTickets || '0')}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#6E6F71]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#6E6F71] flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Resolved Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {statsLoading ? '...' : ((stats as any)?.data?.resolvedTickets || '0')}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="border-[#6E6F71]">
            <CardHeader>
              <CardTitle className="text-[#6E6F71]">Quick Actions</CardTitle>
              <CardDescription>
                Common support actions to get you started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black font-medium h-auto p-4 justify-start">
                      <Plus className="w-5 h-5 mr-3" />
                      <div className="text-left">
                        <div className="font-semibold">Create New Ticket</div>
                        <div className="text-sm opacity-70">Get help with specific issues</div>
                      </div>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="text-[#6E6F71] uppercase tracking-[0.5px]">
                        Create Support Ticket
                      </DialogTitle>
                      <DialogDescription>
                        Describe your issue and we'll help you resolve it
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Form {...createTicketForm}>
                      <form onSubmit={createTicketForm.handleSubmit(onCreateTicket)} className="space-y-4">
                        <FormField
                          control={createTicketForm.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#6E6F71] font-medium">Subject</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Brief description of your issue" 
                                  className="border-[#6E6F71]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={createTicketForm.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#6E6F71] font-medium">Priority</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="border-[#6E6F71]">
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
                            control={createTicketForm.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[#6E6F71] font-medium">Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="border-[#6E6F71]">
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
                          control={createTicketForm.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[#6E6F71] font-medium">Message</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Detailed description of your issue..." 
                                  className="min-h-[120px] border-[#6E6F71]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => createTicketForm.reset()}
                            className="border-[#6E6F71] text-[#6E6F71]"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createTicketMutation.isPending}
                            className="bg-[#FFB20F] hover:bg-[#e6a00e] text-black font-medium"
                          >
                            {createTicketMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              'Create Ticket'
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                <Button 
                  variant="outline" 
                  className="border-[#6E6F71] text-[#6E6F71] hover:bg-[#6E6F71] hover:text-white h-auto p-4 justify-start"
                  onClick={() => setActiveTab("knowledge-base")}
                >
                  <BookOpen className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-semibold">Browse Knowledge Base</div>
                    <div className="text-sm opacity-70">Find answers to common questions</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-6">
          <Card className="border-[#6E6F71]">
            <CardHeader>
              <CardTitle className="text-[#6E6F71] flex items-center">
                <Ticket className="w-5 h-5 mr-2" />
                My Support Tickets
              </CardTitle>
              <CardDescription>
                View and manage your support requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search tickets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-[#6E6F71] pl-10"
                    />
                  </div>
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

              {/* Debug Info */}
              <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
                <strong>Debug:</strong> 
                Loading: {ticketsLoading ? 'true' : 'false'} | 
                Raw tickets: {tickets ? JSON.stringify(tickets).substring(0, 100) + '...' : 'null'} |
                Filtered: {filteredTickets?.length || 0} tickets
              </div>

              {/* Tickets List */}
              {ticketsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading tickets...
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTickets && filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket: any) => (
                      <Card key={ticket.id} className="border-l-4 border-l-[#FFB20F]">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-[#6E6F71] mb-2">
                                #{ticket.ticketNumber} - {ticket.title || ticket.subject}
                              </h3>
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {ticket.description || ticket.message}
                              </p>
                              <div className="flex items-center gap-4">
                                <StatusBadge status={ticket.status} />
                                <PriorityBadge priority={ticket.priority} />
                                <span className="text-sm text-gray-500">
                                  {new Date(ticket.createdAt).toLocaleDateString()}
                                </span>
                                <span className="text-sm text-gray-500 capitalize">
                                  {ticket.category?.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No tickets found</p>
                      <p className="text-sm text-gray-500">Create your first support ticket to get started</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge-base" className="space-y-6">
          <Card className="border-[#6E6F71]">
            <CardHeader>
              <CardTitle className="text-[#6E6F71] flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                Knowledge Base
              </CardTitle>
              <CardDescription>
                Browse helpful articles and guides
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kbLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading articles...
                </div>
              ) : (
                <div className="space-y-4">
                  {(kbArticles as any)?.data && (kbArticles as any).data.length > 0 ? (
                    (kbArticles as any).data.map((article: any) => (
                      <Card key={article.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-[#6E6F71] mb-2">
                            {article.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {article.excerpt}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[#6E6F71] border-[#6E6F71]">
                              {article.category?.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {new Date(article.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No articles available</p>
                      <p className="text-sm text-gray-500">Knowledge base articles will appear here</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-6">
          <Card className="border-[#6E6F71]">
            <CardHeader>
              <CardTitle className="text-[#6E6F71] flex items-center">
                <HelpCircle className="w-5 h-5 mr-2" />
                Frequently Asked Questions
              </CardTitle>
              <CardDescription>
                Common questions and answers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {faqsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Loading FAQs...
                </div>
              ) : (
                <div className="space-y-4">
                  {(faqs as any)?.data && (faqs as any).data.length > 0 ? (
                    (faqs as any).data.map((faq: any) => (
                      <Card key={faq.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-[#6E6F71] mb-2">
                            {faq.question}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            {faq.answer}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[#6E6F71] border-[#6E6F71]">
                              {faq.category?.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {new Date(faq.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No FAQs available</p>
                      <p className="text-sm text-gray-500">Frequently asked questions will appear here</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}