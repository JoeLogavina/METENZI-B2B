import { execSync } from 'child_process';
import fs from 'fs';

// Test configuration
const BASE_URL = 'http://localhost:5000';
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'password123'
};
const B2B_CREDENTIALS = {
  username: 'b2bkm',
  password: 'password123'
};

// Test results storage
let testResults = {
  authentication: { pass: 0, fail: 0, tests: [] },
  supportTickets: { pass: 0, fail: 0, tests: [] },
  chatSessions: { pass: 0, fail: 0, tests: [] },
  knowledgeBase: { pass: 0, fail: 0, tests: [] },
  faqs: { pass: 0, fail: 0, tests: [] },
  adminRoutes: { pass: 0, fail: 0, tests: [] }
};

// Helper functions
const logResult = (category, testName, success, details = '') => {
  const status = success ? '✅ PASS' : '❌ FAIL';
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] ${status} - ${category}: ${testName}`);
  if (details) console.log(`   Details: ${details}`);
  
  testResults[category].tests.push({
    name: testName,
    success,
    details,
    timestamp
  });
  
  if (success) {
    testResults[category].pass++;
  } else {
    testResults[category].fail++;
  }
};

// Authentication helpers
let adminCookies = '';
let b2bCookies = '';

const authenticateAdmin = async () => {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(ADMIN_CREDENTIALS),
      redirect: 'manual'
    });
    
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      adminCookies = cookies;
      logResult('authentication', 'Admin Login', true, 'Admin session established');
      return true;
    }
    
    logResult('authentication', 'Admin Login', false, 'No session cookies received');
    return false;
  } catch (error) {
    logResult('authentication', 'Admin Login', false, error.message);
    return false;
  }
};

const authenticateB2B = async () => {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(B2B_CREDENTIALS),
      redirect: 'manual'
    });
    
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      b2bCookies = cookies;
      logResult('authentication', 'B2B User Login', true, 'B2B session established');
      return true;
    }
    
    logResult('authentication', 'B2B User Login', false, 'No session cookies received');
    return false;
  } catch (error) {
    logResult('authentication', 'B2B User Login', false, error.message);
    return false;
  }
};

// API test functions
const testSupportTicketsAPI = async () => {
  console.log('\n🎫 Testing Support Tickets API...');
  
  try {
    // Test: Create support ticket (B2B user)
    const ticketData = {
      subject: 'Test Support Ticket - Phase 2 API Testing',
      message: 'This is a test ticket created during Phase 2 API testing to verify the support system functionality.',
      priority: 'medium',
      category: 'technical'
    };
    
    const createResponse = await fetch(`${BASE_URL}/api/support/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': b2bCookies
      },
      body: JSON.stringify(ticketData)
    });
    
    if (createResponse.ok) {
      const ticket = await createResponse.json();
      logResult('supportTickets', 'Create Ticket', true, `Ticket created with ID: ${ticket.data.id}`);
      
      // Test: List tickets
      const listResponse = await fetch(`${BASE_URL}/api/support/tickets`, {
        headers: { 'Cookie': b2bCookies }
      });
      
      if (listResponse.ok) {
        const tickets = await listResponse.json();
        logResult('supportTickets', 'List Tickets', true, `Found ${tickets.data.length} tickets`);
        
        // Test: Get specific ticket
        if (tickets.data.length > 0) {
          const ticketId = tickets.data[0].id;
          const getResponse = await fetch(`${BASE_URL}/api/support/tickets/${ticketId}`, {
            headers: { 'Cookie': b2bCookies }
          });
          
          if (getResponse.ok) {
            logResult('supportTickets', 'Get Ticket Details', true, `Retrieved ticket: ${ticketId}`);
            
            // Test: Add response to ticket
            const responseData = {
              message: 'This is a test response from Phase 2 API testing.'
            };
            
            const responseResponse = await fetch(`${BASE_URL}/api/support/tickets/${ticketId}/responses`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': b2bCookies
              },
              body: JSON.stringify(responseData)
            });
            
            if (responseResponse.ok) {
              logResult('supportTickets', 'Add Ticket Response', true, 'Response added successfully');
            } else {
              logResult('supportTickets', 'Add Ticket Response', false, `Status: ${responseResponse.status}`);
            }
          } else {
            logResult('supportTickets', 'Get Ticket Details', false, `Status: ${getResponse.status}`);
          }
        }
      } else {
        logResult('supportTickets', 'List Tickets', false, `Status: ${listResponse.status}`);
      }
    } else {
      const errorText = await createResponse.text();
      logResult('supportTickets', 'Create Ticket', false, `Status: ${createResponse.status}, Error: ${errorText}`);
    }
  } catch (error) {
    logResult('supportTickets', 'Support Tickets API Test', false, error.message);
  }
};

