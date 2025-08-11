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
import { db } from '../../db';
import { eq, and, desc, asc, or, like, sql, count } from 'drizzle-orm';
import { z } from 'zod';
import { authenticate, requireRole, authorize, validateRequest, auditLog } from '../../middleware/auth.middleware';
import { tenantAuthMiddleware } from '../../middleware/tenant-auth.middleware';

const router = Router();

// Apply authentication and admin permissions to all admin support routes
router.use(authenticate);
router.use(requireRole('admin', 'super_admin'));

// ====================
// ADMIN SUPPORT TICKETS MANAGEMENT
// ====================

// GET /api/admin/support/tickets - List all tickets (admin view)
router.get('/tickets',
  tenantAuthMiddleware,
  auditLog('admin:support:tickets:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { status, priority, category, assignedTo, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let whereConditions: any[] = [eq(supportTickets.tenantId, tenantId)];
      
      // Apply filters
      if (status) whereConditions.push(eq(supportTickets.status, status));
      if (priority) whereConditions.push(eq(supportTickets.priority, priority));
      if (category) whereConditions.push(eq(supportTickets.category, category));
      if (assignedTo) whereConditions.push(eq(supportTickets.assignedToId, assignedTo));
      
      const tickets = await db
        .select({
          id: supportTickets.id,
          ticketNumber: supportTickets.ticketNumber,
          title: supportTickets.title,
          description: supportTickets.description,
          userId: supportTickets.userId,
          category: supportTickets.category,
          priority: supportTickets.priority,
          status: supportTickets.status,
          assignedToId: supportTickets.assignedToId,
          lastResponseAt: supportTickets.lastResponseAt,
          createdAt: supportTickets.createdAt,
          updatedAt: supportTickets.updatedAt,
          resolvedAt: supportTickets.resolvedAt,
          tenantId: supportTickets.tenantId
        })
        .from(supportTickets)
        .where(and(...whereConditions))
        .orderBy(desc(supportTickets.createdAt))
        .limit(parseInt(limit))
        .offset(offset);
      
      // Get total count for pagination
      const [{ count: totalCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(supportTickets)
        .where(and(...whereConditions));
      
      res.json({
        data: tickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching admin support tickets:', error);
      res.status(500).json({ error: 'Failed to fetch support tickets' });
    }
  }
);

// GET /api/admin/support/tickets/stats - Get ticket statistics
router.get('/tickets/stats',
  tenantAuthMiddleware,
  auditLog('admin:support:tickets:stats'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      
      // Get overall stats
      const [totalTickets] = await db
        .select({ count: sql<number>`count(*)` })
        .from(supportTickets)
        .where(eq(supportTickets.tenantId, tenantId));
      
      // Get stats by status
      const statusStats = await db
        .select({
          status: supportTickets.status,
          count: sql<number>`count(*)`
        })
        .from(supportTickets)
        .where(eq(supportTickets.tenantId, tenantId))
        .groupBy(supportTickets.status);
      
      // Get stats by priority
      const priorityStats = await db
        .select({
          priority: supportTickets.priority,
          count: sql<number>`count(*)`
        })
        .from(supportTickets)
        .where(eq(supportTickets.tenantId, tenantId))
        .groupBy(supportTickets.priority);
      
      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const [recentTickets] = await db
        .select({ count: sql<number>`count(*)` })
        .from(supportTickets)
        .where(and(
          eq(supportTickets.tenantId, tenantId),
          sql`${supportTickets.createdAt} >= ${sevenDaysAgo}`
        ));
      
      // Transform to match expected frontend format
      const stats = {
        total: totalTickets.count || 0,
        open: statusStats.find(s => s.status === 'open')?.count || 0,
        inProgress: statusStats.find(s => s.status === 'in_progress')?.count || 0,
        resolved: statusStats.find(s => s.status === 'resolved')?.count || 0,
        avgResponseTime: "2 hours", // Can be calculated based on actual data
        satisfactionRating: 4.2 // Can be calculated based on actual feedback
      };

      res.json({ data: stats });
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
      res.status(500).json({ error: 'Failed to fetch ticket statistics' });
    }
  }
);

// PUT /api/admin/support/tickets/:id/assign - Assign ticket to admin
router.put('/tickets/:id/assign',
  tenantAuthMiddleware,
  validateRequest({ 
    body: z.object({
      assignedToId: z.string()
    })
  }),
  auditLog('admin:support:tickets:assign'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const ticketId = req.params.id;
      const { assignedToId } = req.body;
      
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
      
      const [updatedTicket] = await db
        .update(supportTickets)
        .set({ 
          assignedToId,
          status: 'in_progress',
          updatedAt: new Date()
        })
        .where(eq(supportTickets.id, ticketId))
        .returning();
      
      res.json({ data: updatedTicket });
    } catch (error) {
      console.error('Error assigning ticket:', error);
      res.status(500).json({ error: 'Failed to assign ticket' });
    }
  }
);

// GET /api/admin/support/tickets/:id/responses - Get responses for specific ticket (admin view)
router.get('/tickets/:id/responses',
  tenantAuthMiddleware,
  auditLog('admin:support:tickets:responses:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const ticketId = req.params.id;
      
      // Verify ticket exists and belongs to tenant
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
      
      // Get responses
      const responses = await db
        .select()
        .from(ticketResponses)
        .where(eq(ticketResponses.ticketId, ticketId))
        .orderBy(asc(ticketResponses.createdAt));
      
      res.json({ data: responses });
    } catch (error) {
      console.error('Error fetching ticket responses:', error);
      res.status(500).json({ error: 'Failed to fetch ticket responses' });
    }
  }
);

