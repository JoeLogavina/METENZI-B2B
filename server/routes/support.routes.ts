import { Router } from 'express';
import { 
  supportTickets, 
  ticketResponses, 
  chatSessions, 
  chatMessages, 
  knowledgeBaseArticles, 
  faqs,
  insertSupportTicketSchema,
  insertTicketResponseSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertKnowledgeBaseArticleSchema,
  insertFaqSchema
} from '@shared/schema';
import { db } from '../db';
import { eq, and, desc, asc, or, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authenticate, requireRole, authorize, validateRequest, auditLog } from '../middleware/auth.middleware';
import { tenantAuthMiddleware } from '../middleware/tenant-auth.middleware';

const router = Router();

// Apply authentication to all support routes
router.use(authenticate);

// ====================
// SUPPORT TICKETS API
// ====================

// GET /api/support/tickets - List tickets for current user/tenant
router.get('/tickets', 
  tenantAuthMiddleware,
  auditLog('support:tickets:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId, role } = req.user;
      
      // Query parameters for filtering
      const { status, priority, category, page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Build WHERE conditions
      let whereConditions: any[] = [eq(supportTickets.tenantId, tenantId)];
      
      // Non-admin users can only see their own tickets
      if (role !== 'super_admin' && role !== 'admin') {
        whereConditions.push(eq(supportTickets.userId, userId));
      }
      
      // Apply filters
      if (status) whereConditions.push(eq(supportTickets.status, status));
      if (priority) whereConditions.push(eq(supportTickets.priority, priority));
      if (category) whereConditions.push(eq(supportTickets.category, category));
      
      const tickets = await db
        .select()
        .from(supportTickets)
        .where(and(...whereConditions))
        .orderBy(desc(supportTickets.createdAt))
        .limit(parseInt(limit))
        .offset(offset);
      
      // Get total count for pagination
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(supportTickets)
        .where(and(...whereConditions));
      
      res.json({
        data: tickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      res.status(500).json({ error: 'Failed to fetch support tickets' });
    }
  }
);

// POST /api/support/tickets - Create new support ticket
router.post('/tickets',
  tenantAuthMiddleware,
  validateRequest({ body: insertSupportTicketSchema.omit({ ticketNumber: true, userId: true, tenantId: true }) }),
  auditLog('support:tickets:create'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId } = req.user;
      
      // Generate ticket number
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const ticketNumber = `SPT-${timestamp}-${randomSuffix}`;
      
      const [ticket] = await db
        .insert(supportTickets)
        .values({
          ...req.body,
          ticketNumber,
          userId,
          tenantId
        })
        .returning();
      
      res.status(201).json({ data: ticket });
    } catch (error) {
      console.error('Error creating support ticket:', error);
      res.status(500).json({ error: 'Failed to create support ticket' });
    }
  }
);

// GET /api/support/tickets/:id - Get specific ticket with responses
router.get('/tickets/:id',
  tenantAuthMiddleware,
  auditLog('support:tickets:view'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId, role } = req.user;
      const ticketId = req.params.id;
      
      // Get ticket
      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketId));
      
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      // Check permissions
      if (ticket.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      if (role !== 'super_admin' && role !== 'admin' && ticket.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get responses
      const responses = await db
        .select()
        .from(ticketResponses)
        .where(eq(ticketResponses.ticketId, ticketId))
        .orderBy(asc(ticketResponses.createdAt));
      
      res.json({
        data: {
          ticket,
          responses
        }
      });
    } catch (error) {
      console.error('Error fetching ticket:', error);
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  }
);

// PUT /api/support/tickets/:id - Update ticket (admin only for status changes)
router.put('/tickets/:id',
  tenantAuthMiddleware,
  requireRole('admin', 'super_admin'),
  validateRequest({ 
    body: z.object({
      status: z.enum(['open', 'in_progress', 'pending', 'resolved', 'closed']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      assignedToId: z.string().optional()
    })
  }),
  auditLog('support:tickets:update'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const ticketId = req.params.id;
      
      // Verify ticket exists and belongs to tenant
      const [existingTicket] = await db
        .select()
        .from(supportTickets)
        .where(and(
          eq(supportTickets.id, ticketId),
          eq(supportTickets.tenantId, tenantId)
        ));
      
      if (!existingTicket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      const updateData: any = { ...req.body, updatedAt: new Date() };
      
      // Set resolved timestamp if status is resolved
      if (req.body.status === 'resolved' && existingTicket.status !== 'resolved') {
        updateData.resolvedAt = new Date();
      }
      
      const [updatedTicket] = await db
        .update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, ticketId))
        .returning();
      
      res.json({ data: updatedTicket });
    } catch (error) {
      console.error('Error updating ticket:', error);
      res.status(500).json({ error: 'Failed to update ticket' });
    }
  }
);