const testChatSessionsAPI = async () => {
  console.log('\n💬 Testing Chat Sessions API...');
  
  try {
    // Test: Create chat session
    const sessionData = {
      title: 'Phase 2 API Test Chat Session'
    };
    
    const createResponse = await fetch(`${BASE_URL}/api/support/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': b2bCookies
      },
      body: JSON.stringify(sessionData)
    });
    
    if (createResponse.ok) {
      const session = await createResponse.json();
      logResult('chatSessions', 'Create Chat Session', true, `Session created: ${session.data.sessionId}`);
      
      // Test: List chat sessions
      const listResponse = await fetch(`${BASE_URL}/api/support/chat/sessions`, {
        headers: { 'Cookie': b2bCookies }
      });
      
      if (listResponse.ok) {
        const sessions = await listResponse.json();
        logResult('chatSessions', 'List Chat Sessions', true, `Found ${sessions.data.length} sessions`);
        
        // Test: Send message to chat session
        if (sessions.data.length > 0) {
          const sessionId = sessions.data[0].id;
          const messageData = {
            message: 'Hello, this is a test message from Phase 2 API testing.',
            messageType: 'text'
          };
          
          const messageResponse = await fetch(`${BASE_URL}/api/support/chat/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': b2bCookies
            },
            body: JSON.stringify(messageData)
          });
          
          if (messageResponse.ok) {
            logResult('chatSessions', 'Send Chat Message', true, 'Message sent successfully');
            
            // Test: Get chat messages
            const getMessagesResponse = await fetch(`${BASE_URL}/api/support/chat/sessions/${sessionId}/messages`, {
              headers: { 'Cookie': b2bCookies }
            });
            
            if (getMessagesResponse.ok) {
              const messages = await getMessagesResponse.json();
              logResult('chatSessions', 'Get Chat Messages', true, `Retrieved ${messages.data.length} messages`);
            } else {
              logResult('chatSessions', 'Get Chat Messages', false, `Status: ${getMessagesResponse.status}`);
            }
          } else {
            logResult('chatSessions', 'Send Chat Message', false, `Status: ${messageResponse.status}`);
          }
        }
      } else {
        logResult('chatSessions', 'List Chat Sessions', false, `Status: ${listResponse.status}`);
      }
    } else {
      const errorText = await createResponse.text();
      logResult('chatSessions', 'Create Chat Session', false, `Status: ${createResponse.status}, Error: ${errorText}`);
    }
  } catch (error) {
    logResult('chatSessions', 'Chat Sessions API Test', false, error.message);
  }
};

const testKnowledgeBaseAPI = async () => {
  console.log('\n📚 Testing Knowledge Base API...');
  
  try {
    // Test: List knowledge base articles (as B2B user)
    const listResponse = await fetch(`${BASE_URL}/api/support/kb/articles`, {
      headers: { 'Cookie': b2bCookies }
    });
    
    if (listResponse.ok) {
      const articles = await listResponse.json();
      logResult('knowledgeBase', 'List KB Articles', true, `Found ${articles.data.length} articles`);
      
      // Test: Search articles
      const searchResponse = await fetch(`${BASE_URL}/api/support/kb/articles?search=test`, {
        headers: { 'Cookie': b2bCookies }
      });
      
      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        logResult('knowledgeBase', 'Search KB Articles', true, `Found ${searchResults.data.length} search results`);
      } else {
        logResult('knowledgeBase', 'Search KB Articles', false, `Status: ${searchResponse.status}`);
      }
    } else {
      logResult('knowledgeBase', 'List KB Articles', false, `Status: ${listResponse.status}`);
    }
  } catch (error) {
    logResult('knowledgeBase', 'Knowledge Base API Test', false, error.message);
  }
};