// POST /api/admin/support/tickets/:id/responses - Add response to ticket (admin)
router.post('/tickets/:id/responses',
  tenantAuthMiddleware,
  validateRequest({ body: insertTicketResponseSchema.omit({ ticketId: true, userId: true }) }),
  auditLog('admin:support:tickets:responses:create'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      
      // Extract userId with fallback methods (matching other endpoints)
      let userId = null;
      if (req.user && (req.user as any).id) {
        userId = (req.user as any).id;
      } else if (req.user && (req.user as any).userId) {
        userId = (req.user as any).userId;
      } else if (req.session && (req.session as any).passport && (req.session as any).passport.user) {
        userId = (req.session as any).passport.user;
      }
      
      const ticketId = req.params.id;
      
      // Verify ticket exists and belongs to tenant
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
      
      // Create response
      const [response] = await db
        .insert(ticketResponses)
        .values({
          ...req.body,
          ticketId,
          userId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Update ticket's last response timestamp and status if needed
      const updateData: any = { 
        lastResponseAt: new Date(),
        updatedAt: new Date()
      };
      
      // If admin response, set status to in_progress if currently open
      if (ticket.status === 'open') {
        updateData.status = 'in_progress';
      }
      
      await db
        .update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, ticketId));
      
      res.status(201).json({ data: response });
    } catch (error) {
      console.error('Error creating ticket response:', error);
      res.status(500).json({ error: 'Failed to create response' });
    }
  }
);

// ====================
// ADMIN KNOWLEDGE BASE MANAGEMENT
// ====================

// POST /api/admin/support/kb/articles - Create knowledge base article
router.post('/kb/articles',
  tenantAuthMiddleware,
  validateRequest({ body: insertKnowledgeBaseArticleSchema.omit({ authorId: true, tenantId: true }) }),
  auditLog('admin:support:kb:create'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { userId } = req.user;
      
      const [article] = await db
        .insert(knowledgeBaseArticles)
        .values({
          ...req.body,
          authorId: userId,
          tenantId
        })
        .returning();
      
      res.status(201).json({ data: article });
    } catch (error) {
      console.error('Error creating knowledge base article:', error);
      res.status(500).json({ error: 'Failed to create article' });
    }
  }
);

