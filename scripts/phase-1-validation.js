#!/usr/bin/env node

/**
 * Phase 1 Foundation Setup Validation Script
 * 
 * This script validates that the support system database foundation is properly set up:
 * - Verifies all support tables exist
 * - Tests table relationships and constraints
 * - Validates enums and data types
 * - Creates initial test data
 */

import { db } from '../server/db.js';
import { 
  supportTickets, 
  ticketResponses, 
  chatSessions, 
  chatMessages, 
  knowledgeBaseArticles, 
  faqs 
} from '../shared/schema.js';
import { sql } from 'drizzle-orm';

console.log('🧪 Phase 1: Foundation Setup Validation');
console.log('=====================================');

async function validatePhase1() {
  try {
    // 1. Verify all support tables exist
    console.log('📋 1. Verifying support system tables...');
    
    const supportTables = [
      'support_tickets',
      'ticket_responses', 
      'chat_sessions',
      'chat_messages',
      'knowledge_base_articles',
      'faqs'
    ];
    
    for (const table of supportTables) {
      try {
        // Direct table check using simple query
        const result = await db.execute(sql.raw(`SELECT 1 FROM ${table} LIMIT 1`));
        console.log(`  ✅ Table ${table} exists and accessible`);
      } catch (error) {
        console.log(`  ❌ Table ${table} error: ${error.message}`);
      }
    }
    
    // 2. Test table structure and enums
    console.log('📊 2. Testing table structure and enums...');
    
    // Test support ticket creation with all enums
    const timestamp = Date.now();
    const testTicket = await db.insert(supportTickets).values({
      title: 'Test Phase 1 Setup',
      description: 'Testing database foundation setup for support system',
      status: 'open',
      priority: 'medium', 
      category: 'technical',
      userId: 'admin-1',
      tenantId: 'eur',
      ticketNumber: `SPT-2025-TEST-${timestamp}`
    }).returning();
    
    console.log(`  ✅ Support ticket created: ${testTicket[0].id}`);
    
    // Test chat session creation
    const testChat = await db.insert(chatSessions).values({
      sessionId: `CHAT-TEST-${timestamp}`,
      userId: 'admin-1',
      status: 'active',
      tenantId: 'eur',
      title: 'Test Chat Session'
    }).returning();
    
    console.log(`  ✅ Chat session created: ${testChat[0].id}`);
    
    // Test knowledge base article creation
    const testArticle = await db.insert(knowledgeBaseArticles).values({
      title: 'Test Article',
      slug: `test-article-phase-1-${timestamp}`,
      content: 'This is a test article for Phase 1 validation',
      excerpt: 'Test article excerpt',
      category: 'getting_started',
      tenantId: 'eur',
      authorId: 'admin-1',
      isPublished: false
    }).returning();
    
    console.log(`  ✅ Knowledge base article created: ${testArticle[0].id}`);
    
    // Test FAQ creation
    const testFaq = await db.insert(faqs).values({
      question: 'How do I test the support system?',
      answer: 'You can test it using this validation script!',
      category: 'technical',
      tenantId: 'eur',
      isPublished: true,
      order: 1
    }).returning();
    
    console.log(`  ✅ FAQ created: ${testFaq[0].id}`);
    
    // 3. Test relationships
    console.log('🔗 3. Testing table relationships...');
    
    // Add ticket response
    const testResponse = await db.insert(ticketResponses).values({
      ticketId: testTicket[0].id,
      userId: 'admin-1',
      message: 'This is a test response to validate relationships',
      isInternal: false
    }).returning();
    
    console.log(`  ✅ Ticket response created: ${testResponse[0].id}`);
    
    // Add chat message  
    const testMessage = await db.insert(chatMessages).values({
      sessionId: testChat[0].id,
      userId: 'admin-1',
      message: 'Test chat message for relationship validation',
      messageType: 'text'
    }).returning();
    
    console.log(`  ✅ Chat message created: ${testMessage[0].id}`);
    
    // 4. Query with relationships to test joins
    console.log('🔍 4. Testing relationship queries...');
    
    const ticketWithResponses = await db.execute(sql`
      SELECT 
        t.id as ticket_id,
        t.title,
        t.status,
        COUNT(r.id) as response_count
      FROM support_tickets t
      LEFT JOIN ticket_responses r ON t.id = r.ticket_id
      WHERE t.id = ${testTicket[0].id}
      GROUP BY t.id, t.title, t.status
    `);
    
    const responseCount = ticketWithResponses[0]?.response_count || 0;
    console.log(`  ✅ Ticket query with relationships: ${responseCount} responses found`);
    
    // 5. Clean up test data
    console.log('🧹 5. Cleaning up test data...');
    
    await db.execute(sql`DELETE FROM chat_messages WHERE session_id = ${testChat[0].id}`);
    await db.execute(sql`DELETE FROM ticket_responses WHERE ticket_id = ${testTicket[0].id}`);
    await db.execute(sql`DELETE FROM support_tickets WHERE id = ${testTicket[0].id}`);
    await db.execute(sql`DELETE FROM chat_sessions WHERE id = ${testChat[0].id}`);
    await db.execute(sql`DELETE FROM knowledge_base_articles WHERE id = ${testArticle[0].id}`);
    await db.execute(sql`DELETE FROM faqs WHERE id = ${testFaq[0].id}`);
    
    console.log('  ✅ Test data cleaned up');
    
    console.log('\n🎉 Phase 1 Foundation Setup Validation COMPLETED');
    console.log('✅ All support system tables created successfully');
    console.log('✅ All enums working correctly');
    console.log('✅ Table relationships functioning properly');
    console.log('✅ Database ready for Phase 2 implementation');
    
    return true;
    
  } catch (error) {
    console.error('❌ Phase 1 validation failed:', error.message);
    console.error(error);
    return false;
  }
}

// Run validation
validatePhase1()
  .then(success => {
    if (success) {
      console.log('\n📋 PHASE 1 STATUS: COMPLETE ✅');
      console.log('Ready to proceed to Phase 2: Support API Development');
    } else {
      console.log('\n📋 PHASE 1 STATUS: FAILED ❌');
      console.log('Please fix issues before proceeding to Phase 2');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Validation script error:', error);
    process.exit(1);
  });