// POST /api/support/tickets/:id/responses - Add response to ticket
router.post('/tickets/:id/responses',
  tenantAuthMiddleware,
  validateRequest({ body: insertTicketResponseSchema.omit({ ticketId: true, userId: true }) }),
  auditLog('support:tickets:respond'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId, role } = req.user;
      const ticketId = req.params.id;
      
      // Verify ticket exists and user has access
      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(and(
          eq(supportTickets.id, ticketId),
          eq(supportTickets.tenantId, tenantId)
        ));
      
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      // Check permissions
      if (role !== 'super_admin' && role !== 'admin' && ticket.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const [response] = await db
        .insert(ticketResponses)
        .values({
          ...req.body,
          ticketId,
          userId
        })
        .returning();
      
      // Update ticket's lastResponseAt
      await db
        .update(supportTickets)
        .set({ 
          lastResponseAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(supportTickets.id, ticketId));
      
      res.status(201).json({ data: response });
    } catch (error) {
      console.error('Error creating ticket response:', error);
      res.status(500).json({ error: 'Failed to create response' });
    }
  }
);

// ====================
// CHAT SESSIONS API
// ====================

// GET /api/support/chat/sessions - List chat sessions
router.get('/chat/sessions',
  tenantAuthMiddleware,
  auditLog('support:chat:sessions:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId, role } = req.user;
      
      let whereConditions: any[] = [eq(chatSessions.tenantId, tenantId)];
      
      // Non-admin users can only see their own sessions
      if (role !== 'super_admin' && role !== 'admin') {
        whereConditions.push(eq(chatSessions.userId, userId));
      }
      
      const sessions = await db
        .select()
        .from(chatSessions)
        .where(and(...whereConditions))
        .orderBy(desc(chatSessions.lastMessageAt));
      
      res.json({ data: sessions });
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }
  }
);