// PUT /api/admin/support/kb/articles/:id - Update knowledge base article
router.put('/kb/articles/:id',
  tenantAuthMiddleware,
  validateRequest({ 
    body: insertKnowledgeBaseArticleSchema
      .omit({ authorId: true, tenantId: true })
      .partial()
  }),
  auditLog('admin:support:kb:update'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const articleId = req.params.id;
      
      // Verify article exists and belongs to tenant
      const [existingArticle] = await db
        .select()
        .from(knowledgeBaseArticles)
        .where(and(
          eq(knowledgeBaseArticles.id, articleId),
          eq(knowledgeBaseArticles.tenantId, tenantId)
        ));
      
      if (!existingArticle) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      const updateData: any = { ...req.body, updatedAt: new Date() };
      
      // Set published timestamp if publishing for first time
      if (req.body.isPublished && !existingArticle.isPublished) {
        updateData.publishedAt = new Date();
      }
      
      const [updatedArticle] = await db
        .update(knowledgeBaseArticles)
        .set(updateData)
        .where(eq(knowledgeBaseArticles.id, articleId))
        .returning();
      
      res.json({ data: updatedArticle });
    } catch (error) {
      console.error('Error updating knowledge base article:', error);
      res.status(500).json({ error: 'Failed to update article' });
    }
  }
);

// DELETE /api/admin/support/kb/articles/:id - Delete knowledge base article
router.delete('/kb/articles/:id',
  tenantAuthMiddleware,
  auditLog('admin:support:kb:delete'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const articleId = req.params.id;
      
      // Verify article exists and belongs to tenant
      const [existingArticle] = await db
        .select()
        .from(knowledgeBaseArticles)
        .where(and(
          eq(knowledgeBaseArticles.id, articleId),
          eq(knowledgeBaseArticles.tenantId, tenantId)
        ));
      
      if (!existingArticle) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      await db
        .delete(knowledgeBaseArticles)
        .where(eq(knowledgeBaseArticles.id, articleId));
      
      res.json({ message: 'Article deleted successfully' });
    } catch (error) {
      console.error('Error deleting knowledge base article:', error);
      res.status(500).json({ error: 'Failed to delete article' });
    }
  }
);

// ====================
// ADMIN FAQ MANAGEMENT
// ====================

// POST /api/admin/support/faqs - Create FAQ
router.post('/faqs',
  tenantAuthMiddleware,
  validateRequest({ body: insertFaqSchema.omit({ tenantId: true }) }),
  auditLog('admin:support:faqs:create'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      
      const [faq] = await db
        .insert(faqs)
        .values({
          ...req.body,
          tenantId
        })
        .returning();
      
      res.status(201).json({ data: faq });
    } catch (error) {
      console.error('Error creating FAQ:', error);
      res.status(500).json({ error: 'Failed to create FAQ' });
    }
  }
);

// PUT /api/admin/support/faqs/:id - Update FAQ
router.put('/faqs/:id',
  tenantAuthMiddleware,
  validateRequest({ 
    body: insertFaqSchema
      .omit({ tenantId: true })
      .partial()
  }),
  auditLog('admin:support:faqs:update'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const faqId = req.params.id;
      
      // Verify FAQ exists and belongs to tenant
      const [existingFaq] = await db
        .select()
        .from(faqs)
        .where(and(
          eq(faqs.id, faqId),
          eq(faqs.tenantId, tenantId)
        ));
      
      if (!existingFaq) {
        return res.status(404).json({ error: 'FAQ not found' });
      }
      
      const [updatedFaq] = await db
        .update(faqs)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(faqs.id, faqId))
        .returning();
      
      res.json({ data: updatedFaq });
    } catch (error) {
      console.error('Error updating FAQ:', error);
      res.status(500).json({ error: 'Failed to update FAQ' });
    }
  }
);