const testFAQsAPI = async () => {
  console.log('\n❓ Testing FAQs API...');
  
  try {
    // Test: List FAQs
    const listResponse = await fetch(`${BASE_URL}/api/support/faqs`, {
      headers: { 'Cookie': b2bCookies }
    });
    
    if (listResponse.ok) {
      const faqs = await listResponse.json();
      logResult('faqs', 'List FAQs', true, `Found ${faqs.data.length} FAQs`);
      
      // Test: Search FAQs
      const searchResponse = await fetch(`${BASE_URL}/api/support/faqs?search=license`, {
        headers: { 'Cookie': b2bCookies }
      });
      
      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        logResult('faqs', 'Search FAQs', true, `Found ${searchResults.data.length} search results`);
      } else {
        logResult('faqs', 'Search FAQs', false, `Status: ${searchResponse.status}`);
      }
    } else {
      logResult('faqs', 'List FAQs', false, `Status: ${listResponse.status}`);
    }
  } catch (error) {
    logResult('faqs', 'FAQs API Test', false, error.message);
  }
};

const testAdminSupportAPI = async () => {
  console.log('\n👨‍💼 Testing Admin Support API...');
  
  try {
    // Test: Admin list all tickets
    const listResponse = await fetch(`${BASE_URL}/api/admin/support/tickets`, {
      headers: { 'Cookie': adminCookies }
    });
    
    if (listResponse.ok) {
      const tickets = await listResponse.json();
      logResult('adminRoutes', 'Admin List All Tickets', true, `Found ${tickets.data.length} tickets`);
      
      // Test: Get ticket statistics
      const statsResponse = await fetch(`${BASE_URL}/api/admin/support/tickets/stats`, {
        headers: { 'Cookie': adminCookies }
      });
      
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        logResult('adminRoutes', 'Get Ticket Statistics', true, `Total tickets: ${stats.data.total}`);
        
        // Test: Admin create knowledge base article
        const articleData = {
          title: 'Phase 2 API Test Article',
          slug: 'phase-2-api-test-article',
          content: 'This is a test knowledge base article created during Phase 2 API testing.',
          excerpt: 'Test article for API validation',
          category: 'technical',
          isPublished: true
        };
        
        const createArticleResponse = await fetch(`${BASE_URL}/api/admin/support/kb/articles`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': adminCookies
          },
          body: JSON.stringify(articleData)
        });
        
        if (createArticleResponse.ok) {
          const article = await createArticleResponse.json();
          logResult('adminRoutes', 'Admin Create KB Article', true, `Article created: ${article.data.id}`);
          
          // Test: Admin create FAQ
          const faqData = {
            question: 'How do I test the Phase 2 support system?',
            answer: 'You can test the Phase 2 support system by running the comprehensive API testing script.',
            category: 'technical',
            isPublished: true
          };
          
          const createFaqResponse = await fetch(`${BASE_URL}/api/admin/support/faqs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': adminCookies
            },
            body: JSON.stringify(faqData)
          });
          
          if (createFaqResponse.ok) {
            logResult('adminRoutes', 'Admin Create FAQ', true, 'FAQ created successfully');
          } else {
            logResult('adminRoutes', 'Admin Create FAQ', false, `Status: ${createFaqResponse.status}`);
          }
        } else {
          logResult('adminRoutes', 'Admin Create KB Article', false, `Status: ${createArticleResponse.status}`);
        }
      } else {
        logResult('adminRoutes', 'Get Ticket Statistics', false, `Status: ${statsResponse.status}`);
      }
    } else {
      logResult('adminRoutes', 'Admin List All Tickets', false, `Status: ${listResponse.status}`);
    }
  } catch (error) {
    logResult('adminRoutes', 'Admin Support API Test', false, error.message);
  }
};

// Main test execution
const runPhase2Testing = async () => {
  console.log('🚀 PHASE 2: SUPPORT API DEVELOPMENT - FULL DEBUG AND TESTING');
  console.log('================================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  
  try {
    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Authenticate users
    console.log('🔐 Authenticating test users...');
    const adminAuth = await authenticateAdmin();
    const b2bAuth = await authenticateB2B();
    
    if (!adminAuth || !b2bAuth) {
      console.log('❌ CRITICAL: Authentication failed. Cannot proceed with API testing.');
      return;
    }
    
    // Run all API tests
    await testSupportTicketsAPI();
    await testChatSessionsAPI();
    await testKnowledgeBaseAPI();
    await testFAQsAPI();
    await testAdminSupportAPI();
    
    // Generate test report
    console.log('\n📊 PHASE 2 API TESTING RESULTS');
    console.log('===============================');
    
    let totalPass = 0;
    let totalFail = 0;
    
    Object.entries(testResults).forEach(([category, results]) => {
      const { pass, fail, tests } = results;
      totalPass += pass;
      totalFail += fail;
      
      console.log(`\n${category.toUpperCase()}:`);
      console.log(`  ✅ Passed: ${pass}`);
      console.log(`  ❌ Failed: ${fail}`);
      console.log(`  📊 Success Rate: ${((pass / (pass + fail)) * 100).toFixed(1)}%`);
    });
    
    console.log(`\n🎯 OVERALL RESULTS:`);
    console.log(`  ✅ Total Passed: ${totalPass}`);
    console.log(`  ❌ Total Failed: ${totalFail}`);
    console.log(`  📊 Overall Success Rate: ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%`);
    
    // Save detailed results
    const reportPath = 'docs/PHASE_2_API_TESTING_REPORT.md';
    const detailedReport = generateDetailedReport(testResults, totalPass, totalFail);
    fs.writeFileSync(reportPath, detailedReport);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    if (totalFail === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Phase 2 Support API Development is ready for Phase 3.');
    } else {
      console.log(`\n⚠️  ${totalFail} tests failed. Review the results and fix issues before proceeding to Phase 3.`);
    }
    
  } catch (error) {
    console.error('💥 CRITICAL ERROR during Phase 2 testing:', error);
  }
  
  console.log(`\nCompleted at: ${new Date().toISOString()}`);
};

const generateDetailedReport = (results, totalPass, totalFail) => {
  const timestamp = new Date().toISOString();
  
  let report = `# Phase 2: Support API Development - Testing Report\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Overall Results:** ${totalPass} passed, ${totalFail} failed\n`;
  report += `**Success Rate:** ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%\n\n`;
  
  report += `## Test Categories\n\n`;
  
  Object.entries(results).forEach(([category, categoryResults]) => {
    const { pass, fail, tests } = categoryResults;
    report += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
    report += `- **Passed:** ${pass}\n`;
    report += `- **Failed:** ${fail}\n`;
    report += `- **Success Rate:** ${((pass / (pass + fail)) * 100).toFixed(1)}%\n\n`;
    
    report += `#### Detailed Results\n\n`;
    tests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      report += `${status} **${test.name}**\n`;
      if (test.details) {
        report += `   - ${test.details}\n`;
      }
      report += `   - Time: ${test.timestamp}\n\n`;
    });
  });
  
  report += `## Next Steps\n\n`;
  if (totalFail === 0) {
    report += `🎉 **ALL TESTS PASSED!** The Phase 2 Support API Development is complete and ready for Phase 3.\n\n`;
    report += `### Phase 3 Recommendations:\n`;
    report += `- Implement frontend support components\n`;
    report += `- Create admin dashboard for support management\n`;
    report += `- Add real-time chat functionality\n`;
    report += `- Implement notification system\n`;
  } else {
    report += `⚠️ **${totalFail} tests failed.** Review and fix the following issues:\n\n`;
    
    Object.entries(results).forEach(([category, categoryResults]) => {
      const failedTests = categoryResults.tests.filter(test => !test.success);
      if (failedTests.length > 0) {
        report += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Issues:\n`;
        failedTests.forEach(test => {
          report += `- **${test.name}:** ${test.details}\n`;
        });
        report += `\n`;
      }
    });
  }
  
  return report;
};

// Run the tests
runPhase2Testing().catch(console.error);