// POST /api/support/chat/sessions - Create new chat session
router.post('/chat/sessions',
  tenantAuthMiddleware,
  validateRequest({ body: insertChatSessionSchema.omit({ sessionId: true, userId: true, tenantId: true }) }),
  auditLog('support:chat:sessions:create'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId } = req.user;
      
      const sessionId = `CHAT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const [session] = await db
        .insert(chatSessions)
        .values({
          ...req.body,
          sessionId,
          userId,
          tenantId
        })
        .returning();
      
      res.status(201).json({ data: session });
    } catch (error) {
      console.error('Error creating chat session:', error);
      res.status(500).json({ error: 'Failed to create chat session' });
    }
  }
);

// GET /api/support/chat/sessions/:id/messages - Get messages for chat session
router.get('/chat/sessions/:id/messages',
  tenantAuthMiddleware,
  auditLog('support:chat:messages:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId, role } = req.user;
      const sessionId = req.params.id;
      
      // Verify session exists and user has access
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.tenantId, tenantId)
        ));
      
      if (!session) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
      
      // Check permissions
      if (role !== 'super_admin' && role !== 'admin' && session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt));
      
      res.json({ data: messages });
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  }
);

// POST /api/support/chat/sessions/:id/messages - Send message to chat session
router.post('/chat/sessions/:id/messages',
  tenantAuthMiddleware,
  validateRequest({ body: insertChatMessageSchema.omit({ sessionId: true, userId: true }) }),
  auditLog('support:chat:messages:send'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId, role } = req.user;
      const sessionId = req.params.id;
      
      // Verify session exists and user has access
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.tenantId, tenantId)
        ));
      
      if (!session) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
      
      // Check permissions
      if (role !== 'super_admin' && role !== 'admin' && session.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const [message] = await db
        .insert(chatMessages)
        .values({
          ...req.body,
          sessionId,
          userId
        })
        .returning();
      
      // Update session's lastMessageAt
      await db
        .update(chatSessions)
        .set({ lastMessageAt: new Date() })
        .where(eq(chatSessions.id, sessionId));
      
      res.status(201).json({ data: message });
    } catch (error) {
      console.error('Error sending chat message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// ====================
// KNOWLEDGE BASE API
// ====================

// GET /api/support/kb/articles - List published knowledge base articles
router.get('/kb/articles',
  tenantAuthMiddleware,
  auditLog('support:kb:articles:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { role } = req.user;
      const { category, search, page = 1, limit = 10 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let whereConditions: any[] = [eq(knowledgeBaseArticles.tenantId, tenantId)];
      
      // Non-admin users can only see published articles
      if (role !== 'super_admin' && role !== 'admin') {
        whereConditions.push(eq(knowledgeBaseArticles.isPublished, true));
      }
      
      // Apply filters
      if (category) whereConditions.push(eq(knowledgeBaseArticles.category, category));
      if (search) {
        whereConditions.push(
          or(
            like(knowledgeBaseArticles.title, `%${search}%`),
            like(knowledgeBaseArticles.content, `%${search}%`)
          )
        );
      }
      
      const articles = await db
        .select()
        .from(knowledgeBaseArticles)
        .where(and(...whereConditions))
        .orderBy(desc(knowledgeBaseArticles.createdAt))
        .limit(parseInt(limit))
        .offset(offset);
      
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(knowledgeBaseArticles)
        .where(and(...whereConditions));
      
      res.json({
        data: articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching knowledge base articles:', error);
      res.status(500).json({ error: 'Failed to fetch articles' });
    }
  }
);

// GET /api/support/kb/articles/:slug - Get specific article by slug
router.get('/kb/articles/:slug',
  tenantAuthMiddleware,
  auditLog('support:kb:articles:view'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { role } = req.user;
      const slug = req.params.slug;
      
      let whereConditions: any[] = [
        eq(knowledgeBaseArticles.slug, slug),
        eq(knowledgeBaseArticles.tenantId, tenantId)
      ];
      
      // Non-admin users can only see published articles
      if (role !== 'super_admin' && role !== 'admin') {
        whereConditions.push(eq(knowledgeBaseArticles.isPublished, true));
      }
      
      const [article] = await db
        .select()
        .from(knowledgeBaseArticles)
        .where(and(...whereConditions));
      
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      // Increment view count
      await db
        .update(knowledgeBaseArticles)
        .set({ 
          viewCount: sql`${knowledgeBaseArticles.viewCount} + 1`
        })
        .where(eq(knowledgeBaseArticles.id, article.id));
      
      res.json({ data: article });
    } catch (error) {
      console.error('Error fetching knowledge base article:', error);
      res.status(500).json({ error: 'Failed to fetch article' });
    }
  }
);

// ====================
// FAQ API
// ====================

// GET /api/support/faqs - List published FAQs
router.get('/faqs',
  tenantAuthMiddleware,
  auditLog('support:faqs:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { role } = req.user;
      const { category, search } = req.query;
      
      let whereConditions: any[] = [eq(faqs.tenantId, tenantId)];
      
      // Non-admin users can only see published FAQs
      if (role !== 'super_admin' && role !== 'admin') {
        whereConditions.push(eq(faqs.isPublished, true));
      }
      
      // Apply filters
      if (category) whereConditions.push(eq(faqs.category, category));
      if (search) {
        whereConditions.push(
          or(
            like(faqs.question, `%${search}%`),
            like(faqs.answer, `%${search}%`)
          )
        );
      }
      
      const faqList = await db
        .select()
        .from(faqs)
        .where(and(...whereConditions))
        .orderBy(asc(faqs.order), desc(faqs.createdAt));
      
      res.json({ data: faqList });
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      res.status(500).json({ error: 'Failed to fetch FAQs' });
    }
  }
);

// POST /api/support/faqs/:id/helpful - Mark FAQ as helpful
router.post('/faqs/:id/helpful',
  tenantAuthMiddleware,
  auditLog('support:faqs:helpful'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const faqId = req.params.id;
      
      const [faq] = await db
        .select()
        .from(faqs)
        .where(and(
          eq(faqs.id, faqId),
          eq(faqs.tenantId, tenantId)
        ));
      
      if (!faq) {
        return res.status(404).json({ error: 'FAQ not found' });
      }
      
      await db
        .update(faqs)
        .set({ 
          helpfulCount: sql`${faqs.helpfulCount} + 1`,
          viewCount: sql`${faqs.viewCount} + 1`
        })
        .where(eq(faqs.id, faqId));
      
      res.json({ message: 'FAQ marked as helpful' });
    } catch (error) {
      console.error('Error marking FAQ as helpful:', error);
      res.status(500).json({ error: 'Failed to mark FAQ as helpful' });
    }
  }
);

// POST /api/support/faqs/:id/not-helpful - Mark FAQ as not helpful
router.post('/faqs/:id/not-helpful',
  tenantAuthMiddleware,
  auditLog('support:faqs:not-helpful'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const faqId = req.params.id;
      
      const [faq] = await db
        .select()
        .from(faqs)
        .where(and(
          eq(faqs.id, faqId),
          eq(faqs.tenantId, tenantId)
        ));
      
      if (!faq) {
        return res.status(404).json({ error: 'FAQ not found' });
      }
      
      await db
        .update(faqs)
        .set({ 
          notHelpfulCount: sql`${faqs.notHelpfulCount} + 1`,
          viewCount: sql`${faqs.viewCount} + 1`
        })
        .where(eq(faqs.id, faqId));
      
      res.json({ message: 'FAQ marked as not helpful' });
    } catch (error) {
      console.error('Error marking FAQ as not helpful:', error);
      res.status(500).json({ error: 'Failed to mark FAQ as not helpful' });
    }
  }
);

export { router as supportRouter };