// DELETE /api/admin/support/faqs/:id - Delete FAQ
router.delete('/faqs/:id',
  tenantAuthMiddleware,
  auditLog('admin:support:faqs:delete'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const faqId = req.params.id;
      
      // Verify FAQ exists and belongs to tenant
      const [existingFaq] = await db
        .select()
        .from(faqs)
        .where(and(
          eq(faqs.id, faqId),
          eq(faqs.tenantId, tenantId)
        ));
      
      if (!existingFaq) {
        return res.status(404).json({ error: 'FAQ not found' });
      }
      
      await db
        .delete(faqs)
        .where(eq(faqs.id, faqId));
      
      res.json({ message: 'FAQ deleted successfully' });
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      res.status(500).json({ error: 'Failed to delete FAQ' });
    }
  }
);

// GET /api/admin/support/chat/sessions - List all chat sessions (admin view)
router.get('/chat/sessions',
  tenantAuthMiddleware,
  auditLog('admin:support:chat:sessions:list'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const { status, assignedTo, page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let whereConditions: any[] = [eq(chatSessions.tenantId, tenantId)];
      
      // Apply filters
      if (status) whereConditions.push(eq(chatSessions.status, status));
      if (assignedTo) whereConditions.push(eq(chatSessions.assignedToId, assignedTo));
      
      const sessions = await db
        .select()
        .from(chatSessions)
        .where(and(...whereConditions))
        .orderBy(desc(chatSessions.lastMessageAt))
        .limit(parseInt(limit))
        .offset(offset);
      
      const [{ count: totalCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatSessions)
        .where(and(...whereConditions));
      
      res.json({
        data: sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching admin chat sessions:', error);
      res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }
  }
);

// PUT /api/admin/support/chat/sessions/:id/assign - Assign chat session to admin
router.put('/chat/sessions/:id/assign',
  tenantAuthMiddleware,
  validateRequest({ 
    body: z.object({
      assignedToId: z.string()
    })
  }),
  auditLog('admin:support:chat:assign'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const sessionId = req.params.id;
      const { assignedToId } = req.body;
      
      // Verify session exists and belongs to tenant
      const [existingSession] = await db
        .select()
        .from(chatSessions)
        .where(and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.tenantId, tenantId)
        ));
      
      if (!existingSession) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
      
      const [updatedSession] = await db
        .update(chatSessions)
        .set({ 
          assignedToId,
          status: 'active'
        })
        .where(eq(chatSessions.id, sessionId))
        .returning();
      
      res.json({ data: updatedSession });
    } catch (error) {
      console.error('Error assigning chat session:', error);
      res.status(500).json({ error: 'Failed to assign chat session' });
    }
  }
);

// PATCH /api/admin/support/tickets/:id/resolve - Resolve/close ticket (admin)
router.patch('/tickets/:id/resolve',
  tenantAuthMiddleware,
  validateRequest({ 
    body: z.object({
      resolution: z.string().min(1, "Resolution message is required"),
      status: z.enum(['resolved', 'closed']).default('resolved')
    })
  }),
  auditLog('admin:support:tickets:resolve'),
  async (req: any, res) => {
    try {
      const { tenantId } = req.tenant;
      const ticketId = req.params.id;
      const { resolution, status } = req.body;
      
      // Extract userId with fallback methods (matching other endpoints)
      let userId = null;
      if (req.user && (req.user as any).id) {
        userId = (req.user as any).id;
      } else if (req.user && (req.user as any).userId) {
        userId = (req.user as any).userId;
      } else if (req.session && (req.session as any).passport && (req.session as any).passport.user) {
        userId = (req.session as any).passport.user;
      }
      
      // Verify ticket exists and belongs to tenant
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
      
      // Add resolution response
      const [response] = await db
        .insert(ticketResponses)
        .values({
          ticketId,
          userId,
          message: resolution,
          isInternal: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Update ticket status and set resolved timestamp
      const [updatedTicket] = await db
        .update(supportTickets)
        .set({
          status,
          resolvedAt: new Date(),
          lastResponseAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(supportTickets.id, ticketId))
        .returning();
      
      res.json({ 
        data: {
          ticket: updatedTicket,
          response: response
        }
      });
    } catch (error) {
      console.error('Error resolving ticket:', error);
      res.status(500).json({ error: 'Failed to resolve ticket' });
    }
  }
);

export { router as adminSupportRouter };